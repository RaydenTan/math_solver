from flask import Flask, render_template, request, jsonify, send_file
import ast
import math
import random
import re
from dataclasses import dataclass
from pathlib import Path
import sympy as sp


app = Flask(__name__)
PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------
# CONSTANTS AND LIMITS
# ---------------------------------------------------------

CONSTANTS = {
    "pi": sp.pi,
    "e": sp.E,
    "i": sp.I,
    "tau": 2 * sp.pi,
    "φ": (1 + sp.sqrt(5)) / 2,
    "x": sp.Symbol("x"),
    "y": sp.Symbol("y"),
    "z": sp.Symbol("z"),
    "t": sp.Symbol("t"),
}

MAX_EXPRESSION_LENGTH = 200
MAX_AST_NODES = 100
MAX_EXPONENT = 1000
MAX_ROOT_DEGREE = 1000
MAX_INTEGER_FUNCTION_INPUT = 10**100
MAX_ALGEBRA_EQUATIONS = 12
MAX_ALGEBRA_EXPRESSION_LENGTH = 300
MAX_ALGEBRA_TOTAL_LENGTH = 1800
MAX_ALGEBRA_VARIABLES = 12
MAX_ALGEBRA_EXPONENT = 100

ALGEBRA_FUNCTIONS = {
    "sqrt", "cbrt", "root", "square", "cube", "exp", "ln", "log",
    "log2", "log10", "abs", "sin", "cos", "tan", "sec", "csc", "cot",
    "asin", "acos", "atan", "sinh", "cosh", "tanh", "asinh", "acosh",
    "atanh", "sech", "csch", "coth", "asech", "acsch", "acoth", "sinc",
    "sinhc", "versin", "vercosin", "coversin", "haversin", "havercos",
    "versinh", "vercosh", "sinc_pi", "sinc_deg", "sin_deg", "acot",
    "asec", "acsc", "floor", "ceil", "ceiling", "factor", "factor_terms",
    "expand", "simplify", "cancel", "together", "apart", "trigsimp",
    "powsimp", "radsimp", "collect",
}


@dataclass(frozen=True)
class BaseAnswer:
    text: str
    expression: str


# ---------------------------------------------------------
# SYMBOL NORMALISATION
# Converts calculator symbols into safe Python-AST syntax.
# This does NOT evaluate user input.
# ---------------------------------------------------------

SUPERSCRIPT_TO_NORMAL = str.maketrans({
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "⁻": "-",
})

# A root argument can be a parenthesised expression, a number,
# or a simple name such as x or pi.
ROOT_ARGUMENT = (
    r"(?:\([^()]*\)|(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_]\w*)"
)


def insert_implicit_multiplication(expression):
    """
    Allow calculator-style multiplication such as:
    (2)(3), 2(3), (2+1)4, 2pi, 3sin(30), and pi(2).

    Function-name followed by '(' remains a function call.
    """
    # A number or closing parenthesis followed by an opening
    # parenthesis, number, or known name means multiplication.
    expression = re.sub(
        r'(?<![A-Za-z_0-9])(\d+(?:\.\d*)?|\.\d+)\s*(?=\()',
        r'\1*',
        expression,
    )
    expression = re.sub(
        r'(?<=\))\s*(?=[0-9A-Za-z_(])',
        '*',
        expression,
    )

    # Number immediately followed by a named constant/function.
    names = (
        r'(?:pi|tau|phi|e|i|sin|cos|tan|sec|csc|cot|'
        r'asin|acos|atan|sinh|cosh|tanh|asinh|acosh|atanh|'
        r'sqrt|cbrt|root|log|log2|log10|ln|abs|floor|ceil|'
        r'factorial|ncr|npr|hcf|gcd|lcm|mod|min|max|count|sum|mean|median|'
        r'mode|range|stdev|pstdev|variance|pvariance|q1|q3|iqr|'
        r'sum_squares|geometric_mean|harmonic_mean|mean_deviation|mad|'
        r'rms|coefficient_variation|skewness|kurtosis|sum_cubes|product|diff|diff2|'
        r'diff3|diff_at|integrate|integrate2|anti_diff|defint|limit|'
        r'limit_left|limit_right|solve|roots|factor|factor_terms|expand|'
        r'simplify|cancel|together|apart|trigsimp|powsimp|radsimp|'
        r'nsimplify|series|taylor|collect|evalf|sech|csch|coth|asech|'
        r'acsch|acoth|sinc|sinhc|versin|vercosin|coversin|haversin|'
        r'havercos|versinh|vercosh|sinc_pi|sinc_deg|sin_deg|asec|acsc|acot|'
        r're|im|conj|arg|phase_deg|cis|complex|polar|rect|magnitude|'
        r'signum|real_part|imag_part|conjugate|argument|phase_rad|euler|'
        r'complex_conjugate|complex_power|complex_sqrt|complex_exp|complex_log|'
        r'complex_sin|complex_cos|complex_tan|complex_sec|complex_csc|complex_cot|'
        r'complex_sinh|complex_cosh|complex_tanh|complex_asin|complex_acos|'
        r'complex_atan|complex_asinh|complex_acosh|complex_atanh|complex_asec|'
        r'complex_acsc|complex_acot|'
        r'modulus|polar_radius|polar_angle|from_polar|'
        r'to_cartesian|real_abs|imag_abs|rotate|reciprocal|split|arg_deg|'
        r'arg_rad|vec|dot|cross|norm|unit|mat|matrix|det|trace|transpose|'
        r'inverse|rank|identity|zeros|ones|distance|hadamard|vector_sum|'
        r'matrix_power|row|column|diagonal|minor|cofactor|adjugate|nullspace|'
        r'columnspace|gram|angle|projection|vector_sub|vector_scale|'
        r'vector_sum_components|matrix_add|matrix_sub|'
        r'matrix_mul|eigenvalues|to_bin|to_oct|to_hex|to_base|from_bin|'
        r'from_oct|from_hex|from_base|from_base3|from_base5|from_base7|'
        r'from_base12|base2|base8|base16|decimal|binary|'
        r'octal|hexadecimal|bits|bit_length|gray|base3|base5|base7|base12|'
        r'base36|ternary|quinary|from_base36|popcount|parity|bit_and|'
        r'bit_or|bit_xor|bit_nand|bit_nor|bit_xnor|bit_not|left_shift|right_shift|'
        r'set_bit|clear_bit|toggle_bit|rotate_left|ones_complement|twos_complement)'
    )
    expression = re.sub(
        r'(\d)\s*(' + names + r')\b',
        r'\1*\2',
        expression,
        flags=re.IGNORECASE,
    )

    # Constants followed by a parenthesised expression, e.g. pi(2).
    expression = re.sub(
        r'\b(pi|tau|phi|e|i)\s*(?=\()',
        r'\1*',
        expression,
        flags=re.IGNORECASE,
    )

    return expression


def normalise_expression(expression):
    """Translate calculator symbols into parser-compatible syntax."""
    expression = str(expression).strip()

    replacements = {
        "π": "pi",
        "τ": "tau",
        "ℯ": "e",
        "ⅈ": "i",
        "×": "*",
        "·": "*",
        "⋅": "*",
        "÷": "/",
        "⁄": "/",
        "−": "-",
    }

    for symbol, replacement in replacements.items():
        expression = expression.replace(symbol, replacement)

    # Floor and ceiling notation:
    # ⌊x⌋ -> floor(x)
    # ⌈x⌉ -> ceil(x)
    expression = expression.replace("⌊", "floor(")
    expression = expression.replace("⌋", ")")
    expression = expression.replace("⌈", "ceil(")
    expression = expression.replace("⌉", ")")

    # Superscript-indexed roots, e.g. ⁵√32.
    # Ordinary digits before √ are NOT treated as root indices.
    expression = re.sub(
        r"([⁰¹²³⁴⁵⁶⁷⁸⁹]+)√(" + ROOT_ARGUMENT + r")",
        lambda m: (
            "root(" + m.group(2) + ","
            + m.group(1).translate(SUPERSCRIPT_TO_NORMAL) + ")"
        ),
        expression,
    )

    # Cube roots must be handled before square-root symbols.
    expression = re.sub(
        r"∛(" + ROOT_ARGUMENT + r")",
        r"cbrt(\1)",
        expression,
    )

    expression = re.sub(
        r"√(" + ROOT_ARGUMENT + r")",
        r"sqrt(\1)",
        expression,
    )

    # Superscript powers, e.g. 5² or (x+1)³.
    power_base = (
        r"(?:\([^()]*\)|[A-Za-z_]\w*|\d+(?:\.\d*)?|\.\d+)"
    )
    expression = re.sub(
        power_base + r"([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)",
        lambda m: (
            m.group(0)[:len(m.group(0)) - len(m.group(1))]
            + "**("
            + m.group(1).translate(SUPERSCRIPT_TO_NORMAL)
            + ")"
        ),
        expression,
    )

    # A postfix percent means divide the preceding value by 100.
    # Examples: 50% -> 50/100 and (2+3)% -> (2+3)/100.
    expression = re.sub(r"(?<=[0-9)])%", "/100", expression)
    expression = re.sub(
        r"\b(pi|tau|phi|e|i)%",
        r"(\1/100)",
        expression,
        flags=re.IGNORECASE,
    )

    # Calculator caret means exponentiation.
    expression = expression.replace("^", "**")

    # Calculator-style adjacent values imply multiplication.
    expression = insert_implicit_multiplication(expression)

    return expression


# ---------------------------------------------------------
# FUNCTION HELPERS
# ---------------------------------------------------------

def require_integer(value, name, minimum=None, maximum=None):
    if not value.is_Integer:
        raise ValueError(f"{name} must be a whole number.")

    number = int(value)

    if minimum is not None and number < minimum:
        raise ValueError(f"{name} must be at least {minimum}.")

    if maximum is not None and number > maximum:
        raise ValueError(f"{name} cannot be greater than {maximum}.")

    return number


def require_integer_list(args, function_name, minimum_count=2):
    if len(args) < minimum_count:
        raise ValueError(
            f"{function_name} requires at least {minimum_count} whole numbers."
        )

    numbers = []
    for index, value in enumerate(args, start=1):
        number = require_integer(
            value,
            f"{function_name} argument {index}"
        )
        if abs(number) > MAX_INTEGER_FUNCTION_INPUT:
            raise ValueError(
                f"{function_name} inputs are too large."
            )
        numbers.append(number)

    return numbers


def require_real_values(args, function_name, minimum_count=1):
    if len(args) < minimum_count:
        raise ValueError(
            f"{function_name} requires at least {minimum_count} values."
        )

    if any(value.is_number is not True or value.is_real is not True for value in args):
        raise ValueError(f"{function_name} requires real numeric values.")

    return list(args)


def median(values):
    ordered = sorted(values, key=lambda value: float(sp.N(value, 30)))
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def require_symbol(value, function_name):
    if not isinstance(value, sp.Symbol):
        raise ValueError(f"{function_name} requires a variable such as x.")
    return value


def require_vector(value, function_name):
    if isinstance(value, sp.Tuple):
        return list(value)
    if isinstance(value, sp.MatrixBase) and (value.rows == 1 or value.cols == 1):
        return list(value)
    raise ValueError(f"{function_name} requires a vector, e.g. vec(1,2,3).")


def require_matrix(value, function_name):
    if isinstance(value, sp.MatrixBase):
        matrix = sp.Matrix(value)
    elif isinstance(value, sp.Tuple):
        values = list(value)
        if values and all(isinstance(row, sp.Tuple) for row in values):
            matrix = sp.Matrix([list(row) for row in values])
        else:
            side = math.isqrt(len(values))
            if side * side != len(values):
                raise ValueError(
                    f"{function_name} requires a square matrix or "
                    "a square number of entries."
                )
            matrix = sp.Matrix(side, side, values)
    else:
        raise ValueError(
            f"{function_name} requires a matrix, e.g. mat(1,2,3,4)."
        )

    if matrix.rows != matrix.cols:
        raise ValueError(f"{function_name} requires a square matrix.")
    return matrix


# ---------------------------------------------------------
# FUNCTION HANDLERS
# ---------------------------------------------------------

def calculate_function(name, args, angle_mode):
    trig_functions = {
        "sin": sp.sin,
        "cos": sp.cos,
        "tan": sp.tan,
        "sec": lambda x: 1 / sp.cos(x),
        "csc": lambda x: 1 / sp.sin(x),
        "cot": lambda x: 1 / sp.tan(x),
    }

    inverse_trig = {
        "asin": sp.asin,
        "acos": sp.acos,
        "atan": sp.atan,
    }

    hyperbolic_functions = {
        "sinh": sp.sinh,
        "cosh": sp.cosh,
        "tanh": sp.tanh,
        "asinh": sp.asinh,
        "acosh": sp.acosh,
        "atanh": sp.atanh,
    }

    if name in trig_functions:
        if len(args) != 1:
            raise ValueError(f"{name} requires one argument.")

        value = args[0]
        if angle_mode == "DEG":
            value = value * sp.pi / 180

        return trig_functions[name](value)

    if name in inverse_trig:
        if len(args) != 1:
            raise ValueError(f"{name} requires one argument.")

        result = inverse_trig[name](args[0])
        if angle_mode == "DEG":
            result = result * 180 / sp.pi

        return result

    if name in hyperbolic_functions:
        if len(args) != 1:
            raise ValueError(f"{name} requires one argument.")
        return hyperbolic_functions[name](args[0])

    if name == "sqrt":
        if len(args) != 1:
            raise ValueError("√ requires one argument.")
        return sp.sqrt(args[0])

    if name == "cbrt":
        if len(args) != 1:
            raise ValueError("∛ requires one argument.")
        return sp.real_root(args[0], 3)

    if name == "root":
        if len(args) != 2:
            raise ValueError("Use root(value, degree), e.g. root(16, 4).")

        value, degree = args
        degree = require_integer(
            degree,
            "Root degree",
            minimum=1,
            maximum=MAX_ROOT_DEGREE,
        )
        return sp.real_root(value, degree)

    if name == "square":
        if len(args) != 1:
            raise ValueError("Square requires one argument.")
        return args[0] ** 2

    if name == "cube":
        if len(args) != 1:
            raise ValueError("Cube requires one argument.")
        return args[0] ** 3

    if name == "exp":
        if len(args) != 1:
            raise ValueError("eˣ requires one argument.")
        return sp.exp(args[0])

    if name == "ln":
        if len(args) != 1:
            raise ValueError("ln requires one argument.")
        return sp.log(args[0])

    if name == "log":
        if len(args) == 1:
            return sp.log(args[0], 10)
        if len(args) == 2:
            # The internal order is log(value, base).
            return sp.log(args[0], args[1])
        raise ValueError("Use log(value) or log(value, base).")

    if name == "log2":
        if len(args) != 1:
            raise ValueError("log₂ requires one argument.")
        return sp.log(args[0], 2)

    if name == "log10":
        if len(args) != 1:
            raise ValueError("log₁₀ requires one argument.")
        return sp.log(args[0], 10)

    if name == "abs":
        if len(args) != 1:
            raise ValueError("Absolute value requires one argument.")
        return sp.Abs(args[0])

    if name == "floor":
        if len(args) != 1:
            raise ValueError("⌊x⌋ requires one argument.")
        return sp.floor(args[0])

    if name in ("ceil", "ceiling"):
        if len(args) != 1:
            raise ValueError("⌈x⌉ requires one argument.")
        return sp.ceiling(args[0])

    if name == "factorial":
        if len(args) != 1:
            raise ValueError("Factorial requires one argument.")

        value = require_integer(
            args[0],
            "Factorial",
            minimum=0,
            maximum=170,
        )
        return sp.factorial(value)

    if name == "dms":
        if len(args) != 3:
            raise ValueError("DMS requires degrees, minutes, and seconds.")
        degrees, minutes, seconds = args
        if minutes.is_negative or seconds.is_negative:
            raise ValueError("DMS minutes and seconds cannot be negative.")
        if minutes >= 60 or seconds >= 60:
            raise ValueError("DMS minutes and seconds must be less than 60.")
        sign = -1 if degrees.is_negative else 1
        return sign * (
            sp.Abs(degrees) + minutes / 60 + seconds / 3600
        )

    if name == "mod":
        if len(args) != 2:
            raise ValueError("mod requires two arguments.")
        if args[1] == 0:
            raise ValueError("Cannot divide by zero.")
        return sp.Mod(args[0], args[1])

    # Combinations and permutations.
    if name in ("ncr", "npr"):
        if len(args) != 2:
            raise ValueError(f"{name} requires n and r.")

        n = require_integer(args[0], "n", minimum=0, maximum=170)
        r = require_integer(args[1], "r", minimum=0, maximum=170)

        if r > n:
            raise ValueError("r cannot be greater than n.")

        if name == "ncr":
            return sp.binomial(n, r)

        return sp.factorial(n) / sp.factorial(n - r)

    # HCF (also accepts gcd) and LCM accept two or more integers.
    if name in ("hcf", "gcd"):
        numbers = require_integer_list(args, "HCF")
        return sp.Integer(math.gcd(*numbers))

    if name == "lcm":
        numbers = require_integer_list(args, "LCM")
        return sp.Integer(math.lcm(*numbers))

    if name in {
        "count", "sum", "mean", "median", "mode", "range", "stdev",
        "pstdev", "variance", "pvariance", "q1", "q3", "iqr",
        "sum_squares", "geometric_mean", "harmonic_mean",
        "mean_deviation", "mad", "rms", "coefficient_variation",
        "skewness", "kurtosis", "product", "sum_cubes",
    }:
        values = require_real_values(args, name)
        average = sp.Add(*values) / len(values)

        if name == "count":
            return sp.Integer(len(values))
        if name == "sum":
            return sp.Add(*values)
        if name == "mean":
            return average
        if name == "median":
            return median(values)
        if name == "mode":
            frequencies = [(value, values.count(value)) for value in values]
            highest = max(count for _, count in frequencies)
            modes = []
            for value, count in frequencies:
                if count == highest and value not in modes:
                    modes.append(value)
            if len(modes) == 1:
                return modes[0]
            return sp.Tuple(*modes)
        if name == "range":
            return max(values) - min(values)
        if name in {"variance", "pvariance", "stdev", "pstdev"}:
            sample = name in {"variance", "stdev"}
            if sample and len(values) < 2:
                raise ValueError(f"{name} requires at least two values.")
            divisor = len(values) - 1 if sample else len(values)
            variance = sp.Add(
                *((value - average) ** 2 for value in values)
            ) / divisor
            return sp.sqrt(variance) if name in {"stdev", "pstdev"} else variance
        if name in {"q1", "q3", "iqr"}:
            ordered = sorted(values, key=lambda value: float(sp.N(value, 30)))
            middle = len(ordered) // 2
            lower = ordered[:middle]
            upper = ordered[(middle + 1 if len(ordered) % 2 else middle):]
            first = median(lower) if lower else ordered[0]
            third = median(upper) if upper else ordered[-1]
            return first if name == "q1" else third if name == "q3" else third - first
        if name == "sum_squares":
            return sp.Add(*(value ** 2 for value in values))
        if name == "sum_cubes":
            return sp.Add(*(value ** 3 for value in values))
        if name == "geometric_mean":
            if any(value.is_positive is not True for value in values):
                raise ValueError("geometric_mean requires positive values.")
            return sp.prod(values) ** sp.Rational(1, len(values))
        if name == "harmonic_mean":
            if any(value == 0 for value in values):
                raise ValueError("harmonic_mean cannot include zero.")
            return len(values) / sp.Add(*(1 / value for value in values))
        if name == "mean_deviation":
            return sp.Add(*(sp.Abs(value - average) for value in values)) / len(values)
        if name == "mad":
            deviations = [sp.Abs(value - median(values)) for value in values]
            return median(deviations)
        if name == "rms":
            return sp.sqrt(sp.Add(*(value ** 2 for value in values)) / len(values))
        if name == "coefficient_variation":
            if average == 0:
                raise ValueError("coefficient_variation is undefined when the mean is zero.")
            deviation = sp.sqrt(
                sp.Add(*((value - average) ** 2 for value in values))
                / max(1, len(values) - 1)
            )
            return deviation / sp.Abs(average)
        if name in {"skewness", "kurtosis"}:
            if len(values) < (3 if name == "skewness" else 4):
                raise ValueError(f"{name} requires more values.")
            second = sp.Add(*((value - average) ** 2 for value in values)) / len(values)
            if second == 0:
                raise ValueError(f"{name} is undefined when all values are equal.")
            if name == "skewness":
                third = sp.Add(*((value - average) ** 3 for value in values)) / len(values)
                return third / second ** sp.Rational(3, 2)
            fourth = sp.Add(*((value - average) ** 4 for value in values)) / len(values)
            return fourth / second ** 2 - 3
        return sp.prod(values)

    if name in {"min", "max"}:
        values = require_real_values(args, name)
        return sp.Min(*values) if name == "min" else sp.Max(*values)

    if name in {
        "diff", "diff2", "diff3", "diff_at", "integrate", "integrate2",
        "anti_diff", "defint", "limit", "limit_left", "limit_right",
        "solve", "roots", "factor", "factor_terms", "expand", "simplify",
        "cancel", "together", "apart", "trigsimp", "powsimp", "radsimp",
        "nsimplify", "series", "taylor", "collect", "evalf",
    }:
        if not args:
            raise ValueError(f"{name} requires an expression.")
        expression = args[0]
        variable = args[1] if len(args) > 1 else (
            next(iter(expression.free_symbols), sp.Symbol("x"))
            if hasattr(expression, "free_symbols")
            else sp.Symbol("x")
        )

        if name in {"diff", "diff2", "diff3", "diff_at"}:
            if len(args) > 1:
                variable = require_symbol(variable, name)
            order = 2 if name == "diff2" else 3 if name == "diff3" else 1
            if name == "diff" and len(args) > 2:
                order = require_integer(args[2], "Derivative order", 1, 100)
            derivative = sp.diff(expression, variable, order)
            if name == "diff_at":
                if len(args) != 3:
                    raise ValueError("diff_at requires expression, variable, and point.")
                return derivative.subs(variable, args[2])
            return derivative
        if name in {"integrate", "integrate2", "anti_diff", "defint"}:
            if len(args) == 1:
                variable = next(iter(expression.free_symbols), sp.Symbol("x"))
            else:
                variable = require_symbol(variable, name)
            if name == "defint" or (name == "integrate2" and len(args) == 4):
                if len(args) != 4:
                    raise ValueError(
                        f"{name} requires expression, variable, lower, "
                        "and upper bounds."
                    )
                return sp.integrate(expression, (variable, args[2], args[3]))
            if len(args) > 2:
                raise ValueError(f"{name} accepts only an expression and optional variable.")
            return sp.integrate(expression, variable)
        if name in {"limit", "limit_left", "limit_right"}:
            if len(args) != 3:
                raise ValueError(f"{name} requires expression, variable, and point.")
            variable = require_symbol(variable, name)
            direction = "-" if name == "limit_left" else "+" if name == "limit_right" else "+-"
            return sp.limit(expression, variable, args[2], dir=direction)
        if name in {"solve", "roots"}:
            if len(args) > 2:
                raise ValueError(f"{name} accepts an expression and optional variable.")
            variable = require_symbol(variable, name)
            return sp.FiniteSet(*sp.solve(expression, variable))
        if name in {"series", "taylor"}:
            if len(args) not in {3, 4}:
                raise ValueError(
                    f"{name} requires expression, variable, point, "
                    "and optional order."
                )
            variable = require_symbol(variable, name)
            order = require_integer(args[3], "Series order", 1, 100) if len(args) == 4 else 6
            return sp.series(expression, variable, args[2], order).removeO()
        if name == "factor":
            return sp.factor(expression)
        if name == "factor_terms":
            return sp.factor_terms(expression)
        if name == "expand":
            return sp.expand(expression)
        if name == "simplify":
            return sp.simplify(expression)
        if name == "cancel":
            return sp.cancel(expression)
        if name == "together":
            return sp.together(expression)
        if name == "apart":
            return sp.apart(expression, variable)
        if name == "trigsimp":
            return sp.trigsimp(expression)
        if name == "powsimp":
            return sp.powsimp(expression)
        if name == "radsimp":
            return sp.radsimp(expression)
        if name == "nsimplify":
            return sp.nsimplify(expression)
        if name == "collect":
            if len(args) != 2:
                raise ValueError("collect requires an expression and a variable.")
            return sp.collect(expression, variable)
        return sp.N(expression, 12)

    if name in {
        "sech", "csch", "coth", "asech", "acsch", "acoth", "sinc",
        "sinhc", "versin", "vercosin", "coversin", "haversin",
        "havercos", "versinh", "vercosh", "sinc_pi", "sinc_deg",
        "sin_deg", "acot", "asec", "acsc",
    }:
        if len(args) != 1:
            raise ValueError(f"{name} requires one argument.")
        value = args[0]
        if name == "sin_deg":
            return sp.sin(value * sp.pi / 180)
        angle = value * sp.pi / 180 if angle_mode == "DEG" else value
        if name in {
            "versin", "vercosin", "coversin", "haversin", "havercos",
            "sinc",
        }:
            value = angle
        if name == "sech":
            return 1 / sp.cosh(value)
        if name == "csch":
            return 1 / sp.sinh(value)
        if name == "coth":
            return 1 / sp.tanh(value)
        if name == "asech":
            return sp.acosh(1 / value)
        if name == "acsch":
            return sp.asinh(1 / value)
        if name == "acoth":
            return sp.atanh(1 / value)
        if name == "sinc":
            return sp.sin(value) / value if value != 0 else sp.Integer(1)
        if name == "sinhc":
            return sp.sinh(value) / value if value != 0 else sp.Integer(1)
        if name == "versin":
            return 1 - sp.cos(value)
        if name == "vercosin":
            return 1 + sp.cos(value)
        if name == "coversin":
            return 1 - sp.sin(value)
        if name == "haversin":
            return (1 - sp.cos(value)) / 2
        if name == "havercos":
            return (1 + sp.cos(value)) / 2
        if name == "versinh":
            return sp.cosh(value) - 1
        if name == "vercosh":
            return sp.cosh(value) + 1
        if name == "sinc_pi":
            return sp.sin(sp.pi * value) / (sp.pi * value) if value != 0 else sp.Integer(1)
        if name == "sinc_deg":
            angle_in_radians = value * sp.pi / 180
            return sp.sin(angle_in_radians) / angle_in_radians if value != 0 else sp.Integer(1)
        if name == "acot":
            result = sp.acot(value)
            return result * 180 / sp.pi if angle_mode == "DEG" else result
        if name == "asec":
            result = sp.acos(1 / value)
            return result * 180 / sp.pi if angle_mode == "DEG" else result
        result = sp.asin(1 / value)
        return result * 180 / sp.pi if angle_mode == "DEG" else result

    if name in {
        "re", "im", "conj", "arg", "phase_deg", "cis", "complex",
        "polar", "rect", "magnitude",         "signum", "real_part",
        "imag_part", "conjugate", "argument", "phase_rad", "euler",
        "complex_conjugate", "modulus", "polar_radius", "polar_angle",
        "from_polar", "to_cartesian", "real_abs", "imag_abs", "rotate",
        "reciprocal", "split", "arg_deg", "arg_rad", "complex_sqrt",
        "complex_exp", "complex_log", "complex_power",
    }:
        if name == "complex":
            if len(args) != 2:
                raise ValueError("complex requires real and imaginary parts.")
            return args[0] + args[1] * sp.I
        if name == "complex_power":
            if len(args) != 2:
                raise ValueError("complex_power requires a value and exponent.")
            return args[0] ** args[1]
        if name in {"polar", "from_polar"}:
            if len(args) != 2:
                raise ValueError(f"{name} requires magnitude and angle.")
            return args[0] * sp.exp(sp.I * args[1])
        if len(args) != 1:
            raise ValueError(f"{name} requires one argument.")
        value = args[0]
        if name in {"re", "real_part"}:
            return sp.re(value)
        if name in {"im", "imag_part"}:
            return sp.im(value)
        if name in {"conj", "conjugate", "complex_conjugate"}:
            return sp.conjugate(value)
        if name in {"arg", "argument", "phase_rad"}:
            return sp.arg(value)
        if name in {"phase_deg", "arg_deg"}:
            return sp.arg(value) * 180 / sp.pi
        if name == "arg_rad":
            return sp.arg(value)
        if name in {"cis", "euler"}:
            return sp.exp(sp.I * value)
        if name == "complex_sqrt":
            return sp.sqrt(value)
        if name == "complex_exp":
            return sp.exp(value)
        if name == "complex_log":
            return sp.log(value)
        if name in {"rect", "to_cartesian", "split"}:
            if name == "split":
                return sp.Tuple(sp.re(value), sp.im(value))
            return sp.expand_complex(value)
        if name in {"magnitude", "polar_radius"}:
            return sp.Abs(value)
        if name == "modulus":
            return sp.Abs(value) ** 2
        if name == "polar_angle":
            return sp.arg(value)
        if name == "real_abs":
            return sp.Abs(sp.re(value))
        if name == "imag_abs":
            return sp.Abs(sp.im(value))
        if name == "signum":
            return sp.sign(value)
        if name == "rotate":
            return value * sp.I
        if name == "reciprocal":
            if value == 0:
                raise ValueError("Cannot divide by zero.")
            return 1 / value
        return sp.sign(value)

    complex_trig_functions = {
        "complex_sin": sp.sin,
        "complex_cos": sp.cos,
        "complex_tan": sp.tan,
        "complex_sec": lambda value: 1 / sp.cos(value),
        "complex_csc": lambda value: 1 / sp.sin(value),
        "complex_cot": lambda value: 1 / sp.tan(value),
        "complex_sinh": sp.sinh,
        "complex_cosh": sp.cosh,
        "complex_tanh": sp.tanh,
        "complex_asin": sp.asin,
        "complex_acos": sp.acos,
        "complex_atan": sp.atan,
        "complex_asinh": sp.asinh,
        "complex_acosh": sp.acosh,
        "complex_atanh": sp.atanh,
        "complex_asec": lambda value: sp.acos(1 / value),
        "complex_acsc": lambda value: sp.asin(1 / value),
        "complex_acot": sp.acot,
    }
    if name in complex_trig_functions:
        if len(args) != 1:
            raise ValueError(f"{name} requires one argument.")
        value = args[0]
        inverse = name in {
            "complex_asin", "complex_acos", "complex_atan",
            "complex_asec", "complex_acsc", "complex_acot",
        }
        if angle_mode == "DEG" and not inverse and name in {
            "complex_sin", "complex_cos", "complex_tan",
            "complex_sec", "complex_csc", "complex_cot",
        }:
            value = value * sp.pi / 180
        result = complex_trig_functions[name](value)
        if angle_mode == "DEG" and inverse:
            result *= 180 / sp.pi
        return result

    if name in {
        "vec", "dot", "cross", "norm", "unit", "mat", "matrix",
        "det", "trace", "transpose", "inverse", "rank", "identity",
        "zeros", "ones", "distance", "hadamard", "vector_sum",
        "matrix_power", "row", "column", "diagonal", "minor",
        "cofactor", "adjugate", "nullspace", "columnspace", "gram",
        "angle", "projection", "vector_sub", "vector_scale",
        "vector_sum_components", "matrix_add", "matrix_sub", "matrix_mul",
        "eigenvalues",
    }:
        if name == "vec":
            return sp.Tuple(*args)
        if name in {"mat", "matrix"}:
            return sp.Tuple(*args)
        if name == "vector_scale":
            if len(args) != 2:
                raise ValueError("vector_scale requires a vector and a scalar.")
            vector = require_vector(args[0], name)
            return sp.Tuple(*(value * args[1] for value in vector))
        if name == "vector_sum_components":
            if len(args) != 1:
                raise ValueError("vector_sum_components requires one vector.")
            return sp.Add(*require_vector(args[0], name))
        if name in {
            "dot", "cross", "distance", "hadamard", "vector_sum",
            "vector_sub", "angle", "projection",
        }:
            if len(args) != 2:
                raise ValueError(f"{name} requires two vectors.")
            left = require_vector(args[0], name)
            right = require_vector(args[1], name)
            if len(left) != len(right):
                raise ValueError(f"{name} requires vectors of equal length.")
            if name == "dot":
                return sp.Add(*(a * b for a, b in zip(left, right)))
            if name == "cross":
                if len(left) != 3:
                    raise ValueError("cross requires two 3-dimensional vectors.")
                return sp.Tuple(*sp.Matrix(left).cross(sp.Matrix(right)))
            if name == "distance":
                return sp.sqrt(sp.Add(*((a - b) ** 2 for a, b in zip(left, right))))
            if name == "hadamard":
                return sp.Tuple(*(a * b for a, b in zip(left, right)))
            if name == "vector_sum":
                return sp.Tuple(*(a + b for a, b in zip(left, right)))
            if name == "vector_sub":
                return sp.Tuple(*(a - b for a, b in zip(left, right)))
            dot_product = sp.Add(*(a * b for a, b in zip(left, right)))
            if name == "angle":
                left_norm = sp.sqrt(sp.Add(*(a ** 2 for a in left)))
                right_norm = sp.sqrt(sp.Add(*(b ** 2 for b in right)))
                result = sp.acos(dot_product / (left_norm * right_norm))
                return result * 180 / sp.pi if angle_mode == "DEG" else result
            right_norm_sq = sp.Add(*(b ** 2 for b in right))
            if right_norm_sq == 0:
                raise ValueError("Cannot project onto the zero vector.")
            scale = dot_product / right_norm_sq
            return sp.Tuple(*(scale * b for b in right))
        if name in {"norm", "unit"}:
            if len(args) != 1:
                raise ValueError(f"{name} requires one vector.")
            vector = require_vector(args[0], name)
            length = sp.sqrt(sp.Add(*(value ** 2 for value in vector)))
            if name == "norm":
                return length
            if length == 0:
                raise ValueError("The zero vector has no unit vector.")
            return sp.Tuple(*(value / length for value in vector))
        if name in {"identity", "zeros", "ones"}:
            if len(args) != 1:
                raise ValueError(f"{name} requires a matrix dimension.")
            size = require_integer(args[0], "Matrix dimension", 1, 20)
            if name == "identity":
                return sp.Matrix.eye(size)
            if name == "zeros":
                return sp.zeros(size)
            return sp.ones(size)
        if name in {
            "det", "trace", "transpose", "inverse", "rank", "diagonal",
            "adjugate", "nullspace", "columnspace", "gram", "eigenvalues",
        }:
            if len(args) != 1:
                raise ValueError(f"{name} requires one matrix.")
            matrix = require_matrix(args[0], name)
            if name == "det":
                return matrix.det()
            if name == "trace":
                return matrix.trace()
            if name == "transpose":
                return sp.Tuple(*(sp.Tuple(*row) for row in matrix.T.tolist()))
            if name == "inverse":
                if matrix.det() == 0:
                    raise ValueError("A singular matrix has no inverse.")
                return sp.Tuple(*(sp.Tuple(*row) for row in matrix.inv().tolist()))
            if name == "rank":
                return sp.Integer(matrix.rank())
            if name == "diagonal":
                return sp.Tuple(*matrix.diagonal())
            if name == "adjugate":
                return sp.Tuple(*(sp.Tuple(*row) for row in matrix.adjugate().tolist()))
            if name == "nullspace":
                vectors = matrix.nullspace()
                return sp.Tuple(*(sp.Tuple(*vector) for vector in vectors))
            if name == "columnspace":
                vectors = matrix.columnspace()
                return sp.Tuple(*(sp.Tuple(*vector) for vector in vectors))
            if name == "gram":
                gram = matrix.T * matrix
                return sp.Tuple(*(sp.Tuple(*row) for row in gram.tolist()))
            return sp.Tuple(*matrix.eigenvals(multiple=True))
        if name in {"row", "column", "minor", "cofactor"}:
            if len(args) != 2:
                raise ValueError(f"{name} requires a matrix and an index.")
            matrix = require_matrix(args[0], name)
            index = require_integer(args[1], "Matrix index", 1, matrix.rows) - 1
            if name == "row":
                return sp.Tuple(*matrix.row(index))
            if name == "column":
                return sp.Tuple(*matrix.col(index))
            if name == "minor":
                return matrix.minor(index, 0)
            return matrix.cofactor(index, 0)
        if name in {"matrix_add", "matrix_sub", "matrix_mul"}:
            if len(args) != 2:
                raise ValueError(f"{name} requires two matrices.")
            left = require_matrix(args[0], name)
            right = require_matrix(args[1], name)
            if left.shape != right.shape:
                raise ValueError(f"{name} requires matrices of equal dimensions.")
            if name == "matrix_add":
                result = left + right
            elif name == "matrix_sub":
                result = left - right
            else:
                result = left * right
            return sp.Tuple(*(sp.Tuple(*row) for row in result.tolist()))
        if name == "matrix_power":
            if len(args) != 2:
                raise ValueError("matrix_power requires a matrix and an integer exponent.")
            matrix = require_matrix(args[0], name)
            exponent = require_integer(args[1], "Matrix exponent", -100, 100)
            return sp.Tuple(*(sp.Tuple(*row) for row in (matrix ** exponent).tolist()))
        if len(args) != 1:
            raise ValueError(f"{name} requires one matrix.")

    if name in {
        "to_bin", "to_oct", "to_hex", "to_base", "from_bin", "from_oct",
        "from_hex", "from_base", "base2", "base8", "base16", "decimal",
        "binary", "octal", "hexadecimal", "bits", "bit_length", "gray",
        "base3", "base5", "base7", "base12", "base36", "ternary",
        "quinary", "from_base3", "from_base5", "from_base7", "from_base12",
        "from_base36", "popcount", "parity", "bit_and", "bit_or",
        "bit_xor", "bit_nand", "bit_nor", "bit_xnor", "bit_not",
        "left_shift", "right_shift", "set_bit", "clear_bit", "toggle_bit",
        "rotate_left", "ones_complement", "twos_complement",
    }:
        if name in {"to_base", "from_base"}:
            if len(args) != 2:
                raise ValueError(f"{name} requires a value and a base.")
            value = require_integer(args[0], name)
            base = require_integer(args[1], "Base", 2, 36)
            if name == "to_base":
                digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                original_value = value
                sign = "-" if value < 0 else ""
                value = abs(value)
                output = "0" if value == 0 else ""
                while value:
                    value, remainder = divmod(value, base)
                    output = digits[remainder] + output
                return BaseAnswer(
                    f"{sign}{output}₍{base}₎",
                    str(original_value),
                )
            if value < 0:
                raise ValueError("from_base digits cannot be negative.")
            try:
                return sp.Integer(int(str(value), base))
            except ValueError as error:
                raise ValueError("The digits are not valid for that base.") from error
        if name in {
            "bit_and", "bit_or", "bit_xor", "bit_nand", "bit_nor",
            "bit_xnor",
        }:
            values = require_integer_list(args, name)
            if name in {"bit_and", "bit_nand"}:
                result = values[0]
                for value in values[1:]:
                    result &= value
            elif name in {"bit_or", "bit_nor"}:
                result = values[0]
                for value in values[1:]:
                    result |= value
            else:
                result = values[0]
                for value in values[1:]:
                    result ^= value
            if name in {"bit_nand", "bit_nor", "bit_xnor"}:
                result = ~result
            return sp.Integer(result)
        if name in {"left_shift", "right_shift"}:
            if len(args) != 2:
                raise ValueError(f"{name} requires a value and shift count.")
            value = require_integer(args[0], name)
            shift = require_integer(args[1], "Shift count", 0, 10000)
            return sp.Integer(value << shift if name == "left_shift" else value >> shift)
        if name in {"set_bit", "clear_bit", "toggle_bit"}:
            if len(args) != 2:
                raise ValueError(f"{name} requires a value and bit index.")
            value = require_integer(args[0], name)
            index = require_integer(args[1], "Bit index", 0, 10000)
            mask = 1 << index
            if name == "set_bit":
                value |= mask
            elif name == "clear_bit":
                value &= ~mask
            else:
                value ^= mask
            return sp.Integer(value)
        if name == "rotate_left":
            if len(args) != 2:
                raise ValueError("rotate_left requires a value and rotation count.")
            value = require_integer(args[0], name)
            shift = require_integer(args[1], "Rotation count", 0, 10000)
            if value < 0:
                raise ValueError("rotate_left requires a non-negative value.")
            width = max(1, value.bit_length())
            shift %= width
            mask = (1 << width) - 1
            rotated = value if shift == 0 else (
                (value << shift) | (value >> (width - shift))
            ) & mask
            return sp.Integer(rotated)
        if len(args) != 1:
            raise ValueError(f"{name} requires one integer.")
        value = require_integer(args[0], name)
        if name in {"from_bin", "binary"}:
            base = 2
        elif name in {"from_oct", "octal"}:
            base = 8
        elif name in {"from_hex", "hexadecimal"}:
            base = 16
        elif name == "from_base36":
            base = 36
        elif name in {"from_base3", "from_base5", "from_base7", "from_base12"}:
            base = int(name[len("from_base"):])
        else:
            base = {
                "to_bin": 2, "base2": 2, "bits": 2,
                "to_oct": 8, "base8": 8,
                "to_hex": 16, "base16": 16,
                "base3": 3, "ternary": 3,
                "base5": 5, "quinary": 5,
                "base7": 7, "base12": 12, "base36": 36,
            }.get(name)
        if base is not None:
            if name in {
                "from_bin", "binary", "from_oct", "octal", "from_hex",
                "hexadecimal", "from_base3", "from_base5", "from_base7",
                "from_base12", "from_base36",
            }:
                if value < 0:
                    raise ValueError("Base digits cannot be negative.")
                try:
                    return sp.Integer(int(str(value), base))
                except ValueError as error:
                    raise ValueError("The digits are not valid for that base.") from error
            digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            sign = "-" if value < 0 else ""
            remainder = abs(value)
            output = "0" if remainder == 0 else ""
            while remainder:
                remainder, digit = divmod(remainder, base)
                output = digits[digit] + output
            return BaseAnswer(
                f"{sign}{output}₂" if name in {"to_bin", "base2", "bits"} else (
                    f"{sign}{output}₈" if name in {"to_oct", "base8"} else
                    f"{sign}{output}₁₆" if name in {"to_hex", "base16"} else
                    f"{sign}{output}₍{base}₎"
                ),
                str(-abs(value) if sign else value),
            )
        if name == "decimal":
            return sp.Integer(value)
        if name == "bit_length":
            return sp.Integer(abs(value).bit_length())
        if name == "popcount":
            return sp.Integer(bin(abs(value)).count("1"))
        if name == "parity":
            return sp.Integer(bin(abs(value)).count("1") % 2)
        if name == "gray":
            gray_value = value ^ (value >> 1)
            return BaseAnswer(
                format(gray_value, "b") + "₂",
                str(gray_value),
            )
        if name in {"bit_not", "ones_complement"}:
            return sp.Integer(~value)
        if name == "twos_complement":
            width = max(1, value.bit_length())
            return sp.Integer((-value) & ((1 << width) - 1))

    # Random decimal from 0 (inclusive) to 1 (exclusive).
    # Example: rnd()
    if name in ("rnd", "random"):
        if len(args) != 0:
            raise ValueError("rnd takes no arguments. Use rnd().")
        return sp.Float(repr(random.random()), 15)

    raise ValueError(f"Unknown function: {name}")


# ---------------------------------------------------------
# SAFE AST EXPRESSION BUILDER
# Only explicitly permitted Python AST node types are accepted.
# Never replace this with eval() or unrestricted parse_expr().
# ---------------------------------------------------------

def build_expression(node, angle_mode="DEG", symbols=None):
    if isinstance(node, ast.Expression):
        return build_expression(node.body, angle_mode, symbols)

    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool):
            raise ValueError("Boolean values are not allowed.")

        if not isinstance(node.value, (int, float)):
            raise ValueError("Only numbers are allowed.")

        return sp.Rational(str(node.value))

    if isinstance(node, (ast.List, ast.Tuple)):
        return sp.Tuple(
            *(build_expression(element, angle_mode, symbols) for element in node.elts)
        )

    if isinstance(node, ast.Set):
        return sp.FiniteSet(
            *(build_expression(element, angle_mode, symbols) for element in node.elts)
        )

    if isinstance(node, ast.Name):
        if symbols is not None and node.id in symbols:
            return symbols[node.id]

        name = node.id.lower()

        if name in CONSTANTS:
            return CONSTANTS[name]

        raise ValueError(f"Unknown constant: {node.id}")

    if isinstance(node, ast.UnaryOp):
        value = build_expression(node.operand, angle_mode, symbols)

        if isinstance(node.op, ast.UAdd):
            return value

        if isinstance(node.op, ast.USub):
            return -value

        raise ValueError("Unsupported unary operation.")

    if isinstance(node, ast.BinOp):
        left = build_expression(node.left, angle_mode, symbols)
        right = build_expression(node.right, angle_mode, symbols)

        if isinstance(node.op, ast.Add):
            return left + right

        if isinstance(node.op, ast.Sub):
            return left - right

        if isinstance(node.op, ast.Mult):
            return left * right

        if isinstance(node.op, ast.Div):
            if right == 0:
                raise ValueError("Cannot divide by zero.")
            return left / right

        if isinstance(node.op, ast.Pow):
            if right.is_Integer and abs(int(right)) > MAX_EXPONENT:
                raise ValueError("The exponent is too large.")
            return left ** right

        if isinstance(node.op, ast.Mod):
            if right == 0:
                raise ValueError("Cannot divide by zero.")
            return sp.Mod(left, right)

        raise ValueError("Unsupported mathematical operation.")

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Unsupported function.")

        if node.keywords:
            raise ValueError("Named arguments are not supported.")

        name = node.func.id.lower()
        args = [
            build_expression(arg, angle_mode, symbols)
            for arg in node.args
        ]

        return calculate_function(name, args, angle_mode)

    raise ValueError("Invalid mathematical expression.")


# ---------------------------------------------------------
# ANSWER FORMATTING
# ---------------------------------------------------------

def format_answer(result, display_mode, original_tree=None, angle_mode="DEG"):
    if isinstance(result, BaseAnswer):
        return result.text

    result = sp.simplify(result)

    if display_mode == "decimal":
        return str(sp.N(result, 12))

    if display_mode == "mixed":
        if result.is_Rational:
            numerator = int(result.p)
            denominator = int(result.q)
            whole, remainder = divmod(abs(numerator), denominator)

            if remainder == 0:
                return str(numerator)

            sign = "-" if numerator < 0 else ""

            if whole == 0:
                return f"{sign}{remainder}/{denominator}"

            return f"{sign}{whole} {remainder}/{denominator}"

        return str(sp.N(result, 12))

    if display_mode == "remainder":
        if original_tree is not None:
            division = original_tree.body

            if (
                isinstance(division, ast.BinOp)
                and isinstance(division.op, ast.Div)
            ):
                left = build_expression(division.left, angle_mode)
                right = build_expression(division.right, angle_mode)

                if (
                    left.is_Integer
                    and right.is_Integer
                    and right != 0
                ):
                    quotient, remainder = divmod(
                        int(left),
                        int(right),
                    )
                    return f"{quotient} r {remainder}"

        return "Remainder format needs integer division, e.g. 17 / 5."

    # Unicode symbolic output: √, π, ∞, superscripts, etc.
    # Floor/ceiling are represented symbolically when present in results.
    return sp.pretty(result, use_unicode=True, wrap_line=False)


def expression_for_answer(result):
    if isinstance(result, BaseAnswer):
        return result.expression
    if isinstance(result, sp.MatrixBase):
        entries = [sp.sstr(value) for value in result]
        return f"mat({','.join(entries)})"
    return sp.sstr(result)


def parse_algebra_equation(expression, symbols):
    normalized = normalise_expression(expression)
    normalized = re.sub(
        r"(\d+(?:\.\d*)?|\.\d+)([A-Za-z])(?![+-]?\d)",
        r"\1*\2",
        normalized,
    )
    if normalized.count("=") > 1 or any(
        operator in normalized for operator in ("<=", ">=", "==", "!=")
    ):
        raise ValueError("Use one equals sign (=) for each equation.")

    sides = [side.strip() for side in normalized.split("=", 1)]
    if len(sides) == 1:
        sides.append("0")
    if not sides[0].strip() or not sides[1].strip():
        raise ValueError("Enter an expression on both sides of the equals sign.")

    trees = []
    for side in sides:
        tree = ast.parse(side, mode="eval")
        if sum(1 for _ in ast.walk(tree)) > MAX_AST_NODES:
            raise ValueError("An equation is too complicated.")

        for node in ast.walk(tree):
            if (
                isinstance(node, ast.BinOp)
                and isinstance(node.op, ast.Pow)
                and isinstance(node.right, ast.Constant)
                and isinstance(node.right.value, (int, float))
                and abs(node.right.value) > MAX_ALGEBRA_EXPONENT
            ):
                raise ValueError(
                    f"Algebra exponents cannot be greater than {MAX_ALGEBRA_EXPONENT}."
                )
            if isinstance(node, ast.Call):
                if not isinstance(node.func, ast.Name):
                    raise ValueError("Use only supported math functions.")
                if node.func.id.lower() not in ALGEBRA_FUNCTIONS:
                    raise ValueError(
                        f"Unsupported algebra function: {node.func.id}."
                    )

        trees.append(tree)

    left = build_expression(trees[0], "RAD", symbols)
    right = build_expression(trees[1], "RAD", symbols)
    return sp.simplify(left - right)


def solve_algebra_system(equations):
    if not isinstance(equations, list):
        raise ValueError("Send equations as a list of expression lines.")

    if not equations or len(equations) > MAX_ALGEBRA_EQUATIONS:
        raise ValueError(
            f"Enter between 1 and {MAX_ALGEBRA_EQUATIONS} equations."
        )

    if any(not isinstance(equation, str) for equation in equations):
        raise ValueError("Each equation must be text.")

    cleaned_equations = [equation.strip() for equation in equations if equation.strip()]
    if not cleaned_equations:
        raise ValueError("Enter at least one equation.")
    if any(len(equation) > MAX_ALGEBRA_EXPRESSION_LENGTH for equation in cleaned_equations):
        raise ValueError(
            f"Each equation must be {MAX_ALGEBRA_EXPRESSION_LENGTH} characters or fewer."
        )
    if sum(map(len, cleaned_equations)) > MAX_ALGEBRA_TOTAL_LENGTH:
        raise ValueError(
            f"All equations combined must be {MAX_ALGEBRA_TOTAL_LENGTH} characters or fewer."
        )

    parsed_trees = []
    for equation in cleaned_equations:
        normalized = normalise_expression(equation)
        normalized = re.sub(
            r"(\d+(?:\.\d*)?|\.\d+)([A-Za-z])(?![+-]?\d)",
            r"\1*\2",
            normalized,
        )
        if normalized.count("=") > 1:
            raise ValueError("Use one equals sign (=) for each equation.")
        sides = [side.strip() for side in normalized.split("=", 1)]
        if len(sides) == 1:
            sides.append("0")
        if not sides[0].strip() or not sides[1].strip():
            raise ValueError("Enter an expression on both sides of the equals sign.")
        parsed_trees.extend(ast.parse(side, mode="eval") for side in sides)

    function_names = {
        node.func.id.lower()
        for tree in parsed_trees
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    variable_names = {
        node.id
        for tree in parsed_trees
        for node in ast.walk(tree)
        if isinstance(node, ast.Name)
        and node.id.lower() not in function_names
    }
    variable_names = {
        name
        for name in variable_names
        if name.lower() not in {"pi", "tau", "phi"}
    }
    if len(variable_names) > MAX_ALGEBRA_VARIABLES:
        raise ValueError(
            f"Solve at most {MAX_ALGEBRA_VARIABLES} variables at a time."
        )
    symbols = {
        name: sp.Symbol(name)
        for name in sorted(variable_names)
    }

    relations = [
        parse_algebra_equation(equation, symbols)
        for equation in cleaned_equations
    ]
    relations = [sp.simplify(relation) for relation in relations]
    variables = [symbols[name] for name in sorted(symbols)]
    nontrivial_relations = [relation for relation in relations if relation != 0]

    if not nontrivial_relations:
        return {
            "status": "Every value of the listed variables satisfies these identities.",
            "variables": sorted(symbols),
            "solutions": [],
            "infinitely_many": True,
        }

    if not variables:
        return {
            "status": "No solutions." if any(relation != 0 for relation in relations) else "Identity.",
            "variables": [],
            "solutions": [],
            "infinitely_many": not any(relation != 0 for relation in relations),
        }

    if len(variables) == 1 and len(nontrivial_relations) == 1:
        variable = variables[0]
        solution_set = sp.solveset(
            nontrivial_relations[0],
            variable,
            domain=sp.S.Complexes,
        )
        if solution_set == sp.S.EmptySet:
            solutions = []
        elif isinstance(solution_set, sp.FiniteSet):
            solutions = [{variable: value} for value in solution_set]
        else:
            return {
                "status": "Returned the complete symbolic solution set.",
                "variables": sorted(symbols),
                "solution_set": True,
                "solutions": [{
                    "assignments": [{
                        "variable": str(variable),
                        "value": sp.pretty(
                            solution_set,
                            use_unicode=True,
                            wrap_line=False,
                        ),
                        "free": False,
                    }],
                }],
                "infinitely_many": False,
            }
    else:
        solutions = sp.solve(nontrivial_relations, variables, dict=True)

    if not solutions:
        return {
            "status": "No solutions were found.",
            "variables": sorted(symbols),
            "solutions": [],
            "infinitely_many": False,
        }

    formatted_solutions = []
    for solution in solutions:
        assignments = []
        for variable in variables:
            value = solution.get(variable)
            assignments.append({
                "variable": str(variable),
                "value": (
                    "Any value"
                    if value is None
                    else sp.pretty(sp.simplify(value), use_unicode=True, wrap_line=False)
                ),
                "free": value is None,
            })
        formatted_solutions.append({"assignments": assignments})

    return {
        "status": f"Found {len(formatted_solutions)} solution(s).",
        "variables": sorted(symbols),
        "solutions": formatted_solutions,
        "infinitely_many": False,
    }


# ---------------------------------------------------------
# FLASK ROUTES
# ---------------------------------------------------------

@app.route("/")
def home():
    return send_file(PROJECT_ROOT / "index.html")


@app.route("/style.css")
def home_stylesheet():
    return send_file(PROJECT_ROOT / "style.css", mimetype="text/css")


@app.route("/script.js")
def home_script():
    return send_file(PROJECT_ROOT / "script.js", mimetype="application/javascript")


@app.route("/icon.png")
def site_icon():
    return send_file(PROJECT_ROOT / "icon.png", mimetype="image/png")


@app.route("/unit-converter/")
def unit_converter():
    return send_file(PROJECT_ROOT / "Unit_Converter" / "index.html")


@app.route("/unit-converter/style.css")
def unit_converter_stylesheet():
    return send_file(
        PROJECT_ROOT / "Unit_Converter" / "style.css",
        mimetype="text/css",
    )


@app.route("/unit-converter/script.js")
def unit_converter_script():
    return send_file(
        PROJECT_ROOT / "Unit_Converter" / "script.js",
        mimetype="application/javascript",
    )


@app.route("/algebra/")
def algebra():
    return send_file(PROJECT_ROOT / "algebra" / "index.html")


@app.route("/algebra/style.css")
def algebra_stylesheet():
    return send_file(PROJECT_ROOT / "algebra" / "style.css", mimetype="text/css")


@app.route("/algebra/script.js")
def algebra_script():
    return send_file(
        PROJECT_ROOT / "algebra" / "script.js",
        mimetype="application/javascript",
    )


@app.route("/algebra/solve", methods=["POST"])
def algebra_solve():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Send equations as a JSON object."}), 400
    try:
        return jsonify(solve_algebra_system(data.get("equations")))
    except (
        SyntaxError,
        ValueError,
        TypeError,
        NotImplementedError,
        RecursionError,
        ZeroDivisionError,
        sp.PolynomialError,
    ) as error:
        return jsonify({"error": str(error)}), 400


@app.route("/scientific-calculator")
def scientific_calculator():
    return render_template("calculator.html")


@app.route("/calculate", methods=["POST"])
def calculate():
    data = request.get_json(silent=True) or {}

    expression = str(data.get("expression", "")).strip()
    display_mode = data.get("format", "fraction")
    angle_mode = data.get("angle", "DEG")

    if not expression:
        return jsonify({"error": "Enter a calculation first."}), 400

    if len(expression) > MAX_EXPRESSION_LENGTH:
        return jsonify({"error": "Expression is too long."}), 400

    if display_mode not in {"fraction", "decimal", "mixed", "remainder"}:
        return jsonify({"error": "Invalid answer format."}), 400

    if angle_mode not in {"DEG", "RAD"}:
        return jsonify({"error": "Invalid angle mode."}), 400

    try:
        normalised = normalise_expression(expression)
        tree = ast.parse(normalised, mode="eval")

        if sum(1 for _ in ast.walk(tree)) > MAX_AST_NODES:
            raise ValueError("Expression is too complicated.")

        result = build_expression(tree, angle_mode)
        answer = format_answer(
            result,
            display_mode,
            tree,
            angle_mode,
        )
        if isinstance(result, BaseAnswer):
            answer_latex = None
            answer_mathml = None
        else:
            simplified = sp.simplify(result)
            answer_latex = sp.latex(simplified)
            answer_mathml = (
                sp.mathml(simplified, printer="presentation")
                if display_mode == "fraction"
                else None
            )

        return jsonify({
            "answer": answer,
            "answer_input": expression_for_answer(result),
            "answer_latex": answer_latex,
            "answer_mathml": answer_mathml,
        })

    except (
        SyntaxError,
        TypeError,
        ValueError,
        ZeroDivisionError,
        OverflowError,
    ) as error:
        return jsonify({
            "error": str(error) or "Invalid expression."
        }), 400

    except Exception:
        app.logger.exception("Unexpected calculator error")
        return jsonify({
            "error": "Could not calculate that expression."
        }), 400


if __name__ == "__main__":
    app.run(debug=True)

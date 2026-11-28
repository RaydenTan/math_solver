import ast
import math
import re

import sympy as sp

MAX_ALGEBRA_AST_NODES = 100
MAX_ALGEBRA_EQUATIONS = 12
MAX_ALGEBRA_EXPRESSION_LENGTH = 300
MAX_ALGEBRA_TOTAL_LENGTH = 1800
MAX_ALGEBRA_VARIABLES = 12
MAX_ALGEBRA_EXPONENT = 100
ALGEBRA_GRAPH_FUNCTION_SAMPLES = 161
ALGEBRA_GRAPH_GRID_SAMPLES = 41

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


class AlgebraModeError(ValueError):
    def __init__(self, message, recommendation):
        super().__init__(message)
        self.recommendation = recommendation


def validate_algebra_tree(tree, expression_label):
    if sum(1 for _ in ast.walk(tree)) > MAX_ALGEBRA_AST_NODES:
        raise ValueError(f"{expression_label} is too complicated.")

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
                raise ValueError(f"Unsupported algebra function: {node.func.id}.")


def algebra_variable_names(tree):
    function_names = {
        node.func.id.lower()
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    return {
        node.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Name)
        and node.id.lower() not in function_names
        and node.id.lower() not in {"pi", "tau", "phi"}
    }


def normalise_algebra_expression(expression, expression_normalizer):
    normalized = expression_normalizer(expression)
    return re.sub(
        r"(\d+(?:\.\d*)?|\.\d+)([A-Za-z])(?![+-]?\d)",
        r"\1*\2",
        normalized,
    )


def parse_algebra_equation(
    expression,
    symbols,
    expression_normalizer,
    expression_builder,
):
    normalized = normalise_algebra_expression(expression, expression_normalizer)
    if normalized.count("=") > 1 or any(
        operator in normalized for operator in ("<=", ">=", "==", "!=")
    ):
        raise ValueError("Use one equals sign (=) for each equation.")

    sides = [side.strip() for side in normalized.split("=", 1)]
    if len(sides) == 1:
        sides.append("0")
    if not sides[0] or not sides[1]:
        raise ValueError("Enter an expression on both sides of the equals sign.")

    trees = [ast.parse(side, mode="eval") for side in sides]
    for tree in trees:
        validate_algebra_tree(tree, "An equation")

    left = expression_builder(trees[0], "RAD", symbols)
    right = expression_builder(trees[1], "RAD", symbols)
    return sp.simplify(left - right)


def parse_algebra_expression(
    expression,
    expression_normalizer,
    expression_builder,
    known_symbols=None,
):
    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("Enter an expression.")
    if len(expression) > MAX_ALGEBRA_EXPRESSION_LENGTH:
        raise ValueError(
            f"An expression must be {MAX_ALGEBRA_EXPRESSION_LENGTH} characters or fewer."
        )

    normalized = normalise_algebra_expression(expression.strip(), expression_normalizer)
    if "=" in normalized:
        raise ValueError(
            "This mode expects an expression, not an equation. "
            "Choose Solve all variables or Find an expression from a system."
        )

    tree = ast.parse(normalized, mode="eval")
    validate_algebra_tree(tree, "The expression")

    symbols = dict(known_symbols or {})
    for name in algebra_variable_names(tree):
        symbols.setdefault(name, sp.Symbol(name))
    if len(symbols) > MAX_ALGEBRA_VARIABLES:
        raise ValueError(
            f"Use at most {MAX_ALGEBRA_VARIABLES} variables in one expression."
        )

    return expression_builder(tree, "RAD", symbols), symbols


def parse_algebra_system(equations, expression_normalizer, expression_builder):
    if not isinstance(equations, list):
        raise ValueError("Send equations as a list of expression lines.")

    if not equations or len(equations) > MAX_ALGEBRA_EQUATIONS:
        raise ValueError(
            f"Enter between 1 and {MAX_ALGEBRA_EQUATIONS} equations."
        )

    if any(not isinstance(equation, str) for equation in equations):
        raise ValueError("Each equation must be text.")

    cleaned_equations = [
        equation.strip()
        for equation in equations
        if equation.strip()
    ]
    if not cleaned_equations:
        raise ValueError("Enter at least one equation.")
    if any(
        len(equation) > MAX_ALGEBRA_EXPRESSION_LENGTH
        for equation in cleaned_equations
    ):
        raise ValueError(
            f"Each equation must be {MAX_ALGEBRA_EXPRESSION_LENGTH} characters or fewer."
        )
    if sum(map(len, cleaned_equations)) > MAX_ALGEBRA_TOTAL_LENGTH:
        raise ValueError(
            f"All equations combined must be {MAX_ALGEBRA_TOTAL_LENGTH} characters or fewer."
        )

    parsed_trees = []
    for equation in cleaned_equations:
        normalized = normalise_algebra_expression(equation, expression_normalizer)
        if normalized.count("=") > 1:
            raise ValueError("Use one equals sign (=) for each equation.")
        sides = [side.strip() for side in normalized.split("=", 1)]
        if len(sides) == 1:
            sides.append("0")
        if not sides[0].strip() or not sides[1].strip():
            raise ValueError("Enter an expression on both sides of the equals sign.")
        parsed_trees.extend(ast.parse(side, mode="eval") for side in sides)

    variable_names = set().union(
        *(algebra_variable_names(tree) for tree in parsed_trees)
    )
    if len(variable_names) > MAX_ALGEBRA_VARIABLES:
        raise ValueError(
            f"Solve at most {MAX_ALGEBRA_VARIABLES} variables at a time."
        )
    symbols = {
        name: sp.Symbol(name)
        for name in sorted(variable_names)
    }

    relations = [
        parse_algebra_equation(
            equation,
            symbols,
            expression_normalizer,
            expression_builder,
        )
        for equation in cleaned_equations
    ]
    relations = [sp.simplify(relation) for relation in relations]
    variables = [symbols[name] for name in sorted(symbols)]
    nontrivial_relations = [relation for relation in relations if relation != 0]

    return symbols, variables, relations, nontrivial_relations


def algebra_solution_maps(variables, nontrivial_relations):
    if not nontrivial_relations:
        return "identity", []

    if not variables:
        return "finite", []

    if len(variables) == 1 and len(nontrivial_relations) == 1:
        solution_set = sp.solveset(
            nontrivial_relations[0],
            variables[0],
            domain=sp.S.Complexes,
        )
        if solution_set == sp.S.EmptySet:
            return "finite", []
        if isinstance(solution_set, sp.FiniteSet):
            return "finite", [
                {variables[0]: value}
                for value in solution_set
            ]
        return "set", solution_set

    return "finite", sp.solve(nontrivial_relations, variables, dict=True)


def solve_algebra_system(
    equations,
    expression_normalizer,
    expression_builder,
):
    symbols, variables, relations, nontrivial_relations = parse_algebra_system(
        equations, expression_normalizer, expression_builder
    )

    if not nontrivial_relations:
        return {
            "status": "Every value of the listed variables satisfies these identities.",
            "variables": sorted(symbols),
            "solutions": [],
            "infinitely_many": True,
        }

    if not variables:
        return {
            "status": (
                "No solutions."
                if any(relation != 0 for relation in relations)
                else "Identity."
            ),
            "variables": [],
            "solutions": [],
            "infinitely_many": not any(relation != 0 for relation in relations),
        }

    solution_kind, solutions = algebra_solution_maps(
        variables,
        nontrivial_relations,
    )
    if solution_kind == "set":
        return {
            "status": "Returned the complete symbolic solution set.",
            "variables": sorted(symbols),
            "solution_set": True,
            "solutions": [{
                "assignments": [{
                    "variable": str(variables[0]),
                    "value": sp.pretty(
                        solutions,
                        use_unicode=True,
                        wrap_line=False,
                    ),
                    "free": False,
                }],
            }],
            "infinitely_many": False,
        }

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


def evaluate_algebra_expression(
    equations,
    expression,
    expression_normalizer,
    expression_builder,
):
    symbols, variables, relations, nontrivial_relations = parse_algebra_system(
        equations, expression_normalizer, expression_builder
    )
    target, expression_symbols = parse_algebra_expression(
        expression, expression_normalizer, expression_builder, symbols
    )
    solution_kind, solutions = algebra_solution_maps(
        variables,
        nontrivial_relations,
    )

    if solution_kind == "identity":
        values = [sp.simplify(target)]
    elif solution_kind == "set":
        parameter = sp.Dummy(str(variables[0]))
        value_set = sp.imageset(
            sp.Lambda(parameter, target.subs(variables[0], parameter)),
            solutions,
        )
        values = [value_set]
    elif not solutions:
        raise AlgebraModeError(
            "The equations have no solution, so the expression cannot be evaluated.",
            "Choose “Solve all variables” to inspect the system, or correct the equations.",
        )
    else:
        values = []
        seen_values = set()
        for solution in solutions:
            value = sp.simplify(target.subs(solution, simultaneous=True))
            if value not in seen_values:
                seen_values.add(value)
                values.append(value)

    formatted_values = [
        {
            "value": sp.pretty(value, use_unicode=True, wrap_line=False),
            "free_variables": sorted(str(symbol) for symbol in value.free_symbols),
        }
        for value in values
    ]

    return {
        "status": (
            f"Found {len(formatted_values)} possible value(s) for the expression."
        ),
        "expression": sp.pretty(target, use_unicode=True, wrap_line=False),
        "values": formatted_values,
        "variables": sorted(str(symbol) for symbol in expression_symbols.values()),
    }


def simplify_algebra_expression(
    expression,
    expression_normalizer,
    expression_builder,
    operation="simplify",
):
    value, symbols = parse_algebra_expression(
        expression, expression_normalizer, expression_builder
    )
    if operation == "simplify":
        result = sp.simplify(value)
    elif operation == "expand":
        result = sp.expand(value)
    elif operation == "factor":
        result = sp.factor(value)
    elif operation == "collect":
        variables = sorted(value.free_symbols, key=str)
        result = value
        for variable in variables:
            result = sp.collect(result, variable)
    else:
        raise ValueError("Choose simplify, expand, factor, or collect.")

    return {
        "status": {
            "simplify": "Expression simplified.",
            "expand": "Brackets expanded.",
            "factor": "Expression factored.",
            "collect": "Like terms collected.",
        }[operation],
        "operation": operation,
        "result": sp.pretty(result, use_unicode=True, wrap_line=False),
        "variables": sorted(str(symbol) for symbol in symbols.values()),
    }


def algebra_graph_numeric_value(expression, substitutions):
    try:
        numeric_value = complex(sp.N(expression.subs(substitutions), 15))
    except (
        TypeError,
        ValueError,
        ZeroDivisionError,
        OverflowError,
        RecursionError,
        NotImplementedError,
    ):
        return None

    if (
        not math.isfinite(numeric_value.real)
        or not math.isfinite(numeric_value.imag)
        or abs(numeric_value.imag) > 1e-10
        or abs(numeric_value.real) > 1e12
    ):
        return None

    return float(numeric_value.real)


def algebra_graph_data(
    mode,
    expression_normalizer,
    expression_builder,
    equations=None,
    expression=None,
):
    if mode in {"solve", "evaluate"}:
        symbols, variables, relations, _ = parse_algebra_system(
            equations,
            expression_normalizer,
            expression_builder,
        )
        cleaned_equations = [equation.strip() for equation in equations if equation.strip()]
        traces = list(zip(cleaned_equations, relations))
    elif mode == "simplify":
        value, symbols = parse_algebra_expression(
            expression,
            expression_normalizer,
            expression_builder,
        )
        variables = [symbols[name] for name in sorted(symbols)]
        traces = [(expression.strip(), value)]
    else:
        raise ValueError("Choose an algebra goal before graphing.")

    if len(variables) > 1:
        x_variable, y_variable = variables[:2]
        fixed_variables = {variable: 0 for variable in variables[2:]}
        x_values = [
            -10 + 20 * index / (ALGEBRA_GRAPH_GRID_SAMPLES - 1)
            for index in range(ALGEBRA_GRAPH_GRID_SAMPLES)
        ]
        y_values = x_values.copy()
        plotted_traces = []

        for label, relation in traces:
            identity = relation == 0
            grid = []
            if not identity:
                for y_value in y_values:
                    row = []
                    for x_value in x_values:
                        substitutions = {
                            **fixed_variables,
                            x_variable: x_value,
                            y_variable: y_value,
                        }
                        row.append(
                            algebra_graph_numeric_value(relation, substitutions)
                        )
                    grid.append(row)
            plotted_traces.append({
                "label": label,
                "identity": identity,
                "grid": grid,
            })

        return {
            "plot_type": "implicit",
            "value_type": "expression" if mode == "simplify" else "equation",
            "variables": [str(x_variable), str(y_variable)],
            "x_values": x_values,
            "y_values": y_values,
            "traces": plotted_traces,
            "slice": [
                {"variable": str(variable), "value": "0"}
                for variable in variables[2:]
            ],
        }

    variable = variables[0] if variables else sp.Symbol("x")
    x_values = [
        -10 + 20 * index / (ALGEBRA_GRAPH_FUNCTION_SAMPLES - 1)
        for index in range(ALGEBRA_GRAPH_FUNCTION_SAMPLES)
    ]
    plotted_traces = []

    for label, relation in traces:
        identity = relation == 0
        values = (
            [0.0] * len(x_values)
            if identity
            else [
                algebra_graph_numeric_value(relation, {variable: x_value})
                for x_value in x_values
            ]
        )
        plotted_traces.append({
            "label": label,
            "identity": identity,
            "values": values,
        })

    return {
        "plot_type": "function",
        "value_type": "expression" if mode == "simplify" else "equation",
        "variables": [str(variable)],
        "x_values": x_values,
        "traces": plotted_traces,
        "slice": [],
    }


class AlgebraSolver:
    def __init__(self, expression_normalizer, expression_builder):
        self._expression_normalizer = expression_normalizer
        self._expression_builder = expression_builder

    def solve_algebra_system(self, equations):
        return solve_algebra_system(
            equations, self._expression_normalizer, self._expression_builder
        )

    def evaluate_algebra_expression(self, equations, expression):
        return evaluate_algebra_expression(
            equations,
            expression,
            self._expression_normalizer,
            self._expression_builder,
        )

    def simplify_algebra_expression(self, expression, operation="simplify"):
        return simplify_algebra_expression(
            expression,
            self._expression_normalizer,
            self._expression_builder,
            operation,
        )

    def algebra_graph_data(self, mode, equations=None, expression=None):
        return algebra_graph_data(
            mode,
            self._expression_normalizer,
            self._expression_builder,
            equations=equations,
            expression=expression,
        )


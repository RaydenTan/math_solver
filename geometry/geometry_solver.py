from __future__ import annotations

import base64
import io
import math
import re
import threading
from collections.abc import Sequence
from typing import Any

import cv2
import numpy as np
import sympy as sp
from matplotlib.backends.backend_svg import FigureCanvasSVG
from matplotlib.figure import Figure
from matplotlib.patches import Circle, Ellipse, Polygon, Rectangle


MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_TEXT_LENGTH = 5000

SHAPE_PATTERNS = [
    ("rightTriangle", r"right[\s-]*triangle|90\s*degree\s*triangle"),
    ("cuboid", r"rectangular\s+prism|cuboid"),
    ("circle", r"circles?"),
    ("square", r"squares?"),
    ("rectangle", r"rectangles?"),
    ("pentagon", r"pentagons?"),
    ("triangle", r"triangles?"),
    ("cube", r"cubes?"),
    ("sphere", r"spheres?"),
    ("cylinder", r"cylinders?"),
    ("cone", r"cones?"),
]

SHAPE_LABELS = {
    "rightTriangle": "Right triangle",
    "cuboid": "Rectangular prism",
    "circle": "Circle",
    "square": "Square",
    "rectangle": "Rectangle",
    "pentagon": "Pentagon",
    "triangle": "Triangle",
    "cube": "Cube",
    "sphere": "Sphere",
    "cylinder": "Cylinder",
    "cone": "Cone",
}

GOAL_LABELS = {
    "area": "area",
    "circumference": "circumference",
    "perimeter": "perimeter",
    "volume": "volume",
    "surfaceArea": "surface area",
    "angleA": "angle A",
    "angleB": "angle B",
    "angleC": "angle C",
    "hypotenuse": "hypotenuse",
    "missingSide": "missing side",
    "pi": "value of pi",
}

_OCR_READER: Any | None = None
_OCR_LOCK = threading.Lock()


class GeometryInputError(ValueError):
    """The question does not contain enough valid information to solve."""


class GeometryServiceError(RuntimeError):
    """An image-processing dependency could not complete its work."""


def _normalise_text(text: str) -> str:
    normalized = text.lower().replace("π", "pi").replace("×", " x ")
    latex_symbols = {
        r"\triangle": " triangle ",
        r"\square": " square ",
        r"\circ": " circle ",
        r"\angle": " angle ",
        r"\pi": " pi ",
        r"\parallel": " parallel ",
        r"\perp": " perpendicular ",
        r"\cong": " congruent ",
        r"\sim": " similar ",
    }
    for notation, word in latex_symbols.items():
        normalized = re.sub(re.escape(notation) + r"\b", word, normalized)
    symbol_words = {
        "△": " triangle ",
        "∆": " triangle ",
        "○": " circle ",
        "□": " square ",
        "∠": " angle ",
        "°": " degree ",
        "∥": " parallel ",
        "⊥": " perpendicular ",
        "≅": " congruent ",
        "∼": " similar ",
    }
    return normalized.translate(str.maketrans(symbol_words))


def _shape_candidates(text: str) -> list[str]:
    normalized = _normalise_text(text)
    found = [
        key
        for key, pattern in SHAPE_PATTERNS
        if re.search(rf"\b(?:{pattern})\b", normalized)
    ]
    if "rightTriangle" in found and "triangle" in found:
        found.remove("triangle")
    return list(dict.fromkeys(found))


def _find_target_shape(question: str, goal: str | None) -> str | None:
    if not goal:
        return None

    normalized = _normalise_text(question)
    goal_pattern = {
        "surfaceArea": r"(?:total\s+)?surface\s+area",
        "area": r"area",
        "perimeter": r"perimeter",
        "circumference": r"circumference",
        "volume": r"volume",
        "hypotenuse": r"hypotenuse",
        "missingSide": r"(?:missing|unknown)\s+side",
        "angleA": r"angle(?:\s+at)?\s+a",
        "angleB": r"angle(?:\s+at)?\s+b",
        "angleC": r"angle(?:\s+at)?\s+c",
    }.get(goal)
    if not goal_pattern:
        return None

    for key, shape_pattern in SHAPE_PATTERNS:
        if re.search(
            rf"\b{goal_pattern}\s+(?:of|for)\s+(?:(?:the|a|an|big|large|small|outer|inner)\s+)*(?:{shape_pattern})\b",
            normalized,
        ) or re.search(
            rf"\b(?:{shape_pattern})(?:'s)?\s+{goal_pattern}\b",
            normalized,
        ):
            return key
    return None


def _find_goal(question: str, combined_text: str) -> str | None:
    normalized = _normalise_text(question)
    if not normalized:
        normalized = _normalise_text(combined_text)

    if re.search(r"\b(?:total\s+)?surface\s+area\b", normalized):
        return "surfaceArea"
    if re.search(r"\b(?:volume|capacity)\b", normalized):
        return "volume"
    if re.search(r"\bcircumference\b", normalized):
        return "circumference"
    if re.search(r"\bperimeter\b", normalized):
        return "perimeter"
    for letter, goal in (("a", "angleA"), ("b", "angleB"), ("c", "angleC")):
        if re.search(rf"\bangle(?:\s+at)?\s+{letter}\b", normalized):
            return goal
    if re.search(r"\b(?:hypotenuse|longest\s+side)\b", normalized):
        return "hypotenuse"
    if re.search(r"\b(?:missing|unknown)\s+side\b|\bfind\s+the\s+side\b", normalized):
        return "missingSide"
    if re.search(r"\barea\b", normalized):
        return "area"
    if re.search(r"\bpi\b", normalized):
        return "pi"
    return None


def _find_measurement(label: str, text: str) -> float | None:
    number = r"(-?\d+(?:\.\d+)?)"
    after = re.search(rf"\b{label}\b[^\d\n]{{0,35}}?{number}", text)
    if after:
        return float(after.group(1))
    before = re.search(
        rf"{number}\s*(?:mm|cm|m|km|inches?|in|feet|ft)?\s+(?:of\s+)?\b{label}\b",
        text,
    )
    return float(before.group(1)) if before else None


def _extract_measurements(shape: str | None, text: str) -> dict[str, float]:
    aliases: dict[str, Sequence[str]] = {
        "radius": ("radius", "rad"),
        "diameter": ("diameter",),
        "side": ("side length", "side", "edge"),
        "length": ("length", "long side"),
        "width": ("width", "breadth", "short side"),
        "base": ("base",),
        "height": ("height", "tall"),
        "sideA": ("side a", "side 1"),
        "sideB": ("side b", "side 2"),
        "sideC": ("side c", "side 3"),
        "sideD": ("side d", "side 4"),
        "sideE": ("side e", "side 5"),
        "legA": ("leg a", "side a", "first leg"),
        "legB": ("leg b", "side b", "second leg"),
        "hypotenuse": ("hypotenuse", "side c"),
        "slantHeight": ("slant height", "slope height"),
    }

    if shape in {"triangle", "pentagon"}:
        keys = ["base", "height", "sideA", "sideB", "sideC"]
        if shape == "pentagon":
            keys.extend(("sideD", "sideE"))
    elif shape == "rightTriangle":
        keys = ["legA", "legB", "hypotenuse", "height"]
    elif shape in {"circle", "sphere"}:
        keys = ["radius", "diameter"]
    elif shape in {"square", "cube"}:
        keys = ["side"]
    elif shape in {"rectangle", "cuboid"}:
        keys = ["length", "width", "height"]
    elif shape in {"cylinder", "cone"}:
        keys = ["radius", "height", "slantHeight"]
    else:
        keys = list(aliases)

    measurements: dict[str, float] = {}
    for key in keys:
        for alias in aliases[key]:
            value = _find_measurement(re.escape(alias), text)
            if value is not None:
                measurements[key] = value
                break

    number = r"(\d+(?:\.\d+)?)"
    if shape == "rightTriangle" and not {
        "legA",
        "legB",
    }.issubset(measurements):
        legs = re.search(
            rf"\blegs?\s*(?:are|of|=|:)?\s*{number}\s*(?:and|,|&)\s*{number}",
            text,
        )
        if legs:
            measurements.setdefault("legA", float(legs.group(1)))
            measurements.setdefault("legB", float(legs.group(2)))

    if shape == "triangle" and not {
        "sideA",
        "sideB",
        "sideC",
    }.issubset(measurements):
        sides = re.search(
            rf"\bsides?\s*(?:are|of|=|:)?\s*{number}\s*,?\s*{number}\s*(?:,|and)\s*{number}",
            text,
        )
        if sides:
            for key, group in zip(("sideA", "sideB", "sideC"), range(1, 4)):
                measurements.setdefault(key, float(sides.group(group)))

    if shape == "pentagon" and not all(
        key in measurements for key in ("sideA", "sideB", "sideC", "sideD", "sideE")
    ):
        sides = re.search(
            rf"\bsides?\s*(?:are|of|=|:)?\s*{number}\s*,\s*{number}\s*,\s*{number}\s*,\s*{number}\s*,?\s*(?:and\s*)?{number}",
            text,
        )
        if sides:
            for key, group in zip(
                ("sideA", "sideB", "sideC", "sideD", "sideE"),
                range(1, 6),
            ):
                measurements.setdefault(key, float(sides.group(group)))

    if shape in {"rectangle", "cuboid"}:
        dimension_count = 3 if shape == "cuboid" else 2
        dimension_pattern = number + r"\s*(?:mm|cm|m|in|ft)?\s*(?:by|x)\s*" + number
        if dimension_count == 3:
            dimension_pattern += r"\s*(?:mm|cm|m|in|ft)?\s*(?:by|x)\s*" + number
        dimensions = re.search(dimension_pattern, text)
        if dimensions:
            measurements.setdefault("length", float(dimensions.group(1)))
            measurements.setdefault("width", float(dimensions.group(2)))
            if dimension_count == 3:
                measurements.setdefault("height", float(dimensions.group(3)))

    if shape == "circle":
        if "diameter" in measurements:
            measurements.setdefault("radius", measurements["diameter"] / 2)
        large_radius = re.search(
            r"\b(?:big|large|outer|larger)\s+circle\b.{0,40}\bradius\b[^\d\n]{0,20}(\d+(?:\.\d+)?)",
            text,
        )
        if large_radius:
            measurements["radius"] = float(large_radius.group(1))

    return measurements


def parse_geometry(
    diagram_description: str,
    question: str,
    ocr_text: str = "",
    detected_shapes: Sequence[str] = (),
) -> dict[str, Any]:
    if len(diagram_description) > MAX_TEXT_LENGTH or len(question) > MAX_TEXT_LENGTH:
        raise GeometryInputError("Please keep each text box under 5,000 characters.")

    combined_text = "\n".join(
        text for text in (diagram_description, question, ocr_text) if text
    )
    normalized_text = _normalise_text(combined_text)
    normalized_question = _normalise_text(question)
    described_shapes = _shape_candidates(combined_text)
    for shape in detected_shapes:
        if shape in SHAPE_LABELS and shape not in described_shapes:
            described_shapes.append(shape)

    goal = _find_goal(question, combined_text)
    shape = _find_target_shape(question, goal)
    if shape is None and len(described_shapes) == 1:
        shape = described_shapes[0]
    if shape is None and goal == "pi":
        shape = "circle"

    measurements = _extract_measurements(shape, normalized_text)
    unit_match = re.search(r"\b(mm|cm|km|m|inches?|in|feet|ft)\b", normalized_text)
    unit = unit_match.group(1) if unit_match else ""
    if unit == "inches":
        unit = "in"
    elif unit == "feet":
        unit = "ft"

    return {
        "shape": shape,
        "goal": goal,
        "shapes": described_shapes,
        "measurements": measurements,
        "unit": unit,
        "normalized_text": normalized_text,
        "normalized_question": normalized_question,
    }


def _format_number(value: sp.Expr) -> str:
    numeric = float(sp.N(value, 12))
    if not math.isfinite(numeric):
        raise GeometryInputError("The measurements do not produce a finite answer.")
    if math.isclose(numeric, round(numeric), rel_tol=0, abs_tol=1e-10):
        return f"{round(numeric):,}"
    return f"{numeric:,.6f}".rstrip("0").rstrip(".")


def _require(measurements: dict[str, float], *keys: str) -> None:
    for key in keys:
        value = measurements.get(key)
        if value is None or not math.isfinite(value) or value <= 0:
            labels = {
                "sideA": "Side a",
                "sideB": "Side b",
                "sideC": "Side c",
                "sideD": "Side d",
                "sideE": "Side e",
                "legA": "Leg a",
                "legB": "Leg b",
                "slantHeight": "Slant height",
            }
            raise GeometryInputError(f"Enter a positive {labels.get(key, key)}.")


def _solve(
    parsed: dict[str, Any],
) -> tuple[str, str, int, str, list[str]]:
    shape = parsed["shape"]
    goal = parsed["goal"]
    measurements = parsed["measurements"]
    unit = parsed["unit"]
    label = SHAPE_LABELS[shape].lower()
    values = {key: sp.Rational(str(value)) for key, value in measurements.items()}
    pi = sp.pi

    if shape == "circle" and goal == "pi":
        result = sp.N(pi, 12)
        return (
            "The value of pi",
            "π = circumference ÷ diameter",
            0,
            f"Pi is the constant ratio between a circle's circumference and its diameter. Therefore, π ≈ {_format_number(pi)}.",
            [
                "Pi is the constant ratio between a circle's circumference and its diameter.",
                f"Therefore, π ≈ {_format_number(pi)}.",
            ],
        )

    if shape == "circle" and goal in {"area", "circumference"}:
        if "radius" not in values:
            raise GeometryInputError("Enter the circle's radius or diameter.")
        radius = values["radius"]
        if goal == "area":
            name, formula, power = "Circle area", "A = πr²", 2
            expression = pi * radius**2
            substitutions = [
                f"Use radius r = {_format_number(radius)}{f' {unit}' if unit else ''}.",
                f"Substitute: A = π × {_format_number(radius)}².",
            ]
        else:
            name, formula, power = "Circle circumference", "C = 2πr", 1
            expression = 2 * pi * radius
            substitutions = [
                f"Use radius r = {_format_number(radius)}{f' {unit}' if unit else ''}.",
                f"Substitute: C = 2 × π × {_format_number(radius)}.",
            ]
    elif shape == "square" and goal in {"area", "perimeter"}:
        _require(measurements, "side")
        side = values["side"]
        if goal == "area":
            name, formula, power, expression = "Square area", "A = s²", 2, side**2
            substitutions = [f"Substitute: A = {_format_number(side)}²."]
        else:
            name, formula, power, expression = "Square perimeter", "P = 4s", 1, 4 * side
            substitutions = [f"Substitute: P = 4 × {_format_number(side)}."]
    elif shape == "rectangle" and goal in {"area", "perimeter"}:
        _require(measurements, "length", "width")
        length, width = values["length"], values["width"]
        if goal == "area":
            name, formula, power = "Rectangle area", "A = lw", 2
            expression = length * width
            substitutions = [
                f"Substitute: A = {_format_number(length)} × {_format_number(width)}."
            ]
        else:
            name, formula, power = "Rectangle perimeter", "P = 2(l + w)", 1
            expression = 2 * (length + width)
            substitutions = [
                f"Substitute: P = 2 × ({_format_number(length)} + {_format_number(width)})."
            ]
    elif shape == "triangle" and goal in {"area", "perimeter"}:
        if goal == "area":
            _require(measurements, "base", "height")
            base, height = values["base"], values["height"]
            name, formula, power = "Triangle area", "A = ½bh", 2
            expression = base * height / 2
            substitutions = [
                f"Substitute: A = ½ × {_format_number(base)} × {_format_number(height)}."
            ]
        else:
            _require(measurements, "sideA", "sideB", "sideC")
            a, b, c = values["sideA"], values["sideB"], values["sideC"]
            if a + b <= c or a + c <= b or b + c <= a:
                raise GeometryInputError("Those side lengths cannot form a triangle.")
            name, formula, power = "Triangle perimeter", "P = a + b + c", 1
            expression = a + b + c
            substitutions = [
                f"Substitute: P = {_format_number(a)} + {_format_number(b)} + {_format_number(c)}."
            ]
    elif shape == "triangle" and goal in {"angleA", "angleB", "angleC"}:
        _require(measurements, "sideA", "sideB", "sideC")
        a, b, c = values["sideA"], values["sideB"], values["sideC"]
        if a + b <= c or a + c <= b or b + c <= a:
            raise GeometryInputError("Those side lengths cannot form a triangle.")
        opposite, adjacent_a, adjacent_b = {
            "angleA": (a, b, c),
            "angleB": (b, a, c),
            "angleC": (c, a, b),
        }[goal]
        angle = sp.acos(
            (adjacent_a**2 + adjacent_b**2 - opposite**2)
            / (2 * adjacent_a * adjacent_b)
        ) * 180 / pi
        angle_letter = goal[-1].upper()
        return (
            f"Triangle {angle_letter} angle",
            "cos(A) = (b² + c² − a²) / (2bc)",
            0,
            f"Triangle {angle_letter} angle = {_format_number(sp.N(angle, 12))}°.",
            [
                f"Use the cosine rule with sides {_format_number(opposite)}, {_format_number(adjacent_a)} and {_format_number(adjacent_b)}.",
                f"Apply inverse cosine to find angle {angle_letter}.",
                f"Therefore, angle {angle_letter} = {_format_number(sp.N(angle, 12))}°.",
            ],
        )
    elif shape == "rightTriangle" and goal in {"area", "hypotenuse", "missingSide"}:
        if goal == "area":
            _require(measurements, "legA", "legB")
            a, b = values["legA"], values["legB"]
            name, formula, power = "Right triangle area", "A = ½ab", 2
            expression = a * b / 2
            substitutions = [f"Substitute: A = ½ × {_format_number(a)} × {_format_number(b)}."]
        elif goal == "hypotenuse":
            _require(measurements, "legA", "legB")
            a, b = values["legA"], values["legB"]
            name, formula, power = "Right triangle hypotenuse", "c = √(a² + b²)", 1
            expression = sp.sqrt(a**2 + b**2)
            substitutions = [f"Substitute: c = √({_format_number(a)}² + {_format_number(b)}²)."]
        else:
            known = [key for key in ("legA", "legB", "hypotenuse") if key in values]
            if len(known) != 2:
                raise GeometryInputError("Enter exactly two positive side lengths to find the missing side.")
            a, b, c = (values.get(key) for key in ("legA", "legB", "hypotenuse"))
            if c is None:
                expression = sp.sqrt(a**2 + b**2)
                name, formula = "Missing hypotenuse", "c = √(a² + b²)"
                substitutions = [f"Substitute: c = √({_format_number(a)}² + {_format_number(b)}²)."]
            else:
                known_leg = a if a is not None else b
                if c <= known_leg:
                    raise GeometryInputError("The hypotenuse must be longer than either leg.")
                expression = sp.sqrt(c**2 - known_leg**2)
                name, formula = "Missing right-triangle leg", "a = √(c² − b²)"
                substitutions = [
                    f"Substitute: missing leg = √({_format_number(c)}² − {_format_number(known_leg)}²)."
                ]
            power = 1
    elif shape == "pentagon" and goal == "perimeter":
        _require(measurements, "sideA", "sideB", "sideC", "sideD", "sideE")
        sides = [values[f"side{letter}"] for letter in "ABCDE"]
        name, formula, power = "Pentagon perimeter", "P = a + b + c + d + e", 1
        expression = sum(sides)
        substitutions = [
            "Substitute: P = " + " + ".join(_format_number(side) for side in sides) + "."
        ]
    elif shape in {"cube", "cuboid"} and goal in {"volume", "surfaceArea"}:
        if shape == "cube":
            _require(measurements, "side")
            side = values["side"]
            if goal == "volume":
                name, formula, power, expression = "Cube volume", "V = s³", 3, side**3
                substitutions = [f"Substitute: V = {_format_number(side)}³."]
            else:
                name, formula, power, expression = "Cube surface area", "S = 6s²", 2, 6 * side**2
                substitutions = [f"Substitute: S = 6 × {_format_number(side)}²."]
        else:
            _require(measurements, "length", "width", "height")
            length, width, height = values["length"], values["width"], values["height"]
            if goal == "volume":
                name, formula, power = "Rectangular prism volume", "V = lwh", 3
                expression = length * width * height
                substitutions = [
                    f"Substitute: V = {_format_number(length)} × {_format_number(width)} × {_format_number(height)}."
                ]
            else:
                name, formula, power = "Rectangular prism surface area", "S = 2(lw + lh + wh)", 2
                expression = 2 * (length * width + length * height + width * height)
                substitutions = [
                    f"Substitute: S = 2({_format_number(length)}×{_format_number(width)} + {_format_number(length)}×{_format_number(height)} + {_format_number(width)}×{_format_number(height)})."
                ]
    elif shape in {"sphere", "cylinder", "cone"} and goal in {"volume", "surfaceArea"}:
        if shape == "sphere":
            _require(measurements, "radius")
            radius = values["radius"]
            if goal == "volume":
                name, formula, power = "Sphere volume", "V = ⁴⁄₃πr³", 3
                expression = 4 * pi * radius**3 / 3
                substitutions = [f"Substitute: V = ⁴⁄₃ × π × {_format_number(radius)}³."]
            else:
                name, formula, power = "Sphere surface area", "S = 4πr²", 2
                expression = 4 * pi * radius**2
                substitutions = [f"Substitute: S = 4 × π × {_format_number(radius)}²."]
        elif shape == "cylinder":
            _require(measurements, "radius", "height")
            radius, height = values["radius"], values["height"]
            if goal == "volume":
                name, formula, power = "Cylinder volume", "V = πr²h", 3
                expression = pi * radius**2 * height
                substitutions = [
                    f"Substitute: V = π × {_format_number(radius)}² × {_format_number(height)}."
                ]
            else:
                name, formula, power = "Cylinder total surface area", "S = 2πr(r + h)", 2
                expression = 2 * pi * radius * (radius + height)
                substitutions = [
                    f"Substitute: S = 2 × π × {_format_number(radius)} × ({_format_number(radius)} + {_format_number(height)})."
                ]
        else:
            if goal == "volume":
                _require(measurements, "radius", "height")
                radius, height = values["radius"], values["height"]
                name, formula, power = "Cone volume", "V = ⅓πr²h", 3
                expression = pi * radius**2 * height / 3
                substitutions = [
                    f"Substitute: V = ⅓ × π × {_format_number(radius)}² × {_format_number(height)}."
                ]
            else:
                _require(measurements, "radius", "slantHeight")
                radius, slant = values["radius"], values["slantHeight"]
                name, formula, power = "Cone total surface area", "S = πr(r + ℓ)", 2
                expression = pi * radius * (radius + slant)
                substitutions = [
                    f"Substitute: S = π × {_format_number(radius)} × ({_format_number(radius)} + {_format_number(slant)})."
                ]
    elif shape == "triangle" and goal == "area":
        raise GeometryInputError("Enter the triangle's base and perpendicular height.")
    elif shape == "pentagon" and goal == "area":
        raise GeometryInputError(
            "An irregular pentagon's area needs enough dimensions, such as vertex coordinates or a valid split into simpler shapes."
        )
    else:
        raise GeometryInputError(
            "That shape and question combination is not supported yet. Check the target and measurements."
        )

    result = sp.simplify(expression)
    result_text = _format_number(result)
    unit_suffix = ""
    if unit and power:
        unit_suffix = f" {unit}" + ("²" if power == 2 else "³" if power == 3 else "")

    diagram_step = f"Read the diagram: focus on the {label}."
    if measurements:
        summary = ", ".join(
            f"{key} {_format_number(sp.Rational(str(value)))}{f' {unit}' if unit else ''}"
            for key, value in measurements.items()
        )
        diagram_step += f" The measurements are {summary}."

    return (
        name,
        formula,
        power,
        result_text + unit_suffix,
        [
            diagram_step,
            f"Formula: {formula}.",
            *substitutions,
            f"Therefore, {name.lower()} = {result_text}{unit_suffix}.",
        ],
    )


def _shape_color(shape: str, target_shape: str) -> tuple[str, str]:
    if shape == target_shape:
        return "#126e9d", "#dff3fb"
    return "#839aa6", "#f4f7f8"


def _render_diagram_svg(
    text: str,
    parsed: dict[str, Any],
    detected_shapes: Sequence[str],
) -> str:
    figure = Figure(figsize=(6, 4), facecolor="#fbfdfe")
    canvas = FigureCanvasSVG(figure)
    axes = figure.add_axes((0.06, 0.06, 0.88, 0.88))
    axes.set_xlim(0, 320)
    axes.set_ylim(220, 0)
    axes.set_aspect("equal")
    axes.axis("off")
    axes.set_facecolor("#fbfdfe")

    target_shape = parsed["shape"] or ""
    candidates = parsed["shapes"] or list(detected_shapes)
    normalized = _normalise_text(text)
    measurements = parsed["measurements"]
    unit = parsed["unit"]

    def label(x: float, y: float, value: str, *, align: str = "center") -> None:
        if value:
            axes.text(
                x,
                y,
                value,
                ha=align,
                va="center",
                fontsize=10,
                color="#31576d",
                fontweight="bold",
                bbox={"facecolor": "#fbfdfe", "edgecolor": "none", "pad": 1.5},
            )

    def add_circle(
        x: float,
        y: float,
        radius: float,
        shape: str = "circle",
        *,
        fill: bool = True,
    ) -> None:
        stroke, face = _shape_color(shape, target_shape)
        axes.add_patch(
            Circle(
                (x, y),
                radius,
                linewidth=2.8,
                edgecolor=stroke,
                facecolor=face if fill else "none",
                alpha=0.9 if fill else 1,
            )
        )

    def add_polygon(points: Sequence[tuple[float, float]], shape: str) -> None:
        stroke, face = _shape_color(shape, target_shape)
        axes.add_patch(
            Polygon(
                points,
                closed=True,
                linewidth=2.8,
                edgecolor=stroke,
                facecolor=face,
                alpha=0.9,
                joinstyle="round",
            )
        )

    def dimension(x1: float, y1: float, x2: float, y2: float, text_label: str) -> None:
        axes.plot(
            [x1, x2],
            [y1, y2],
            color="#ef8b38",
            linewidth=1.8,
            linestyle=(0, (4, 3)),
        )
        label((x1 + x2) / 2, (y1 + y2) / 2 - 9, text_label)

    def measurement(key: str, symbol: str) -> str:
        value = measurements.get(key)
        return f"{symbol} = {_format_number(sp.Rational(str(value)))}{f' {unit}' if unit else ''}" if value is not None else ""

    triangle_inside_circle = bool(
        re.search(r"triangle.{0,60}\b(?:inside|within|in|inscribed in)\b.{0,30}circle", normalized)
        or re.search(r"circle.{0,60}\b(?:contains?|with|holding)\b.{0,30}triangle", normalized)
    )
    circle_inside_triangle = bool(
        re.search(r"circle.{0,60}\b(?:inside|within|in)\b.{0,30}triangle", normalized)
        or re.search(r"triangle.{0,60}\b(?:contains?|with|holding)\b.{0,30}circle", normalized)
    )
    pentagon_inside_circle = bool(
        re.search(r"pentagon.{0,60}\b(?:inside|within|in|inscribed in)\b.{0,30}circle", normalized)
        or re.search(r"circle.{0,60}\b(?:contains?|with|holding)\b.{0,30}pentagon", normalized)
    )
    circle_cluster = bool(
        re.search(r"\b(?:two|three|four|five|2|3|4|5)\s+(?:small\s+)?circles?\b", normalized)
        and re.search(r"\b(?:inside|within|in)\b", normalized)
    )
    outer_circle = bool(re.search(r"\b(?:big|large|outer|larger)\s+circle\b", normalized))

    if outer_circle and circle_cluster:
        add_circle(160, 110, 91)
        count_match = re.search(r"\b(2|3|4|5|two|three|four|five)\s+(?:small\s+)?circles?\b", normalized)
        count_words = {"two": 2, "three": 3, "four": 4, "five": 5}
        count = int(count_match.group(1)) if count_match and count_match.group(1).isdigit() else count_words.get(count_match.group(1), 3) if count_match else 3
        positions = np.linspace(160 - (count - 1) * 47, 160 + (count - 1) * 47, count)
        for x in positions:
            add_circle(float(x), 110, min(22, 38 / count), "circle")
        dimension(160, 110, 251, 110, measurement("radius", "R"))
    elif triangle_inside_circle:
        add_circle(160, 110, 91)
        triangle = [(160, 38), (82, 169), (238, 169)]
        add_polygon(triangle, "triangle")
        dimension(160, 110, 251, 110, measurement("radius", "r"))
        base = measurement("base", "b")
        if base:
            label(160, 188, base)
    elif circle_inside_triangle:
        add_polygon([(160, 31), (58, 185), (262, 185)], "triangle")
        add_circle(160, 127, 43)
        dimension(160, 127, 203, 127, measurement("radius", "r"))
    elif pentagon_inside_circle:
        add_circle(160, 110, 92)
        points = (
            [(158, 48), (225, 83), (205, 156), (120, 176), (83, 98)]
            if "irregular" in normalized
            else [(160, 39), (227, 69), (202, 139), (118, 139), (93, 69)]
        )
        add_polygon(points, "pentagon")
        dimension(160, 110, 252, 110, measurement("radius", "r"))
    elif target_shape in {"sphere", "cylinder", "cone", "cube", "cuboid"}:
        if target_shape == "sphere":
            add_circle(160, 110, 68, "sphere")
            axes.add_patch(Ellipse((160, 110), 136, 48, fill=False, edgecolor="#ef8b38", linestyle="--", linewidth=1.5))
            label(160, 197, measurement("radius", "r"))
        elif target_shape == "cylinder":
            stroke, face = _shape_color("cylinder", target_shape)
            axes.add_patch(Ellipse((160, 65), 156, 42, edgecolor=stroke, facecolor=face, linewidth=2.8))
            axes.plot([82, 82], [65, 155], color=stroke, linewidth=2.8)
            axes.plot([238, 238], [65, 155], color=stroke, linewidth=2.8)
            axes.add_patch(Ellipse((160, 155), 156, 42, edgecolor=stroke, facecolor="none", linewidth=2.0, linestyle="--"))
            dimension(260, 65, 260, 155, measurement("height", "h"))
            dimension(160, 65, 238, 65, measurement("radius", "r"))
        elif target_shape == "cone":
            stroke, face = _shape_color("cone", target_shape)
            add_polygon([(160, 38), (76, 158), (244, 158)], "cone")
            axes.add_patch(Ellipse((160, 158), 168, 46, edgecolor=stroke, facecolor=face, linewidth=2.0, linestyle="--"))
            dimension(160, 38, 160, 158, measurement("height", "h"))
            dimension(160, 158, 244, 158, measurement("radius", "r"))
        else:
            x1, y1, x2, y2 = (88, 72, 196, 176) if target_shape == "cube" else (74, 78, 212, 166)
            dx, dy = (34, -28) if target_shape == "cube" else (38, -31)
            stroke, face = _shape_color(target_shape, target_shape)
            front = [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
            back = [(x + dx, y + dy) for x, y in front]
            add_polygon(front, target_shape)
            for start, end in zip(front, back):
                axes.plot([start[0], end[0]], [start[1], end[1]], color=stroke, linewidth=2.3)
            for index in range(3):
                axes.plot(
                    [back[index][0], back[(index + 1) % 4][0]],
                    [back[index][1], back[(index + 1) % 4][1]],
                    color=stroke,
                    linewidth=2.3,
                )
            dimension(x1, y2 + 12, x2, y2 + 12, measurement("side", "s") if target_shape == "cube" else measurement("length", "l"))
    elif target_shape == "circle":
        add_circle(160, 110, 78)
        dimension(160, 110, 238, 110, measurement("radius", "r"))
    elif target_shape in {"square", "rectangle"}:
        width = 112 if target_shape == "square" else 180
        ratio = measurements.get("length", 8) / max(measurements.get("width", 5), 1)
        height = width / max(0.65, min(2.2, ratio)) if target_shape == "rectangle" else width
        x, y = (320 - width) / 2, (220 - height) / 2
        stroke, face = _shape_color(target_shape, target_shape)
        axes.add_patch(Rectangle((x, y), width, height, facecolor=face, edgecolor=stroke, linewidth=2.8))
        dimension(x, y + height + 12, x + width, y + height + 12, measurement("side", "s") if target_shape == "square" else measurement("length", "l"))
        if target_shape == "rectangle":
            dimension(x + width + 10, y, x + width + 10, y + height, measurement("width", "w"))
    elif target_shape in {"triangle", "rightTriangle"}:
        points = (
            [(78, 168), (248, 168), (248, 48)]
            if target_shape == "rightTriangle"
            else [(62, 167), (258, 167), (160, 47)]
        )
        add_polygon(points, target_shape)
        dimension(points[0][0], 183, points[1][0], 183, measurement("base", "b") or measurement("sideC", "c"))
    elif target_shape == "pentagon":
        points = (
            [(158, 31), (244, 75), (220, 169), (112, 190), (68, 94)]
            if "irregular" in normalized
            else [(160, 28), (238, 85), (208, 190), (112, 190), (82, 85)]
        )
        add_polygon(points, "pentagon")
    else:
        # Show detected shapes as labelled candidates when the target is unclear.
        for index, shape in enumerate(candidates[:4]):
            x = 70 + index * 62
            if shape == "circle":
                add_circle(x, 110, 28, shape)
            elif shape in {"triangle", "rightTriangle"}:
                add_polygon([(x - 30, 138), (x + 30, 138), (x, 82)], shape)
            elif shape == "pentagon":
                add_polygon(
                    [(x, 78), (x + 28, 99), (x + 18, 135), (x - 18, 135), (x - 28, 99)],
                    shape,
                )
            else:
                stroke, face = _shape_color(shape, target_shape)
                axes.add_patch(Rectangle((x - 26, 86), 52, 48, facecolor=face, edgecolor=stroke, linewidth=2.5))

    output = io.StringIO()
    canvas.print_svg(output)
    return output.getvalue()


def _classify_image_shapes(image: np.ndarray) -> tuple[list[str], list[str]]:
    height, width = image.shape[:2]
    scale = min(1.0, 1400 / max(height, width))
    if scale < 1:
        image = cv2.resize(
            image,
            (round(width * scale), round(height * scale)),
            interpolation=cv2.INTER_AREA,
        )

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 45, 135)
    contours, hierarchy = cv2.findContours(
        edges,
        cv2.RETR_TREE,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    total_area = image.shape[0] * image.shape[1]
    candidates: list[dict[str, Any]] = []
    for index, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        if area < max(220, total_area * 0.0007) or area > total_area * 0.92:
            continue
        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue
        approximation = cv2.approxPolyDP(contour, 0.025 * perimeter, True)
        vertices = len(approximation)
        x, y, box_width, box_height = cv2.boundingRect(contour)
        if min(box_width, box_height) < 18:
            continue

        shape: str | None = None
        if vertices == 3:
            shape = "triangle"
            points = approximation.reshape(-1, 2).astype(float)
            vectors = [
                points[(i + 1) % 3] - points[i]
                for i in range(3)
            ]
            angles = [
                abs(float(np.dot(vectors[i - 1], vectors[i])))
                / (float(np.linalg.norm(vectors[i - 1]) * np.linalg.norm(vectors[i])) + 1e-9)
                for i in range(3)
            ]
            if min(angles) < 0.22:
                shape = "rightTriangle"
        elif vertices == 4:
            shape = "square" if 0.88 <= box_width / box_height <= 1.12 else "rectangle"
        elif vertices == 5:
            shape = "pentagon"
        else:
            circularity = 4 * np.pi * area / (perimeter**2)
            if circularity >= 0.68:
                shape = "circle"

        if shape:
            candidates.append(
                {
                    "shape": shape,
                    "bbox": (x, y, box_width, box_height),
                    "area": area,
                    "contour_index": index,
                }
            )

    candidates.sort(key=lambda item: item["area"], reverse=True)
    unique: list[dict[str, Any]] = []
    for candidate in candidates:
        x, y, box_width, box_height = candidate["bbox"]
        duplicate = False
        for previous in unique:
            if candidate["shape"] != previous["shape"]:
                continue
            px, py, previous_width, previous_height = previous["bbox"]
            intersection_width = max(0, min(x + box_width, px + previous_width) - max(x, px))
            intersection_height = max(0, min(y + box_height, py + previous_height) - max(y, py))
            intersection = intersection_width * intersection_height
            union = box_width * box_height + previous_width * previous_height - intersection
            if union and intersection / union > 0.82:
                duplicate = True
                break
        if not duplicate:
            unique.append(candidate)

    relationships: list[str] = []
    for outer in unique:
        ox, oy, ow, oh = outer["bbox"]
        for inner in unique:
            if outer is inner or outer["area"] <= inner["area"] * 1.5:
                continue
            ix, iy, iw, ih = inner["bbox"]
            if ix >= ox and iy >= oy and ix + iw <= ox + ow and iy + ih <= oy + oh:
                relationship = f"{SHAPE_LABELS[inner['shape']]} inside {SHAPE_LABELS[outer['shape']]}"
                if relationship not in relationships:
                    relationships.append(relationship)

    shape_names = list(dict.fromkeys(item["shape"] for item in unique[:8]))
    return shape_names, relationships[:8]


def _get_ocr_reader() -> Any:
    global _OCR_READER
    if _OCR_READER is None:
        with _OCR_LOCK:
            if _OCR_READER is None:
                try:
                    import easyocr
                except ImportError as error:
                    raise GeometryServiceError(
                        "Photo text recognition is not installed on the Python service."
                    ) from error
                try:
                    _OCR_READER = easyocr.Reader(["en"], gpu=False, verbose=False)
                except Exception as error:
                    raise GeometryServiceError(
                        "Photo text recognition could not be initialized. Check the Python service logs or enter the text manually."
                    ) from error
    return _OCR_READER


def _read_image(image_bytes: bytes) -> tuple[np.ndarray, str, list[str], list[str]]:
    image = cv2.imdecode(
        np.frombuffer(image_bytes, dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )
    if image is None:
        raise GeometryInputError("The uploaded file is not a readable image.")

    shapes, relationships = _classify_image_shapes(image)
    reader = _get_ocr_reader()
    try:
        results = reader.readtext(image, detail=1, paragraph=False)
    except Exception as error:
        raise GeometryServiceError(
            "Photo text recognition failed. Check the Python service logs or enter the text manually."
        ) from error
    recognized_text = [
        str(text).strip()
        for _, text, confidence in results
        if confidence >= 0.25 and str(text).strip()
    ]
    return image, "\n".join(recognized_text), shapes, relationships


def _diagram_caption(
    text: str,
    shapes: Sequence[str],
    relationships: Sequence[str],
) -> str:
    normalized = _normalise_text(text)
    if relationships:
        return relationships[0]
    if re.search(r"triangle.{0,60}\b(?:inside|within|in|inscribed in)\b.{0,30}circle", normalized):
        return "Triangle inside a circle"
    if re.search(r"circle.{0,60}\b(?:inside|within|in)\b.{0,30}triangle", normalized):
        return "Circle inside a triangle"
    if re.search(r"pentagon.{0,60}\b(?:inside|within|in|inscribed in)\b.{0,30}circle", normalized):
        return "Pentagon inside a circle"
    count = re.search(
        r"\b(1|one|2|two|3|three|4|four|5|five)\s+(?:small\s+)?circles?\b",
        normalized,
    )
    if count and re.search(r"\b(?:inside|within|in)\b", normalized):
        number_words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
        number = int(count.group(1)) if count.group(1).isdigit() else number_words[count.group(1)]
        if re.search(r"\b(?:big|large|outer|larger)\s+circle\b", normalized):
            return f"{number} smaller circles inside a larger circle"
    labels = [SHAPE_LABELS[shape] for shape in shapes]
    if len(labels) > 1:
        return " and ".join(labels)
    return labels[0] if labels else "Describe the shapes to sketch the diagram"


def analyze_geometry(
    diagram_description: str,
    question: str,
    image_bytes: bytes | None = None,
) -> dict[str, Any]:
    if not diagram_description.strip() and not question.strip() and not image_bytes:
        raise GeometryInputError("Describe the diagram or enter a question first.")

    ocr_text = ""
    detected_shapes: list[str] = []
    image_relationships: list[str] = []
    if image_bytes:
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise GeometryInputError("Choose an image smaller than 20 MB.")
        _, ocr_text, detected_shapes, image_relationships = _read_image(image_bytes)

    parsed = parse_geometry(
        diagram_description.strip(),
        question.strip(),
        ocr_text,
        detected_shapes,
    )
    caption_shapes = parsed["shapes"]
    visual_text = "\n".join(
        [
            diagram_description,
            question,
            ocr_text,
            *image_relationships,
        ]
    )
    caption = _diagram_caption(visual_text, caption_shapes, image_relationships)
    diagram_svg = _render_diagram_svg(
        visual_text,
        parsed,
        detected_shapes,
    )

    target = (
        f"{GOAL_LABELS[parsed['goal']]} of the {SHAPE_LABELS[parsed['shape']].lower()}"
        if parsed["goal"] and parsed["shape"]
        else GOAL_LABELS.get(parsed["goal"], "Not specified")
    )
    unit_suffix = f" {parsed['unit']}" if parsed["unit"] else ""
    measurements = [
        f"{key}: {_format_number(sp.Rational(str(value)))}{unit_suffix}"
        for key, value in parsed["measurements"].items()
    ]
    issues: list[str] = []
    result_steps: list[str] = []
    result_name: str | None = None
    result_formula: str | None = None
    try:
        if not parsed["shape"]:
            issues.append("Name the shape the question asks about.")
        if not parsed["goal"]:
            issues.append("Add what you need to find, such as area, perimeter, or volume.")
        if not issues:
            result_name, result_formula, _, _, result_steps = _solve(parsed)
    except GeometryInputError as error:
        issues.append(str(error))

    detected_labels = [SHAPE_LABELS[shape] for shape in detected_shapes]
    interpretation_items = [
        f"Shapes described or detected: {', '.join(SHAPE_LABELS[shape] for shape in caption_shapes) or 'none recognized'}",
        f"Possible shapes found in photo: {', '.join(detected_labels) or 'none'}",
        f"What to find: {target}",
        f"Measurements: {'; '.join(measurements) or 'none recognized'}",
    ]
    if image_relationships:
        interpretation_items.append(
            "Possible photo relationships: " + "; ".join(image_relationships)
        )
    interpretation_items.append(f"Diagram: {caption} · not to scale")
    if ocr_text:
        interpretation_items.append("Printed text was read from the photo; check it in the question box.")

    return {
        "ready": not issues,
        "issue": " ".join(issues),
        "shape": parsed["shape"],
        "goal": parsed["goal"],
        "result_name": result_name,
        "result_formula": result_formula,
        "shapes": [SHAPE_LABELS[shape] for shape in caption_shapes],
        "detected_shapes": detected_labels,
        "target": target,
        "measurements": measurements,
        "diagram_caption": caption + " · not to scale",
        "diagram_svg": base64.b64encode(diagram_svg.encode("utf-8")).decode("ascii"),
        "ocr_text": ocr_text,
        "interpretation_items": interpretation_items,
        "steps": result_steps,
    }

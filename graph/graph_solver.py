from __future__ import annotations

import io
import math
import statistics
from collections import Counter
from statistics import NormalDist
from typing import Any

import numpy as np
from matplotlib.backends.backend_svg import FigureCanvasSVG
from matplotlib.figure import Figure
from matplotlib.patches import Circle


MAX_ROWS = 250
MAX_ABSOLUTE_VALUE = 1e12
CHART_TYPES = {
    "bar-h",
    "bar",
    "pie",
    "pareto",
    "histogram",
    "box",
    "frequency",
    "ogive",
    "density",
    "scatter",
    "line",
    "bubble",
    "stem",
    "dot",
    "qq",
    "error",
    "donut",
    "table",
}
PALETTE = [
    "#1682b3",
    "#42a9ce",
    "#75c5dd",
    "#1e678e",
    "#66b2a1",
    "#efb653",
    "#e47e66",
    "#8d83c7",
    "#8cabc0",
    "#d37d9a",
]


def _number(value: Any, field: str, row_number: int) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"Row {row_number} has an invalid {field} value.")
    number = float(value)
    if not math.isfinite(number) or abs(number) > MAX_ABSOLUTE_VALUE:
        raise ValueError(f"Row {row_number} has an invalid {field} value.")
    return number


def _read_rows(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError("Send graph data as a list of rows.")
    if len(value) > MAX_ROWS:
        raise ValueError(f"Charts support up to {MAX_ROWS} data rows.")

    rows = []
    for index, row in enumerate(value):
        if not isinstance(row, dict):
            raise ValueError(f"Row {index + 1} must be an object.")
        label = row.get("label", "")
        if not isinstance(label, str) or len(label) > 60:
            raise ValueError(f"Row {index + 1} has an invalid label.")
        rows.append(
            {
                "label": label.strip() or f"Item {index + 1}",
                "x": _number(row.get("x"), "X", index + 1),
                "y": _number(row.get("y"), "Y", index + 1),
                "error": _number(row.get("error"), "Error", index + 1),
                "size": _number(row.get("size"), "Size", index + 1),
            }
        )
    return rows


def _format_number(value: float) -> str:
    if not math.isfinite(value):
        return "∞" if value > 0 else "−∞"
    if value == 0:
        return "0"
    return f"{value:,.6g}"


def _median(values: list[float]) -> float | None:
    if not values:
        return None
    return float(statistics.median(values))


def _statistics(rows: list[dict[str, Any]]) -> tuple[str, list[dict[str, str]]]:
    values = [row["y"] for row in rows if row["y"] is not None]
    if not values:
        return (
            "Calculated from the valid Y values in your table.",
            [],
        )

    ordered = sorted(values)
    middle = len(ordered) // 2
    lower = ordered[:middle]
    upper = ordered[(middle + 1 if len(ordered) % 2 else middle) :]
    counts = Counter(values)
    highest_frequency = max(counts.values())
    modes = (
        ", ".join(
            _format_number(value)
            for value, frequency in sorted(counts.items())
            if frequency == highest_frequency
        )
        if highest_frequency > 1
        else "No repeated value"
    )
    q1 = _median(lower) if lower else ordered[0]
    q3 = _median(upper) if upper else ordered[-1]
    sum_value = sum(values)
    items = [
        ("Count", str(len(values))),
        ("Sum", _format_number(sum_value)),
        ("Mean", _format_number(sum_value / len(values))),
        ("Median", _format_number(_median(ordered))),
        ("Mode", modes),
        ("Minimum", _format_number(ordered[0])),
        ("Maximum", _format_number(ordered[-1])),
        ("Range", _format_number(ordered[-1] - ordered[0])),
        ("Q1", _format_number(q1)),
        ("Q3", _format_number(q3)),
        ("IQR", _format_number(q3 - q1)),
        ("Population SD", _format_number(statistics.pstdev(values))),
        (
            "Sample SD",
            _format_number(statistics.stdev(values)) if len(values) > 1 else "—",
        ),
    ]
    description = f"{len(values)} numeric Y value{'s' if len(values) != 1 else ''} included. Empty cells are skipped."
    return description, [{"label": label, "value": value} for label, value in items]


def _histogram(values: list[float]) -> tuple[np.ndarray, np.ndarray]:
    bins = max(1, min(12, math.ceil(math.sqrt(len(values)))))
    return np.histogram(values, bins=bins)


def _render_svg(
    chart_type: str,
    rows: list[dict[str, Any]],
    title: str,
    x_label: str,
    y_label: str,
) -> tuple[str, str, int]:
    fig = Figure(figsize=(8, 4.4), dpi=100, facecolor="#fbfdfe")
    canvas = FigureCanvasSVG(fig)
    axes = fig.add_subplot(1, 1, 1)
    axes.set_facecolor("#fbfdfe")
    axes.grid(axis="y", color="#e8eff3", linewidth=0.8)
    axes.set_axisbelow(True)
    values = [row["y"] for row in rows if row["y"] is not None]
    scatter_rows = [row for row in rows if row["x"] is not None and row["y"] is not None]
    bubble_rows = [
        row
        for row in scatter_rows
        if row["size"] is not None
    ]
    error_rows = [
        row
        for row in rows
        if row["y"] is not None and row["error"] is not None
    ]
    labels = [row["label"] for row in rows if row["y"] is not None]
    plotted_count = len(values)
    caption = ""

    if chart_type in {"bar", "bar-h", "pareto"}:
        chart_rows = [row for row in rows if row["y"] is not None]
        if chart_type == "pareto":
            if any(row["y"] < 0 for row in chart_rows):
                raise ValueError("Pareto charts require non-negative values.")
            chart_rows.sort(key=lambda row: row["y"], reverse=True)
            chart_values = [row["y"] for row in chart_rows]
            total = sum(chart_values)
            if total <= 0:
                raise ValueError("Enter positive values to draw a Pareto chart.")
            cumulative = np.cumsum(chart_values) / total * 100
            x = np.arange(len(chart_rows))
            axes.bar(x, chart_values, color=PALETTE[0])
            axes.set_xticks(x, [row["label"] for row in chart_rows], rotation=30, ha="right")
            cumulative_axes = axes.twinx()
            cumulative_axes.plot(x, cumulative, color="#e47e66", marker="o")
            cumulative_axes.set_ylabel("Cumulative percentage")
            cumulative_axes.set_ylim(0, 105)
            caption = "Categories are sorted from largest to smallest with cumulative percentage."
        elif chart_type == "bar-h":
            chart_rows.reverse()
            axes.barh(
                [row["label"] for row in chart_rows],
                [row["y"] for row in chart_rows],
                color=PALETTE[0],
            )
            caption = "Compare values across categories."
        else:
            axes.bar(
                [row["label"] for row in chart_rows],
                [row["y"] for row in chart_rows],
                color=PALETTE[0],
            )
            axes.tick_params(axis="x", labelrotation=30)
            caption = "Compare values across categories."
    elif chart_type in {"pie", "donut"}:
        chart_rows = [row for row in rows if row["y"] is not None]
        chart_values = [row["y"] for row in chart_rows]
        if any(value < 0 for value in chart_values) or sum(chart_values) <= 0:
            raise ValueError("Pie and doughnut charts require non-negative values with a positive total.")
        wedges, _, _ = axes.pie(
            chart_values,
            labels=[row["label"] for row in chart_rows],
            autopct="%1.1f%%",
            colors=[PALETTE[index % len(PALETTE)] for index in range(len(chart_rows))],
            wedgeprops={"linewidth": 1, "edgecolor": "white"},
        )
        if chart_type == "donut":
            axes.add_artist(Circle((0, 0), 0.58, color="#fbfdfe"))
            axes.text(0, 0, _format_number(sum(chart_values)), ha="center", va="center", weight="bold")
        axes.axis("equal")
        plotted_count = len(chart_rows)
        caption = "Values are shown as parts of the whole."
    elif chart_type == "histogram":
        if values:
            axes.hist(values, bins="auto", color=PALETTE[0], edgecolor="white")
        caption = "Numeric Y values grouped into intervals."
    elif chart_type == "box":
        if values:
            axes.boxplot(
                values,
                orientation="horizontal",
                patch_artist=True,
                boxprops={"facecolor": PALETTE[2]},
            )
        caption = "Minimum, quartiles, median and maximum of Y values."
    elif chart_type in {"frequency", "ogive"}:
        if values:
            counts, edges = _histogram(values)
            centers = (edges[:-1] + edges[1:]) / 2
            if chart_type == "frequency":
                axes.plot(centers, counts, color=PALETTE[0], marker="o")
                caption = "Frequency at the centre of each interval."
            else:
                axes.plot(edges[1:], np.cumsum(counts), color=PALETTE[0], marker="o")
                caption = "Cumulative frequency as values increase."
    elif chart_type == "density":
        if values:
            data = np.asarray(values, dtype=float)
            spread = float(np.std(data))
            if len(data) > 1 and spread > 0:
                bandwidth = max(1.06 * spread * len(data) ** (-0.2), 1e-9)
                sample = np.linspace(float(data.min()), float(data.max()), 250)
                kernels = np.exp(-0.5 * ((sample[:, None] - data[None, :]) / bandwidth) ** 2)
                density = kernels.sum(axis=1) / (len(data) * bandwidth * math.sqrt(2 * math.pi))
                axes.plot(sample, density, color=PALETTE[0])
                axes.fill_between(sample, density, color=PALETTE[2], alpha=0.55)
            else:
                axes.axvline(float(data[0]), color=PALETTE[0])
            caption = "Smoothed estimate of the Y-value distribution."
    elif chart_type in {"scatter", "bubble"}:
        plotted = bubble_rows if chart_type == "bubble" else scatter_rows
        if not plotted:
            raise ValueError(
                "Enter X, Y, and Size values for at least one row to draw a bubble chart."
                if chart_type == "bubble"
                else "Enter at least one row with both an X value and a Y value to draw a scatter plot."
            )
        if chart_type == "bubble":
            if any(row["size"] < 0 for row in plotted):
                raise ValueError("Bubble sizes cannot be negative.")
            maximum = max((row["size"] for row in plotted), default=0) or 1
            sizes = [40 + 600 * row["size"] / maximum for row in plotted]
            axes.scatter([row["x"] for row in plotted], [row["y"] for row in plotted], s=sizes, alpha=0.7, color=PALETTE[0], edgecolors="white")
            caption = "Bubble area represents the Size column."
        else:
            axes.scatter([row["x"] for row in plotted], [row["y"] for row in plotted], color=PALETTE[0])
            caption = "Relationship between numeric X and Y values."
        plotted_count = len(plotted)
    elif chart_type == "line":
        chart_rows = [row for row in rows if row["y"] is not None]
        axes.plot(
            range(len(chart_rows)),
            [row["y"] for row in chart_rows],
            color=PALETTE[0],
            marker="o",
        )
        axes.set_xticks(range(len(chart_rows)), [row["label"] for row in chart_rows], rotation=30, ha="right")
        caption = "Values across the ordered categories."
    elif chart_type == "stem":
        ordered = sorted(values)
        if ordered:
            stems: dict[int, list[str]] = {}
            for value in ordered:
                rounded = int(round(value * 10))
                stem, leaf = divmod(abs(rounded), 10)
                stems.setdefault(stem if rounded >= 0 else -stem, []).append(str(leaf))
            axes.axis("off")
            table = axes.table(
                cellText=[[stem, " ".join(leaves)] for stem, leaves in sorted(stems.items())],
                colLabels=["Stem", "Leaves"],
                loc="center",
                cellLoc="left",
            )
            table.auto_set_font_size(False)
            table.set_fontsize(12)
            table.scale(1, 1.5)
        caption = "Leaves preserve values rounded to tenths."
    elif chart_type == "dot":
        if values:
            counts = Counter(values)
            for x, count in sorted(counts.items()):
                axes.scatter([x] * count, range(1, count + 1), color=PALETTE[0])
        caption = "Repeated values are stacked into columns."
    elif chart_type == "qq":
        ordered = sorted(values)
        if ordered:
            theoretical = [
                NormalDist().inv_cdf((index + 0.5) / len(ordered))
                for index in range(len(ordered))
            ]
            axes.scatter(theoretical, ordered, color=PALETTE[0])
            if len(ordered) > 1:
                mean = statistics.mean(ordered)
                deviation = statistics.stdev(ordered)
                line_x = np.asarray([min(theoretical), max(theoretical)])
                axes.plot(line_x, mean + deviation * line_x, color="#d27a3e", linestyle="--")
            axes.set_xlabel(x_label or "Theoretical normal quantile")
            axes.set_ylabel(y_label or "Sample quantile")
        caption = "Compare sample quantiles with normal-distribution quantiles."
    elif chart_type == "error":
        if not error_rows:
            raise ValueError("Enter both a Y value and a non-negative Error amount for at least one row.")
        if any(row["error"] < 0 for row in error_rows):
            raise ValueError("Error amounts cannot be negative.")
        axes.errorbar(
            [row["label"] for row in error_rows],
            [row["y"] for row in error_rows],
            yerr=[row["error"] for row in error_rows],
            fmt="o",
            color=PALETTE[0],
            ecolor=PALETTE[1],
            capsize=4,
        )
        axes.tick_params(axis="x", labelrotation=30)
        plotted_count = len(error_rows)
        caption = "Y values with plus/minus error amounts."
    elif chart_type == "table":
        axes.axis("off")
        table_rows = [
            [
                row["label"],
                "" if row["x"] is None else _format_number(row["x"]),
                "" if row["y"] is None else _format_number(row["y"]),
                "" if row["error"] is None else _format_number(row["error"]),
                "" if row["size"] is None else _format_number(row["size"]),
            ]
            for row in rows
        ]
        table = axes.table(
            cellText=table_rows,
            colLabels=["Label", "X value", "Y value", "Error", "Size"],
            loc="center",
            cellLoc="left",
        )
        table.auto_set_font_size(False)
        table.set_fontsize(8)
        caption = f"{len(rows)} data rows shown in the table."
    else:
        raise ValueError("Choose a supported chart type.")

    if chart_type not in {"pie", "donut", "stem", "table"}:
        if chart_type not in {"bar-h", "bar", "line", "error"}:
            axes.set_xlabel(x_label or ("X value" if chart_type in {"scatter", "bubble"} else "Value"))
        if chart_type not in {"bar-h", "pie", "donut"}:
            axes.set_ylabel(y_label or ("Frequency" if chart_type in {"histogram", "frequency", "ogive"} else "Y value"))
        if chart_type not in {"scatter", "bubble", "histogram", "density", "qq", "dot", "box", "frequency", "ogive"}:
            axes.grid(axis="x", visible=False)
    axes.set_title(title or "Data chart", color="#173448", pad=14)
    fig.tight_layout()
    output = io.StringIO()
    canvas.print_svg(output)
    return output.getvalue(), caption, plotted_count


def analyze_graph(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Send your graph request as a JSON object.")

    chart_type = payload.get("type")
    if not isinstance(chart_type, str) or chart_type not in CHART_TYPES:
        raise ValueError("Choose a supported chart type.")

    rows = _read_rows(payload.get("rows"))
    title = payload.get("title", "")
    x_label = payload.get("x_label", "")
    y_label = payload.get("y_label", "")
    for name, value, limit in (
        ("title", title, 80),
        ("horizontal axis label", x_label, 40),
        ("vertical axis label", y_label, 40),
    ):
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f"Enter a valid {name}.")

    stats_description, stats = _statistics(rows)
    values = [row["y"] for row in rows if row["y"] is not None]
    chart_error = ""
    svg = ""
    caption = ""
    plotted_count = 0
    chart_values = (
        [row for row in rows if row["x"] is not None and row["y"] is not None]
        if chart_type == "scatter"
        else [
            row
            for row in rows
            if row["x"] is not None and row["y"] is not None and row["size"] is not None
        ]
        if chart_type == "bubble"
        else [row for row in rows if row["y"] is not None and row["error"] is not None]
        if chart_type == "error"
        else values
    )
    if chart_type != "table" and not chart_values:
        chart_error = {
            "scatter": "Enter at least one row with both an X value and a Y value to draw a scatter plot.",
            "bubble": "Enter X, Y, and Size values for at least one row to draw a bubble chart.",
            "error": "Enter both a Y value and a non-negative Error amount for at least one row.",
        }.get(chart_type, "Enter at least one numeric Y value to draw this chart.")
    else:
        try:
            svg, caption, plotted_count = _render_svg(
                chart_type,
                rows,
                title,
                x_label,
                y_label,
            )
        except ValueError as error:
            chart_error = str(error)

    return {
        "statistics_description": stats_description,
        "statistics": stats,
        "chart_error": chart_error,
        "chart_svg": svg,
        "chart_caption": caption,
        "plotted_count": plotted_count,
        "row_count": len(rows),
    }

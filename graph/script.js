const svgNamespace = "http://www.w3.org/2000/svg";
const maxRows = 250;
const maxAbsoluteValue = 1e12;
const palette = [
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
];

const elements = {
    chart: document.getElementById("chart"),
    chartTable: document.getElementById("chart-table"),
    chartType: document.getElementById("chart-type"),
    chartTitle: document.getElementById("chart-title"),
    xAxisLabel: document.getElementById("x-axis-label"),
    yAxisLabel: document.getElementById("y-axis-label"),
    chartHelp: document.getElementById("chart-help"),
    chartError: document.getElementById("chart-error"),
    chartCaption: document.getElementById("chart-caption"),
    dataRows: document.getElementById("data-rows"),
    sampleData: document.getElementById("sample-data"),
    dataStatus: document.getElementById("data-status"),
    csvFile: document.getElementById("csv-file"),
    addRow: document.getElementById("add-row"),
    exportReport: document.getElementById("export-report"),
    statsSummary: document.getElementById("stats-summary"),
    statsDescription: document.getElementById("stats-description"),
};

if (Object.values(elements).some((element) => !element)) {
    throw new Error("Graphs & statistics: required page elements are missing.");
}

const samples = {
    sales: {
        title: "Monthly sales",
        type: "bar",
        xLabel: "Month",
        yLabel: "Sales",
        rows: [
            ["Jan", 1, 18, null, null],
            ["Feb", 2, 25, null, null],
            ["Mar", 3, 20, null, null],
            ["Apr", 4, 32, null, null],
            ["May", 5, 28, null, null],
            ["Jun", 6, 40, null, null],
        ],
    },
    survey: {
        title: "Favourite fruit survey",
        type: "pie",
        xLabel: "Fruit",
        yLabel: "Votes",
        rows: [
            ["Mango", 1, 12, null, null],
            ["Apple", 2, 9, null, null],
            ["Orange", 3, 7, null, null],
            ["Banana", 4, 5, null, null],
        ],
    },
    scores: {
        title: "Class test scores",
        type: "histogram",
        xLabel: "Test score",
        yLabel: "Students",
        rows: [
            ["Student 1", 1, 62, null, null],
            ["Student 2", 2, 74, null, null],
            ["Student 3", 3, 81, null, null],
            ["Student 4", 4, 88, null, null],
            ["Student 5", 5, 74, null, null],
            ["Student 6", 6, 93, null, null],
            ["Student 7", 7, 68, null, null],
            ["Student 8", 8, 81, null, null],
            ["Student 9", 9, 77, null, null],
            ["Student 10", 10, 96, null, null],
            ["Student 11", 11, 85, null, null],
            ["Student 12", 12, 72, null, null],
        ],
    },
    blank: {
        title: "My data",
        type: "table",
        xLabel: "X value",
        yLabel: "Y value",
        rows: [
            ["Item 1", null, null, null, null],
            ["Item 2", null, null, null, null],
            ["Item 3", null, null, null, null],
        ],
    },
};

let rows = [];

function makeSvg(tagName, attributes = {}, text = "") {
    const node = document.createElementNS(svgNamespace, tagName);
    Object.entries(attributes).forEach(([name, value]) => {
        node.setAttribute(name, String(value));
    });
    if (text !== "") {
        node.textContent = text;
    }
    return node;
}

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return "—";
    }
    return new Intl.NumberFormat(undefined, {
        maximumSignificantDigits: 6,
    }).format(value);
}

function formatTick(value, step) {
    const decimals = Math.min(8, Math.max(0, -Math.floor(Math.log10(step)) + 1));
    const rounded = Number(value.toFixed(decimals));
    return formatNumber(rounded);
}

function getLabel(row, index) {
    return row.label.trim() || `Item ${index + 1}`;
}

function getYValues() {
    return rows
        .map((row, index) => ({
            label: getLabel(row, index),
            value: row.y,
        }))
        .filter((entry) => Number.isFinite(entry.value));
}

function addStat(label, value) {
    const item = document.createElement("div");
    item.className = "stat-item";
    const labelNode = document.createElement("span");
    labelNode.className = "stat-label";
    labelNode.textContent = label;
    const valueNode = document.createElement("span");
    valueNode.className = "stat-value";
    valueNode.textContent = value;
    item.append(labelNode, valueNode);
    elements.statsSummary.append(item);
}

function median(values) {
    if (values.length === 0) {
        return null;
    }
    const middle = Math.floor(values.length / 2);
    return values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2;
}

function quartiles(sorted) {
    if (sorted.length === 0) {
        return { q1: null, median: null, q3: null };
    }
    const middle = Math.floor(sorted.length / 2);
    const lowerHalf = sorted.slice(0, middle);
    const upperHalf = sorted.slice(sorted.length % 2 ? middle + 1 : middle);
    return {
        q1: lowerHalf.length ? median(lowerHalf) : sorted[0],
        median: median(sorted),
        q3: upperHalf.length ? median(upperHalf) : sorted[sorted.length - 1],
    };
}

function renderStatistics() {
    const values = getYValues().map((entry) => entry.value);
    elements.statsSummary.replaceChildren();

    if (values.length === 0) {
        elements.statsDescription.textContent =
            "Calculated from the valid Y values in your table.";
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "Add at least one numeric Y value to see statistics.";
        elements.statsSummary.append(note);
        return;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const { q1, median: middle, q3 } = quartiles(sorted);
    const sum = values.reduce((total, value) => total + value, 0);
    const mean = sum / values.length;
    const frequencies = new Map();
    values.forEach((value) => {
        frequencies.set(value, (frequencies.get(value) || 0) + 1);
    });
    const highestFrequency = Math.max(...frequencies.values());
    const modes = highestFrequency > 1
        ? [...frequencies.entries()]
            .filter(([, frequency]) => frequency === highestFrequency)
            .map(([value]) => formatNumber(value))
            .join(", ")
        : "No repeated value";
    const squaredDifferences = values.reduce(
        (total, value) => total + (value - mean) ** 2,
        0,
    );
    const standardDeviation = Math.sqrt(squaredDifferences / values.length);
    const sampleDeviation = values.length > 1
        ? Math.sqrt(squaredDifferences / (values.length - 1))
        : null;

    elements.statsDescription.textContent =
        `${values.length} numeric Y value${values.length === 1 ? "" : "s"} included. Empty cells are skipped.`;
    [
        ["Count", String(values.length)],
        ["Sum", formatNumber(sum)],
        ["Mean", formatNumber(mean)],
        ["Median", formatNumber(middle)],
        ["Mode", modes],
        ["Minimum", formatNumber(sorted[0])],
        ["Maximum", formatNumber(sorted[sorted.length - 1])],
        ["Range", formatNumber(sorted[sorted.length - 1] - sorted[0])],
        ["Q1", formatNumber(q1)],
        ["Q3", formatNumber(q3)],
        ["IQR", formatNumber(q3 - q1)],
        ["Population SD", formatNumber(standardDeviation)],
        ["Sample SD", sampleDeviation === null ? "—" : formatNumber(sampleDeviation)],
    ].forEach(([label, value]) => addStat(label, value));
}

function setChartError(message) {
    elements.chartError.textContent = message;
    elements.chartError.hidden = !message;
}

function showChartMessage(message) {
    elements.chart.replaceChildren();
    elements.chart.append(
        makeSvg("text", {
            x: 400,
            y: 210,
            "text-anchor": "middle",
            class: "axis-title",
        }, message),
    );
}

function chartTitle() {
    return elements.chartTitle.value.trim() || "Data chart";
}

function addChartTitle() {
    elements.chart.append(
        makeSvg("title", {}, chartTitle()),
        makeSvg("text", {
            x: 400,
            y: 28,
            "text-anchor": "middle",
            class: "chart-main-title",
        }, chartTitle()),
    );
    elements.chart.setAttribute("aria-label", chartTitle());
}

function addTooltip(mark, text) {
    mark.append(makeSvg("title", {}, text));
    mark.classList.add("data-mark");
}

function niceStep(range, tickCount = 5) {
    const roughStep = range / Math.max(1, tickCount - 1);
    const power = 10 ** Math.floor(Math.log10(roughStep));
    const fraction = roughStep / power;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return niceFraction * power;
}

function numericTicks(min, max, tickCount = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return [0, 1];
    }
    const step = niceStep(max - min, tickCount);
    const first = Math.ceil(min / step) * step;
    const values = [];
    for (let value = first, count = 0; value <= max + step * 0.000001 && count < 12; value += step, count += 1) {
        values.push(Number(value.toPrecision(12)));
    }
    return values.length ? values : [min, max];
}

function paddedDomain(values, includeZero = false) {
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (includeZero) {
        min = Math.min(0, min);
        max = Math.max(0, max);
    }
    if (min === max) {
        const padding = Math.abs(min) * 0.1 || 1;
        min -= padding;
        max += padding;
        if (includeZero && min >= 0) {
            min = 0;
        }
    } else {
        const padding = (max - min) * 0.06;
        if (!includeZero || min < 0) {
            min -= padding;
        }
        max += padding;
    }
    return [min, max];
}

function createScale(domainMin, domainMax, rangeMin, rangeMax) {
    return (value) => (
        rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin)
    );
}

function drawGrid(plot, yMin, yMax, bounds) {
    const ticks = numericTicks(yMin, yMax);
    const y = createScale(yMin, yMax, bounds.bottom, bounds.top);
    ticks.forEach((tick) => {
        const position = y(tick);
        plot.append(
            makeSvg("line", {
                x1: bounds.left,
                y1: position,
                x2: bounds.right,
                y2: position,
                class: "grid-line",
            }),
            makeSvg("text", {
                x: bounds.left - 10,
                y: position + 4,
                "text-anchor": "end",
            }, formatTick(tick, niceStep(yMax - yMin))),
        );
    });
    plot.append(
        makeSvg("line", {
            x1: bounds.left,
            y1: bounds.top,
            x2: bounds.left,
            y2: bounds.bottom,
            class: "axis-line",
        }),
        makeSvg("line", {
            x1: bounds.left,
            y1: bounds.bottom,
            x2: bounds.right,
            y2: bounds.bottom,
            class: "axis-line",
        }),
    );
    return y;
}

function addAxisTitles(plot, bounds, xTitle, yTitle) {
    plot.append(
        makeSvg("text", {
            x: (bounds.left + bounds.right) / 2,
            y: 425,
            "text-anchor": "middle",
            class: "axis-title",
        }, xTitle),
        makeSvg("text", {
            x: 17,
            y: (bounds.top + bounds.bottom) / 2,
            "text-anchor": "middle",
            class: "axis-title",
            transform: `rotate(-90 17 ${(bounds.top + bounds.bottom) / 2})`,
        }, yTitle),
    );
}

function labelForAxis(label) {
    const trimmed = label.trim();
    return trimmed.length > 15 ? `${trimmed.slice(0, 13)}...` : trimmed;
}

function drawCategoryLabels(plot, entries, bounds, step = 1) {
    entries.forEach((entry, index) => {
        if (index % step !== 0 && index !== entries.length - 1) {
            return;
        }
        const band = (bounds.right - bounds.left) / entries.length;
        const x = bounds.left + band * (index + 0.5);
        const label = makeSvg("text", {
            x,
            y: bounds.bottom + 20,
            "text-anchor": entries.length > 7 ? "end" : "middle",
        }, labelForAxis(entry.label));
        if (entries.length > 7) {
            label.setAttribute("transform", `rotate(-25 ${x} ${bounds.bottom + 20})`);
        }
        addTooltip(label, entry.label);
        plot.append(label);
    });
}

function drawBarChart() {
    const entries = getYValues();
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const [min, max] = paddedDomain(entries.map((entry) => entry.value), true);
    const y = drawGrid(plot, min, max, bounds);
    const zeroY = y(0);
    const band = (bounds.right - bounds.left) / entries.length;
    entries.forEach((entry, index) => {
        const valueY = y(entry.value);
        const barWidth = Math.min(48, band * 0.68);
        const mark = makeSvg("rect", {
            x: bounds.left + band * index + (band - barWidth) / 2,
            y: Math.min(valueY, zeroY),
            width: barWidth,
            height: Math.max(1, Math.abs(zeroY - valueY)),
            rx: 4,
            fill: palette[index % palette.length],
        });
        addTooltip(mark, `${entry.label}: ${formatNumber(entry.value)}`);
        plot.append(mark);
    });
    drawCategoryLabels(plot, entries, bounds, Math.max(1, Math.ceil(entries.length / 18)));
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Category", elements.yAxisLabel.value || "Value");
}

function drawHorizontalBarChart() {
    const entries = getYValues();
    const bounds = { left: 180, right: 778, top: 55, bottom: 350 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const [min, max] = paddedDomain(entries.map((entry) => entry.value), true);
    const ticks = numericTicks(min, max);
    const x = createScale(min, max, bounds.left, bounds.right);
    ticks.forEach((tick) => {
        const position = x(tick);
        plot.append(
            makeSvg("line", {
                x1: position,
                y1: bounds.top,
                x2: position,
                y2: bounds.bottom,
                class: "grid-line",
            }),
            makeSvg("text", {
                x: position,
                y: bounds.bottom + 20,
                "text-anchor": "middle",
            }, formatNumber(tick)),
        );
    });
    const band = (bounds.bottom - bounds.top) / entries.length;
    const zeroX = x(0);
    entries.forEach((entry, index) => {
        const valueX = x(entry.value);
        const barHeight = Math.min(34, band * 0.68);
        const mark = makeSvg("rect", {
            x: Math.min(valueX, zeroX),
            y: bounds.top + band * index + (band - barHeight) / 2,
            width: Math.max(1, Math.abs(valueX - zeroX)),
            height: barHeight,
            rx: 4,
            fill: palette[index % palette.length],
        });
        addTooltip(mark, `${entry.label}: ${formatNumber(entry.value)}`);
        plot.append(
            mark,
            makeSvg("text", {
                x: bounds.left - 10,
                y: bounds.top + band * (index + 0.5) + 4,
                "text-anchor": "end",
            }, labelForAxis(entry.label)),
        );
    });
    plot.append(
        makeSvg("line", {
            x1: bounds.left,
            y1: bounds.bottom,
            x2: bounds.right,
            y2: bounds.bottom,
            class: "axis-line",
        }),
        makeSvg("text", {
            x: (bounds.left + bounds.right) / 2,
            y: 425,
            "text-anchor": "middle",
            class: "axis-title",
        }, elements.xAxisLabel.value || "Value"),
        makeSvg("text", {
            x: 25,
            y: (bounds.top + bounds.bottom) / 2,
            "text-anchor": "middle",
            class: "axis-title",
            transform: `rotate(-90 25 ${(bounds.top + bounds.bottom) / 2})`,
        }, elements.yAxisLabel.value || "Category"),
    );
}

function drawLineChart() {
    const entries = getYValues();
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const [min, max] = paddedDomain(entries.map((entry) => entry.value));
    const y = drawGrid(plot, min, max, bounds);
    const x = (index) => entries.length === 1
        ? (bounds.left + bounds.right) / 2
        : bounds.left + (index / (entries.length - 1)) * (bounds.right - bounds.left);
    const path = entries.map((entry, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(entry.value)}`).join(" ");
    plot.append(makeSvg("path", {
        d: path,
        fill: "none",
        stroke: "#1682b3",
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
    }));
    entries.forEach((entry, index) => {
        const mark = makeSvg("circle", {
            cx: x(index),
            cy: y(entry.value),
            r: 5.5,
            fill: palette[index % palette.length],
            stroke: "#fff",
            "stroke-width": 2,
        });
        addTooltip(mark, `${entry.label}: ${formatNumber(entry.value)}`);
        plot.append(mark);
    });
    drawCategoryLabels(plot, entries, bounds, Math.max(1, Math.ceil(entries.length / 18)));
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Category", elements.yAxisLabel.value || "Value");
}

function drawScatterChart() {
    const entries = rows
        .map((row, index) => ({
            label: getLabel(row, index),
            x: row.x,
            y: row.y,
        }))
        .filter((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y));
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const [xMin, xMax] = paddedDomain(entries.map((entry) => entry.x));
    const [yMin, yMax] = paddedDomain(entries.map((entry) => entry.y));
    const x = createScale(xMin, xMax, bounds.left, bounds.right);
    const y = drawGrid(plot, yMin, yMax, bounds);
    numericTicks(xMin, xMax).forEach((tick) => {
        const position = x(tick);
        plot.append(
            makeSvg("line", {
                x1: position,
                y1: bounds.bottom,
                x2: position,
                y2: bounds.bottom + 5,
                class: "axis-line",
            }),
            makeSvg("text", {
                x: position,
                y: bounds.bottom + 20,
                "text-anchor": "middle",
            }, formatNumber(tick)),
        );
    });
    entries.forEach((entry, index) => {
        const mark = makeSvg("circle", {
            cx: x(entry.x),
            cy: y(entry.y),
            r: 6,
            fill: palette[index % palette.length],
            stroke: "#fff",
            "stroke-width": 2,
        });
        addTooltip(mark, `${entry.label}: (${formatNumber(entry.x)}, ${formatNumber(entry.y)})`);
        plot.append(mark);
    });
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "X", elements.yAxisLabel.value || "Y");
}

function drawBubbleChart() {
    const entries = rows
        .map((row, index) => ({
            label: getLabel(row, index),
            x: row.x,
            y: row.y,
            size: row.size,
        }))
        .filter((entry) =>
            Number.isFinite(entry.x) &&
            Number.isFinite(entry.y) &&
            Number.isFinite(entry.size),
        );
    if (entries.some((entry) => entry.size < 0)) {
        setChartError("Bubble sizes must be zero or greater.");
        showChartMessage("Use non-negative sizes for bubbles.");
        return;
    }

    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const [xMin, xMax] = paddedDomain(entries.map((entry) => entry.x));
    const [yMin, yMax] = paddedDomain(entries.map((entry) => entry.y));
    const x = createScale(xMin, xMax, bounds.left, bounds.right);
    const y = drawGrid(plot, yMin, yMax, bounds);
    numericTicks(xMin, xMax).forEach((tick) => {
        const position = x(tick);
        plot.append(
            makeSvg("line", {
                x1: position,
                y1: bounds.bottom,
                x2: position,
                y2: bounds.bottom + 5,
                class: "axis-line",
            }),
            makeSvg("text", {
                x: position,
                y: bounds.bottom + 20,
                "text-anchor": "middle",
            }, formatNumber(tick)),
        );
    });
    const maximumSize = Math.max(...entries.map((entry) => entry.size), 0);
    entries.forEach((entry, index) => {
        const radius = maximumSize > 0
            ? Math.max(4, Math.sqrt(entry.size / maximumSize) * 25)
            : 4;
        const mark = makeSvg("circle", {
            cx: x(entry.x),
            cy: y(entry.y),
            r: radius,
            fill: palette[index % palette.length],
            "fill-opacity": 0.68,
            stroke: "#fff",
            "stroke-width": 1.5,
        });
        addTooltip(mark, `${entry.label}: X ${formatNumber(entry.x)}, Y ${formatNumber(entry.y)}, size ${formatNumber(entry.size)}`);
        plot.append(mark);
    });
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "X", elements.yAxisLabel.value || "Y");
}

function drawErrorBarChart() {
    const entries = rows
        .map((row, index) => ({
            label: getLabel(row, index),
            y: row.y,
            error: row.error,
        }))
        .filter((entry) => Number.isFinite(entry.y) && Number.isFinite(entry.error));
    if (entries.some((entry) => entry.error < 0)) {
        setChartError("Error amounts must be zero or greater.");
        showChartMessage("Use non-negative error amounts.");
        return;
    }
    if (entries.length === 0) {
        setChartError("Enter both a Y value and a non-negative Error amount for at least one row.");
        showChartMessage("Add Y values and error amounts.");
        return;
    }

    const lows = entries.map((entry) => entry.y - entry.error);
    const highs = entries.map((entry) => entry.y + entry.error);
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const [min, max] = paddedDomain([...lows, ...highs]);
    const y = drawGrid(plot, min, max, bounds);
    const band = (bounds.right - bounds.left) / entries.length;
    entries.forEach((entry, index) => {
        const centerX = bounds.left + band * (index + 0.5);
        const upperY = y(entry.y + entry.error);
        const lowerY = y(entry.y - entry.error);
        const color = palette[index % palette.length];
        const mark = makeSvg("line", {
            x1: centerX,
            y1: upperY,
            x2: centerX,
            y2: lowerY,
            stroke: color,
            "stroke-width": 2.5,
        });
        addTooltip(mark, `${entry.label}: ${formatNumber(entry.y)} ± ${formatNumber(entry.error)}`);
        plot.append(
            mark,
            makeSvg("line", {
                x1: centerX - 7,
                y1: upperY,
                x2: centerX + 7,
                y2: upperY,
                stroke: color,
                "stroke-width": 2,
            }),
            makeSvg("line", {
                x1: centerX - 7,
                y1: lowerY,
                x2: centerX + 7,
                y2: lowerY,
                stroke: color,
                "stroke-width": 2,
            }),
            makeSvg("circle", {
                cx: centerX,
                cy: y(entry.y),
                r: 5,
                fill: color,
                stroke: "#fff",
                "stroke-width": 1.5,
            }),
        );
    });
    drawCategoryLabels(plot, entries, bounds, Math.max(1, Math.ceil(entries.length / 18)));
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Category", elements.yAxisLabel.value || "Value");
}

function fullCirclePath(cx, cy, radius) {
    return [
        `M ${cx} ${cy - radius}`,
        `A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
        `A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
        "Z",
    ].join(" ");
}

function sectorPath(cx, cy, radius, startAngle, endAngle) {
    const startX = cx + radius * Math.cos(startAngle);
    const startY = cy + radius * Math.sin(startAngle);
    const endX = cx + radius * Math.cos(endAngle);
    const endY = cy + radius * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function drawPieChart(doughnut = false) {
    const entries = getYValues();
    if (entries.length > 9) {
        setChartError("Pie and doughnut charts work best with 9 or fewer categories. Remove or combine some rows.");
        showChartMessage("Simplify the categories to see this chart.");
        return;
    }
    if (entries.some((entry) => entry.value < 0)) {
        setChartError("Pie and doughnut charts cannot show negative values. Choose a bar or line chart instead.");
        showChartMessage("Negative values are not valid for this chart.");
        return;
    }
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    if (total <= 0) {
        setChartError("Enter at least one positive value to draw a pie or doughnut chart.");
        showChartMessage("This chart needs a positive total.");
        return;
    }

    addChartTitle();
    const centerX = 250;
    const centerY = 218;
    const radius = 145;
    let angle = -Math.PI / 2;
    entries.forEach((entry, index) => {
        if (entry.value <= 0) {
            return;
        }
        const nextAngle = angle + (entry.value / total) * Math.PI * 2;
        const mark = makeSvg("path", {
            d: entries.filter((item) => item.value > 0).length === 1
                ? fullCirclePath(centerX, centerY, radius)
                : sectorPath(centerX, centerY, radius, angle, nextAngle),
            fill: palette[index % palette.length],
            stroke: "#fff",
            "stroke-width": 2,
        });
        addTooltip(mark, `${entry.label}: ${formatNumber(entry.value)} (${formatNumber(entry.value / total * 100)}%)`);
        elements.chart.append(mark);
        angle = nextAngle;
    });

    if (doughnut) {
        elements.chart.append(
            makeSvg("circle", {
                cx: centerX,
                cy: centerY,
                r: 73,
                fill: "#fff",
            }),
            makeSvg("text", {
                x: centerX,
                y: centerY - 2,
                "text-anchor": "middle",
                class: "chart-main-title",
            }, formatNumber(total)),
            makeSvg("text", {
                x: centerX,
                y: centerY + 17,
                "text-anchor": "middle",
            }, "Total"),
        );
    }

    const positiveEntries = entries.filter((entry) => entry.value > 0);
    positiveEntries.forEach((entry) => {
        const index = entries.indexOf(entry);
        const y = 110 + index * 30;
        elements.chart.append(
            makeSvg("rect", {
                x: 465,
                y: y - 10,
                width: 12,
                height: 12,
                rx: 3,
                fill: palette[index % palette.length],
            }),
            makeSvg("text", {
                x: 486,
                y,
            }, `${labelForAxis(entry.label)}  ${formatNumber(entry.value / total * 100)}%`),
        );
    });
}

function makeHistogramBins(values) {
    const [min, max] = paddedDomain(values);
    const binCount = Math.min(12, Math.max(3, Math.ceil(1 + Math.log2(values.length))));
    const binSize = (max - min) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
        start: min + index * binSize,
        end: index === binCount - 1 ? max : min + (index + 1) * binSize,
        count: 0,
    }));
    values.forEach((value) => {
        const index = Math.min(binCount - 1, Math.floor((value - min) / binSize));
        bins[index].count += 1;
    });
    return { min, max, bins };
}

function drawNumericXAxis(plot, min, max, bounds) {
    const x = createScale(min, max, bounds.left, bounds.right);
    numericTicks(min, max).forEach((tick) => {
        const position = x(tick);
        plot.append(
            makeSvg("line", {
                x1: position,
                y1: bounds.bottom,
                x2: position,
                y2: bounds.bottom + 5,
                class: "axis-line",
            }),
            makeSvg("text", {
                x: position,
                y: bounds.bottom + 20,
                "text-anchor": "middle",
            }, formatNumber(tick)),
        );
    });
    return x;
}

function drawHistogram() {
    const values = getYValues().map((entry) => entry.value);
    const { bins } = makeHistogramBins(values);
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const maximumCount = Math.max(...bins.map((bin) => bin.count), 1);
    const y = drawGrid(plot, 0, maximumCount + Math.max(1, maximumCount * 0.08), bounds);
    const zeroY = y(0);
    const band = (bounds.right - bounds.left) / bins.length;
    bins.forEach((bin, index) => {
        const barWidth = Math.max(1, band - 2);
        const mark = makeSvg("rect", {
            x: bounds.left + index * band + 1,
            y: y(bin.count),
            width: barWidth,
            height: Math.max(1, zeroY - y(bin.count)),
            fill: palette[0],
            opacity: 0.88,
        });
        addTooltip(mark, `${formatNumber(bin.start)} to ${formatNumber(bin.end)}: ${bin.count} value(s)`);
        plot.append(mark);
        plot.append(makeSvg("text", {
            x: bounds.left + index * band + band / 2,
            y: bounds.bottom + 19,
            "text-anchor": "middle",
        }, formatNumber(bin.start)));
    });
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Value ranges", elements.yAxisLabel.value || "Frequency");
}

function drawParetoChart() {
    const entries = getYValues().sort((first, second) => second.value - first.value);
    if (entries.some((entry) => entry.value < 0)) {
        setChartError("Pareto values must be non-negative.");
        showChartMessage("Use non-negative category values.");
        return;
    }
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    if (total <= 0) {
        setChartError("Enter a positive total to draw a Pareto chart.");
        showChartMessage("This chart needs a positive total.");
        return;
    }

    const bounds = { left: 78, right: 744, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const maximum = Math.max(...entries.map((entry) => entry.value));
    const [min, max] = paddedDomain([0, maximum], true);
    const y = drawGrid(plot, min, max, bounds);
    const band = (bounds.right - bounds.left) / entries.length;
    let runningTotal = 0;
    const cumulativePoints = [];
    entries.forEach((entry, index) => {
        const barWidth = Math.min(48, band * 0.68);
        const valueY = y(entry.value);
        const mark = makeSvg("rect", {
            x: bounds.left + band * index + (band - barWidth) / 2,
            y: valueY,
            width: barWidth,
            height: Math.max(1, y(0) - valueY),
            rx: 4,
            fill: palette[index % palette.length],
        });
        addTooltip(mark, `${entry.label}: ${formatNumber(entry.value)}`);
        plot.append(mark);
        runningTotal += entry.value;
        cumulativePoints.push({
            x: bounds.left + band * (index + 0.5),
            y: bounds.bottom - (runningTotal / total) * (bounds.bottom - bounds.top),
            percent: runningTotal / total * 100,
        });
    });
    drawCategoryLabels(plot, entries, bounds, Math.max(1, Math.ceil(entries.length / 16)));
    const cumulativePath = cumulativePoints
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
    plot.append(makeSvg("path", {
        d: cumulativePath,
        fill: "none",
        stroke: "#d27a3e",
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
    }));
    cumulativePoints.forEach((point) => {
        const mark = makeSvg("circle", {
            cx: point.x,
            cy: point.y,
            r: 4,
            fill: "#d27a3e",
            stroke: "#fff",
            "stroke-width": 1.5,
        });
        addTooltip(mark, `${formatNumber(point.percent)}% cumulative`);
        plot.append(mark);
    });
    [0, 25, 50, 75, 100].forEach((percent) => {
        const yPosition = bounds.bottom - (percent / 100) * (bounds.bottom - bounds.top);
        plot.append(makeSvg("text", {
            x: bounds.right + 8,
            y: yPosition + 4,
            "text-anchor": "start",
        }, `${percent}%`));
    });
    plot.append(makeSvg("text", {
        x: 792,
        y: (bounds.top + bounds.bottom) / 2,
        "text-anchor": "middle",
        class: "axis-title",
        transform: `rotate(90 792 ${(bounds.top + bounds.bottom) / 2})`,
    }, "Cumulative %"));
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Category", elements.yAxisLabel.value || "Value");
}

function drawFrequencyPolygon() {
    const values = getYValues().map((entry) => entry.value);
    const { min, max, bins } = makeHistogramBins(values);
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
    const y = drawGrid(plot, 0, maxCount + Math.max(1, maxCount * 0.08), bounds);
    const x = createScale(min, max, bounds.left, bounds.right);
    const points = bins.map((bin) => ({
        x: x((bin.start + bin.end) / 2),
        y: y(bin.count),
        count: bin.count,
        center: (bin.start + bin.end) / 2,
    }));
    plot.append(makeSvg("path", {
        d: points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "),
        fill: "none",
        stroke: "#1682b3",
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
    }));
    points.forEach((point) => {
        const mark = makeSvg("circle", {
            cx: point.x,
            cy: point.y,
            r: 5,
            fill: palette[0],
            stroke: "#fff",
            "stroke-width": 2,
        });
        addTooltip(mark, `Midpoint ${formatNumber(point.center)}: frequency ${point.count}`);
        plot.append(mark);
    });
    drawNumericXAxis(plot, min, max, bounds);
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Value", elements.yAxisLabel.value || "Frequency");
}

function drawOgive() {
    const values = getYValues().map((entry) => entry.value);
    const { min, max, bins } = makeHistogramBins(values);
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const y = drawGrid(plot, 0, values.length, bounds);
    const x = createScale(min, max, bounds.left, bounds.right);
    let cumulative = 0;
    const points = [{ x: x(min), y: y(0), value: min, cumulative: 0 }];
    bins.forEach((bin) => {
        cumulative += bin.count;
        points.push({
            x: x(bin.end),
            y: y(cumulative),
            value: bin.end,
            cumulative,
        });
    });
    plot.append(makeSvg("path", {
        d: points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "),
        fill: "none",
        stroke: "#1682b3",
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
    }));
    points.slice(1).forEach((point) => {
        const mark = makeSvg("circle", {
            cx: point.x,
            cy: point.y,
            r: 4.5,
            fill: palette[0],
            stroke: "#fff",
            "stroke-width": 1.5,
        });
        addTooltip(mark, `At or below ${formatNumber(point.value)}: ${point.cumulative} value(s)`);
        plot.append(mark);
    });
    drawNumericXAxis(plot, min, max, bounds);
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Value", elements.yAxisLabel.value || "Cumulative frequency");
}

function drawDensityPlot() {
    const values = getYValues().map((entry) => entry.value);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const deviation = Math.sqrt(variance);
    const [dataMin, dataMax] = paddedDomain(values);
    const bandwidth = deviation > 0
        ? 1.06 * deviation * values.length ** -0.2
        : (dataMax - dataMin) / 10;
    const safeBandwidth = Math.max(bandwidth, Number.EPSILON);
    const min = Math.min(dataMin, Math.min(...values) - safeBandwidth * 3);
    const max = Math.max(dataMax, Math.max(...values) + safeBandwidth * 3);
    const points = Array.from({ length: 61 }, (_, index) => {
        const x = min + ((max - min) * index) / 60;
        const density = values.reduce((sum, value) => {
            const standardized = (x - value) / safeBandwidth;
            return sum + Math.exp(-0.5 * standardized ** 2);
        }, 0) / (values.length * safeBandwidth * Math.sqrt(2 * Math.PI));
        return { x, density };
    });
    const maxDensity = Math.max(...points.map((point) => point.density));
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const y = drawGrid(plot, 0, maxDensity * 1.12, bounds);
    const x = createScale(min, max, bounds.left, bounds.right);
    const path = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.x)} ${y(point.density)}`)
        .join(" ");
    plot.append(
        makeSvg("path", {
            d: `${path} L ${bounds.right} ${bounds.bottom} L ${bounds.left} ${bounds.bottom} Z`,
            fill: "#8ed0e2",
            "fill-opacity": 0.32,
            stroke: "none",
        }),
        makeSvg("path", {
            d: path,
            fill: "none",
            stroke: "#1682b3",
            "stroke-width": 3,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
        }),
    );
    drawNumericXAxis(plot, min, max, bounds);
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Value", elements.yAxisLabel.value || "Density");
}

function drawDotPlot() {
    const entries = getYValues();
    const sorted = [...entries].sort((a, b) => a.value - b.value);
    const [min, max] = paddedDomain(sorted.map((entry) => entry.value));
    const groups = new Map();
    sorted.forEach((entry) => {
        const key = String(entry.value);
        const group = groups.get(key) || [];
        group.push(entry);
        groups.set(key, group);
    });
    const maximumCount = Math.max(...[...groups.values()].map((group) => group.length));
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const y = drawGrid(plot, 0, maximumCount + 1, bounds);
    const x = createScale(min, max, bounds.left, bounds.right);
    numericTicks(min, max).forEach((tick) => {
        const position = x(tick);
        plot.append(
            makeSvg("line", {
                x1: position,
                y1: bounds.bottom,
                x2: position,
                y2: bounds.bottom + 5,
                class: "axis-line",
            }),
            makeSvg("text", {
                x: position,
                y: bounds.bottom + 20,
                "text-anchor": "middle",
            }, formatNumber(tick)),
        );
    });
    let pointIndex = 0;
    groups.forEach((group, value) => {
        group.forEach((entry, stackIndex) => {
            const mark = makeSvg("circle", {
                cx: x(Number(value)),
                cy: y(stackIndex + 1),
                r: 6,
                fill: palette[pointIndex % palette.length],
                stroke: "#fff",
                "stroke-width": 1.5,
            });
            addTooltip(mark, `${entry.label}: ${formatNumber(entry.value)}`);
            plot.append(mark);
            pointIndex += 1;
        });
    });
    addAxisTitles(plot, bounds, elements.xAxisLabel.value || "Value", elements.yAxisLabel.value || "Frequency");
}

function drawBoxPlot() {
    const values = getYValues().map((entry) => entry.value).sort((a, b) => a - b);
    const [min, max] = paddedDomain(values);
    const scale = createScale(min, max, 78, 778);
    const { q1, median: middle, q3 } = quartiles(values);
    const centerY = 208;
    const boxHeight = 68;
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    numericTicks(min, max).forEach((tick) => {
        const x = scale(tick);
        plot.append(
            makeSvg("line", {
                x1: x,
                y1: 333,
                x2: x,
                y2: 338,
                class: "axis-line",
            }),
            makeSvg("text", {
                x,
                y: 355,
                "text-anchor": "middle",
            }, formatNumber(tick)),
        );
    });
    plot.append(
        makeSvg("line", {
            x1: scale(values[0]),
            y1: centerY,
            x2: scale(values[values.length - 1]),
            y2: centerY,
            stroke: "#1d789f",
            "stroke-width": 2,
        }),
        makeSvg("line", {
            x1: scale(values[0]),
            y1: centerY - 16,
            x2: scale(values[0]),
            y2: centerY + 16,
            stroke: "#1d789f",
            "stroke-width": 2,
        }),
        makeSvg("line", {
            x1: scale(values[values.length - 1]),
            y1: centerY - 16,
            x2: scale(values[values.length - 1]),
            y2: centerY + 16,
            stroke: "#1d789f",
            "stroke-width": 2,
        }),
    );
    const box = makeSvg("rect", {
        x: scale(q1),
        y: centerY - boxHeight / 2,
        width: Math.max(1, scale(q3) - scale(q1)),
        height: boxHeight,
        rx: 5,
        fill: "#a9dfed",
        stroke: "#1682b3",
        "stroke-width": 2,
    });
    addTooltip(box, `Q1: ${formatNumber(q1)}, median: ${formatNumber(middle)}, Q3: ${formatNumber(q3)}`);
    plot.append(box);
    plot.append(makeSvg("line", {
        x1: scale(middle),
        y1: centerY - boxHeight / 2,
        x2: scale(middle),
        y2: centerY + boxHeight / 2,
        stroke: "#0b5077",
        "stroke-width": 3,
    }));
    addAxisTitles(plot, { left: 78, right: 778, top: 55, bottom: 333 }, elements.xAxisLabel.value || "Value", "");
}

function drawStemAndLeafPlot() {
    const values = getYValues().map((entry) => entry.value).sort((a, b) => a - b);
    const useTenths = values.some((value) => !Number.isInteger(value));
    const multiplier = useTenths ? 10 : 1;
    const stems = new Map();
    values.forEach((value) => {
        const scaledValue = Math.round(value * multiplier);
        const stem = Math.trunc(scaledValue / 10);
        const leaf = Math.abs(scaledValue - stem * 10);
        const leaves = stems.get(stem) || [];
        leaves.push(leaf);
        stems.set(stem, leaves);
    });

    const displayRows = [];
    [...stems.entries()]
        .sort(([first], [second]) => first - second)
        .forEach(([stem, leaves]) => {
            leaves.sort((first, second) => first - second);
            for (let index = 0; index < leaves.length; index += 30) {
                displayRows.push({
                    stem: index === 0 ? String(stem) : "",
                    leaves: leaves.slice(index, index + 30).join("  "),
                });
            }
        });

    const rowHeight = 24;
    const viewHeight = Math.max(440, 128 + displayRows.length * rowHeight);
    elements.chart.setAttribute("viewBox", `0 0 800 ${viewHeight}`);
    addChartTitle();
    elements.chart.append(
        makeSvg("text", {
            x: 255,
            y: 66,
            "text-anchor": "end",
            class: "axis-title",
        }, "Stem"),
        makeSvg("text", {
            x: 280,
            y: 66,
            class: "axis-title",
        }, "Leaves"),
    );
    elements.chart.append(makeSvg("line", {
        x1: 265,
        y1: 52,
        x2: 265,
        y2: 77 + displayRows.length * rowHeight,
        class: "axis-line",
    }));
    displayRows.forEach((row, index) => {
        const y = 96 + index * rowHeight;
        elements.chart.append(
            makeSvg("text", {
                x: 255,
                y,
                "text-anchor": "end",
                "font-family": "Consolas, monospace",
            }, row.stem),
            makeSvg("text", {
                x: 280,
                y,
                "font-family": "Consolas, monospace",
            }, row.leaves),
        );
    });
    const key = useTenths
        ? "Key: 1 | 2 = 1.2; decimal values are rounded to tenths."
        : "Key: 1 | 5 = 15.";
    elements.chart.append(makeSvg("text", {
        x: 400,
        y: viewHeight - 22,
        "text-anchor": "middle",
        class: "axis-title",
    }, key));
}

function inverseNormal(probability) {
    const a = [
        -39.6968302866538,
        220.946098424521,
        -275.928510446969,
        138.357751867269,
        -30.6647980661472,
        2.50662827745924,
    ];
    const b = [
        -54.4760987982241,
        161.585836858041,
        -155.698979859887,
        66.8013118877197,
        -13.2806815528857,
    ];
    const c = [
        -0.00778489400243029,
        -0.322396458041136,
        -2.40075827716184,
        -2.54973253934373,
        4.37466414146497,
        2.93816398269878,
    ];
    const d = [
        0.00778469570904146,
        0.32246712907004,
        2.445134137143,
        3.75440866190742,
    ];
    const low = 0.02425;
    const high = 1 - low;
    if (probability < low) {
        const q = Math.sqrt(-2 * Math.log(probability));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (probability > high) {
        const q = Math.sqrt(-2 * Math.log(1 - probability));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    const q = probability - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function drawQQPlot() {
    const sample = getYValues().map((entry) => entry.value).sort((a, b) => a - b);
    const points = sample.map((value, index) => ({
        theoretical: inverseNormal((index + 0.5) / sample.length),
        value,
    }));
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const [xMin, xMax] = paddedDomain(points.map((point) => point.theoretical));
    const [yMin, yMax] = paddedDomain(sample);
    const x = createScale(xMin, xMax, bounds.left, bounds.right);
    const y = drawGrid(plot, yMin, yMax, bounds);
    drawNumericXAxis(plot, xMin, xMax, bounds);

    const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length;
    const standardDeviation = Math.sqrt(
        sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sample.length,
    );
    const reference = makeSvg("line", {
        x1: x(xMin),
        y1: y(mean + standardDeviation * xMin),
        x2: x(xMax),
        y2: y(mean + standardDeviation * xMax),
        stroke: "#d27a3e",
        "stroke-width": 2,
        "stroke-dasharray": "6 5",
    });
    addTooltip(reference, "Reference line based on the sample mean and standard deviation");
    plot.append(reference);
    points.forEach((point, index) => {
        const mark = makeSvg("circle", {
            cx: x(point.theoretical),
            cy: y(point.value),
            r: 5,
            fill: palette[index % palette.length],
            stroke: "#fff",
            "stroke-width": 1.5,
        });
        addTooltip(mark, `Theoretical ${formatNumber(point.theoretical)}; sample ${formatNumber(point.value)}`);
        plot.append(mark);
    });
    addAxisTitles(
        plot,
        bounds,
        elements.xAxisLabel.value || "Theoretical normal quantile",
        elements.yAxisLabel.value || "Sample quantile",
    );
}

function renderDataTable() {
    elements.chartTable.replaceChildren();
    if (rows.length === 0) {
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "Add data rows to display a table.";
        elements.chartTable.append(note);
        return;
    }
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.className = "visually-hidden";
    caption.textContent = chartTitle();
    table.append(caption);
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Label", "X value", "Y value", "Error", "Size"].forEach((label) => {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        headerRow.append(cell);
    });
    head.append(headerRow);
    table.append(head);
    const body = document.createElement("tbody");
    rows.forEach((row, index) => {
        const tableRow = document.createElement("tr");
        [getLabel(row, index), row.x, row.y, row.error, row.size].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = typeof value === "number" ? formatNumber(value) : value ?? "—";
            tableRow.append(cell);
        });
        body.append(tableRow);
    });
    table.append(body);
    elements.chartTable.append(table);
}

function updateChartHelp() {
    const help = {
        "bar-h": "Compare categories with horizontal bars. Enter a label and a Y value for each row.",
        bar: "Compare categories with vertical bars. Enter a label and a Y value for each row.",
        pareto: "A Pareto chart sorts categories from largest to smallest and overlays a cumulative percentage line.",
        line: "See how values change across an ordered set of categories.",
        scatter: "Explore the relationship between two numeric variables. Each plotted row needs both an X and a Y value.",
        bubble: "Compare three numeric variables. X and Y set each position; Size controls the bubble area.",
        pie: "Compare parts of a whole. Values must be non-negative and work best with 9 or fewer categories.",
        donut: "Compare parts of a whole and see their total. Values must be non-negative.",
        histogram: "See how numeric Y values are distributed. The chart groups values into intervals.",
        frequency: "Join the frequency counts at the centre of each histogram interval.",
        ogive: "Show cumulative frequency as values increase.",
        density: "Estimate the shape of the distribution with a smoothed density curve.",
        stem: "Split each number into a stem and a leaf to preserve the original values.",
        dot: "See every numeric Y value, with repeated values stacked into columns.",
        qq: "Compare sample values with normal-distribution quantiles. A near-straight pattern suggests a roughly normal shape.",
        error: "Show each Y value with a vertical plus/minus error amount from the Error column.",
        box: "Compare the minimum, first quartile, median, third quartile, and maximum of your Y values.",
        table: "View all labels and values together in a clean table.",
    };
    elements.chartHelp.textContent = help[elements.chartType.value];
    document.querySelectorAll(".axis-setting").forEach((setting) => {
        setting.hidden = ["pie", "donut", "stem", "table"].includes(elements.chartType.value);
    });
}

function hasInvalidNumericInput() {
    return [...elements.dataRows.querySelectorAll('input[type="number"]')].some((input) => {
        if (!input.value.trim()) {
            return false;
        }
        const value = Number(input.value);
        return !Number.isFinite(value) || Math.abs(value) > maxAbsoluteValue;
    });
}

function renderChart() {
    setChartError("");
    updateChartHelp();
    const type = elements.chartType.value;
    elements.chartTable.hidden = type !== "table";
    elements.chart.hidden = type === "table";
    elements.chart.classList.toggle("is-hidden", type === "table");

    if (type === "table") {
        renderDataTable();
        elements.chartCaption.textContent = `${rows.length} data row${rows.length === 1 ? "" : "s"} shown in the table.`;
        return;
    }
    if (rows.length > maxRows) {
        setChartError(`Charts support up to ${maxRows} data rows. Remove extra rows or import a smaller CSV.`);
        showChartMessage("Too many rows to draw this chart.");
        return;
    }
    if (hasInvalidNumericInput()) {
        setChartError(`Use valid numeric values between -${formatNumber(maxAbsoluteValue)} and ${formatNumber(maxAbsoluteValue)}.`);
        showChartMessage("Check the numeric values in your table.");
        return;
    }

    const values = getYValues();
    const scatterValues = rows.filter(
        (row) => Number.isFinite(row.x) && Number.isFinite(row.y),
    );
    const bubbleValues = rows.filter(
        (row) =>
            Number.isFinite(row.x) &&
            Number.isFinite(row.y) &&
            Number.isFinite(row.size),
    );
    const errorValues = rows.filter(
        (row) => Number.isFinite(row.y) && Number.isFinite(row.error),
    );
    if (type === "scatter" && scatterValues.length === 0) {
        setChartError("Enter at least one row with both an X value and a Y value to draw a scatter plot.");
        showChartMessage("Add numeric X and Y values.");
        return;
    }
    if (type === "bubble" && bubbleValues.length === 0) {
        setChartError("Enter X, Y, and Size values for at least one row to draw a bubble chart.");
        showChartMessage("Add numeric X, Y, and Size values.");
        return;
    }
    if (type === "error" && errorValues.length === 0) {
        setChartError("Enter both a Y value and a non-negative Error amount for at least one row.");
        showChartMessage("Add Y values and error amounts.");
        return;
    }
    if (!["scatter", "bubble"].includes(type) && values.length === 0) {
        setChartError("Enter at least one numeric Y value to draw this chart.");
        showChartMessage("Add a numeric Y value to get started.");
        return;
    }

    elements.chart.replaceChildren();
    elements.chart.setAttribute("viewBox", "0 0 800 440");
    if (type === "bar-h") {
        drawHorizontalBarChart();
    } else if (type === "bar") {
        drawBarChart();
    } else if (type === "pareto") {
        drawParetoChart();
    } else if (type === "line") {
        drawLineChart();
    } else if (type === "scatter") {
        drawScatterChart();
    } else if (type === "bubble") {
        drawBubbleChart();
    } else if (type === "error") {
        drawErrorBarChart();
    } else if (type === "pie") {
        drawPieChart();
    } else if (type === "donut") {
        drawPieChart(true);
    } else if (type === "histogram") {
        drawHistogram();
    } else if (type === "dot") {
        drawDotPlot();
    } else if (type === "box") {
        drawBoxPlot();
    } else if (type === "frequency") {
        drawFrequencyPolygon();
    } else if (type === "ogive") {
        drawOgive();
    } else if (type === "density") {
        drawDensityPlot();
    } else if (type === "stem") {
        drawStemAndLeafPlot();
    } else if (type === "qq") {
        drawQQPlot();
    }

    const plottedCount = type === "scatter"
        ? scatterValues.length
        : type === "bubble"
            ? bubbleValues.length
            : type === "error"
                ? errorValues.length
                : values.length;
    const skippedCount = rows.length - plottedCount;
    elements.chartCaption.textContent = type === "stem"
        ? "Leaves preserve the sorted values; decimal inputs are rounded to tenths."
        : skippedCount > 0
        ? `${plottedCount} plotted value${plottedCount === 1 ? "" : "s"}. Rows with blank numeric cells are skipped.`
        : `${plottedCount} plotted value${plottedCount === 1 ? "" : "s"}. Hover or tap a mark to see its value.`;
}

function renderAll() {
    renderStatistics();
    renderChart();
}

function renderEditor() {
    elements.dataRows.replaceChildren();
    rows.forEach((row, index) => {
        const tableRow = document.createElement("tr");
        tableRow.dataset.index = String(index);

        const labelCell = document.createElement("td");
        const labelInput = document.createElement("input");
        labelInput.type = "text";
        labelInput.maxLength = 60;
        labelInput.value = row.label;
        labelInput.dataset.field = "label";
        labelInput.setAttribute("aria-label", `Label for row ${index + 1}`);
        labelCell.append(labelInput);

        const xCell = document.createElement("td");
        const xInput = document.createElement("input");
        xInput.type = "number";
        xInput.step = "any";
        xInput.value = row.x ?? "";
        xInput.dataset.field = "x";
        xInput.setAttribute("aria-label", `X value for row ${index + 1}`);
        xCell.append(xInput);

        const yCell = document.createElement("td");
        const yInput = document.createElement("input");
        yInput.type = "number";
        yInput.step = "any";
        yInput.value = row.y ?? "";
        yInput.dataset.field = "y";
        yInput.setAttribute("aria-label", `Y value for row ${index + 1}`);
        yCell.append(yInput);

        const errorCell = document.createElement("td");
        const errorInput = document.createElement("input");
        errorInput.type = "number";
        errorInput.min = "0";
        errorInput.step = "any";
        errorInput.value = row.error ?? "";
        errorInput.dataset.field = "error";
        errorInput.setAttribute("aria-label", `Error amount for row ${index + 1}`);
        errorCell.append(errorInput);

        const sizeCell = document.createElement("td");
        const sizeInput = document.createElement("input");
        sizeInput.type = "number";
        sizeInput.min = "0";
        sizeInput.step = "any";
        sizeInput.value = row.size ?? "";
        sizeInput.dataset.field = "size";
        sizeInput.setAttribute("aria-label", `Bubble size for row ${index + 1}`);
        sizeCell.append(sizeInput);

        const actionCell = document.createElement("td");
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-row";
        removeButton.dataset.removeIndex = String(index);
        removeButton.setAttribute("aria-label", `Remove row ${index + 1}`);
        removeButton.textContent = "×";
        actionCell.append(removeButton);

        tableRow.append(labelCell, xCell, yCell, errorCell, sizeCell, actionCell);
        elements.dataRows.append(tableRow);
    });
    elements.addRow.disabled = rows.length >= maxRows;
    renderAll();
}

function setSample(name) {
    const sample = samples[name];
    if (!sample) {
        return;
    }
    rows = sample.rows.map(([label, x, y, error, size]) => ({
        label,
        x,
        y,
        error,
        size,
    }));
    elements.chartTitle.value = sample.title;
    elements.chartType.value = sample.type;
    elements.xAxisLabel.value = sample.xLabel;
    elements.yAxisLabel.value = sample.yLabel;
    elements.sampleData.value = name;
    elements.dataStatus.textContent = name === "blank"
        ? "Blank table ready. Add values to start plotting."
        : `Loaded ${sample.title.toLowerCase()} sample data. Edit any cell to make it yours.`;
    renderEditor();
}

function csvEscape(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv() {
    const content = [
        ["Label", "X", "Y", "Error", "Size"],
        ...rows.map((row) => [row.label, row.x, row.y, row.error, row.size]),
    ].map((line) => line.map(csvEscape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "math-solver-data.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    elements.dataStatus.textContent = "CSV file exported.";
}

function parseCsv(text) {
    const grid = [];
    let record = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                field += character;
            }
        } else if (character === '"' && field === "") {
            quoted = true;
        } else if (character === ",") {
            record.push(field);
            field = "";
        } else if (character === "\n" || character === "\r") {
            if (character === "\r" && text[index + 1] === "\n") {
                index += 1;
            }
            record.push(field);
            if (record.some((cell) => cell.trim() !== "")) {
                grid.push(record);
            }
            record = [];
            field = "";
        } else {
            field += character;
        }
    }
    if (quoted) {
        throw new Error("The CSV has an unclosed quotation mark.");
    }
    record.push(field);
    if (record.some((cell) => cell.trim() !== "")) {
        grid.push(record);
    }
    return grid;
}

function parseCsvNumber(value, rowNumber, columnName) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const number = Number(trimmed);
    if (!Number.isFinite(number) || Math.abs(number) > maxAbsoluteValue) {
        throw new Error(`Row ${rowNumber} has an invalid ${columnName} value.`);
    }
    return number;
}

function importCsv(text) {
    const grid = parseCsv(text.replace(/^\uFEFF/, ""));
    if (grid.length === 0) {
        throw new Error("The selected CSV has no data rows.");
    }
    const normalizedHeaders = grid[0].map((cell) => cell.trim().toLowerCase());
    const hasHeader = normalizedHeaders.some((cell) =>
        ["label", "category", "name", "x", "x value", "y", "y value", "value", "error", "size"].includes(cell),
    );
    const headers = hasHeader ? normalizedHeaders : [];
    const dataRows = hasHeader ? grid.slice(1) : grid;
    if (dataRows.length > maxRows) {
        throw new Error(`Choose a CSV with no more than ${maxRows} data rows.`);
    }
    if (dataRows.length === 0) {
        throw new Error("The CSV contains a header but no data rows.");
    }

    const labelIndex = hasHeader
        ? headers.findIndex((header) => ["label", "category", "name"].includes(header))
        : dataRows[0].length === 1 ? -1 : 0;
    const xIndex = hasHeader
        ? headers.findIndex((header) => ["x", "x value"].includes(header))
        : dataRows[0].length >= 3 ? 1 : -1;
    const yIndex = hasHeader
        ? headers.findIndex((header) => ["y", "y value", "value"].includes(header))
        : dataRows[0].length >= 3 ? 2 : dataRows[0].length === 1 ? 0 : 1;
    const errorIndex = hasHeader
        ? headers.findIndex((header) => header === "error")
        : dataRows[0].length >= 4 ? 3 : -1;
    const sizeIndex = hasHeader
        ? headers.findIndex((header) => header === "size")
        : dataRows[0].length >= 5 ? 4 : -1;
    if (yIndex < 0) {
        throw new Error("Add a Y or Value column to the CSV. X is optional.");
    }

    return dataRows.map((cells, index) => {
        const label = labelIndex >= 0 ? (cells[labelIndex] || "").trim() : `Item ${index + 1}`;
        const x = xIndex >= 0
            ? parseCsvNumber(cells[xIndex] || "", index + 2, "X")
            : null;
        const y = parseCsvNumber(cells[yIndex] || "", index + 2, "Y");
        const error = errorIndex >= 0
            ? parseCsvNumber(cells[errorIndex] || "", index + 2, "Error")
            : null;
        const size = sizeIndex >= 0
            ? parseCsvNumber(cells[sizeIndex] || "", index + 2, "Size")
            : null;
        return { label, x, y, error, size };
    });
}

function reportText(report, x, y, text, size = 14, color = "#26485c", weight = 400) {
    report.append(makeSvg("text", {
        x,
        y,
        fill: color,
        "font-family": "Arial, sans-serif",
        "font-size": size,
        "font-weight": weight,
    }, text));
}

function createReportSvg(chartCopy, selectedType) {
    const reportWidth = 1600;
    const viewBox = (chartCopy.getAttribute("viewBox") || "0 0 800 440")
        .split(/\s+/)
        .map(Number);
    const chartWidth = 960;
    const chartHeight = Math.max(510, chartWidth * (viewBox[3] / viewBox[2]));
    const chartTop = 148;
    const tableTop = Math.max(730, chartTop + chartHeight + 44);
    const headerHeight = 38;
    const rowHeight = 28;
    const reportHeight = tableTop + headerHeight + rows.length * rowHeight + 70;
    const report = makeSvg("svg", {
        xmlns: svgNamespace,
        width: reportWidth,
        height: reportHeight,
        viewBox: `0 0 ${reportWidth} ${reportHeight}`,
    });
    const style = makeSvg("style", {}, `
        text { font-family: Arial, sans-serif; }
        .chart-report text { fill: #627c8b; font-family: Arial, sans-serif; font-size: 11px; }
        .chart-report .chart-main-title { fill: #26485c; font-size: 14px; font-weight: 700; }
        .chart-report .axis-title { fill: #446678; font-size: 11px; font-weight: 700; }
        .chart-report .grid-line { stroke: #e8eff3; stroke-width: 1; }
        .chart-report .axis-line { stroke: #9db1bd; stroke-width: 1.2; }
        .chart-report .data-mark { cursor: auto; }
    `);
    report.append(style, makeSvg("rect", {
        x: 0,
        y: 0,
        width: reportWidth,
        height: reportHeight,
        fill: "#ffffff",
    }));

    report.append(makeSvg("rect", {
        x: 1,
        y: 1,
        width: reportWidth - 2,
        height: reportHeight - 2,
        fill: "none",
        stroke: "#dce9f0",
        "stroke-width": 2,
    }));
    reportText(report, 54, 43, "MATH SOLVER++  /  GRAPHS & STATISTICS", 13, "#39738f", 700);
    reportText(report, 54, 86, chartTitle(), 30, "#173448", 700);
    const selectedLabel = selectedType === "table"
        ? "Vertical bar chart (table view was selected)"
        : elements.chartType.options[elements.chartType.selectedIndex].textContent;
    reportText(report, 54, 116, `${selectedLabel}  •  ${rows.length} data rows`, 14, "#647d8b");

    report.append(
        makeSvg("rect", {
            x: 40,
            y: chartTop - 12,
            width: 990,
            height: chartHeight + 24,
            rx: 14,
            fill: "#ffffff",
            stroke: "#dce9f0",
            "stroke-width": 2,
        }),
        makeSvg("rect", {
            x: 1050,
            y: chartTop - 12,
            width: 510,
            height: chartHeight + 24,
            rx: 14,
            fill: "#ffffff",
            stroke: "#dce9f0",
            "stroke-width": 2,
        }),
    );
    chartCopy.removeAttribute("id");
    chartCopy.removeAttribute("hidden");
    chartCopy.classList.remove("is-hidden");
    chartCopy.setAttribute("class", "chart-report");
    chartCopy.setAttribute("x", "55");
    chartCopy.setAttribute("y", String(chartTop));
    chartCopy.setAttribute("width", String(chartWidth));
    chartCopy.setAttribute("height", String(chartHeight));
    chartCopy.setAttribute("preserveAspectRatio", "xMidYMin meet");
    report.append(chartCopy);

    reportText(report, 1080, 174, "Statistics", 21, "#173448", 700);
    reportText(
        report,
        1080,
        198,
        `${getYValues().length} numeric Y values`,
        12,
        "#647d8b",
    );
    const statItems = [...elements.statsSummary.querySelectorAll(".stat-item")];
    if (statItems.length === 0) {
        reportText(report, 1080, 238, "Add numeric Y values to calculate statistics.", 13, "#647d8b");
    }
    statItems.forEach((item, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = 1080 + column * 232;
        const y = 222 + row * 52;
        const label = item.querySelector(".stat-label").textContent;
        const value = item.querySelector(".stat-value").textContent;
        report.append(makeSvg("rect", {
            x,
            y,
            width: 216,
            height: 44,
            rx: 7,
            fill: "#f5fafc",
            stroke: "#e5eef2",
        }));
        reportText(report, x + 10, y + 17, label, 10, "#738a97", 600);
        reportText(report, x + 10, y + 35, value, 14, "#1d506c", 700);
    });
    reportText(
        report,
        1080,
        Math.min(chartTop + chartHeight - 16, 690),
        "Quartiles use the median of each half of the sorted data.",
        10,
        "#81939d",
    );

    reportText(report, 54, tableTop, "Data table", 21, "#173448", 700);
    reportText(report, 54, tableTop + 22, "All rows included in this chart", 12, "#647d8b");
    const tableX = 50;
    const columnWidths = [600, 220, 220, 220, 240];
    const headers = ["Label", "X value", "Y value", "Error", "Size"];
    const tableY = tableTop + 36;
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    report.append(makeSvg("rect", {
        x: tableX,
        y: tableY,
        width: tableWidth,
        height: headerHeight,
        rx: 5,
        fill: "#eaf5fa",
    }));
    let columnX = tableX;
    headers.forEach((header, index) => {
        reportText(report, columnX + 12, tableY + 25, header, 12, "#355a6e", 700);
        columnX += columnWidths[index];
    });
    rows.forEach((row, index) => {
        const rowY = tableY + headerHeight + index * rowHeight;
        if (index % 2 === 0) {
            report.append(makeSvg("rect", {
                x: tableX,
                y: rowY,
                width: tableWidth,
                height: rowHeight,
                fill: "#f8fbfc",
            }));
        }
        const values = [
            getLabel(row, index),
            row.x === null || row.x === undefined ? "—" : formatNumber(row.x),
            row.y === null || row.y === undefined ? "—" : formatNumber(row.y),
            row.error === null || row.error === undefined ? "—" : formatNumber(row.error),
            row.size === null || row.size === undefined ? "—" : formatNumber(row.size),
        ];
        let cellX = tableX;
        values.forEach((value, cellIndex) => {
            reportText(report, cellX + 12, rowY + 19, value, 11, "#355a6e");
            cellX += columnWidths[cellIndex];
        });
        report.append(makeSvg("line", {
            x1: tableX,
            y1: rowY + rowHeight,
            x2: tableX + tableWidth,
            y2: rowY + rowHeight,
            stroke: "#e7eef2",
        }));
    });
    reportText(report, 54, reportHeight - 20, "Created with Math Solver++", 10, "#81939d");
    return report;
}

function currentChartForReport() {
    const selectedType = elements.chartType.value;
    let chartCopy;
    let chartError = "";
    try {
        if (selectedType === "table") {
            elements.chartType.value = "bar";
            renderChart();
        }
        if (!elements.chartError.hidden) {
            chartError = elements.chartError.textContent;
        } else {
            chartCopy = elements.chart.cloneNode(true);
        }
    } finally {
        elements.chartType.value = selectedType;
        renderChart();
    }
    if (chartError) {
        throw new Error(`Fix the chart before exporting: ${chartError}`);
    }
    return { chartCopy, selectedType };
}

async function downloadReportImage() {
    elements.dataStatus.textContent = "Preparing the chart, statistics, and data table...";
    const { chartCopy, selectedType } = currentChartForReport();
    const report = createReportSvg(chartCopy, selectedType);
    const svgBlob = new Blob(
        [new XMLSerializer().serializeToString(report)],
        { type: "image/svg+xml;charset=utf-8" },
    );
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
        const image = new Image();
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error("The report image could not be rendered."));
            image.src = svgUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = report.width.baseVal.value;
        canvas.height = report.height.baseVal.value;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("This browser could not create an image canvas.");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!pngBlob) {
            throw new Error("The browser could not encode the report as a PNG.");
        }
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = "math-solver-graph-report.png";
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
        elements.dataStatus.textContent = "Saved a PNG report with the chart, statistics, and full data table.";
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

elements.dataRows.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-field]");
    if (!input) {
        return;
    }
    const index = Number(input.closest("tr").dataset.index);
    const field = input.dataset.field;
    const value = input.value;
    if (field === "label") {
        rows[index].label = value;
    } else if (value.trim() === "") {
        rows[index][field] = null;
    } else {
        const number = Number(value);
        rows[index][field] = Number.isFinite(number) && Math.abs(number) <= maxAbsoluteValue
            ? number
            : null;
    }
    elements.sampleData.value = "";
    renderAll();
});

elements.dataRows.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-index]");
    if (!button) {
        return;
    }
    rows.splice(Number(button.dataset.removeIndex), 1);
    elements.sampleData.value = "";
    elements.dataStatus.textContent = "Row removed.";
    renderEditor();
});

elements.addRow.addEventListener("click", () => {
    if (rows.length >= maxRows) {
        elements.dataStatus.textContent = `A table can contain up to ${maxRows} rows.`;
        return;
    }
    rows.push({
        label: `Item ${rows.length + 1}`,
        x: rows.length + 1,
        y: null,
        error: null,
        size: null,
    });
    elements.sampleData.value = "";
    elements.dataStatus.textContent = "Row added. Enter a Y value to include it in the chart.";
    renderEditor();
    elements.dataRows.querySelector("tr:last-child input")?.focus();
});

elements.sampleData.addEventListener("change", () => {
    if (elements.sampleData.value) {
        setSample(elements.sampleData.value);
    }
});

elements.chartType.addEventListener("change", renderAll);
elements.chartTitle.addEventListener("input", renderAll);
elements.xAxisLabel.addEventListener("input", renderAll);
elements.yAxisLabel.addEventListener("input", renderAll);
document.getElementById("export-csv").addEventListener("click", downloadCsv);
elements.exportReport.addEventListener("click", async () => {
    elements.exportReport.disabled = true;
    try {
        await downloadReportImage();
    } catch (error) {
        elements.dataStatus.textContent = `Could not export image: ${error.message}`;
    } finally {
        elements.exportReport.disabled = false;
    }
});

elements.csvFile.addEventListener("change", async () => {
    const file = elements.csvFile.files[0];
    if (!file) {
        return;
    }
    if (file.size > 1_000_000) {
        elements.dataStatus.textContent = "CSV files must be smaller than 1 MB.";
        elements.csvFile.value = "";
        return;
    }
    try {
        const importedRows = importCsv(await file.text());
        rows = importedRows;
        elements.chartTitle.value = file.name.replace(/\.csv$/i, "") || "Imported data";
        elements.chartType.value = "bar";
        elements.sampleData.value = "";
        elements.dataStatus.textContent = `Imported ${rows.length} row${rows.length === 1 ? "" : "s"} from ${file.name}.`;
        renderEditor();
    } catch (error) {
        elements.dataStatus.textContent = `Could not import CSV: ${error.message}`;
    } finally {
        elements.csvFile.value = "";
    }
});

setSample("sales");

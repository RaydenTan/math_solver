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
            ["Jan", 1, 18],
            ["Feb", 2, 25],
            ["Mar", 3, 20],
            ["Apr", 4, 32],
            ["May", 5, 28],
            ["Jun", 6, 40],
        ],
    },
    survey: {
        title: "Favourite fruit survey",
        type: "pie",
        xLabel: "Fruit",
        yLabel: "Votes",
        rows: [
            ["Mango", 1, 12],
            ["Apple", 2, 9],
            ["Orange", 3, 7],
            ["Banana", 4, 5],
        ],
    },
    scores: {
        title: "Class test scores",
        type: "histogram",
        xLabel: "Test score",
        yLabel: "Students",
        rows: [
            ["Student 1", 1, 62],
            ["Student 2", 2, 74],
            ["Student 3", 3, 81],
            ["Student 4", 4, 88],
            ["Student 5", 5, 74],
            ["Student 6", 6, 93],
            ["Student 7", 7, 68],
            ["Student 8", 8, 81],
            ["Student 9", 9, 77],
            ["Student 10", 10, 96],
            ["Student 11", 11, 85],
            ["Student 12", 12, 72],
        ],
    },
    blank: {
        title: "My data",
        type: "table",
        xLabel: "X value",
        yLabel: "Y value",
        rows: [
            ["Item 1", null, null],
            ["Item 2", null, null],
            ["Item 3", null, null],
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

function drawHistogram() {
    const entries = getYValues();
    const values = entries.map((entry) => entry.value);
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
    const bounds = { left: 78, right: 778, top: 55, bottom: 333 };
    const plot = makeSvg("g");
    elements.chart.append(plot);
    addChartTitle();
    const maximumCount = Math.max(...bins.map((bin) => bin.count), 1);
    const y = drawGrid(plot, 0, maximumCount + Math.max(1, maximumCount * 0.08), bounds);
    const zeroY = y(0);
    const band = (bounds.right - bounds.left) / binCount;
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
    ["Label", "X value", "Y value"].forEach((label) => {
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
        [getLabel(row, index), row.x, row.y].forEach((value) => {
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
        bar: "Compare values across categories. Enter a label and a value for each row.",
        line: "See how values change across an ordered set of categories.",
        scatter: "Explore the relationship between two numeric variables. Each plotted row needs both an X and a Y value.",
        pie: "Compare parts of a whole. Values must be non-negative and work best with 9 or fewer categories.",
        donut: "Compare parts of a whole and see their total. Values must be non-negative.",
        histogram: "See how numeric Y values are distributed. The chart groups values into intervals.",
        dot: "See every numeric Y value, with repeated values stacked into columns.",
        box: "Compare the minimum, first quartile, median, third quartile, and maximum of your Y values.",
        table: "View all labels and values together in a clean table.",
    };
    elements.chartHelp.textContent = help[elements.chartType.value];
    document.querySelectorAll(".axis-setting").forEach((setting) => {
        setting.hidden = ["pie", "donut", "table"].includes(elements.chartType.value);
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
    if (type === "scatter" && scatterValues.length === 0) {
        setChartError("Enter at least one row with both an X value and a Y value to draw a scatter plot.");
        showChartMessage("Add numeric X and Y values.");
        return;
    }
    if (type !== "scatter" && values.length === 0) {
        setChartError("Enter at least one numeric Y value to draw this chart.");
        showChartMessage("Add a numeric Y value to get started.");
        return;
    }

    elements.chart.replaceChildren();
    if (type === "bar") {
        drawBarChart();
    } else if (type === "line") {
        drawLineChart();
    } else if (type === "scatter") {
        drawScatterChart();
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
    }

    const plottedCount = type === "scatter" ? scatterValues.length : values.length;
    const skippedCount = rows.length - plottedCount;
    elements.chartCaption.textContent = skippedCount > 0
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

        const actionCell = document.createElement("td");
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-row";
        removeButton.dataset.removeIndex = String(index);
        removeButton.setAttribute("aria-label", `Remove row ${index + 1}`);
        removeButton.textContent = "×";
        actionCell.append(removeButton);

        tableRow.append(labelCell, xCell, yCell, actionCell);
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
    rows = sample.rows.map(([label, x, y]) => ({ label, x, y }));
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
        ["Label", "X", "Y"],
        ...rows.map((row) => [row.label, row.x, row.y]),
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
        ["label", "category", "name", "x", "x value", "y", "y value", "value"].includes(cell),
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
    if (yIndex < 0) {
        throw new Error("Add a Y or Value column to the CSV. X is optional.");
    }

    return dataRows.map((cells, index) => {
        const label = labelIndex >= 0 ? (cells[labelIndex] || "").trim() : `Item ${index + 1}`;
        const x = xIndex >= 0
            ? parseCsvNumber(cells[xIndex] || "", index + 2, "X")
            : null;
        const y = parseCsvNumber(cells[yIndex] || "", index + 2, "Y");
        return { label, x, y };
    });
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
    rows.push({ label: `Item ${rows.length + 1}`, x: rows.length + 1, y: null });
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

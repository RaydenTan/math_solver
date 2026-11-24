const equationEditor = document.getElementById("equations");
const targetEditor = document.getElementById("target-expression");
const simplifyEditor = document.getElementById("expression-input");
const numberKeypad = document.getElementById("number-keypad");
const letterKeypad = document.getElementById("letter-keypad");
const numbersTab = document.getElementById("numbers-tab");
const lettersTab = document.getElementById("letters-tab");
const statusOutput = document.getElementById("answer-status");
const recommendationOutput = document.getElementById("answer-recommendation");
const solutionsOutput = document.getElementById("solutions");
const solveButton = document.getElementById("solve-equations");
const goalMode = document.getElementById("goal-mode");
const graphButton = document.getElementById("graph-algebra");
const graphPanel = document.getElementById("algebra-graph");
const graphStatus = document.getElementById("algebra-graph-status");
const graphSvg = document.getElementById("algebra-graph-svg");
const graphDescription = document.getElementById("algebra-graph-description");
const graphLegend = document.getElementById("algebra-graph-legend");
const graphDownloadButton = document.getElementById("download-algebra-graph");
const graphExamplePicker = document.getElementById("graph-example");
const loadGraphExampleButton = document.getElementById("load-graph-example");
const equationInput = document.getElementById("equation-input");
const targetInput = document.getElementById("target-input");
const simplifyInput = document.getElementById("simplify-input");
const keypadSection = document.getElementById("keypad-section");

if (
    !equationEditor ||
    !targetEditor ||
    !simplifyEditor ||
    !numberKeypad ||
    !letterKeypad ||
    !numbersTab ||
    !lettersTab ||
    !statusOutput ||
    !recommendationOutput ||
    !solutionsOutput ||
    !solveButton ||
    !goalMode ||
    !graphButton ||
    !graphPanel ||
    !graphStatus ||
    !graphSvg ||
    !graphDescription ||
    !graphLegend ||
    !graphDownloadButton ||
    !graphExamplePicker ||
    !loadGraphExampleButton ||
    !equationInput ||
    !targetInput ||
    !simplifyInput ||
    !keypadSection
) {
    throw new Error("Algebra solver: required page elements are missing.");
}

const editors = [equationEditor, targetEditor, simplifyEditor];
let activeEditor = equationEditor;

editors.forEach((editor) => {
    editor.setAttribute("inputmode", "none");
    editor.setAttribute("virtualkeyboardpolicy", "manual");
    editor.addEventListener("focus", () => {
        activeEditor = editor;
        if (navigator.virtualKeyboard) {
            navigator.virtualKeyboard.hide();
        }
    });
});

function setKeypadTab(activeTab) {
    const showNumbers = activeTab === "numbers";
    numberKeypad.hidden = !showNumbers;
    letterKeypad.hidden = showNumbers;
    numbersTab.classList.toggle("active", showNumbers);
    lettersTab.classList.toggle("active", !showNumbers);
    numbersTab.setAttribute("aria-selected", String(showNumbers));
    lettersTab.setAttribute("aria-selected", String(!showNumbers));
}

numbersTab.addEventListener("click", () => setKeypadTab("numbers"));
lettersTab.addEventListener("click", () => setKeypadTab("letters"));

function addEquationLine() {
    const currentValue = equationEditor.value;
    const separator = currentValue.endsWith("\n") ? "" : "\n";
    activeEditor = equationEditor;
    insertText(`${separator}`, currentValue.length, currentValue.length);
}

function insertText(text, start, end = start) {
    const selectionStart = start ?? activeEditor.selectionStart;
    const selectionEnd = end ?? activeEditor.selectionEnd;
    activeEditor.setRangeText(text, selectionStart, selectionEnd, "end");
    activeEditor.focus({ preventScroll: true });

    if (navigator.virtualKeyboard) {
        navigator.virtualKeyboard.hide();
    }

    activeEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertTemplate(template) {
    let text;
    let cursorOffset;

    if (template === "fraction") {
        text = "()/()";
        cursorOffset = 1;
    } else if (template === "mixed") {
        text = "(1+1/2)";
        cursorOffset = 3;
    } else if (template === "root") {
        text = "root(, )";
        cursorOffset = 5;
    } else if (template === "sqrt") {
        text = "sqrt()";
        cursorOffset = 5;
    } else if (template === "power") {
        text = "^()";
        cursorOffset = 2;
    } else {
        throw new Error(`Unknown keypad template: ${template}`);
    }

    const start = activeEditor.selectionStart;
    const end = activeEditor.selectionEnd;
    insertText(text, start, end);
    const cursor = start + cursorOffset;
    activeEditor.setSelectionRange(cursor, cursor);
}

function deleteSelectionOrPreviousCharacter() {
    let start = activeEditor.selectionStart;
    let end = activeEditor.selectionEnd;

    if (start === end && start > 0) {
        start -= 1;
    }

    insertText("", start, end);
}

function clearEditor() {
    activeEditor.value = "";
    activeEditor.focus({ preventScroll: true });
    activeEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

function clearAllEditors() {
    editors.forEach((editor) => {
        editor.value = "";
    });

    if (goalMode.value === "simplify") {
        activeEditor = simplifyEditor;
    } else {
        activeEditor = equationEditor;
    }

    if (goalMode.value) {
        activeEditor.focus({ preventScroll: true });
    }
}

function makeLetterKeys() {
    const fragment = document.createDocumentFragment();

    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "key";
        button.textContent = letter;
        button.setAttribute("aria-label", `Insert variable ${letter}`);
        button.addEventListener("click", () => insertText(letter));
        fragment.append(button);
    });

    letterKeypad.replaceChildren(fragment);
}

document.querySelectorAll(".key[data-insert]").forEach((button) => {
    button.addEventListener("click", () => {
        insertText(button.dataset.insert);
    });
});

document.querySelectorAll(".key[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
        insertTemplate(button.dataset.template);
    });
});

document.querySelectorAll(".key[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
        if (button.dataset.action === "backspace") {
            deleteSelectionOrPreviousCharacter();
        } else if (button.dataset.action === "clear") {
            clearEditor();
        }
    });
});

document.getElementById("add-equation").addEventListener("click", () => {
    addEquationLine();
    equationEditor.focus({ preventScroll: true });
    const end = equationEditor.value.length;
    equationEditor.setSelectionRange(end, end);
});

equationEditor.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const start = equationEditor.selectionStart;
        const end = equationEditor.selectionEnd;
        insertText("\n", start, end);
    }
});

function updateGoalMode() {
    const mode = goalMode.value;
    const hasGoal = Boolean(mode);
    const hasEquationSystem = mode === "solve" || mode === "evaluate";

    equationInput.hidden = !hasEquationSystem;
    targetInput.hidden = mode !== "evaluate";
    simplifyInput.hidden = mode !== "simplify";
    keypadSection.hidden = !hasGoal;
    graphButton.disabled = !hasGoal;
    document.getElementById("add-equation").hidden = mode !== "solve" && mode !== "evaluate";
    activeEditor = mode === "simplify" ? simplifyEditor : equationEditor;

    if (mode === "solve") {
        document.getElementById("mode-help").textContent =
            "Enter equations one per line. We will solve every variable.";
        document.getElementById("equation-heading").textContent = "Your equations";
        document.getElementById("equation-description").textContent =
            "Use one equation per line. An expression without = is treated as equal to zero.";
        document.getElementById("equation-help").textContent =
            "Press Enter or Add equation to add another line.";
        document.getElementById("solve-button-label").textContent = "Solve all variables";
        document.getElementById("answer-heading").textContent = "Solutions";
        document.getElementById("action-hint").textContent =
            "Enter equations, then solve for their variables.";
    } else if (mode === "evaluate") {
        document.getElementById("mode-help").textContent =
            "Enter a system of equations, then a separate expression to evaluate using its solutions.";
        document.getElementById("equation-heading").textContent = "Equation system";
        document.getElementById("equation-description").textContent =
            "Use one equation per line to define the variable values.";
        document.getElementById("equation-help").textContent =
            "Example: x + y = 5 and x - y = 1.";
        document.getElementById("solve-button-label").textContent = "Find expression value";
        document.getElementById("answer-heading").textContent = "Expression result";
        document.getElementById("action-hint").textContent =
            "Enter the equations and the expression to evaluate.";
    } else if (mode === "simplify") {
        document.getElementById("mode-help").textContent =
            "Enter one expression and choose whether to simplify, expand, factor, or collect terms.";
        document.getElementById("solve-button-label").textContent = "Simplify expression";
        document.getElementById("answer-heading").textContent = "Simplified result";
        document.getElementById("action-hint").textContent =
            "Expressions only—use a solve goal if you have equations.";
    } else {
        document.getElementById("mode-help").textContent =
            "Choose a goal to see the right inputs.";
        document.getElementById("solve-button-label").textContent = "Calculate";
        document.getElementById("answer-heading").textContent = "Solutions";
        document.getElementById("action-hint").textContent =
            "Select a goal to get started.";
    }

    recommendationOutput.hidden = true;
    statusOutput.classList.remove("error");
    statusOutput.textContent = "Choose a goal, enter your math, then calculate.";
    solutionsOutput.replaceChildren();
}

goalMode.addEventListener("change", updateGoalMode);

const GRAPH_EXAMPLES = {
    circle: { label: "Circle", equations: ["x^2 + y^2 = 25"] },
    ellipse: { label: "Ellipse", equations: ["x^2/25 + y^2/9 = 1"] },
    parabola: { label: "Parabola", equations: ["y = x^2/4"] },
    hyperbola: { label: "Hyperbola", equations: ["x^2/16 - y^2/9 = 1"] },
    lines: { label: "Multiple lines", equations: ["y = x", "y = -x"] },
};

loadGraphExampleButton.addEventListener("click", () => {
    const example = GRAPH_EXAMPLES[graphExamplePicker.value];
    if (!example) {
        showError("Choose a graph example first.", "Select a circle, ellipse, parabola, hyperbola, or multiple lines.");
        return;
    }

    goalMode.value = "solve";
    updateGoalMode();
    equationEditor.value = example.equations.join("\n");
    equationEditor.dispatchEvent(new Event("input", { bubbles: true }));
    statusOutput.classList.remove("error");
    statusOutput.textContent = `Loaded the ${example.label.toLowerCase()} example.`;
    graphButton.click();
});

document.getElementById("clear-equations").addEventListener("click", () => {
    clearAllEditors();
    solutionsOutput.replaceChildren();
    statusOutput.classList.remove("error");
    recommendationOutput.hidden = true;
    statusOutput.textContent = goalMode.value
        ? "Inputs cleared."
        : "Choose a goal, enter your math, then calculate.";
});

function showSolutions(data) {
    statusOutput.classList.remove("error");
    statusOutput.textContent = data.status;
    solutionsOutput.replaceChildren();
    recommendationOutput.hidden = true;

    if (data.infinitely_many) {
        const note = document.createElement("p");
        note.className = "solution-status";
        note.textContent = data.variables.length
            ? `The equations are identities; ${data.variables.join(", ")} can take any value.`
            : "The equation is an identity and is true for every value.";
        solutionsOutput.append(note);
        return;
    }

    data.solutions.forEach((solution, index) => {
        const card = document.createElement("section");
        card.className = "solution-card";
        card.setAttribute("aria-label", `Solution ${index + 1}`);

        const title = document.createElement("p");
        title.className = "solution-title";
        title.textContent = data.solution_set
            ? "Complete solution set"
            : data.solutions.length > 1
                ? `Solution ${index + 1}`
                : "Exact solution";
        card.append(title);

        solution.assignments.forEach((assignment) => {
            const row = document.createElement("div");
            row.className = "assignment";

            const variable = document.createElement("span");
            variable.className = "assignment-variable";
            variable.textContent = `${assignment.variable} =`;

            const value = document.createElement("span");
            value.className = "assignment-value";
            value.textContent = assignment.value;
            row.append(variable, value);
            card.append(row);
        });

        solutionsOutput.append(card);
    });
}

function showExpressionResults(data, mode) {
    statusOutput.classList.remove("error");
    statusOutput.textContent = data.status;
    recommendationOutput.hidden = true;
    solutionsOutput.replaceChildren();

    if (mode === "simplify") {
        appendResultCard("Result", data.result);
        return;
    }

    data.values.forEach((value, index) => {
        const label = data.values.length > 1
            ? `Possible value ${index + 1}`
            : "Exact value";
        appendResultCard(label, value.value);

        if (value.free_variables.length) {
            const note = document.createElement("p");
            note.className = "result-note";
            note.textContent =
                `This result still depends on free variable(s): ${value.free_variables.join(", ")}.`;
            solutionsOutput.append(note);
        }
    });
}

function appendResultCard(label, result) {
    const card = document.createElement("section");
    card.className = "result-card";

    const title = document.createElement("p");
    title.className = "result-label";
    title.textContent = label;

    const value = document.createElement("p");
    value.className = "result-value";
    value.textContent = result;

    card.append(title, value);
    solutionsOutput.append(card);
}

function showError(error, recommendation) {
    statusOutput.classList.add("error");
    statusOutput.textContent = error;
    recommendationOutput.textContent = recommendation || "";
    recommendationOutput.hidden = !recommendation;
    solutionsOutput.replaceChildren();
}

const GRAPH_COLORS = ["#147aa3", "#d56a3a", "#49865b", "#8b64aa", "#c19122", "#ce5a79"];
const GRAPH_SVG_NS = "http://www.w3.org/2000/svg";

function createGraphSvgElement(name, attributes = {}) {
    const element = document.createElementNS(GRAPH_SVG_NS, name);
    Object.entries(attributes).forEach(([attribute, value]) => {
        element.setAttribute(attribute, String(value));
    });
    return element;
}

function formatGraphNumber(value) {
    if (!Number.isFinite(value)) {
        return "";
    }
    if ((Math.abs(value) >= 10000) || (value !== 0 && Math.abs(value) < 0.001)) {
        return value.toExponential(1);
    }
    return String(Number(value.toFixed(2)));
}

function graphQuantile(values, fraction) {
    const index = Math.min(
        values.length - 1,
        Math.max(0, Math.floor((values.length - 1) * fraction)),
    );
    return values[index];
}

function addGraphText(parent, text, x, y, className, anchor = "middle") {
    const element = createGraphSvgElement("text", {
        x,
        y,
        class: className,
        "text-anchor": anchor,
    });
    element.textContent = text;
    parent.append(element);
    return element;
}

function addGraphGrid(svg, plot, xRange, yRange, xLabel, yLabel) {
    const grid = createGraphSvgElement("g");
    const xPosition = (value) =>
        plot.left + ((value - xRange[0]) / (xRange[1] - xRange[0])) * plot.width;
    const yPosition = (value) =>
        plot.top + ((yRange[1] - value) / (yRange[1] - yRange[0])) * plot.height;

    for (let index = 0; index <= 4; index += 1) {
        const xValue = xRange[0] + ((xRange[1] - xRange[0]) * index) / 4;
        const yValue = yRange[0] + ((yRange[1] - yRange[0]) * index) / 4;
        const x = xPosition(xValue);
        const y = yPosition(yValue);

        grid.append(
            createGraphSvgElement("line", {
                x1: x,
                x2: x,
                y1: plot.top,
                y2: plot.top + plot.height,
                class: "graph-grid-line",
            }),
            createGraphSvgElement("line", {
                x1: plot.left,
                x2: plot.left + plot.width,
                y1: y,
                y2: y,
                class: "graph-grid-line",
            }),
        );
        addGraphText(grid, formatGraphNumber(xValue), x, plot.top + plot.height + 20, "graph-tick");
        addGraphText(grid, formatGraphNumber(yValue), plot.left - 10, y + 4, "graph-tick", "end");
    }

    if (xRange[0] <= 0 && xRange[1] >= 0) {
        grid.append(createGraphSvgElement("line", {
            x1: xPosition(0),
            x2: xPosition(0),
            y1: plot.top,
            y2: plot.top + plot.height,
            class: "graph-axis",
        }));
    }
    if (yRange[0] <= 0 && yRange[1] >= 0) {
        grid.append(createGraphSvgElement("line", {
            x1: plot.left,
            x2: plot.left + plot.width,
            y1: yPosition(0),
            y2: yPosition(0),
            class: "graph-axis",
        }));
    }

    addGraphText(
        grid,
        xLabel,
        plot.left + plot.width / 2,
        plot.top + plot.height + 46,
        "graph-axis-label",
    );
    addGraphText(
        grid,
        yLabel,
        19,
        plot.top + plot.height / 2,
        "graph-axis-label",
    ).setAttribute("transform", `rotate(-90 19 ${plot.top + plot.height / 2})`);
    svg.append(grid);
}

function buildFunctionPath(xValues, values, xPosition, yPosition, yRange) {
    let path = "";
    let drawing = false;

    values.forEach((value, index) => {
        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < yRange[0] ||
            value > yRange[1]
        ) {
            drawing = false;
            return;
        }

        const command = drawing ? "L" : "M";
        path += `${command}${xPosition(xValues[index]).toFixed(2)},${yPosition(value).toFixed(2)} `;
        drawing = true;
    });
    return path.trim();
}

function interpolateGraphEdge(first, second) {
    if (first.value === second.value) {
        return null;
    }
    const amount = Math.max(0, Math.min(1, -first.value / (second.value - first.value)));
    return {
        x: first.x + amount * (second.x - first.x),
        y: first.y + amount * (second.y - first.y),
    };
}

function buildImplicitPath(xValues, yValues, grid, xPosition, yPosition) {
    const segments = [];
    for (let row = 0; row < yValues.length - 1; row += 1) {
        for (let column = 0; column < xValues.length - 1; column += 1) {
            const corners = [
                { x: xValues[column], y: yValues[row], value: grid[row][column] },
                { x: xValues[column + 1], y: yValues[row], value: grid[row][column + 1] },
                { x: xValues[column + 1], y: yValues[row + 1], value: grid[row + 1][column + 1] },
                { x: xValues[column], y: yValues[row + 1], value: grid[row + 1][column] },
            ];
            if (corners.some((corner) => typeof corner.value !== "number" || !Number.isFinite(corner.value))) {
                continue;
            }
            if (corners.some((corner) => Math.abs(corner.value) > 1e12)) {
                continue;
            }

            const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
            const crossings = [];
            edges.forEach(([firstIndex, secondIndex], edgeIndex) => {
                const first = corners[firstIndex];
                const second = corners[secondIndex];
                if ((first.value < 0) !== (second.value < 0)) {
                    crossings[edgeIndex] = interpolateGraphEdge(first, second);
                }
            });
            const activeEdges = crossings
                .map((point, edgeIndex) => point ? edgeIndex : -1)
                .filter((edgeIndex) => edgeIndex >= 0);

            if (activeEdges.length === 2) {
                segments.push([crossings[activeEdges[0]], crossings[activeEdges[1]]]);
            } else if (activeEdges.length === 4) {
                const centerValue = corners.reduce((sum, corner) => sum + corner.value, 0) / 4;
                const pairs = (centerValue < 0) === (corners[0].value < 0)
                    ? [[0, 1], [2, 3]]
                    : [[0, 3], [1, 2]];
                pairs.forEach(([first, second]) => segments.push([crossings[first], crossings[second]]));
            }
        }
    }

    return segments.map(([first, second]) =>
        `M${xPosition(first.x).toFixed(2)},${yPosition(first.y).toFixed(2)} L${xPosition(second.x).toFixed(2)},${yPosition(second.y).toFixed(2)}`,
    ).join(" ");
}

function renderAlgebraGraph(data) {
    if (!Array.isArray(data.traces) || !Array.isArray(data.x_values) || !data.traces.length) {
        throw new Error("The graph response did not contain any plottable data.");
    }

    graphSvg.replaceChildren();
    graphLegend.replaceChildren();

    const title = createGraphSvgElement("title");
    title.textContent = "Graph of the entered algebra";
    graphSvg.append(title);

    const plot = { left: 76, top: 24, width: 690, height: 420 };
    const xRange = [data.x_values[0], data.x_values[data.x_values.length - 1]];
    const implicit = data.plot_type === "implicit";
    let yRange;

    if (implicit) {
        yRange = [data.y_values[0], data.y_values[data.y_values.length - 1]];
    } else {
        const finiteValues = data.traces
            .flatMap((trace) => trace.values || [])
            .filter((value) => typeof value === "number" && Number.isFinite(value))
            .sort((left, right) => left - right);
        if (!finiteValues.length) {
            throw new Error("No real-valued points were found in the displayed range.");
        }

        yRange = [
            Math.min(0, graphQuantile(finiteValues, 0.03)),
            Math.max(0, graphQuantile(finiteValues, 0.97)),
        ];
        if (yRange[0] === yRange[1]) {
            yRange = [yRange[0] - 1, yRange[1] + 1];
        } else {
            const padding = (yRange[1] - yRange[0]) * 0.08;
            yRange = [yRange[0] - padding, yRange[1] + padding];
        }
    }

    const xPosition = (value) =>
        plot.left + ((value - xRange[0]) / (xRange[1] - xRange[0])) * plot.width;
    const yPosition = (value) =>
        plot.top + ((yRange[1] - value) / (yRange[1] - yRange[0])) * plot.height;

    if (implicit && data.traces.some((trace) => trace.identity)) {
        graphSvg.append(createGraphSvgElement("rect", {
            x: plot.left,
            y: plot.top,
            width: plot.width,
            height: plot.height,
            class: "graph-identity",
        }));
    }

    addGraphGrid(
        graphSvg,
        plot,
        xRange,
        yRange,
        data.variables[0],
        implicit ? data.variables[1] : (data.value_type === "expression" ? "y" : "Residual"),
    );

    const clipId = "algebra-graph-plot-clip";
    const definitions = createGraphSvgElement("defs");
    const clipPath = createGraphSvgElement("clipPath", { id: clipId });
    clipPath.append(createGraphSvgElement("rect", {
        x: plot.left,
        y: plot.top,
        width: plot.width,
        height: plot.height,
    }));
    definitions.append(clipPath);
    graphSvg.prepend(definitions);

    let hasContour = false;
    data.traces.forEach((trace, index) => {
        const color = GRAPH_COLORS[index % GRAPH_COLORS.length];
        let path = "";
        if (implicit) {
            if (!trace.identity) {
                path = buildImplicitPath(
                    data.x_values,
                    data.y_values,
                    trace.grid,
                    xPosition,
                    yPosition,
                );
            }
            hasContour = hasContour || Boolean(path);
        } else if (!trace.identity) {
            path = buildFunctionPath(
                data.x_values,
                trace.values,
                xPosition,
                yPosition,
                yRange,
            );
        }

        if (path) {
            graphSvg.append(createGraphSvgElement("path", {
                d: path,
                fill: "none",
                stroke: color,
                "stroke-width": 3,
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "clip-path": `url(#${clipId})`,
            }));
        }

        if (trace.identity && !implicit && yRange[0] <= 0 && yRange[1] >= 0) {
            graphSvg.append(createGraphSvgElement("line", {
                x1: plot.left,
                x2: plot.left + plot.width,
                y1: yPosition(0),
                y2: yPosition(0),
                stroke: color,
                "stroke-width": 4,
                "clip-path": `url(#${clipId})`,
            }));
        }

        const legendItem = document.createElement("span");
        legendItem.className = "graph-legend-item";
        const swatch = document.createElement("span");
        swatch.className = "graph-legend-swatch";
        swatch.style.backgroundColor = color;
        const label = document.createElement("span");
        label.textContent = trace.label;
        legendItem.append(swatch, label);
        graphLegend.append(legendItem);
    });

    const descriptions = [];
    if (implicit) {
        descriptions.push(
            "Each curve is an equation equal to zero; shared points are system solutions.",
        );
        if (data.slice.length) {
            descriptions.push(
                `For this 2D view, ${data.slice.map((item) => `${item.variable} = ${item.value}`).join(", ")}.`,
            );
        }
        if (!hasContour && !data.traces.some((trace) => trace.identity)) {
            graphStatus.textContent = "No real curve was found in the displayed range.";
        } else if (data.traces.some((trace) => trace.identity)) {
            graphStatus.textContent = "An identity is true throughout the displayed region; its graph is shaded.";
        } else {
            graphStatus.textContent = "The displayed curves include all real points in the current window.";
        }
    } else if (data.value_type === "expression") {
        descriptions.push("The graph shows y as the value of your expression.");
        graphStatus.textContent = data.traces.some((trace) => trace.identity)
            ? "This expression is zero for every displayed input."
            : "Real-valued points are drawn over x = -10 to 10.";
    } else {
        descriptions.push(
            "Each curve shows an equation's residual; system solutions occur where every curve meets the horizontal axis at the same x.",
        );
        graphStatus.textContent = data.traces.some((trace) => trace.identity)
            ? "An identity is true for every displayed input."
            : "Multiple roots appear where the curves meet the horizontal axis.";
    }
    graphDescription.textContent = descriptions.join(" ");
}

async function createAlgebraGraphPng() {
    const legendItems = Array.from(graphLegend.children).map((item) => ({
        color: item.querySelector(".graph-legend-swatch").style.backgroundColor,
        label: item.querySelector("span:last-child").textContent,
    }));
    const exportHeight = 550 + legendItems.length * 24;
    const exportSvg = graphSvg.cloneNode(true);
    exportSvg.setAttribute("viewBox", `0 0 800 ${exportHeight}`);
    exportSvg.setAttribute("width", "1600");
    exportSvg.setAttribute("height", String(exportHeight * 2));
    exportSvg.setAttribute("xmlns", GRAPH_SVG_NS);

    const background = createGraphSvgElement("rect", {
        x: 0,
        y: 0,
        width: 800,
        height: exportHeight,
        fill: "#ffffff",
    });
    const style = createGraphSvgElement("style");
    style.textContent = `
        .graph-grid-line { stroke: #e7eef2; stroke-width: 1; }
        .graph-axis { stroke: #718895; stroke-width: 1.5; }
        .graph-tick { fill: #6c8491; font: 11px "Segoe UI", Arial, sans-serif; }
        .graph-axis-label { fill: #355a6e; font: 700 13px "Segoe UI", Arial, sans-serif; }
        .graph-identity { fill: rgba(18, 110, 157, 0.11); }
    `;
    exportSvg.prepend(background, style);

    const title = createGraphSvgElement("text", {
        x: 400,
        y: 16,
        fill: "#173448",
        "font-family": "Segoe UI, Arial, sans-serif",
        "font-size": 14,
        "font-weight": 700,
        "text-anchor": "middle",
    });
    title.textContent = "Math Solver++ Algebra Graph";
    exportSvg.append(title);

    legendItems.forEach((item, index) => {
        const y = 540 + index * 24;
        exportSvg.append(
            createGraphSvgElement("line", {
                x1: 78,
                x2: 96,
                y1: y,
                y2: y,
                stroke: item.color,
                "stroke-width": 3,
                "stroke-linecap": "round",
            }),
        );
        const label = createGraphSvgElement("text", {
            x: 104,
            y: y + 4,
            fill: "#526e7c",
            "font-family": "Segoe UI, Arial, sans-serif",
            "font-size": 11,
        });
        label.textContent = item.label.length > 100
            ? `${item.label.slice(0, 97)}...`
            : item.label;
        exportSvg.append(label);
    });

    const svgBlob = new Blob(
        [new XMLSerializer().serializeToString(exportSvg)],
        { type: "image/svg+xml;charset=utf-8" },
    );
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
        return await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 1600;
                canvas.height = exportHeight * 2;
                const context = canvas.getContext("2d");
                if (!context) {
                    reject(new Error("This browser cannot create a PNG canvas."));
                    return;
                }

                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Could not encode the graph as a PNG."));
                        return;
                    }
                    resolve(blob);
                }, "image/png");
            };
            image.onerror = () => reject(new Error("Could not render the graph for PNG export."));
            image.src = svgUrl;
        });
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

graphDownloadButton.addEventListener("click", async () => {
    const previousStatus = graphStatus.textContent;
    graphDownloadButton.disabled = true;
    graphStatus.classList.remove("error");
    graphStatus.textContent = "Preparing PNG...";

    try {
        const pngBlob = await createAlgebraGraphPng();
        const downloadUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "math-solver-algebra-graph.png";
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        graphStatus.textContent = `PNG download started. ${previousStatus}`;
    } catch (error) {
        graphStatus.classList.add("error");
        graphStatus.textContent = error.message || "Could not save this graph as PNG.";
    } finally {
        graphDownloadButton.disabled = false;
    }
});

graphButton.addEventListener("click", async () => {
    const mode = goalMode.value;
    const payload = { mode };
    if (mode === "solve" || mode === "evaluate") {
        payload.equations = equationEditor.value
            .split(/\r?\n/)
            .map((equation) => equation.trim());
    } else if (mode === "simplify") {
        payload.expression = simplifyEditor.value;
    }

    graphPanel.hidden = false;
    graphButton.setAttribute("aria-expanded", "true");
    graphButton.disabled = true;
    graphDownloadButton.disabled = true;
    graphStatus.classList.remove("error");
    graphStatus.textContent = "Building graph…";
    graphSvg.replaceChildren();
    graphLegend.replaceChildren();

    try {
        const response = await fetch("/algebra/graph", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(
                [result.error, result.recommendation].filter(Boolean).join(" "),
            );
        }
        renderAlgebraGraph(result);
        graphDownloadButton.disabled = false;
    } catch (error) {
        graphStatus.classList.add("error");
        graphStatus.textContent = error.message || "Could not graph this algebra input.";
    } finally {
        graphButton.disabled = false;
        graphPanel.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "nearest",
        });
    }
});

document.getElementById("close-algebra-graph").addEventListener("click", () => {
    graphPanel.hidden = true;
    graphButton.setAttribute("aria-expanded", "false");
    graphButton.focus();
});

solveButton.addEventListener("click", async () => {
    const mode = goalMode.value;
    if (!mode) {
        showError(
            "Please select what you want to find.",
            "Choose Solve all variables, Find the value of an expression, or Simplify or transform an expression.",
        );
        return;
    }

    solveButton.disabled = true;
    statusOutput.classList.remove("error");
    recommendationOutput.hidden = true;
    statusOutput.textContent =
        mode === "simplify" ? "Simplifying…" : "Solving…";
    solutionsOutput.replaceChildren();

    try {
        const payload = { mode };
        if (mode === "solve" || mode === "evaluate") {
            payload.equations = equationEditor.value
                .split(/\r?\n/)
                .map((equation) => equation.trim());
        }
        if (mode === "evaluate") {
            payload.expression = targetEditor.value;
        } else if (mode === "simplify") {
            payload.expression = simplifyEditor.value;
            payload.operation = document.getElementById("simplify-operation").value;
        }

        const response = await fetch("/algebra/solve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok) {
            showError(
                result.error || "Could not complete this algebra request.",
                result.recommendation,
            );
            return;
        }

        if (mode === "solve") {
            showSolutions(result);
        } else {
            showExpressionResults(result, mode);
        }
    } catch (error) {
        showError(error.message, "Check your inputs and try again.");
    } finally {
        solveButton.disabled = false;
    }
});

makeLetterKeys();
setKeypadTab("numbers");
updateGoalMode();

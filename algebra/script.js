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

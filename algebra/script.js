const equationEditor = document.getElementById("equations");
const numberKeypad = document.getElementById("number-keypad");
const letterKeypad = document.getElementById("letter-keypad");
const numbersTab = document.getElementById("numbers-tab");
const lettersTab = document.getElementById("letters-tab");
const statusOutput = document.getElementById("answer-status");
const solutionsOutput = document.getElementById("solutions");
const solveButton = document.getElementById("solve-equations");

if (
    !equationEditor ||
    !numberKeypad ||
    !letterKeypad ||
    !numbersTab ||
    !lettersTab ||
    !statusOutput ||
    !solutionsOutput ||
    !solveButton
) {
    throw new Error("Algebra solver: required page elements are missing.");
}

equationEditor.setAttribute("inputmode", "none");
equationEditor.setAttribute("virtualkeyboardpolicy", "manual");
equationEditor.setSelectionRange(
    equationEditor.value.length,
    equationEditor.value.length,
);

equationEditor.addEventListener("focus", () => {
    if (navigator.virtualKeyboard) {
        navigator.virtualKeyboard.hide();
    }
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
    insertText(`${separator}`, currentValue.length, currentValue.length);
}

function insertText(text, start, end = start) {
    const selectionStart = start ?? equationEditor.selectionStart;
    const selectionEnd = end ?? equationEditor.selectionEnd;
    equationEditor.setRangeText(text, selectionStart, selectionEnd, "end");
    equationEditor.focus({ preventScroll: true });

    if (navigator.virtualKeyboard) {
        navigator.virtualKeyboard.hide();
    }

    equationEditor.dispatchEvent(new Event("input", { bubbles: true }));
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

    const start = equationEditor.selectionStart;
    const end = equationEditor.selectionEnd;
    insertText(text, start, end);
    const cursor = start + cursorOffset;
    equationEditor.setSelectionRange(cursor, cursor);
}

function deleteSelectionOrPreviousCharacter() {
    let start = equationEditor.selectionStart;
    let end = equationEditor.selectionEnd;

    if (start === end && start > 0) {
        start -= 1;
    }

    insertText("", start, end);
}

function clearEditor() {
    equationEditor.value = "";
    equationEditor.focus({ preventScroll: true });
    equationEditor.dispatchEvent(new Event("input", { bubbles: true }));
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

document.getElementById("clear-equations").addEventListener("click", () => {
    clearEditor();
    solutionsOutput.replaceChildren();
    statusOutput.classList.remove("error");
    statusOutput.textContent = "Enter equations and choose Solve.";
});

function showSolutions(data) {
    statusOutput.classList.remove("error");
    statusOutput.textContent = data.status;
    solutionsOutput.replaceChildren();

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

solveButton.addEventListener("click", async () => {
    const equations = equationEditor.value
        .split(/\r?\n/)
        .map((equation) => equation.trim());

    solveButton.disabled = true;
    statusOutput.classList.remove("error");
    statusOutput.textContent = "Solving…";
    solutionsOutput.replaceChildren();

    try {
        const response = await fetch("/algebra/solve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ equations }),
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not solve these equations.");
        }

        showSolutions(result);
    } catch (error) {
        statusOutput.classList.add("error");
        statusOutput.textContent = error.message;
    } finally {
        solveButton.disabled = false;
    }
});

makeLetterKeys();
setKeypadTab("numbers");

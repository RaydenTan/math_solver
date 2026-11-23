
// ==========================================
// MATH SOLVER v2.1 — CALCULATOR SCRIPT
// ==========================================


// ==========================================
// DOM ELEMENTS
// ==========================================

const editor = document.getElementById("expression-editor");
const answerOutput = document.getElementById("answer");
const messageOutput = document.getElementById("message");

const formatToggle = document.getElementById("format-toggle");
const formatMenu = document.getElementById("format-menu");
const formatLabel = document.getElementById("format-label");
const formatControl = document.querySelector(".format-control");

const shiftToggle = document.getElementById("shift-toggle");
const degToggle = document.getElementById("deg-toggle");
const radToggle = document.getElementById("rad-toggle");
const expressionClear = document.getElementById("expression-clear");


// Check that essential HTML elements exist.
if (
    !editor ||
    !answerOutput ||
    !messageOutput ||
    !formatToggle ||
    !formatMenu ||
    !formatLabel ||
    !shiftToggle ||
    !degToggle ||
    !radToggle ||
    !expressionClear
) {
    throw new Error(
        "Math Solver: One or more required HTML elements are missing."
    );
}


// ==========================================
// CALCULATOR STATE
// ==========================================

let answerFormat = "fraction";
let angleMode = "DEG";
let shiftMode = false;
let keyboardShiftMode = false;

let lastAnswer = "";
let previousAnswer = "";
let memoryValue = "";

let activeCategory = null;

// Prevent outdated calculations from replacing newer results.
let calculationRequest = 0;

const formatNames = {
    fraction: "Fraction",
    mixed: "Mixed fraction",
    decimal: "Decimal",
    remainder: "Remainder"
};

const formatOrder = [
    "mixed",
    "fraction",
    "decimal",
    "remainder"
];


// ==========================================
// EDITOR SETUP
// ==========================================

editor.contentEditable = "true";
editor.spellcheck = false;
editor.setAttribute("inputmode", "none");
editor.setAttribute("virtualkeyboardpolicy", "manual");

editor.addEventListener("focusin", () => {
    if (navigator.virtualKeyboard) {
        navigator.virtualKeyboard.hide();
    }
});

function showPlaceholder() {
    if (
        !editor.textContent.trim() &&
        !editor.querySelector(".math-structure")
    ) {
        editor.innerHTML = "";

        const placeholder = document.createElement("span");

        placeholder.className = "editor-placeholder";
        placeholder.textContent =
            "Enter a mathematical expression...";
        placeholder.contentEditable = "false";

        editor.appendChild(placeholder);
    }
}


function removePlaceholder() {
    editor.querySelector(".editor-placeholder")?.remove();
}


function serialiseChildren(parent) {
    return Array.from(parent.childNodes)
        .map(serialiseNode)
        .join("");
}


function getExpression() {
    return serialiseChildren(editor).trim();
}


function isEditorEmpty() {
    return getExpression() === "";
}


// ==========================================
// MATHEMATICAL SLOT CREATION
// ==========================================

function createSlot(name, placeholder = name) {
    const slot = document.createElement("span");

    slot.className = "math-slot";
    slot.contentEditable = "true";
    slot.setAttribute("aria-label", `${placeholder} slot`);
    slot.setAttribute("inputmode", "none");
    slot.setAttribute("virtualkeyboardpolicy", "manual");

    slot.dataset.slot = name;
    slot.dataset.placeholder = placeholder;

    return slot;
}


function createSymbol(value, className = "") {
    const symbol = document.createElement("span");

    symbol.className = className;
    symbol.textContent = value;
    symbol.contentEditable = "false";

    return symbol;
}


// ==========================================
// FRACTION CREATION
// ==========================================

function makeFraction(numerator, denominator) {
    const fraction = document.createElement("span");

    fraction.className = "math-fraction";

    const top = document.createElement("span");
    top.className = "fraction-numerator";
    top.append(numerator);

    const line = createSymbol("", "fraction-line");

    const bottom = document.createElement("span");
    bottom.className = "fraction-denominator";
    bottom.append(denominator);

    fraction.append(top, line, bottom);

    return fraction;
}


// ==========================================
// MATHEMATICAL TEMPLATE CREATION
// ==========================================

function createStructure(type) {
    const structure = document.createElement("span");

    structure.className = `math-structure math-${type}`;
    structure.dataset.template = type;
    structure.contentEditable = "false";

    let firstSlot = null;


    // Square root and cube root
    if (
        type === "square-root" ||
        type === "cube-root"
    ) {
        const number = createSlot("number");

        structure.append(
            createSymbol(
                type === "square-root" ? "√" : "∛",
                "root-symbol"
            ),
            number
        );

        firstSlot = number;
    }


    // Nth root
    else if (type === "nth-root") {
        const index = createSlot("index");
        index.classList.add("root-index");

        const number = createSlot("number");

        structure.append(
            index,
            createSymbol("√", "root-symbol"),
            number
        );

        firstSlot = index;
    }


    // Square and cube
    else if (
        type === "square" ||
        type === "cube"
    ) {
        const base = createSlot("base");

        structure.append(
            base,
            createSymbol(
                type === "square" ? "2" : "3",
                "power-exponent"
            )
        );

        firstSlot = base;
    }


    // General power
    else if (type === "power") {
        const base = createSlot("base");
        const exponent = createSlot("exponent");

        exponent.classList.add("power-exponent");

        const wrapper = document.createElement("sup");
        wrapper.append(exponent);

        structure.append(base, wrapper);

        firstSlot = base;
    }


    // Fraction
    else if (type === "fraction") {
        const numerator = createSlot("numerator");
        const denominator = createSlot("denominator");

        structure.append(
            makeFraction(numerator, denominator)
        );

        firstSlot = numerator;
    }


    // Mixed fraction
    else if (type === "mixed-fraction") {
        const whole = createSlot("whole");
        const numerator = createSlot("numerator");
        const denominator = createSlot("denominator");

        structure.append(
            whole,
            makeFraction(numerator, denominator)
        );

        firstSlot = whole;
    }


    // Logarithm with base
    else if (type === "log-base") {
        const base = createSlot("base");
        const number = createSlot("number");

        const baseWrapper = document.createElement("sub");
        baseWrapper.className = "log-base-wrap";
        baseWrapper.append(base);

        structure.append(
            createSymbol("log", "log-label"),
            baseWrapper,
            createSymbol("(", "log-bracket"),
            number,
            createSymbol(")", "log-bracket")
        );

        firstSlot = base;
    }


    // Normal logarithm
    else if (type === "log") {
        const number = createSlot("number");

        structure.append(
            createSymbol("log(", "log-label"),
            number,
            createSymbol(")", "log-bracket")
        );

        firstSlot = number;
    }

    // Floor and ceiling
    else if (type === "floor" || type === "ceil") {
        const value = createSlot("value", "x");
        const isFloor = type === "floor";

        structure.append(
            createSymbol(isFloor ? "⌊" : "⌈", "bracket-symbol"),
            value,
            createSymbol(isFloor ? "⌋" : "⌉", "bracket-symbol")
        );

        firstSlot = value;
    }


    // Permutation and combination
    else if (
        type === "permutation" ||
        type === "combination"
    ) {
        const n = createSlot("n", "n");
        const r = createSlot("r", "r");

        structure.append(
            n,
            createSymbol(
                type === "permutation" ? "P" : "C",
                "combinatoric-label"
            ),
            r
        );

        firstSlot = n;
    }


    else {
        console.warn(
            `Unknown mathematical template: ${type}`
        );

        return null;
    }


    return {
        structure,
        firstSlot
    };
}


// ==========================================
// CURSOR AND INSERTION
// ==========================================

function getInsertionRange() {
    const selection = window.getSelection();

    if (
        selection &&
        selection.rangeCount > 0
    ) {
        const range = selection.getRangeAt(0);

        const anchorInsideEditor =
            editor.contains(range.startContainer);

        const focusInsideEditor =
            editor.contains(range.endContainer);

        if (
            anchorInsideEditor &&
            focusInsideEditor
        ) {
            return range.cloneRange();
        }
    }


    // If there is no valid selection,
    // insert at the end of the editor.
    const range = document.createRange();

    range.selectNodeContents(editor);
    range.collapse(false);

    return range;
}


function setCursor(range) {
    const selection = window.getSelection();

    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(range);
}


function focusSlot(slot) {
    if (!slot) return;

    removePlaceholder();

    slot.focus();

    const range = document.createRange();

    range.selectNodeContents(slot);
    range.collapse(false);

    setCursor(range);
}

function focusSlotAtBoundary(slot, atStart) {
    if (!slot) return;

    removePlaceholder();
    slot.focus();

    const range = document.createRange();
    range.selectNodeContents(slot);
    range.collapse(atStart);
    setCursor(range);
}


function insertText(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return;
    }

    removePlaceholder();

    const range = getInsertionRange();

    range.deleteContents();

    const textNode = document.createTextNode(
        String(value)
    );

    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);

    setCursor(range);

    editor.focus();

    messageOutput.textContent = "";
}


function insertStructure(type) {
    removePlaceholder();

    const result = createStructure(type);

    if (!result) return;

    const range = getInsertionRange();

    range.deleteContents();
    range.insertNode(result.structure);

    focusSlot(result.firstSlot);

    messageOutput.textContent = "";
}

function isCaretAtSlotBoundary(slot, boundary) {
    const selection = window.getSelection();

    if (
        !selection ||
        !selection.isCollapsed ||
        !slot.contains(selection.anchorNode)
    ) {
        return false;
    }

    const range = document.createRange();
    range.selectNodeContents(slot);

    if (boundary === "start") {
        range.setEnd(selection.anchorNode, selection.anchorOffset);
    } else {
        range.setStart(selection.anchorNode, selection.anchorOffset);
    }

    return range.toString() === "";
}

function moveCaretOutsideStructure(structure, after) {
    editor.focus();

    const range = document.createRange();
    if (after) {
        range.setStartAfter(structure);
    } else {
        range.setStartBefore(structure);
    }
    range.collapse(true);
    setCursor(range);
}

function handleSlotArrow(event, slot) {
    const structure = slot.closest(".math-structure");
    if (!structure) return false;

    const slots = Array.from(structure.querySelectorAll(".math-slot"));
    const index = slots.indexOf(slot);
    if (index < 0) return false;

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const currentRect = slot.getBoundingClientRect();
        const currentCenterY = currentRect.top + currentRect.height / 2;
        const currentCenterX = currentRect.left + currentRect.width / 2;
        const direction = event.key === "ArrowUp" ? -1 : 1;
        const target = slots
            .filter(candidate => candidate !== slot)
            .map(candidate => {
                const rect = candidate.getBoundingClientRect();
                const deltaY = rect.top + rect.height / 2 - currentCenterY;

                return {
                    candidate,
                    deltaY,
                    deltaX: rect.left + rect.width / 2 - currentCenterX
                };
            })
            .filter(candidate => candidate.deltaY * direction > 1)
            .sort((left, right) => (
                Math.abs(left.deltaY) + Math.abs(left.deltaX) * 0.25
            ) - (
                Math.abs(right.deltaY) + Math.abs(right.deltaX) * 0.25
            ));

        if (target.length > 0) {
            event.preventDefault();
            focusSlotAtBoundary(target[0].candidate, false);
            return true;
        }

        return false;
    }

    if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight"
    ) {
        return false;
    }

    const movingRight = event.key === "ArrowRight";
    const boundary = movingRight ? "end" : "start";

    if (!isCaretAtSlotBoundary(slot, boundary)) {
        return false;
    }

    event.preventDefault();
    moveCaretOutsideStructure(structure, movingRight);
    return true;
}


// ==========================================
// CONVERT VISUAL TEMPLATES TO BACKEND INPUT
// ==========================================

function serialiseNode(node) {

    // Normal text
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
    }


    // Ignore unsupported node types
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
    }


    // Ignore editor placeholder
    if (node.classList.contains("editor-placeholder")) {
        return "";
    }


    // Mathematical slots
    if (node.classList.contains("math-slot")) {
        return serialiseChildren(node);
    }


    // Mathematical structures
    if (node.classList.contains("math-structure")) {
        const type = node.dataset.template;

        const slots = Array.from(
            node.querySelectorAll(".math-slot")
        );

        const values = slots.map(slot =>
            serialiseChildren(slot).trim()
        );


        if (type === "square-root") {
            return `sqrt(${values[0] || ""})`;
        }

        if (type === "cube-root") {
            return `cbrt(${values[0] || ""})`;
        }

        if (type === "nth-root") {
            return `root(${values[1] || ""},${values[0] || ""})`;
        }

        if (type === "square") {
            return `(${values[0] || ""})**2`;
        }

        if (type === "cube") {
            return `(${values[0] || ""})**3`;
        }

        if (type === "power") {
            return `(${values[0] || ""})**(${values[1] || ""})`;
        }

        if (type === "fraction") {
            return `((${values[0] || ""})/(${values[1] || ""}))`;
        }

        if (type === "mixed-fraction") {
            return `((${values[0] || ""})+(${values[1] || ""})/(${values[2] || ""}))`;
        }

        if (type === "log") {
            return `log(${values[0] || ""})`;
        }

        if (type === "floor" || type === "ceil") {
            return `${type}(${values[0] || ""})`;
        }

        if (type === "log-base") {
            return `log(${values[1] || ""},${values[0] || ""})`;
        }

        if (type === "permutation") {
            return `npr(${values[0] || ""},${values[1] || ""})`;
        }

        if (type === "combination") {
            return `ncr(${values[0] || ""},${values[1] || ""})`;
        }

        return "";
    }


    // Ignore line breaks
    if (node.tagName === "BR") {
        return "";
    }


    return serialiseChildren(node);
}


// ==========================================
// SLOT VALIDATION
// ==========================================

function getSlots() {
    return Array.from(
        editor.querySelectorAll(".math-slot")
    );
}


function isSlotEmpty(slot) {
    return serialiseChildren(slot).trim() === "";
}


function validateSlots() {
    return getSlots().every(
        slot => !isSlotEmpty(slot)
    );
}


function moveToNextEmptySlot(currentSlot) {
    const slots = getSlots();

    const index = slots.indexOf(currentSlot);

    const next = slots
        .slice(index + 1)
        .find(isSlotEmpty);

    if (next) {
        focusSlot(next);
        return;
    }

    const firstEmpty = slots.find(isSlotEmpty);

    if (firstEmpty) {
        focusSlot(firstEmpty);
    }
}


// ==========================================
// CLEAR AND DELETE
// ==========================================

function clearCalculator() {
    // Invalidate any calculation still running.
    calculationRequest++;

    editor.innerHTML = "";

    answerOutput.textContent = "0";
    messageOutput.textContent = "";

    showPlaceholder();

    editor.focus();
}


function deleteLast() {
    const selection = window.getSelection();

    if (
        !selection ||
        selection.rangeCount === 0
    ) {
        return;
    }

    const range = selection.getRangeAt(0);

    if (
        !editor.contains(range.startContainer) ||
        !editor.contains(range.endContainer)
    ) {
        return;
    }


    // Delete selected content.
    if (!range.collapsed) {
        range.deleteContents();
    }

    // Delete the previous character.
    else {
        // Use browser editing behaviour for contenteditable.
        const success = document.execCommand("delete");

        if (!success) {
            return;
        }
    }


    editor.focus();

    if (isEditorEmpty()) {
        showPlaceholder();
    }

    messageOutput.textContent = "";
}


// ==========================================
// CALCULATION
// ==========================================

function renderAnswer(data) {
    if (!data.answer_mathml) {
        answerOutput.textContent = String(data.answer);
        return;
    }

    const markup = [
        '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">',
        data.answer_mathml,
        "</math>"
    ].join("");
    const mathDocument = new DOMParser().parseFromString(
        markup,
        "text/html"
    );
    const mathRoot = mathDocument.body.firstElementChild;

    if (
        !mathRoot ||
        mathRoot.localName !== "math" ||
        mathRoot.namespaceURI !== "http://www.w3.org/1998/Math/MathML" ||
        mathRoot.querySelector("parsererror")
    ) {
        throw new Error("The server returned invalid mathematical notation.");
    }

    answerOutput.replaceChildren(
        document.importNode(mathRoot, true)
    );
}


async function calculate() {
    const expression = getExpression();

    if (!expression) {
        messageOutput.textContent =
            "Enter a calculation first.";

        return;
    }


    if (!validateSlots()) {
        messageOutput.textContent =
            "Fill in all mathematical slots first.";

        return;
    }


    const requestNumber = ++calculationRequest;

    messageOutput.textContent = "Calculating...";
    answerOutput.textContent = "…";


    try {
        const response = await fetch("/calculate", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                expression: expression,
                format: answerFormat,
                angle: angleMode
            })
        });


        // Read response safely.
        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "The server returned an invalid response."
            );
        }


        // Ignore outdated responses.
        if (requestNumber !== calculationRequest) {
            return;
        }


        if (!response.ok) {
            throw new Error(
                data.error || "Something went wrong."
            );
        }


        if (data.answer === undefined) {
            throw new Error(
                "The server did not return an answer."
            );
        }


        previousAnswer = lastAnswer;
        lastAnswer = String(
            data.answer_input !== undefined
                ? data.answer_input
                : data.answer
        );

        renderAnswer(data);

        messageOutput.textContent = "";


    } catch (error) {

        if (requestNumber !== calculationRequest) {
            return;
        }

        answerOutput.textContent = "Error";

        messageOutput.textContent =
            error.message || "Unable to calculate.";
    }
}


// ==========================================
// ANSWER AND PREVIOUS ANSWER
// ==========================================

function insertAnswer() {
    if (!lastAnswer) {
        messageOutput.textContent =
            "There is no previous answer yet.";

        return;
    }

    insertText(`(${lastAnswer})`);
}


function insertPreviousAnswer() {
    if (!previousAnswer) {
        messageOutput.textContent =
            "There is no previous answer yet.";

        return;
    }

    insertText(`(${previousAnswer})`);
}


// ==========================================
// MEMORY FUNCTIONS
// ==========================================

function memoryStore() {
    if (!lastAnswer) {
        messageOutput.textContent =
            "Calculate an answer before storing it.";

        return;
    }

    memoryValue = lastAnswer;

    messageOutput.textContent =
        "Answer stored in memory.";
}


function memoryAdd() {
    if (!lastAnswer) {
        messageOutput.textContent =
            "Calculate an answer first.";

        return;
    }

    memoryValue = memoryValue
        ? `(${memoryValue})+(${lastAnswer})`
        : lastAnswer;

    messageOutput.textContent =
        "Added to memory.";
}


function memorySubtract() {
    if (!lastAnswer) {
        messageOutput.textContent =
            "Calculate an answer first.";

        return;
    }

    memoryValue = memoryValue
        ? `(${memoryValue})-(${lastAnswer})`
        : `-(${lastAnswer})`;

    messageOutput.textContent =
        "Subtracted from memory.";
}


function memoryRecall() {
    if (!memoryValue) {
        messageOutput.textContent =
            "Memory is empty.";

        return;
    }

    insertText(`(${memoryValue})`);
}


function memoryClear() {
    memoryValue = "";

    messageOutput.textContent =
        "Memory cleared.";
}


// ==========================================
// SHIFT CONTROL
// ==========================================

function updateShiftDisplay() {
    const active = shiftMode || keyboardShiftMode;

    shiftToggle.setAttribute(
        "aria-pressed",
        String(active)
    );

    shiftToggle.classList.toggle(
        "active",
        active
    );
}


shiftToggle.addEventListener("click", () => {
    shiftMode = !shiftMode;

    updateShiftDisplay();
});

document.addEventListener("keydown", event => {
    if (event.key === "Shift" && !keyboardShiftMode) {
        keyboardShiftMode = true;
        updateShiftDisplay();
    }
});

document.addEventListener("keyup", event => {
    if (event.key === "Shift" && keyboardShiftMode) {
        keyboardShiftMode = false;
        updateShiftDisplay();
    }
});

window.addEventListener("blur", () => {
    keyboardShiftMode = false;
    updateShiftDisplay();
});


// ==========================================
// DEG / RAD CONTROLS
// ==========================================

function setAngleMode(mode) {
    angleMode = mode;

    degToggle.classList.toggle(
        "active",
        mode === "DEG"
    );

    radToggle.classList.toggle(
        "active",
        mode === "RAD"
    );


    degToggle.setAttribute(
        "aria-pressed",
        String(mode === "DEG")
    );

    radToggle.setAttribute(
        "aria-pressed",
        String(mode === "RAD")
    );


    if (
        !isEditorEmpty() &&
        validateSlots()
    ) {
        calculate();
    }
}


degToggle.addEventListener("click", () => {
    setAngleMode("DEG");
});


radToggle.addEventListener("click", () => {
    setAngleMode("RAD");
});


// ==========================================
// CATEGORY BUTTONS
// ==========================================

const categoryButtons = document.querySelectorAll(
    ".category-key"
);

const categoryPanels = new Map(
    Array.from(document.querySelectorAll(".category-panel"))
        .map(panel => [panel.dataset.category, panel])
);

const defaultScientificKeys = Array.from(
    document.querySelectorAll(".scientific-keys > .key.function")
);

const categoryFunctions = {
    STAT: [
        ["n", "count(", "Σx", "sum("],
        ["x̄", "mean(", "Σx²", "sum_squares("],
        ["Med", "median(", "Ḡ", "geometric_mean("],
        ["Mode", "mode(", "H̄", "harmonic_mean("],
        ["R", "range(", "M.D.", "mean_deviation("],
        ["s", "stdev(", "MAD", "mad("],
        ["σ", "pstdev(", "RMS", "rms("],
        ["s²", "variance(", "CV", "coefficient_variation("],
        ["σ²", "pvariance(", "Skew", "skewness("],
        ["Q₁", "q1(", "Kurt", "kurtosis("],
        ["Q₃", "q3(", "Πx", "product("],
        ["IQR", "iqr(", "HCF", "hcf("],
        ["min", "min(", "LCM", "lcm("],
        ["max", "max(", "Rand", "rnd()"],
        ["n!", "factorial(", "|x|", "abs("],
        ["nPr", "npr(", "⌊x⌋", "floor("],
        ["nCr", "ncr(", "⌈x⌉", "ceil("],
        ["Σx³", "sum_cubes(", "ln", "ln("]
    ],
    CALCULUS: [
        ["d/dx", "diff(", "d²/dx²", "diff2("],
        ["d³/dx³", "diff3(", "f′(a)", "diff_at("],
        ["∫", "integrate(", "F(x)", "anti_diff("],
        ["∫ₐᵇ", "defint(", "∫₂", "integrate2("],
        ["lim", "limit(", "lim₋", "limit_left("],
        ["Solve", "solve(", "lim₊", "limit_right("],
        ["Factor", "factor(", "Factor T", "factor_terms("],
        ["Expand", "expand(", "Collect", "collect("],
        ["Simplify", "simplify(", "NSimp", "nsimplify("],
        ["Cancel", "cancel(", "Together", "together("],
        ["Apart", "apart(", "Rational", "radsimp("],
        ["Trig simp", "trigsimp(", "Power simp", "powsimp("],
        ["Series", "series(", "Taylor", "taylor("],
        ["Roots", "roots(", "Evalf", "evalf("],
        ["x²", "square(", "√x", "sqrt("],
        ["log", "log(", "log₂", "log2("],
        ["ln", "ln(", "log₁₀", "log10("],
        ["eˣ", "exp(", "∛x", "cbrt("]
    ],
    "TRI-HYP": [
        ["sin", "sin(", "sech", "sech("],
        ["cos", "cos(", "csch", "csch("],
        ["tan", "tan(", "coth", "coth("],
        ["sec", "sec(", "asech", "asech("],
        ["csc", "csc(", "acsch", "acsch("],
        ["cot", "cot(", "acoth", "acoth("],
        ["sin⁻¹", "asin(", "sinc", "sinc("],
        ["cos⁻¹", "acos(", "sinhc", "sinhc("],
        ["tan⁻¹", "atan(", "versin", "versin("],
        ["sec⁻¹", "asec(", "vercos", "vercosin("],
        ["csc⁻¹", "acsc(", "coversin", "coversin("],
        ["cot⁻¹", "acot(", "haversin", "haversin("],
        ["sinh", "sinh(", "havercos", "havercos("],
        ["cosh", "cosh(", "versinh", "versinh("],
        ["tanh", "tanh(", "vercosh", "vercosh("],
        ["sinh⁻¹", "asinh(", "sinc π", "sinc_pi("],
        ["cosh⁻¹", "acosh(", "sinc°", "sinc_deg("],
        ["tanh⁻¹", "atanh(", "sin°", "sin_deg("]
    ],
    CMPLX: [
        ["Re", "re(", "sin z", "complex_sin("],
        ["Im", "im(", "cos z", "complex_cos("],
        ["conj", "conj(", "tan z", "complex_tan("],
        ["arg", "arg(", "sec z", "complex_sec("],
        ["phase°", "phase_deg(", "csc z", "complex_csc("],
        ["cis", "cis(", "cot z", "complex_cot("],
        ["a+bi", "complex(", "sinh z", "complex_sinh("],
        ["polar", "polar(", "cosh z", "complex_cosh("],
        ["rect", "rect(", "tanh z", "complex_tanh("],
        ["|z|", "magnitude(", "sin⁻¹ z", "complex_asin("],
        ["sgn", "signum(", "cos⁻¹ z", "complex_acos("],
        ["√z", "sqrt(", "tan⁻¹ z", "complex_atan("],
        ["eᶻ", "exp(", "sinh⁻¹ z", "complex_asinh("],
        ["ln z", "ln(", "cosh⁻¹ z", "complex_acosh("],
        ["1/z", "reciprocal(", "tanh⁻¹ z", "complex_atanh("],
        ["↻z", "rotate(", "sec⁻¹ z", "complex_asec("],
        ["Split", "split(", "csc⁻¹ z", "complex_acsc("],
        ["|z|²", "modulus(", "cot⁻¹ z", "complex_acot("]
    ],
    "VEC-MAT": [
        ["vec", "vec(", "mat", "mat("],
        ["a·b", "dot(", "a×b", "cross("],
        ["‖v‖", "norm(", "v̂", "unit("],
        ["det", "det(", "tr", "trace("],
        ["T", "transpose(", "A⁻¹", "inverse("],
        ["rank", "rank(", "Iₙ", "identity("],
        ["0ₙ", "zeros(", "1ₙ", "ones("],
        ["dist", "distance(", "a∘b", "hadamard("],
        ["a+b", "vector_sum(", "A+B", "matrix_add("],
        ["A−B", "matrix_sub(", "A×B", "matrix_mul("],
        ["Aⁿ", "matrix_power(", "AᵀA", "gram("],
        ["row", "row(", "column", "column("],
        ["diag", "diagonal(", "adj", "adjugate("],
        ["minor", "minor(", "cofactor", "cofactor("],
        ["null", "nullspace(", "col", "columnspace("],
        ["angle", "angle(", "proj", "projection("],
        ["a−b", "vector_sub(", "eig", "eigenvalues("],
        ["scale", "vector_scale(", "Σv", "vector_sum_components("]
    ],
    "BASE-N": [
        ["→bin", "to_bin(", "bin→₁₀", "from_bin("],
        ["→oct", "to_oct(", "oct→₁₀", "from_oct("],
        ["→hex", "to_hex(", "hex→₁₀", "from_hex("],
        ["Base n", "to_base(", "n→₁₀", "from_base("],
        ["Base 3", "base3(", "from Base 3", "from_base3("],
        ["Base 5", "base5(", "from Base 5", "from_base5("],
        ["Base 7", "base7(", "from Base 7", "from_base7("],
        ["Base 12", "base12(", "from Base 12", "from_base12("],
        ["Base 36", "base36(", "from Base 36", "from_base36("],
        ["Popcount", "popcount(", "Parity", "parity("],
        ["AND", "bit_and(", "NAND", "bit_nand("],
        ["OR", "bit_or(", "NOR", "bit_nor("],
        ["XOR", "bit_xor(", "XNOR", "bit_xnor("],
        ["NOT", "bit_not(", "1's comp", "ones_complement("],
        ["≪", "left_shift(", "≫", "right_shift("],
        ["Bit length", "bit_length(", "Gray", "gray("],
        ["Set bit", "set_bit(", "Clear bit", "clear_bit("],
        ["Toggle bit", "toggle_bit(", "Rotate left", "rotate_left("]
    ]
};

function createCategoryKey([label, value, shiftedLabel, shiftedValue]) {
    const button = document.createElement("button");
    const main = document.createElement("span");
    const secondary = document.createElement("span");

    button.className = "key function";
    button.type = "button";
    button.dataset.insert = value;
    button.setAttribute(
        "aria-label",
        `${label}; Shift: ${shiftedLabel}`
    );

    if (shiftedValue === "floor(" || shiftedValue === "ceil(") {
        button.dataset.shiftTemplate = shiftedValue === "floor("
            ? "floor"
            : "ceil";
    } else {
        button.dataset.shiftInsert = shiftedValue;
    }

    main.className = "key-main";
    main.textContent = label;
    secondary.className = "key-secondary";
    secondary.textContent = shiftedLabel;
    button.append(main, secondary);

    return button;
}

Object.entries(categoryFunctions).forEach(([category, functions]) => {
    const panel = categoryPanels.get(category);

    if (!panel) {
        throw new Error(`Math Solver: Missing keypad panel for ${category}.`);
    }

    panel.replaceChildren(...functions.map(createCategoryKey));
});

function updateCategoryDisplay() {
    defaultScientificKeys.forEach(button => {
        button.hidden = activeCategory !== null;
    });

    categoryPanels.forEach((panel, category) => {
        panel.hidden = category !== activeCategory;
    });
}

categoryButtons.forEach(button => {

    button.addEventListener("click", () => {

        const category = button.dataset.category;


        // Clicking the active category again turns it off.
        if (activeCategory === category) {
            activeCategory = null;
        } else {
            activeCategory = category;
        }


        categoryButtons.forEach(key => {

            const selected =
                key.dataset.category === activeCategory;

            key.classList.toggle(
                "active",
                selected
            );

            key.setAttribute(
                "aria-pressed",
                String(selected)
            );
        });

        updateCategoryDisplay();
    });
});


// ==========================================
// BUTTON ACTION HANDLER
// ==========================================

function runButtonAction(action) {

    switch (action) {

        case "clear":
            clearCalculator();
            return true;


        case "delete":
            deleteLast();
            return true;


        case "calculate":
            calculate();
            return true;


        case "answer":
            insertAnswer();
            return true;


        case "previous-answer":
            insertPreviousAnswer();
            return true;


        case "store":
            memoryStore();
            return true;


        case "memory-add":
            memoryAdd();
            return true;


        case "memory-subtract":
            memorySubtract();
            return true;


        case "memory-recall":
            memoryRecall();
            return true;


        case "memory-clear":
            memoryClear();
            return true;


        default:
            return false;
    }
}


// ==========================================
// KEYPAD BUTTONS
// ==========================================

document.querySelectorAll(".key").forEach(button => {

    button.addEventListener("click", () => {

        // Category buttons have their own event handler.
        if (
            button.classList.contains("category-key")
        ) {
            return;
        }


        const action = button.dataset.action;

        const shiftedAction =
            button.dataset.shiftAction;
        const shiftActive = shiftMode || keyboardShiftMode;


        // ----------------------------------
        // 1. SHIFT ACTION
        // ----------------------------------

        if (
            shiftActive &&
            shiftedAction &&
            runButtonAction(shiftedAction)
        ) {
            return;
        }


        // ----------------------------------
        // 2. SHIFT TEMPLATE
        // ----------------------------------

        const normalTemplate =
            button.dataset.template;

        const shiftedTemplate =
            button.dataset.shiftTemplate;


        if (
            shiftActive &&
            shiftedTemplate
        ) {
            insertStructure(shiftedTemplate);
            return;
        }


        // ----------------------------------
        // 3. SHIFT TEXT INSERTION
        // ----------------------------------

        const shiftedValue =
            button.dataset.shiftInsert;


        if (
            shiftActive &&
            shiftedValue !== undefined
        ) {
            insertText(shiftedValue);
            return;
        }


        // ----------------------------------
        // 4. NORMAL ACTION
        // ----------------------------------

        if (
            action &&
            runButtonAction(action)
        ) {
            return;
        }


        // ----------------------------------
        // 5. NORMAL TEMPLATE
        // ----------------------------------

        if (normalTemplate) {
            insertStructure(normalTemplate);
            return;
        }


        // ----------------------------------
        // 6. NORMAL TEXT INSERTION
        // ----------------------------------

        const normalValue =
            button.dataset.insert;

        if (normalValue !== undefined) {
            insertText(normalValue);
        }

    });

});


// ==========================================
// EDITOR KEYBOARD SUPPORT
// ==========================================

editor.addEventListener("keydown", event => {

    const activeSlot = event.target.closest?.(".math-slot");
    if (activeSlot && handleSlotArrow(event, activeSlot)) {
        return;
    }

    // Enter calculates.
    if (event.key === "Enter") {
        event.preventDefault();

        calculate();

        return;
    }


    // Tab moves between empty mathematical slots.
    if (event.key === "Tab") {

        const activeSlot =
            event.target.closest?.(".math-slot");

        if (activeSlot) {
            event.preventDefault();

            moveToNextEmptySlot(activeSlot);
        }
    }

});


// ==========================================
// EDITOR INPUT EVENTS
// ==========================================

editor.addEventListener("input", () => {

    messageOutput.textContent = "";

    if (isEditorEmpty()) {
        showPlaceholder();
    }

});


// Paste plain text only.
// This prevents copied HTML formatting from breaking
// the mathematical editor structure.

editor.addEventListener("paste", event => {

    event.preventDefault();

    const text = (
        event.clipboardData ||
        window.clipboardData
    ).getData("text");

    if (text) {
        insertText(text);
    }

});


// Clear button
expressionClear.addEventListener(
    "click",
    clearCalculator
);


// ==========================================
// ANSWER FORMAT MENU
// ==========================================

function closeFormatMenu() {

    formatMenu.classList.add("hidden");

    formatToggle.setAttribute(
        "aria-expanded",
        "false"
    );
}


function changeFormat(format) {

    if (!formatNames[format]) {
        return;
    }


    answerFormat = format;

    formatLabel.textContent =
        formatNames[format];


    document.querySelectorAll("[data-format]").forEach(button => {

        button.classList.toggle(
            "selected",
            button.dataset.format === format
        );

    });


    closeFormatMenu();


    if (
        !isEditorEmpty() &&
        validateSlots()
    ) {
        calculate();
    }
}


// Open and close format menu
formatToggle.addEventListener("click", () => {

    const opening =
        formatMenu.classList.contains("hidden");

    formatMenu.classList.toggle("hidden");

    formatToggle.setAttribute(
        "aria-expanded",
        String(opening)
    );

});


// Format selection
document.querySelectorAll("[data-format]").forEach(button => {

    button.addEventListener("click", () => {

        changeFormat(button.dataset.format);

    });

});


// ==========================================
// FORMAT MENU SCROLL CONTROL
// ==========================================

formatControl?.addEventListener("wheel", event => {

    event.preventDefault();

    const index =
        formatOrder.indexOf(answerFormat);

    const direction =
        event.deltaY > 0 ? 1 : -1;

    const nextIndex =
        (
            index +
            direction +
            formatOrder.length
        ) % formatOrder.length;

    changeFormat(formatOrder[nextIndex]);

}, { passive: false });


// ==========================================
// CLOSE MENU WHEN CLICKING OUTSIDE
// ==========================================

document.addEventListener("click", event => {

    if (
        !event.target.closest(".format-control")
    ) {
        closeFormatMenu();
    }

});


// ==========================================
// INITIAL STATE
// ==========================================

function initialiseCalculator() {

    showPlaceholder();


    // Default angle mode
    setAngleMode("DEG");


    // Default answer format
    formatLabel.textContent =
        formatNames[answerFormat];


    document.querySelectorAll("[data-format]").forEach(button => {

        button.classList.toggle(
            "selected",
            button.dataset.format === answerFormat
        );

    });


    // Reset category selection
    categoryButtons.forEach(button => {

        button.classList.remove("active");

        button.setAttribute(
            "aria-pressed",
            "false"
        );

    });


    // Reset SHIFT
    shiftMode = false;

    updateShiftDisplay();


    // Close format menu
    closeFormatMenu();

}


// Start calculator
initialiseCalculator();


// ==========================================
// END OF MATH SOLVER SCRIPT
// ==========================================

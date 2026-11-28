const tabs = document.getElementById("category-tabs");
const activeCategoryLabel = document.getElementById("active-category");
const fromUnitSelect = document.getElementById("from-unit");
const toUnitSelect = document.getElementById("to-unit");
const fromValueInput = document.getElementById("from-value");
const toValueInput = document.getElementById("to-value");
const message = document.getElementById("conversion-message");
const swapButton = document.getElementById("swap-units");
const clearButton = document.getElementById("clear-values");

if (
    !tabs
    || !activeCategoryLabel
    || !fromUnitSelect
    || !toUnitSelect
    || !fromValueInput
    || !toValueInput
    || !message
    || !swapButton
    || !clearButton
) {
    throw new Error("Unit converter: required page elements are missing.");
}

let categories = [];
let activeCategory = null;
let activeSide = "from";
let conversionRequest = 0;

function formatValue(value) {
    if (typeof value === "string") return value;
    if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
    if (Object.is(value, -0) || value === 0) return "0";
    if (Math.abs(value) >= 1e15 || Math.abs(value) < 1e-8) {
        return value
            .toExponential(8)
            .replace(/\.?0+e/, "e")
            .replace("e+", "e");
    }
    return new Intl.NumberFormat(undefined, {
        useGrouping: false,
        maximumSignificantDigits: 12,
    }).format(value);
}

function populateUnitSelect(select, category, selectedSymbol) {
    select.replaceChildren(
        ...category.units.map((unit) => {
            const option = document.createElement("option");
            option.value = unit.symbol;
            option.textContent = `${unit.name} (${unit.symbol})`;
            option.selected = unit.symbol === selectedSymbol;
            return option;
        }),
    );
}

async function updateConversion(side) {
    activeSide = side;
    const requestId = ++conversionRequest;
    if (!activeCategory) return;

    const sourceInput = side === "from" ? fromValueInput : toValueInput;
    const targetInput = side === "from" ? toValueInput : fromValueInput;
    const sourceSelect = side === "from" ? fromUnitSelect : toUnitSelect;
    const targetSelect = side === "from" ? toUnitSelect : fromUnitSelect;
    if (!sourceInput.value.trim()) {
        targetInput.value = "";
        message.textContent = "";
        return;
    }

    try {
        const response = await fetch("/unit-converter/convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                category: activeCategory.id,
                from: sourceSelect.value,
                to: targetSelect.value,
                value: sourceInput.value,
            }),
        });
        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error("The Python service returned an unreadable response.");
        }
        if (!response.ok) {
            throw new Error(result.error || `The Python service returned ${response.status}.`);
        }
        if (requestId !== conversionRequest) return;
        if (typeof result.result !== "number" && typeof result.result !== "string") {
            throw new Error("The Python service returned an invalid conversion.");
        }
        targetInput.value = formatValue(result.result);
        message.textContent = "";
    } catch (error) {
        if (requestId !== conversionRequest) return;
        targetInput.value = "";
        message.textContent = error instanceof Error
            ? error.message
            : "The Python service could not convert this value.";
    }
}

function selectCategory(category) {
    activeCategory = category;
    activeCategoryLabel.textContent = category.label;
    message.textContent = "";
    tabs.querySelectorAll(".category-tab").forEach((tab) => {
        tab.setAttribute("aria-pressed", String(tab.dataset.category === category.id));
    });
    populateUnitSelect(fromUnitSelect, category, category.defaults[0]);
    populateUnitSelect(toUnitSelect, category, category.defaults[1]);
    updateConversion("from");
}

function createCategoryTabs() {
    const fragment = document.createDocumentFragment();
    categories.forEach((category) => {
        const button = document.createElement("button");
        button.className = "category-tab";
        button.type = "button";
        button.textContent = category.label;
        button.dataset.category = category.id;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => selectCategory(category));
        fragment.append(button);
    });
    tabs.replaceChildren(fragment);
}

async function loadCategories() {
    try {
        const response = await fetch("/unit-converter/data");
        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error("The Python service returned an unreadable unit catalog.");
        }
        if (!response.ok) {
            throw new Error(result.error || `The Python service returned ${response.status}.`);
        }
        if (!Array.isArray(result.categories) || result.categories.length === 0) {
            throw new Error("The Python service returned an empty unit catalog.");
        }
        categories = result.categories;
        createCategoryTabs();
        selectCategory(categories[0]);
    } catch (error) {
        message.textContent = error instanceof Error
            ? error.message
            : "The Python service could not load unit categories.";
    }
}

fromValueInput.addEventListener("input", () => updateConversion("from"));
toValueInput.addEventListener("input", () => updateConversion("to"));
fromUnitSelect.addEventListener("change", () => updateConversion(activeSide));
toUnitSelect.addEventListener("change", () => updateConversion(activeSide));

swapButton.addEventListener("click", () => {
    const fromSymbol = fromUnitSelect.value;
    const toSymbol = toUnitSelect.value;
    const fromValue = fromValueInput.value;
    const toValue = toValueInput.value;
    fromUnitSelect.value = toSymbol;
    toUnitSelect.value = fromSymbol;
    fromValueInput.value = toValue;
    toValueInput.value = fromValue;
    updateConversion(activeSide === "from" ? "to" : "from");
});

clearButton.addEventListener("click", () => {
    conversionRequest += 1;
    fromValueInput.value = "";
    toValueInput.value = "";
    message.textContent = "";
    activeSide = "from";
    fromValueInput.focus();
});

loadCategories();

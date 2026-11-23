const SI_PREFIXES = [
    { name: "quecto", symbol: "q", factor: 1e-30 },
    { name: "ronto", symbol: "r", factor: 1e-27 },
    { name: "yocto", symbol: "y", factor: 1e-24 },
    { name: "zepto", symbol: "z", factor: 1e-21 },
    { name: "atto", symbol: "a", factor: 1e-18 },
    { name: "femto", symbol: "f", factor: 1e-15 },
    { name: "pico", symbol: "p", factor: 1e-12 },
    { name: "nano", symbol: "n", factor: 1e-9 },
    { name: "micro", symbol: "µ", factor: 1e-6 },
    { name: "milli", symbol: "m", factor: 1e-3 },
    { name: "centi", symbol: "c", factor: 1e-2 },
    { name: "deci", symbol: "d", factor: 1e-1 },
    { name: "", symbol: "", factor: 1 },
    { name: "deca", symbol: "da", factor: 1e1 },
    { name: "hecto", symbol: "h", factor: 1e2 },
    { name: "kilo", symbol: "k", factor: 1e3 },
    { name: "mega", symbol: "M", factor: 1e6 },
    { name: "giga", symbol: "G", factor: 1e9 },
    { name: "tera", symbol: "T", factor: 1e12 },
    { name: "peta", symbol: "P", factor: 1e15 },
    { name: "exa", symbol: "E", factor: 1e18 },
    { name: "zetta", symbol: "Z", factor: 1e21 },
    { name: "yotta", symbol: "Y", factor: 1e24 },
    { name: "ronna", symbol: "R", factor: 1e27 },
    { name: "quetta", symbol: "Q", factor: 1e30 },
];

const BINARY_PREFIXES = [
    { name: "kibi", symbol: "Ki", factor: 2 ** 10 },
    { name: "mebi", symbol: "Mi", factor: 2 ** 20 },
    { name: "gibi", symbol: "Gi", factor: 2 ** 30 },
    { name: "tebi", symbol: "Ti", factor: 2 ** 40 },
    { name: "pebi", symbol: "Pi", factor: 2 ** 50 },
    { name: "exbi", symbol: "Ei", factor: 2 ** 60 },
    { name: "zebi", symbol: "Zi", factor: 2 ** 70 },
    { name: "yobi", symbol: "Yi", factor: 2 ** 80 },
];

function prefixedUnits(baseName, symbol, baseFactor = 1, power = 1) {
    return SI_PREFIXES.map((prefix) => {
        let name;

        if (power === 2) {
            name = prefix.name
                ? `${prefix.name}${baseName} squared`
                : `square ${baseName}`;
        } else if (power === 3) {
            name = prefix.name
                ? `${prefix.name}${baseName} cubed`
                : `cubic ${baseName}`;
        } else {
            name = `${prefix.name}${baseName}`;
        }

        return {
            name,
            symbol: `${prefix.symbol}${symbol}`,
            factor: baseFactor * prefix.factor ** power,
        };
    });
}

function prefixedCubicFlowUnits() {
    return SI_PREFIXES.map((prefix) => ({
        name: prefix.name
            ? `cubic ${prefix.name}meter per second`
            : "cubic meter per second",
        symbol: `${prefix.symbol}m³/s`,
        factor: prefix.factor ** 3,
    }));
}

function namedUnit(name, symbol, factor, offset = 0) {
    return { name, symbol, factor, offset };
}

function withUnits(id, label, units, defaults, kind = "linear") {
    return { id, label, units, defaults, kind };
}

const timeUnits = [
    ...prefixedUnits("second", "s"),
    namedUnit("minute", "min", 60),
    namedUnit("hour", "h", 3600),
    namedUnit("day", "d", 86400),
    namedUnit("week", "wk", 604800),
    namedUnit("fortnight", "fn", 1209600),
    namedUnit("average Gregorian month", "mo", 2629800),
    namedUnit("calendar year (365 days)", "yr", 31536000),
    namedUnit("leap year (366 days)", "ly", 31622400),
    namedUnit("Julian year", "a", 31557600),
    namedUnit("decade", "dec", 315576000),
    namedUnit("century", "c", 3155760000),
    namedUnit("millennium", "kyr", 31557600000),
    namedUnit("sidereal day", "sid d", 86164.0905),
    namedUnit("sidereal year", "sid yr", 31558149.8),
    namedUnit("Planck time", "tP", 5.391247e-44),
];

const metricVolumeUnits = [
    ...prefixedUnits("liter", "L", 1e-3),
    ...prefixedUnits("meter", "m³", 1, 3),
];

const categories = [
    withUnits(
        "length",
        "Length",
        [
            ...prefixedUnits("meter", "m"),
            namedUnit("inch", "in", 0.0254),
            namedUnit("foot", "ft", 0.3048),
            namedUnit("yard", "yd", 0.9144),
            namedUnit("mile", "mi", 1609.344),
            namedUnit("nautical mile", "nmi", 1852),
            namedUnit("fathom", "ftm", 1.8288),
            namedUnit("chain", "ch", 20.1168),
            namedUnit("furlong", "fur", 201.168),
            namedUnit("US survey foot", "ftUS", 1200 / 3937),
            namedUnit("astronomical unit", "au", 149597870700),
            namedUnit("light-year", "ly", 9460730472580800),
            namedUnit("parsec", "pc", 3.085677581491367e16),
        ],
        ["m", "km"],
    ),
    withUnits(
        "area",
        "Area",
        [
            ...prefixedUnits("meter", "m²", 1, 2),
            namedUnit("hectare", "ha", 10000),
            namedUnit("are", "a", 100),
            namedUnit("acre", "ac", 4046.8564224),
            namedUnit("square inch", "in²", 0.00064516),
            namedUnit("square foot", "ft²", 0.09290304),
            namedUnit("square yard", "yd²", 0.83612736),
            namedUnit("square mile", "mi²", 2589988.110336),
            namedUnit("barn", "b", 1e-28),
        ],
        ["m²", "ft²"],
    ),
    withUnits(
        "volume",
        "Volume",
        [
            ...metricVolumeUnits,
            namedUnit("US teaspoon", "tsp US", 4.92892159375e-6),
            namedUnit("US tablespoon", "tbsp US", 1.478676478125e-5),
            namedUnit("US fluid ounce", "fl oz US", 2.95735295625e-5),
            namedUnit("US cup", "cup US", 2.365882365e-4),
            namedUnit("US pint", "pt US", 4.73176473e-4),
            namedUnit("US quart", "qt US", 9.46352946e-4),
            namedUnit("US gallon", "gal US", 0.003785411784),
            namedUnit("Imperial fluid ounce", "fl oz imp", 2.84130625e-5),
            namedUnit("Imperial pint", "pt imp", 5.6826125e-4),
            namedUnit("Imperial gallon", "gal imp", 0.00454609),
            namedUnit("cubic inch", "in³", 1.6387064e-5),
            namedUnit("cubic foot", "ft³", 0.028316846592),
            namedUnit("cubic yard", "yd³", 0.764554857984),
            namedUnit("US drop (approx.)", "gtt", 5e-8),
        ],
        ["L", "mL"],
    ),
    withUnits(
        "mass",
        "Mass",
        [
            ...prefixedUnits("gram", "g", 1e-3),
            namedUnit("metric tonne", "t", 1000),
            namedUnit("unified atomic mass unit", "u", 1.6605390666e-27),
            namedUnit("carat", "ct", 0.0002),
            namedUnit("grain", "gr", 0.00006479891),
            namedUnit("ounce", "oz", 0.028349523125),
            namedUnit("pound", "lb", 0.45359237),
            namedUnit("stone", "st", 6.35029318),
            namedUnit("US short ton", "ton US", 907.18474),
            namedUnit("Imperial long ton", "ton imp", 1016.0469088),
        ],
        ["kg", "lb"],
    ),
    withUnits(
        "temperature",
        "Temperature",
        [
            namedUnit("degree Celsius", "°C", 1),
            namedUnit("degree Fahrenheit", "°F", 5 / 9, -160 / 9),
            ...prefixedUnits("kelvin", "K").map((unit) => ({
                ...unit,
                offset: -273.15,
            })),
            namedUnit("degree Rankine", "°R", 5 / 9, -273.15),
            namedUnit("degree Réaumur", "°Ré", 1.25),
            namedUnit("degree Rømer", "°Rø", 40 / 21, -100 / 7),
            namedUnit("degree Newton", "°N", 100 / 33),
            namedUnit("degree Delisle", "°De", -2 / 3, 100),
        ],
        ["°C", "°F"],
        "temperature",
    ),
    withUnits(
        "time",
        "Time",
        timeUnits,
        ["s", "ms"],
    ),
    withUnits(
        "speed",
        "Speed",
        [
            ...prefixedUnits("meter per second", "m/s"),
            ...prefixedUnits("meter per hour", "m/h", 1 / 3600),
            namedUnit("kilometer per hour", "km/h", 1 / 3.6),
            namedUnit("mile per hour", "mph", 0.44704),
            namedUnit("foot per second", "ft/s", 0.3048),
            namedUnit("knot", "kn", 1852 / 3600),
            namedUnit("Mach (sea level, approx.)", "Mach", 340.29),
            namedUnit("speed of light", "c", 299792458),
        ],
        ["m/s", "km/h"],
    ),
    withUnits(
        "data",
        "Digital data",
        [
            namedUnit("bit", "b", 1),
            namedUnit("byte", "B", 8),
            ...SI_PREFIXES.filter((prefix) => prefix.name).flatMap((prefix) => [
                namedUnit(
                    `${prefix.name}bit`,
                    `${prefix.symbol}b`,
                    prefix.factor,
                ),
                namedUnit(
                    `${prefix.name}byte`,
                    `${prefix.symbol}B`,
                    prefix.factor * 8,
                ),
            ]),
            ...BINARY_PREFIXES.flatMap((prefix) => [
                namedUnit(
                    `${prefix.name}bit`,
                    `${prefix.symbol}bit`,
                    prefix.factor,
                ),
                namedUnit(
                    `${prefix.name}byte`,
                    `${prefix.symbol}B`,
                    prefix.factor * 8,
                ),
            ]),
        ],
        ["B", "MiB"],
    ),
    withUnits(
        "angle",
        "Angle",
        [
            namedUnit("radian", "rad", 1),
            namedUnit("milliradian", "mrad", 1e-3),
            namedUnit("microradian", "µrad", 1e-6),
            namedUnit("degree", "°", Math.PI / 180),
            namedUnit("arcminute", "arcmin", Math.PI / 10800),
            namedUnit("arcsecond", "arcsec", Math.PI / 648000),
            namedUnit("gradian", "gon", Math.PI / 200),
            namedUnit("turn", "turn", 2 * Math.PI),
            namedUnit("revolution", "rev", 2 * Math.PI),
            namedUnit("milliarcsecond", "mas", Math.PI / 648000000),
        ],
        ["°", "rad"],
    ),
    withUnits(
        "pressure",
        "Pressure",
        [
            ...prefixedUnits("pascal", "Pa"),
            namedUnit("bar", "bar", 100000),
            namedUnit("standard atmosphere", "atm", 101325),
            namedUnit("technical atmosphere", "at", 98066.5),
            namedUnit("torr", "Torr", 101325 / 760),
            namedUnit("millimeter of mercury", "mmHg", 133.322387415),
            namedUnit("pound per square inch", "psi", 6894.757293168),
            namedUnit("pound per square foot", "psf", 47.88025898),
            namedUnit("inch of water", "inH₂O", 249.08891),
        ],
        ["Pa", "psi"],
    ),
    withUnits(
        "energy",
        "Energy",
        [
            ...prefixedUnits("joule", "J"),
            ...prefixedUnits("watt hour", "Wh", 3600),
            namedUnit("calorie (thermochemical)", "cal", 4.184),
            namedUnit("kilocalorie", "kcal", 4184),
            namedUnit("food calorie", "Cal", 4184),
            namedUnit("British thermal unit", "BTU", 1055.05585262),
            namedUnit("electronvolt", "eV", 1.602176634e-19),
            namedUnit("foot-pound", "ft·lbf", 1.3558179483314),
            namedUnit("US therm", "thm US", 105480400),
        ],
        ["J", "kWh"],
    ),
    withUnits(
        "power",
        "Power",
        [
            ...prefixedUnits("watt", "W"),
            namedUnit("mechanical horsepower", "hp", 745.699871582),
            namedUnit("metric horsepower", "PS", 735.49875),
            namedUnit("imperial horsepower", "hp imp", 745.699871582),
            namedUnit("ton of refrigeration", "TR", 3516.85284),
        ],
        ["W", "hp"],
    ),
    withUnits(
        "force",
        "Force",
        [
            ...prefixedUnits("newton", "N"),
            namedUnit("dyne", "dyn", 1e-5),
            namedUnit("kilogram-force", "kgf", 9.80665),
            namedUnit("pound-force", "lbf", 4.4482216152605),
            namedUnit("ounce-force", "ozf", 0.2780138509538),
            namedUnit("poundal", "pdl", 0.138254954376),
        ],
        ["N", "lbf"],
    ),
    withUnits(
        "frequency",
        "Frequency",
        [
            ...prefixedUnits("hertz", "Hz"),
            namedUnit("revolution per minute", "rpm", 1 / 60),
            namedUnit("revolution per second", "rps", 1),
            namedUnit("beat per minute", "bpm", 1 / 60),
        ],
        ["Hz", "kHz"],
    ),
    withUnits(
        "current",
        "Electric current",
        [
            ...prefixedUnits("ampere", "A"),
            namedUnit("abampere", "abA", 10),
            namedUnit("statampere", "statA", 3.335641e-10),
        ],
        ["A", "mA"],
    ),
    withUnits(
        "voltage",
        "Voltage",
        [
            ...prefixedUnits("volt", "V"),
            namedUnit("abvolt", "abV", 1e-8),
            namedUnit("statvolt", "statV", 299.792458),
        ],
        ["V", "mV"],
    ),
    withUnits(
        "resistance",
        "Electrical resistance",
        [
            ...prefixedUnits("ohm", "Ω"),
            namedUnit("abohm", "abΩ", 1e-9),
            namedUnit("statohm", "statΩ", 8.98755179e11),
        ],
        ["Ω", "kΩ"],
    ),
    withUnits(
        "charge",
        "Electric charge",
        [
            ...prefixedUnits("coulomb", "C"),
            namedUnit("ampere hour", "Ah", 3600),
            namedUnit("milliampere hour", "mAh", 3.6),
            namedUnit("elementary charge", "e", 1.602176634e-19),
            namedUnit("faraday", "F", 96485.33212),
        ],
        ["C", "mAh"],
    ),
    withUnits(
        "capacitance",
        "Capacitance",
        [
            ...prefixedUnits("farad", "F"),
            namedUnit("abfarad", "abF", 1e9),
            namedUnit("statfarad", "statF", 1.112650056e-12),
        ],
        ["F", "µF"],
    ),
    withUnits(
        "conductance",
        "Electrical conductance",
        [...prefixedUnits("siemens", "S"), namedUnit("mho", "℧", 1)],
        ["S", "mS"],
    ),
    withUnits(
        "inductance",
        "Inductance",
        [...prefixedUnits("henry", "H"), namedUnit("abhenry", "abH", 1e-9)],
        ["H", "mH"],
    ),
    withUnits(
        "magnetic-flux",
        "Magnetic flux",
        [
            ...prefixedUnits("weber", "Wb"),
            namedUnit("maxwell", "Mx", 1e-8),
        ],
        ["Wb", "mWb"],
    ),
    withUnits(
        "magnetic-field",
        "Magnetic flux density",
        [
            ...prefixedUnits("tesla", "T"),
            namedUnit("gauss", "G", 1e-4),
        ],
        ["T", "mT"],
    ),
    withUnits(
        "amount",
        "Amount of substance",
        [
            ...prefixedUnits("mole", "mol"),
            namedUnit("molecule", "molecule", 1 / 6.02214076e23),
        ],
        ["mol", "mmol"],
    ),
    withUnits(
        "luminous-intensity",
        "Luminous intensity",
        [
            ...prefixedUnits("candela", "cd"),
            namedUnit("candlepower", "cp", 0.981),
        ],
        ["cd", "mcd"],
    ),
    withUnits(
        "illuminance",
        "Illuminance",
        [
            ...prefixedUnits("lux", "lx"),
            namedUnit("foot-candle", "fc", 10.7639104167),
            namedUnit("phot", "ph", 10000),
        ],
        ["lx", "fc"],
    ),
    withUnits(
        "density",
        "Density",
        [
            namedUnit("kilogram per cubic meter", "kg/m³", 1),
            namedUnit("gram per cubic centimeter", "g/cm³", 1000),
            namedUnit("gram per milliliter", "g/mL", 1000),
            namedUnit("kilogram per liter", "kg/L", 1000),
            namedUnit("pound per cubic foot", "lb/ft³", 16.01846337),
            namedUnit("pound per US gallon", "lb/gal US", 119.8264273),
        ],
        ["kg/m³", "g/cm³"],
    ),
    withUnits(
        "flow",
        "Volume flow",
        [
            ...prefixedCubicFlowUnits(),
            ...prefixedUnits("liter per second", "L/s", 1e-3),
            namedUnit("cubic meter per minute", "m³/min", 1 / 60),
            namedUnit("cubic meter per hour", "m³/h", 1 / 3600),
            namedUnit("liter per minute", "L/min", 1e-3 / 60),
            namedUnit("liter per hour", "L/h", 1e-3 / 3600),
            namedUnit("US gallon per minute", "gpm US", 0.003785411784 / 60),
            namedUnit("Imperial gallon per minute", "gpm imp", 0.00454609 / 60),
            namedUnit("cubic foot per minute", "cfm", 0.028316846592 / 60),
        ],
        ["L/s", "L/min"],
    ),
    withUnits(
        "fuel",
        "Fuel economy",
        [
            { name: "kilometer per liter", symbol: "km/L" },
            { name: "liter per 100 kilometers", symbol: "L/100 km" },
            { name: "mile per US gallon", symbol: "mpg US" },
            { name: "mile per Imperial gallon", symbol: "mpg imp" },
            { name: "liter per 100 miles", symbol: "L/100 mi" },
        ],
        ["km/L", "mpg US"],
        "fuel",
    ),
    withUnits(
        "tip",
        "Tip & percentage",
        [
            namedUnit("decimal fraction", "ratio", 1),
            namedUnit("percent (tip)", "tip %", 0.01),
            namedUnit("percent", "%", 0.01),
            namedUnit("permille", "‰", 0.001),
            namedUnit("basis point", "bp", 0.0001),
            namedUnit("part per million", "ppm", 1e-6),
            namedUnit("part per billion", "ppb", 1e-9),
            namedUnit("part per trillion", "ppt", 1e-12),
        ],
        ["tip %", "ratio"],
    ),
];

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
    !tabs ||
    !activeCategoryLabel ||
    !fromUnitSelect ||
    !toUnitSelect ||
    !fromValueInput ||
    !toValueInput ||
    !message ||
    !swapButton ||
    !clearButton
) {
    throw new Error("Unit converter: required page elements are missing.");
}

let activeCategory = categories[0];
let activeSide = "from";

function getUnit(category, symbol) {
    const unit = category.units.find((item) => item.symbol === symbol);

    if (!unit) {
        throw new Error(`Unit converter: unknown ${category.label} unit.`);
    }

    return unit;
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

function selectCategory(category) {
    activeCategory = category;
    activeCategoryLabel.textContent = category.label;
    message.textContent = "";

    tabs.querySelectorAll(".category-tab").forEach((tab) => {
        const selected = tab.dataset.category === category.id;
        tab.setAttribute("aria-pressed", String(selected));
    });

    populateUnitSelect(fromUnitSelect, category, category.defaults[0]);
    populateUnitSelect(toUnitSelect, category, category.defaults[1]);
    activeSide = "from";
    updateConversion(activeSide);
}

function parseValue(rawValue) {
    const trimmed = rawValue.trim();

    if (!trimmed) {
        return null;
    }

    const normalized = trimmed.replace(",", ".");
    const value = Number(normalized);

    if (!Number.isFinite(value)) {
        throw new Error("Enter a valid number to convert.");
    }

    return value;
}

function toBase(value, unit, category) {
    if (category.kind === "fuel") {
        switch (unit.symbol) {
            case "km/L":
                return 100 / value;
            case "L/100 km":
                return value;
            case "mpg US":
                return 235.214583 / value;
            case "mpg imp":
                return 282.480936 / value;
            case "L/100 mi":
                return value * 0.621371192237;
            default:
                throw new Error("This fuel-economy unit is not supported.");
        }
    }

    return value * unit.factor + (unit.offset || 0);
}

function fromBase(value, unit, category) {
    if (category.kind === "fuel") {
        switch (unit.symbol) {
            case "km/L":
                return value === 0 ? Infinity : 100 / value;
            case "L/100 km":
                return value;
            case "mpg US":
                return value === 0 ? Infinity : 235.214583 / value;
            case "mpg imp":
                return value === 0 ? Infinity : 282.480936 / value;
            case "L/100 mi":
                return value / 0.621371192237;
            default:
                throw new Error("This fuel-economy unit is not supported.");
        }
    }

    return (value - (unit.offset || 0)) / unit.factor;
}

function convertValue(value, sourceUnit, targetUnit, category) {
    const baseValue = toBase(value, sourceUnit, category);

    if (
        category.kind === "temperature" &&
        baseValue < -273.15 - 1e-10
    ) {
        throw new Error("Temperature cannot be below absolute zero.");
    }

    if (category.kind === "fuel" && baseValue < 0) {
        throw new Error("Fuel economy cannot be negative.");
    }

    const converted = fromBase(baseValue, targetUnit, category);

    if (category.kind === "temperature") {
        const tolerance =
            (Number.EPSILON *
                Math.max(
                    Math.abs(value * sourceUnit.factor),
                    Math.abs(sourceUnit.offset || 0),
                    Math.abs(targetUnit.offset || 0),
                    1,
                ) *
                4) /
            Math.abs(targetUnit.factor);

        return Math.abs(converted) <= tolerance ? 0 : converted;
    }

    return converted;
}

function formatValue(value) {
    if (!Number.isFinite(value)) {
        return value > 0 ? "∞" : "−∞";
    }

    if (Object.is(value, -0) || value === 0) {
        return "0";
    }

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

function updateConversion(side) {
    activeSide = side;
    const sourceInput = side === "from" ? fromValueInput : toValueInput;
    const targetInput = side === "from" ? toValueInput : fromValueInput;
    const sourceSelect = side === "from" ? fromUnitSelect : toUnitSelect;
    const targetSelect = side === "from" ? toUnitSelect : fromUnitSelect;

    try {
        const value = parseValue(sourceInput.value);

        if (value === null) {
            targetInput.value = "";
            message.textContent = "";
            return;
        }

        const converted = convertValue(
            value,
            getUnit(activeCategory, sourceSelect.value),
            getUnit(activeCategory, targetSelect.value),
            activeCategory,
        );

        if (Number.isNaN(converted)) {
            throw new Error("These values cannot be converted.");
        }

        targetInput.value = formatValue(converted);
        message.textContent = "";
    } catch (error) {
        targetInput.value = "";
        message.textContent = error.message;
    }
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
    fromValueInput.value = "";
    toValueInput.value = "";
    message.textContent = "";
    activeSide = "from";
    fromValueInput.focus();
});

createCategoryTabs();
selectCategory(activeCategory);

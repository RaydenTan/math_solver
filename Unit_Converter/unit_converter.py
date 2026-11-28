import math
import sys
from typing import Any


SI_PREFIXES = (
    ("quecto", "q", 1e-30),
    ("ronto", "r", 1e-27),
    ("yocto", "y", 1e-24),
    ("zepto", "z", 1e-21),
    ("atto", "a", 1e-18),
    ("femto", "f", 1e-15),
    ("pico", "p", 1e-12),
    ("nano", "n", 1e-9),
    ("micro", "µ", 1e-6),
    ("milli", "m", 1e-3),
    ("centi", "c", 1e-2),
    ("deci", "d", 1e-1),
    ("", "", 1),
    ("deca", "da", 1e1),
    ("hecto", "h", 1e2),
    ("kilo", "k", 1e3),
    ("mega", "M", 1e6),
    ("giga", "G", 1e9),
    ("tera", "T", 1e12),
    ("peta", "P", 1e15),
    ("exa", "E", 1e18),
    ("zetta", "Z", 1e21),
    ("yotta", "Y", 1e24),
    ("ronna", "R", 1e27),
    ("quetta", "Q", 1e30),
)

BINARY_PREFIXES = (
    ("kibi", "Ki", 2**10),
    ("mebi", "Mi", 2**20),
    ("gibi", "Gi", 2**30),
    ("tebi", "Ti", 2**40),
    ("pebi", "Pi", 2**50),
    ("exbi", "Ei", 2**60),
    ("zebi", "Zi", 2**70),
    ("yobi", "Yi", 2**80),
)


def _unit(name: str, symbol: str, factor: float = 1, offset: float = 0) -> dict[str, Any]:
    return {"name": name, "symbol": symbol, "factor": factor, "offset": offset}


def _prefixed_units(
    base_name: str,
    symbol: str,
    base_factor: float = 1,
    power: int = 1,
) -> list[dict[str, Any]]:
    units = []
    for prefix_name, prefix_symbol, prefix_factor in SI_PREFIXES:
        if power == 2:
            name = f"{prefix_name}{base_name} squared" if prefix_name else f"square {base_name}"
        elif power == 3:
            name = f"{prefix_name}{base_name} cubed" if prefix_name else f"cubic {base_name}"
        else:
            name = f"{prefix_name}{base_name}"
        units.append(
            _unit(name, f"{prefix_symbol}{symbol}", base_factor * prefix_factor**power)
        )
    return units


def _category(
    identifier: str,
    label: str,
    units: list[dict[str, Any]],
    defaults: tuple[str, str],
    kind: str = "linear",
) -> dict[str, Any]:
    return {
        "id": identifier,
        "label": label,
        "units": units,
        "defaults": list(defaults),
        "kind": kind,
    }


_time_units = _prefixed_units("second", "s") + [
    _unit("minute", "min", 60),
    _unit("hour", "h", 3600),
    _unit("day", "d", 86400),
    _unit("week", "wk", 604800),
    _unit("fortnight", "fn", 1209600),
    _unit("average Gregorian month", "mo", 2629800),
    _unit("calendar year (365 days)", "yr", 31536000),
    _unit("leap year (366 days)", "ly", 31622400),
    _unit("Julian year", "a", 31557600),
    _unit("decade", "dec", 315576000),
    _unit("century", "c", 3155760000),
    _unit("millennium", "kyr", 31557600000),
    _unit("sidereal day", "sid d", 86164.0905),
    _unit("sidereal year", "sid yr", 31558149.8),
    _unit("Planck time", "tP", 5.391247e-44),
]

_metric_volume_units = _prefixed_units("liter", "L", 1e-3) + _prefixed_units(
    "meter", "m³", power=3
)

_data_units = [_unit("bit", "b"), _unit("byte", "B", 8)]
for _prefix_name, _prefix_symbol, _factor in SI_PREFIXES:
    if _prefix_name:
        _data_units.extend(
            (
                _unit(f"{_prefix_name}bit", f"{_prefix_symbol}b", _factor),
                _unit(f"{_prefix_name}byte", f"{_prefix_symbol}B", _factor * 8),
            )
        )
for _prefix_name, _prefix_symbol, _factor in BINARY_PREFIXES:
    _data_units.extend(
        (
            _unit(f"{_prefix_name}bit", f"{_prefix_symbol}bit", _factor),
            _unit(f"{_prefix_name}byte", f"{_prefix_symbol}B", _factor * 8),
        )
    )

CATEGORIES = [
    _category(
        "length",
        "Length",
        _prefixed_units("meter", "m")
        + [
            _unit("inch", "in", 0.0254),
            _unit("foot", "ft", 0.3048),
            _unit("yard", "yd", 0.9144),
            _unit("mile", "mi", 1609.344),
            _unit("nautical mile", "nmi", 1852),
            _unit("fathom", "ftm", 1.8288),
            _unit("chain", "ch", 20.1168),
            _unit("furlong", "fur", 201.168),
            _unit("US survey foot", "ftUS", 1200 / 3937),
            _unit("astronomical unit", "au", 149597870700),
            _unit("light-year", "ly", 9460730472580800),
            _unit("parsec", "pc", 3.085677581491367e16),
        ],
        ("m", "km"),
    ),
    _category(
        "area",
        "Area",
        _prefixed_units("meter", "m²", power=2)
        + [
            _unit("hectare", "ha", 10000),
            _unit("are", "a", 100),
            _unit("acre", "ac", 4046.8564224),
            _unit("square inch", "in²", 0.00064516),
            _unit("square foot", "ft²", 0.09290304),
            _unit("square yard", "yd²", 0.83612736),
            _unit("square mile", "mi²", 2589988.110336),
            _unit("barn", "b", 1e-28),
        ],
        ("m²", "ft²"),
    ),
    _category(
        "volume",
        "Volume",
        _metric_volume_units
        + [
            _unit("US teaspoon", "tsp US", 4.92892159375e-6),
            _unit("US tablespoon", "tbsp US", 1.478676478125e-5),
            _unit("US fluid ounce", "fl oz US", 2.95735295625e-5),
            _unit("US cup", "cup US", 2.365882365e-4),
            _unit("US pint", "pt US", 4.73176473e-4),
            _unit("US quart", "qt US", 9.46352946e-4),
            _unit("US gallon", "gal US", 0.003785411784),
            _unit("Imperial fluid ounce", "fl oz imp", 2.84130625e-5),
            _unit("Imperial pint", "pt imp", 5.6826125e-4),
            _unit("Imperial gallon", "gal imp", 0.00454609),
            _unit("cubic inch", "in³", 1.6387064e-5),
            _unit("cubic foot", "ft³", 0.028316846592),
            _unit("cubic yard", "yd³", 0.764554857984),
            _unit("US drop (approx.)", "gtt", 5e-8),
        ],
        ("L", "mL"),
    ),
    _category(
        "mass",
        "Mass",
        _prefixed_units("gram", "g", 1e-3)
        + [
            _unit("metric tonne", "t", 1000),
            _unit("unified atomic mass unit", "u", 1.6605390666e-27),
            _unit("carat", "ct", 0.0002),
            _unit("grain", "gr", 0.00006479891),
            _unit("ounce", "oz", 0.028349523125),
            _unit("pound", "lb", 0.45359237),
            _unit("stone", "st", 6.35029318),
            _unit("US short ton", "ton US", 907.18474),
            _unit("Imperial long ton", "ton imp", 1016.0469088),
        ],
        ("kg", "lb"),
    ),
    _category(
        "temperature",
        "Temperature",
        [
            _unit("degree Celsius", "°C"),
            _unit("degree Fahrenheit", "°F", 5 / 9, -160 / 9),
            *[
                _unit(unit["name"], unit["symbol"], unit["factor"], -273.15)
                for unit in _prefixed_units("kelvin", "K")
            ],
            _unit("degree Rankine", "°R", 5 / 9, -273.15),
            _unit("degree Réaumur", "°Ré", 1.25),
            _unit("degree Rømer", "°Rø", 40 / 21, -100 / 7),
            _unit("degree Newton", "°N", 100 / 33),
            _unit("degree Delisle", "°De", -2 / 3, 100),
        ],
        ("°C", "°F"),
        "temperature",
    ),
    _category("time", "Time", _time_units, ("s", "ms")),
    _category(
        "speed",
        "Speed",
        _prefixed_units("meter per second", "m/s")
        + _prefixed_units("meter per hour", "m/h", 1 / 3600)
        + [
            _unit("kilometer per hour", "km/h", 1 / 3.6),
            _unit("mile per hour", "mph", 0.44704),
            _unit("foot per second", "ft/s", 0.3048),
            _unit("knot", "kn", 1852 / 3600),
            _unit("Mach (sea level, approx.)", "Mach", 340.29),
            _unit("speed of light", "c", 299792458),
        ],
        ("m/s", "km/h"),
    ),
    _category("data", "Digital data", _data_units, ("B", "MiB")),
    _category(
        "angle",
        "Angle",
        [
            _unit("radian", "rad"),
            _unit("milliradian", "mrad", 1e-3),
            _unit("microradian", "µrad", 1e-6),
            _unit("degree", "°", math.pi / 180),
            _unit("arcminute", "arcmin", math.pi / 10800),
            _unit("arcsecond", "arcsec", math.pi / 648000),
            _unit("gradian", "gon", math.pi / 200),
            _unit("turn", "turn", 2 * math.pi),
            _unit("revolution", "rev", 2 * math.pi),
            _unit("milliarcsecond", "mas", math.pi / 648000000),
        ],
        ("°", "rad"),
    ),
    _category(
        "pressure",
        "Pressure",
        _prefixed_units("pascal", "Pa")
        + [
            _unit("bar", "bar", 100000),
            _unit("standard atmosphere", "atm", 101325),
            _unit("technical atmosphere", "at", 98066.5),
            _unit("torr", "Torr", 101325 / 760),
            _unit("millimeter of mercury", "mmHg", 133.322387415),
            _unit("pound per square inch", "psi", 6894.757293168),
            _unit("pound per square foot", "psf", 47.88025898),
            _unit("inch of water", "inH₂O", 249.08891),
        ],
        ("Pa", "psi"),
    ),
    _category(
        "energy",
        "Energy",
        _prefixed_units("joule", "J")
        + _prefixed_units("watt hour", "Wh", 3600)
        + [
            _unit("calorie (thermochemical)", "cal", 4.184),
            _unit("kilocalorie", "kcal", 4184),
            _unit("food calorie", "Cal", 4184),
            _unit("British thermal unit", "BTU", 1055.05585262),
            _unit("electronvolt", "eV", 1.602176634e-19),
            _unit("foot-pound", "ft·lbf", 1.3558179483314),
            _unit("US therm", "thm US", 105480400),
        ],
        ("J", "kWh"),
    ),
    _category(
        "power",
        "Power",
        _prefixed_units("watt", "W")
        + [
            _unit("mechanical horsepower", "hp", 745.699871582),
            _unit("metric horsepower", "PS", 735.49875),
            _unit("imperial horsepower", "hp imp", 745.699871582),
            _unit("ton of refrigeration", "TR", 3516.85284),
        ],
        ("W", "hp"),
    ),
    _category(
        "force",
        "Force",
        _prefixed_units("newton", "N")
        + [
            _unit("dyne", "dyn", 1e-5),
            _unit("kilogram-force", "kgf", 9.80665),
            _unit("pound-force", "lbf", 4.4482216152605),
            _unit("ounce-force", "ozf", 0.2780138509538),
            _unit("poundal", "pdl", 0.138254954376),
        ],
        ("N", "lbf"),
    ),
    _category(
        "frequency",
        "Frequency",
        _prefixed_units("hertz", "Hz")
        + [
            _unit("revolution per minute", "rpm", 1 / 60),
            _unit("revolution per second", "rps"),
            _unit("beat per minute", "bpm", 1 / 60),
        ],
        ("Hz", "kHz"),
    ),
    _category(
        "current",
        "Electric current",
        _prefixed_units("ampere", "A")
        + [
            _unit("abampere", "abA", 10),
            _unit("statampere", "statA", 3.335641e-10),
        ],
        ("A", "mA"),
    ),
    _category(
        "voltage",
        "Voltage",
        _prefixed_units("volt", "V")
        + [
            _unit("abvolt", "abV", 1e-8),
            _unit("statvolt", "statV", 299.792458),
        ],
        ("V", "mV"),
    ),
    _category(
        "resistance",
        "Electrical resistance",
        _prefixed_units("ohm", "Ω")
        + [
            _unit("abohm", "abΩ", 1e-9),
            _unit("statohm", "statΩ", 8.98755179e11),
        ],
        ("Ω", "kΩ"),
    ),
    _category(
        "charge",
        "Electric charge",
        _prefixed_units("coulomb", "C")
        + [
            _unit("ampere hour", "Ah", 3600),
            _unit("milliampere hour", "mAh", 3.6),
            _unit("elementary charge", "e", 1.602176634e-19),
            _unit("faraday", "F", 96485.33212),
        ],
        ("C", "mAh"),
    ),
    _category(
        "capacitance",
        "Capacitance",
        _prefixed_units("farad", "F")
        + [
            _unit("abfarad", "abF", 1e9),
            _unit("statfarad", "statF", 1.112650056e-12),
        ],
        ("F", "µF"),
    ),
    _category(
        "conductance",
        "Electrical conductance",
        _prefixed_units("siemens", "S") + [_unit("mho", "℧")],
        ("S", "mS"),
    ),
    _category(
        "inductance",
        "Inductance",
        _prefixed_units("henry", "H") + [_unit("abhenry", "abH", 1e-9)],
        ("H", "mH"),
    ),
    _category(
        "magnetic-flux",
        "Magnetic flux",
        _prefixed_units("weber", "Wb") + [_unit("maxwell", "Mx", 1e-8)],
        ("Wb", "mWb"),
    ),
    _category(
        "magnetic-field",
        "Magnetic flux density",
        _prefixed_units("tesla", "T") + [_unit("gauss", "G", 1e-4)],
        ("T", "mT"),
    ),
    _category(
        "amount",
        "Amount of substance",
        _prefixed_units("mole", "mol")
        + [_unit("molecule", "molecule", 1 / 6.02214076e23)],
        ("mol", "mmol"),
    ),
    _category(
        "luminous-intensity",
        "Luminous intensity",
        _prefixed_units("candela", "cd") + [_unit("candlepower", "cp", 0.981)],
        ("cd", "mcd"),
    ),
    _category(
        "illuminance",
        "Illuminance",
        _prefixed_units("lux", "lx")
        + [
            _unit("foot-candle", "fc", 10.7639104167),
            _unit("phot", "ph", 10000),
        ],
        ("lx", "fc"),
    ),
    _category(
        "density",
        "Density",
        [
            _unit("kilogram per cubic meter", "kg/m³"),
            _unit("gram per cubic centimeter", "g/cm³", 1000),
            _unit("gram per milliliter", "g/mL", 1000),
            _unit("kilogram per liter", "kg/L", 1000),
            _unit("pound per cubic foot", "lb/ft³", 16.01846337),
            _unit("pound per US gallon", "lb/gal US", 119.8264273),
        ],
        ("kg/m³", "g/cm³"),
    ),
    _category(
        "flow",
        "Volume flow",
        [
            *[
                _unit(
                    f"cubic {prefix_name}meter per second" if prefix_name else "cubic meter per second",
                    f"{prefix_symbol}m³/s",
                    prefix_factor**3,
                )
                for prefix_name, prefix_symbol, prefix_factor in SI_PREFIXES
            ],
            *_prefixed_units("liter per second", "L/s", 1e-3),
            _unit("cubic meter per minute", "m³/min", 1 / 60),
            _unit("cubic meter per hour", "m³/h", 1 / 3600),
            _unit("liter per minute", "L/min", 1e-3 / 60),
            _unit("liter per hour", "L/h", 1e-3 / 3600),
            _unit("US gallon per minute", "gpm US", 0.003785411784 / 60),
            _unit("Imperial gallon per minute", "gpm imp", 0.00454609 / 60),
            _unit("cubic foot per minute", "cfm", 0.028316846592 / 60),
        ],
        ("L/s", "L/min"),
    ),
    _category(
        "fuel",
        "Fuel economy",
        [
            {"name": "kilometer per liter", "symbol": "km/L"},
            {"name": "liter per 100 kilometers", "symbol": "L/100 km"},
            {"name": "mile per US gallon", "symbol": "mpg US"},
            {"name": "mile per Imperial gallon", "symbol": "mpg imp"},
            {"name": "liter per 100 miles", "symbol": "L/100 mi"},
        ],
        ("km/L", "mpg US"),
        "fuel",
    ),
    _category(
        "tip",
        "Tip & percentage",
        [
            _unit("decimal fraction", "ratio"),
            _unit("percent (tip)", "tip %", 0.01),
            _unit("percent", "%", 0.01),
            _unit("permille", "‰", 0.001),
            _unit("basis point", "bp", 0.0001),
            _unit("part per million", "ppm", 1e-6),
            _unit("part per billion", "ppb", 1e-9),
            _unit("part per trillion", "ppt", 1e-12),
        ],
        ("tip %", "ratio"),
    ),
]

CATEGORY_BY_ID = {category["id"]: category for category in CATEGORIES}


def get_categories() -> list[dict[str, Any]]:
    return CATEGORIES


def convert_value(category_id: Any, source_symbol: Any, target_symbol: Any, raw_value: Any) -> float | str:
    if not isinstance(category_id, str) or category_id not in CATEGORY_BY_ID:
        raise ValueError("Choose a valid measurement category.")
    if not isinstance(source_symbol, str) or not isinstance(target_symbol, str):
        raise ValueError("Choose valid units to convert.")
    if isinstance(raw_value, bool):
        raise ValueError("Enter a valid number to convert.")
    try:
        value = float(str(raw_value).strip().replace(",", "."))
    except (TypeError, ValueError) as error:
        raise ValueError("Enter a valid number to convert.") from error
    if not math.isfinite(value):
        raise ValueError("Enter a finite number to convert.")

    category = CATEGORY_BY_ID[category_id]
    units = {unit["symbol"]: unit for unit in category["units"]}
    source = units.get(source_symbol)
    target = units.get(target_symbol)
    if source is None or target is None:
        raise ValueError(f"Choose valid {category['label'].lower()} units.")

    if category["kind"] == "fuel":
        to_base = {
            "km/L": lambda number: math.inf if number == 0 else 100 / number,
            "L/100 km": lambda number: number,
            "mpg US": lambda number: math.inf if number == 0 else 235.214583 / number,
            "mpg imp": lambda number: math.inf if number == 0 else 282.480936 / number,
            "L/100 mi": lambda number: number * 0.621371192237,
        }
        from_base = {
            "km/L": lambda number: math.inf if number == 0 else 100 / number,
            "L/100 km": lambda number: number,
            "mpg US": lambda number: math.inf if number == 0 else 235.214583 / number,
            "mpg imp": lambda number: math.inf if number == 0 else 282.480936 / number,
            "L/100 mi": lambda number: number / 0.621371192237,
        }
        base_value = to_base[source_symbol](value)
        if base_value < 0:
            raise ValueError("Fuel economy cannot be negative.")
        converted = from_base[target_symbol](base_value)
    else:
        base_value = value * source["factor"] + source.get("offset", 0)
        if category["kind"] == "temperature" and base_value < -273.15 - 1e-10:
            raise ValueError("Temperature cannot be below absolute zero.")
        converted = (base_value - target.get("offset", 0)) / target["factor"]
        if category["kind"] == "temperature":
            tolerance = (
                sys.float_info.epsilon
                * max(
                    abs(value * source["factor"]),
                    abs(source.get("offset", 0)),
                    abs(target.get("offset", 0)),
                    1,
                )
                * 4
                / abs(target["factor"])
            )
            if abs(converted) <= tolerance:
                converted = 0.0

    if not math.isfinite(converted):
        return "∞" if converted > 0 else "−∞"
    return converted

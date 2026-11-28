import math
import unittest

from app import app
from graph.graph_solver import CHART_TYPES, analyze_graph
from Unit_Converter.unit_converter import CATEGORIES, convert_value


class PythonToolsTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_unit_converter_catalog_and_api_are_served_from_python(self):
        catalog_response = self.client.get("/unit-converter/data")
        self.assertEqual(catalog_response.status_code, 200)
        categories = catalog_response.get_json()["categories"]
        self.assertEqual(len(categories), len(CATEGORIES))
        self.assertIn("Digital data", [category["label"] for category in categories])

        response = self.client.post(
            "/unit-converter/convert",
            json={
                "category": "length",
                "from": "mi",
                "to": "km",
                "value": "1",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertAlmostEqual(response.get_json()["result"], 1.609344)

    def test_unit_converter_handles_temperature_and_fuel_economy(self):
        self.assertEqual(convert_value("temperature", "°C", "°F", 0), 32)
        self.assertEqual(convert_value("temperature", "°F", "°C", 32), 0)
        self.assertAlmostEqual(
            convert_value("fuel", "mpg US", "L/100 km", 30),
            235.214583 / 30,
        )
        self.assertEqual(convert_value("fuel", "km/L", "L/100 km", 0), "∞")
        with self.assertRaisesRegex(ValueError, "absolute zero"):
            convert_value("temperature", "°C", "°F", -300)

    def test_default_units_in_every_category_are_convertible(self):
        for category in CATEGORIES:
            with self.subTest(category=category["id"]):
                result = convert_value(
                    category["id"],
                    category["defaults"][0],
                    category["defaults"][1],
                    1,
                )
                self.assertTrue(
                    isinstance(result, str) or math.isfinite(result)
                )

    def test_unit_converter_rejects_unknown_units(self):
        response = self.client.post(
            "/unit-converter/convert",
            json={"category": "length", "from": "mile", "to": "km", "value": "1"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("valid length units", response.get_json()["error"])

    def test_python_graph_backend_calculates_statistics_and_svg_for_all_charts(self):
        rows = [
            {"label": "A", "x": 1, "y": 2, "error": 0.1, "size": 5},
            {"label": "B", "x": 2, "y": 3, "error": 0.2, "size": 10},
            {"label": "C", "x": 3, "y": 4, "error": 0.3, "size": 15},
            {"label": "D", "x": 4, "y": 5, "error": 0.4, "size": 20},
        ]
        for chart_type in sorted(CHART_TYPES):
            with self.subTest(chart=chart_type):
                result = analyze_graph(
                    {
                        "type": chart_type,
                        "rows": rows,
                        "title": "Sample chart",
                        "x_label": "X",
                        "y_label": "Y",
                    }
                )
                self.assertEqual(result["statistics"][0]["value"], "4")
                self.assertEqual(result["chart_error"], "")
                self.assertIn("<svg", result["chart_svg"])

    def test_graph_api_reports_statistics_and_chart_errors(self):
        response = self.client.post(
            "/graph/analyze",
            json={
                "type": "pie",
                "rows": [
                    {"label": "A", "y": -1},
                    {"label": "B", "y": 2},
                ],
                "title": "Parts",
                "x_label": "",
                "y_label": "",
            },
        )
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertIn("Sum", [item["label"] for item in result["statistics"]])
        self.assertEqual(result["statistics"][0]["value"], "2")
        self.assertIn("non-negative", result["chart_error"])
        self.assertEqual(result["chart_svg"], "")

    def test_graph_api_rejects_invalid_numeric_input(self):
        response = self.client.post(
            "/graph/analyze",
            json={
                "type": "bar",
                "rows": [{"label": "A", "y": "not a number"}],
                "title": "Data",
                "x_label": "",
                "y_label": "",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("invalid Y value", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()

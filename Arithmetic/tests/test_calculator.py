import unittest

from app import app, normalise_expression


class CalculatorTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_homepage_links_to_the_scientific_calculator(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Math Solver++", response.data)
        self.assertIn(b"Math Solver++ v1.2", response.data)
        self.assertIn(b"PYTHON-POWERED TOOLKIT", response.data)
        self.assertIn(b"All five tools use Python-powered backends", response.data)
        self.assertIn(b"Need help?", response.data)
        self.assertIn(b"/scientific-calculator", response.data)
        self.assertIn(b"/unit-converter/", response.data)
        self.assertIn(b"/algebra/", response.data)
        self.assertIn(b"/graph/", response.data)
        self.assertEqual(response.data.count(b'class="tool-version">v2'), 5)
        self.assertIn(b"style.css", response.data)
        self.assertIn(b"script.js", response.data)
        response.close()

        stylesheet_response = self.client.get("/style.css")
        script_response = self.client.get("/script.js")
        icon_response = self.client.get("/icon.png")
        self.assertEqual(stylesheet_response.status_code, 200)
        self.assertEqual(script_response.status_code, 200)
        self.assertEqual(icon_response.status_code, 200)
        stylesheet_response.close()
        script_response.close()
        icon_response.close()

        calculator_response = self.client.get("/scientific-calculator")
        self.assertEqual(calculator_response.status_code, 200)
        self.assertIn(b"Scientific Calculator", calculator_response.data)
        self.assertIn(b"v2", calculator_response.data)

    def test_help_page_links_to_feedback_and_issue_forms(self):
        response = self.client.get("/help/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Send feedback", response.data)
        self.assertIn(b"Report an issue", response.data)
        self.assertIn(
            b"https://docs.google.com/forms/d/e/1FAIpQLSeIz6iXEIVMGh44CxWef_eSwROrhuPNnoi-VeljPFY4ClNw9g/viewform",
            response.data,
        )
        self.assertIn(
            b"https://docs.google.com/forms/d/e/1FAIpQLScgWbr1MBTYaGzGyRH30ERydo0RcuTAdG3x6fV0iI3GQAoOcA/viewform",
            response.data,
        )
        response.close()

        stylesheet = self.client.get("/help/style.css")
        self.assertEqual(stylesheet.status_code, 200)
        stylesheet.close()

    def test_unit_converter_route_and_assets_are_available(self):
        response = self.client.get("/unit-converter/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"v2", response.data)
        self.assertIn(b"category-tabs", response.data)
        self.assertIn(b"script.js", response.data)
        response.close()

        for asset_path in (
            "/unit-converter/style.css",
            "/unit-converter/script.js",
        ):
            asset_response = self.client.get(asset_path)
            self.assertEqual(asset_response.status_code, 200)
            if asset_path.endswith("script.js"):
                self.assertIn(b"/unit-converter/data", asset_response.data)
            asset_response.close()

    def test_algebra_solver_routes_and_solves_symbolic_equations(self):
        response = self.client.get("/algebra/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"v2", response.data)
        self.assertIn(b"Variables", response.data)
        self.assertIn(b"inputmode=\"none\"", response.data)
        self.assertIn(b"Show algebra graph", response.data)
        self.assertIn(b"Save as PNG", response.data)
        self.assertIn(b"Try a graph shape", response.data)
        response.close()

        for asset_path in ("/algebra/style.css", "/algebra/script.js"):
            asset_response = self.client.get(asset_path)
            self.assertEqual(asset_response.status_code, 200)
            asset_response.close()

        system_response = self.client.post(
            "/algebra/solve",
            json={
                "mode": "solve",
                "equations": ["2x + y = 7", "", "x - y = 2"],
            },
        )
        self.assertEqual(system_response.status_code, 200)
        assignments = system_response.get_json()["solutions"][0]["assignments"]
        self.assertEqual(
            [(item["variable"], item["value"]) for item in assignments],
            [("x", "3"), ("y", "1")],
        )
        system_response.close()

        radical_response = self.client.post(
            "/algebra/solve",
            json={"mode": "solve", "equations": ["x^2 = 2"]},
        )
        self.assertEqual(radical_response.status_code, 200)
        values = {
            solution["assignments"][0]["value"]
            for solution in radical_response.get_json()["solutions"]
        }
        self.assertEqual(values, {"√2", "-√2"})
        radical_response.close()

        periodic_response = self.client.post(
            "/algebra/solve",
            json={"mode": "solve", "equations": ["sin(x) = 0"]},
        )
        self.assertEqual(periodic_response.status_code, 200)
        periodic_result = periodic_response.get_json()
        self.assertIn("complete symbolic solution set", periodic_result["status"])
        self.assertIn(
            "ℤ",
            periodic_result["solutions"][0]["assignments"][0]["value"],
        )
        periodic_response.close()

        fraction_response = self.client.post(
            "/algebra/solve",
            json={"mode": "solve", "equations": ["x / 2 = 1 / 3"]},
        )
        self.assertEqual(fraction_response.status_code, 200)
        fraction_value = fraction_response.get_json()["solutions"][0]["assignments"][0]["value"]
        self.assertEqual(fraction_value, "2/3")
        fraction_response.close()

    def test_algebra_graphs_curves_systems_and_identities(self):
        curve_response = self.client.post(
            "/algebra/graph",
            json={"mode": "solve", "equations": ["x^2 = 4"]},
        )
        self.assertEqual(curve_response.status_code, 200)
        curve = curve_response.get_json()
        self.assertEqual(curve["plot_type"], "function")
        self.assertAlmostEqual(curve["traces"][0]["values"][64], 0)
        self.assertAlmostEqual(curve["traces"][0]["values"][96], 0)
        curve_response.close()

        implicit_response = self.client.post(
            "/algebra/graph",
            json={"mode": "solve", "equations": ["x + y = 5"]},
        )
        self.assertEqual(implicit_response.status_code, 200)
        implicit = implicit_response.get_json()
        self.assertEqual(implicit["plot_type"], "implicit")
        self.assertAlmostEqual(implicit["traces"][0]["grid"][30][20], 0)
        implicit_response.close()

        system_response = self.client.post(
            "/algebra/graph",
            json={
                "mode": "solve",
                "equations": ["x + y = 5", "x - y = 1"],
            },
        )
        self.assertEqual(system_response.status_code, 200)
        self.assertEqual(len(system_response.get_json()["traces"]), 2)
        system_response.close()

        slice_response = self.client.post(
            "/algebra/graph",
            json={"mode": "solve", "equations": ["x + y + z = 1"]},
        )
        self.assertEqual(slice_response.status_code, 200)
        self.assertEqual(
            slice_response.get_json()["slice"],
            [{"variable": "z", "value": "0"}],
        )
        slice_response.close()

        identity_response = self.client.post(
            "/algebra/graph",
            json={"mode": "solve", "equations": ["x + y = x + y"]},
        )
        self.assertEqual(identity_response.status_code, 200)
        identity = identity_response.get_json()["traces"][0]
        self.assertTrue(identity["identity"])
        self.assertEqual(identity["grid"], [])
        identity_response.close()

        expression_response = self.client.post(
            "/algebra/graph",
            json={"mode": "simplify", "expression": "x^2"},
        )
        self.assertEqual(expression_response.status_code, 200)
        expression_graph = expression_response.get_json()
        self.assertEqual(expression_graph["value_type"], "expression")
        self.assertAlmostEqual(expression_graph["traces"][0]["values"][80], 0)
        expression_response.close()

    def test_graph_statistics_route_and_assets_are_available(self):
        response = self.client.get("/graph/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Graphs &amp; statistics", response.data)
        self.assertIn(b"v2", response.data)
        self.assertIn(b"Import CSV", response.data)
        self.assertIn(b"Q-Q plot", response.data)
        self.assertIn(b"Pareto chart", response.data)
        self.assertIn(b"Save chart + stats + table as PNG", response.data)
        self.assertIn(b"Statistics", response.data)
        response.close()

        for asset_path in ("/graph/style.css", "/graph/script.js"):
            asset_response = self.client.get(asset_path)
            self.assertEqual(asset_response.status_code, 200)
            asset_response.close()

    def test_algebra_solver_rejects_unsupported_functions(self):
        response = self.client.post(
            "/algebra/solve",
            json={"mode": "solve", "equations": ["__import__('os')"]},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported algebra function", response.get_json()["error"])
        response.close()

    def test_algebra_goal_is_required_and_recommended(self):
        response = self.client.post(
            "/algebra/solve",
            json={"equations": ["x + 1 = 2"]},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"],
            "Please select what you want to find.",
        )
        self.assertIn("Choose solve variables", response.get_json()["recommendation"])
        response.close()

    def test_algebra_can_evaluate_an_expression_from_a_system(self):
        response = self.client.post(
            "/algebra/solve",
            json={
                "mode": "evaluate",
                "equations": ["x + y = 5", "x - y = 1"],
                "expression": "x^2 + y^2",
            },
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["values"], [{
            "value": "13",
            "free_variables": [],
        }])
        response.close()

        multiple_values = self.client.post(
            "/algebra/solve",
            json={
                "mode": "evaluate",
                "equations": ["x^2 = 2"],
                "expression": "x",
            },
        )
        self.assertEqual(multiple_values.status_code, 200)
        self.assertEqual(
            {item["value"] for item in multiple_values.get_json()["values"]},
            {"√2", "-√2"},
        )
        multiple_values.close()

    def test_algebra_can_simplify_expand_factor_and_collect(self):
        response = self.client.post(
            "/algebra/solve",
            json={
                "mode": "simplify",
                "operation": "expand",
                "expression": "(x + 1)(x + 2)",
            },
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["status"], "Brackets expanded.")
        self.assertIn("3⋅x", response.get_json()["result"])
        response.close()

        cases = [
            ("simplify", "(x + x)/2", "Expression simplified.", "x"),
            ("factor", "x^2 - 1", "Expression factored.", "x - 1"),
            ("collect", "x*y + x*z + y*x", "Like terms collected.", "2⋅y + z"),
            ("collect", "7", "Like terms collected.", "7"),
        ]
        for operation, expression, expected_status, expected_result in cases:
            with self.subTest(operation=operation, expression=expression):
                result = self.client.post(
                    "/algebra/solve",
                    json={
                        "mode": "simplify",
                        "operation": operation,
                        "expression": expression,
                    },
                )
                self.assertEqual(result.status_code, 200, result.get_json())
                self.assertEqual(result.get_json()["status"], expected_status)
                self.assertIn(expected_result, result.get_json()["result"])
                result.close()

        wrong_mode = self.client.post(
            "/algebra/solve",
            json={
                "mode": "simplify",
                "expression": "x = 2",
            },
        )
        self.assertEqual(wrong_mode.status_code, 400)
        self.assertIn("Choose Solve all variables", wrong_mode.get_json()["error"])
        self.assertIn("equations", wrong_mode.get_json()["recommendation"])
        wrong_mode.close()

    def calculate(self, expression, angle="DEG"):
        response = self.client.post(
            "/calculate",
            json={
                "expression": expression,
                "format": "fraction",
                "angle": angle,
            },
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def test_fraction_answer_uses_structured_math_and_reusable_input(self):
        result = self.calculate("sqrt(2)/3")

        self.assertIn("<mfrac>", result["answer_mathml"])
        self.assertIn("<msqrt>", result["answer_mathml"])
        self.assertEqual(result["answer_input"], "sqrt(2)/3")

    def test_calculus_and_statistical_functions_calculate(self):
        derivative = self.calculate("diff2(x^3,x)")
        average = self.calculate("mean(1,2,3)")
        mode = self.calculate("mode(1,2,2,3)")

        self.assertEqual(derivative["answer_input"], "6*x")
        self.assertEqual(average["answer"], "2")
        self.assertEqual(mode["answer"], "2")

    def test_vector_and_complex_functions_calculate(self):
        dot_product = self.calculate("dot(vec(1,2),vec(3,4))")
        complex_sine = self.calculate("complex_sin(90)")

        self.assertEqual(dot_product["answer"], "11")
        self.assertEqual(complex_sine["answer"], "1")

    def test_degree_and_radian_modes_apply_to_angles(self):
        degree_sine = self.calculate("sin(30)", "DEG")
        radian_sine = self.calculate("sin(pi/2)", "RAD")
        vector_angle = self.calculate("angle(vec(1,0),vec(0,1))", "DEG")

        self.assertEqual(degree_sine["answer"], "1/2")
        self.assertEqual(radian_sine["answer"], "1")
        self.assertEqual(vector_angle["answer"], "90")

    def test_base_conversion_returns_symbolic_value_and_numeric_input(self):
        result = self.calculate("to_base(10,2)")

        self.assertEqual(result["answer"], "1010₍2₎")
        self.assertEqual(result["answer_input"], "10")

    def test_digit_suffixed_functions_and_implicit_multiplication(self):
        self.assertEqual(normalise_expression("log10(2)"), "log10(2)")
        self.assertEqual(normalise_expression("2(3)"), "2*(3)")
        self.assertEqual(self.calculate("log10(100)")["answer"], "2")

    def test_floor_and_ceiling_symbol_notation(self):
        self.assertEqual(self.calculate("⌊3/2⌋")["answer"], "1")
        self.assertEqual(self.calculate("⌈3/2⌉")["answer"], "2")


if __name__ == "__main__":
    unittest.main()

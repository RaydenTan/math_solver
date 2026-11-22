import unittest

from app import app, normalise_expression


class CalculatorTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

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

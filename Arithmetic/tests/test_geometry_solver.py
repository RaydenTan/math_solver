import base64
import io
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import cv2
import numpy as np

from app import app
from geometry.geometry_solver import (
    GeometryServiceError,
    _get_ocr_reader,
    analyze_geometry,
    parse_geometry,
)


class GeometrySolverTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_parser_combines_diagram_description_and_question(self):
        parsed = parse_geometry(
            "A triangle is inside a circle.",
            "The circle has radius 5 cm. Find the area of the circle.",
        )

        self.assertEqual(parsed["shape"], "circle")
        self.assertEqual(parsed["goal"], "area")
        self.assertEqual(parsed["measurements"]["radius"], 5)
        self.assertEqual(parsed["unit"], "cm")

    def test_parser_recognizes_common_geometry_symbols_and_latex_notation(self):
        for symbol, shape in (
            ("△", "triangle"),
            (r"$\triangle$", "triangle"),
            (r"\triangle", "triangle"),
            ("○", "circle"),
            ("□", "square"),
        ):
            with self.subTest(symbol=symbol):
                parsed = parse_geometry(symbol, "Find the area.")
                self.assertEqual(parsed["shape"], shape)
                self.assertIn(shape, parsed["shapes"])

        parsed = parse_geometry("△ABC ⊥ line ℓ ∥ m", "Find ∠A.")
        self.assertEqual(parsed["goal"], "angleA")
        self.assertIn("perpendicular", parsed["normalized_text"])
        self.assertIn("parallel", parsed["normalized_text"])
        self.assertIn("degree", parse_geometry("∠A = 45°", "Find ∠A.")["normalized_text"])
        self.assertEqual(parse_geometry("○", "Find π.")["goal"], "pi")

    def test_circle_area_returns_worked_steps_with_the_conclusion_last(self):
        result = analyze_geometry(
            "A triangle is inside a circle.",
            "The circle has radius 5 cm. Find the area of the circle.",
        )

        self.assertTrue(result["ready"])
        self.assertEqual(result["diagram_caption"], "Triangle inside a circle · not to scale")
        self.assertIn("Formula: A = πr².", result["steps"])
        self.assertTrue(result["steps"][-1].startswith("Therefore, circle area = 78.539816 cm²."))
        svg = base64.b64decode(result["diagram_svg"])
        self.assertIn(b"<svg", svg)
        self.assertIn(b"#126e9d", svg)

    def test_right_triangle_uses_pythagorean_theorem(self):
        result = analyze_geometry(
            "A right triangle.",
            "Its legs are 3 and 4 cm. Find the hypotenuse.",
        )

        self.assertTrue(result["ready"])
        self.assertEqual(result["shape"], "rightTriangle")
        self.assertTrue(result["steps"][-1].startswith("Therefore, right triangle hypotenuse = 5 cm."))

    def test_rectangle_and_solid_formulas_use_sympy_results(self):
        examples = (
            (
                "A rectangle.",
                "Its length is 8 cm and width is 3 cm. Find the area.",
                "rectangle area = 24 cm²",
            ),
            (
                "A sphere.",
                "Radius 3 cm. Find its volume.",
                "sphere volume = 113.097336 cm³",
            ),
            (
                "A cuboid.",
                "Dimensions are 2 by 3 by 4 cm. Find the volume.",
                "rectangular prism volume = 24 cm³",
            ),
        )
        for description, question, expected in examples:
            with self.subTest(shape=description):
                result = analyze_geometry(description, question)
                self.assertTrue(result["ready"], result["issue"])
                self.assertIn(expected, result["steps"][-1])

    def test_incomplete_question_returns_a_clarification_not_an_answer(self):
        result = analyze_geometry("A circle next to a triangle.", "Find the area.")

        self.assertFalse(result["ready"])
        self.assertIn("Name the shape", result["issue"])
        self.assertEqual(result["steps"], [])

    def test_photo_contours_detect_nested_common_shapes(self):
        image = np.full((300, 400, 3), 255, dtype=np.uint8)
        cv2.circle(image, (200, 150), 105, (0, 0, 0), 4)
        cv2.polylines(
            image,
            [np.array([[200, 70], [125, 220], [275, 220]], dtype=np.int32)],
            isClosed=True,
            color=(0, 0, 0),
            thickness=4,
        )
        encoded, buffer = cv2.imencode(".png", image)
        self.assertTrue(encoded)

        with patch("geometry.geometry_solver._get_ocr_reader") as reader_factory:
            reader_factory.return_value.readtext.return_value = []
            result = analyze_geometry(
                "A triangle is inside a circle.",
                "The circle radius is 4 cm. Find its area.",
                buffer.tobytes(),
            )

        self.assertIn("Circle", result["detected_shapes"])
        self.assertIn("Triangle", result["detected_shapes"])

    def test_flask_analyze_route_uses_ocr_text_from_uploaded_photo(self):
        image = np.full((300, 400, 3), 255, dtype=np.uint8)
        cv2.circle(image, (200, 150), 105, (0, 0, 0), 4)
        encoded, buffer = cv2.imencode(".png", image)
        self.assertTrue(encoded)

        with patch("geometry.geometry_solver._get_ocr_reader") as reader_factory:
            reader_factory.return_value.readtext.return_value = [
                ([], "Circle radius 5 cm", 0.99)
            ]
            response = self.client.post(
                "/geometry/analyze",
                data={
                    "diagram_description": "A circle.",
                    "question": "Find the area of the circle.",
                    "image": (io.BytesIO(buffer.tobytes()), "geometry.png"),
                },
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertTrue(result["ready"])
        self.assertEqual(result["ocr_text"], "Circle radius 5 cm")
        self.assertIn("radius 5 cm", result["steps"][0])
        response.close()

    def test_ocr_reader_initialization_failure_is_exposed_as_service_error(self):
        mock_easyocr = SimpleNamespace(
            Reader=Mock(side_effect=OSError("model download failed"))
        )
        with patch.dict(sys.modules, {"easyocr": mock_easyocr}):
            with patch("geometry.geometry_solver._OCR_READER", None):
                with self.assertRaisesRegex(
                    GeometryServiceError,
                    "Photo text recognition could not be initialized",
                ):
                    _get_ocr_reader()

    def test_photo_ocr_failure_returns_a_logged_service_error(self):
        image = np.full((100, 100, 3), 255, dtype=np.uint8)
        encoded, buffer = cv2.imencode(".png", image)
        self.assertTrue(encoded)
        reader = Mock()
        reader.readtext.side_effect = RuntimeError("recognizer unavailable")

        with patch("geometry.geometry_solver._get_ocr_reader", return_value=reader):
            response = self.client.post(
                "/geometry/analyze",
                data={
                    "diagram_description": "A circle.",
                    "question": "Find the area.",
                    "image": (io.BytesIO(buffer.tobytes()), "geometry.png"),
                },
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("Photo text recognition failed", response.get_json()["error"])
        response.close()

    def test_flask_serves_geometry_page_and_analyze_route(self):
        page = self.client.get("/geometry/")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"v2", page.data)
        self.assertIn(b"Describe the diagram", page.data)
        page.close()

        for asset in ("/geometry/style.css", "/geometry/script.js"):
            response = self.client.get(asset)
            self.assertEqual(response.status_code, 200)
            response.close()

        response = self.client.post(
            "/geometry/analyze",
            data={
                "diagram_description": "A square.",
                "question": "The side is 4 cm. Find the area of the square.",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["ready"])
        response.close()

    def test_flask_returns_json_for_empty_geometry_request(self):
        response = self.client.post(
            "/geometry/analyze",
            data={},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.get_json())
        response.close()


if __name__ == "__main__":
    unittest.main()

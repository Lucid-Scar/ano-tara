"""Exercise production inference functions without unrelated weather/data startup."""
import ast
import base64
import io
import logging
import unittest
from pathlib import Path
from threading import Lock
from base64 import b64decode
from binascii import Error as Base64Error
import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO
from fastapi import HTTPException
from pydantic import BaseModel, Field

source = Path(__file__).parent / 'app' / 'main.py'
tree = ast.parse(source.read_text(encoding='utf-8'))
names = {'OutfitPayload', 'image_bytes', 'load_outfit_model', '_initialize_outfit_model', 'predict_outfit', 'classify_clothing_weather'}
nodes = []
for node in tree.body:
    if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in names:
        node.decorator_list = []
        nodes.append(node)
    elif isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'CLOTHING_WEATHER_MAP' for t in node.targets):
        nodes.append(node)
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), 'exec'))
MODEL_PATH = source.parent / 'model' / 'best.pt'
model = None
model_state = 'not_initialized'
model_lock = Lock()
inference_lock = Lock()

class WorkflowTests(unittest.TestCase):
    def test_corrupt(self):
        for data in ['invalid!', base64.b64encode(b'not an image').decode()]:
            with self.assertRaises(HTTPException) as caught:
                predict_outfit(OutfitPayload(image_base64=data))
            self.assertEqual(caught.exception.status_code, 422)

    def test_real_weights_and_blank_images(self):
        self.assertTrue(load_outfit_model())
        self.assertEqual(len(model.names), 13)
        for fmt in ['JPEG', 'PNG']:
            buffer = io.BytesIO()
            Image.new('RGB', (128, 128), 'white').save(buffer, format=fmt)
            result = predict_outfit(OutfitPayload(image_base64=base64.b64encode(buffer.getvalue()).decode()))
            self.assertEqual(result['status'], 'error')

    def test_missing_weights(self):
        global MODEL_PATH, model, model_state
        saved = MODEL_PATH, model, model_state
        try:
            MODEL_PATH = source.parent / 'missing-test-weights.pt'
            model, model_state = None, 'not_initialized'
            self.assertFalse(load_outfit_model())
            self.assertEqual(model_state, 'missing')
        finally:
            MODEL_PATH, model, model_state = saved

if __name__ == '__main__':
    unittest.main()

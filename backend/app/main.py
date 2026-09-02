import os
from base64 import b64decode
from binascii import Error as Base64Error
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

os.environ["TF_USE_LEGACY_KERAS"] = "1"

import tensorflow as tf
from PIL import Image
import numpy as np
import requests

app = FastAPI(title="Ano Tara API")
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "keras_model.h5"
LABELS_PATH = BASE_DIR / "model" / "labels.txt"

# 1. Allow the frontend to talk to the backend safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OutfitPayload(BaseModel):
    image_url: str | None = None
    image_base64: str | None = None

# 2. Wake up the AI Brain (This runs once when the server boots)
print("Loading CNN Model... this might take a few seconds...")
model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)

with open(LABELS_PATH, "r", encoding="utf-8") as f:
    class_names = []
    for line in f:
        label = line.strip()
        if not label:
            continue
        parts = label.split(" ", 1)
        class_names.append(parts[1] if len(parts) > 1 else parts[0])


def image_bytes_from_payload(payload: OutfitPayload) -> bytes:
    if payload.image_base64:
        image_data = payload.image_base64
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        try:
            return b64decode(image_data)
        except Base64Error as exc:
            raise ValueError("Invalid base64 image data") from exc

    if payload.image_url:
        response = requests.get(payload.image_url, timeout=20)
        response.raise_for_status()
        return response.content

    raise ValueError("Provide either image_url or image_base64")


def weather_label_for_category(category: str) -> str:
    normalized = category.replace("-", " ").strip().lower()
    if normalized.endswith("weather"):
        normalized = normalized[:-7].strip()
    return f"{normalized.title()} weather"

@app.get("/")
def read_root():
    return {"status": "Ano Tara API is live!"}

@app.post("/predict-outfit")
def predict_outfit(payload: OutfitPayload):
    try:
        image_bytes = image_bytes_from_payload(payload)

        # Step A: Open the image and ensure it is in standard RGB color
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        
        # Step B: Resize to exactly 224x224 pixels (Teachable Machine's strict requirement)
        image = image.resize((224, 224))
        
        # Step C: Translate the visual image into a raw math matrix
        image_array = np.asarray(image)
        # Squish the pixel values from 0-255 down to a range of -1 to 1 so the AI can digest it
        normalized_image_array = (image_array.astype(np.float32) / 127.5) - 1 
        
        # Step D: Prepare the surgical tray and feed it to the model
        data = np.ndarray(shape=(1, 224, 224, 3), dtype=np.float32)
        data[0] = normalized_image_array
        
        # Step E: The Prediction
        prediction_array = model.predict(data)
        
        # Step F: Find the winner
        index = np.argmax(prediction_array)
        detected_category = class_names[index]
        confidence_score = float(prediction_array[0][index])
        weather_suitability = weather_label_for_category(detected_category)
        
        return {
            "status": "success",
            "detected_category": detected_category,
            "weather_suitability": weather_suitability,
            # Convert decimal to a clean percentage string (e.g., 98.5%)
            "confidence_score": f"{round(confidence_score * 100, 1)}%", 
            "message": f"This outfit looks best for {weather_suitability.lower()}."
        }

    except ValueError as e:
        return {
            "status": "error",
            "message": str(e)
        }
    except Exception as e:
        print(f"Error during prediction: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
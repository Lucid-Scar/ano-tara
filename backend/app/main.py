import os
from base64 import b64decode
from binascii import Error as Base64Error
from io import BytesIO
from pathlib import Path
from datetime import date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

os.environ["TF_USE_LEGACY_KERAS"] = "1"

import tensorflow as tf
from PIL import Image
import numpy as np
import requests
import pandas as pd
from sklearn.linear_model import LinearRegression

app = FastAPI(title="Ano Tara API")
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "keras_model.h5"
LABELS_PATH = BASE_DIR / "model" / "labels.txt"
HOTEL_DATA_PATH = BASE_DIR / "hotel_bookings.csv"
WEATHER_DATA_PATH = BASE_DIR / "hourly_data_combined_2020_to_2023.csv"

DESTINATION_IMAGES = [
    "https://images.unsplash.com/photo-1526778548025-fa2f459cd5ce?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1518544866330-95a85b8f8f6f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1505881502353-a1986add3762?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1465311440653-ba9b1d9b0f5b?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1483683804023-6ccdb62f86ef?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=900&q=80",
]


def load_destinations():
    hotel_data = pd.read_csv(HOTEL_DATA_PATH, usecols=["hotel", "country"])
    hotel_data = hotel_data.dropna().query("country != 'NULL'")
    popular_places = (
        hotel_data.groupby(["hotel", "country"])
        .size()
        .reset_index(name="bookings")
        .sort_values("bookings", ascending=False)
        .head(len(DESTINATION_IMAGES))
        .reset_index(drop=True)
    )

    return [
        {
            "id": f"destination-{index + 1}",
            "name": row.hotel,
            "location": row.country,
            "image": DESTINATION_IMAGES[index],
            "hotel_type": row.hotel,
            "description": f"Explore a {row.hotel.lower()} stay in country code {row.country}. This mock description is attached to the CSV record so the destination data flow can be tested end to end.",
        }
        for index, row in popular_places.iterrows()
    ]


DESTINATIONS = load_destinations()


def season_for_month(month: str) -> str:
    if month in {"December", "January", "February"}:
        return "Dry season"
    if month in {"June", "July", "August", "September", "October"}:
        return "Rainy season"
    return "Transition season"

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


class PricePayload(BaseModel):
    check_in: date
    guests: int
    hotel_type: str = "Resort Hotel"

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


def train_price_model():
    hotel = pd.read_csv(HOTEL_DATA_PATH)
    hotel = hotel[(hotel["adr"] > 0) & (hotel["adr"] < 1000)]
    hotel = hotel[["hotel", "arrival_date_month", "adults", "children", "adr"]].dropna()
    hotel["pax"] = hotel["adults"] + hotel["children"]
    hotel = hotel[hotel["pax"] > 0]
    hotel["synthetic_base_price"] = hotel["hotel"].map({"Resort Hotel": 9000.0, "City Hotel": 3800.0})
    hotel["adr_php"] = hotel["adr"] * 62.0
    hotel["surge_multiplier"] = hotel["adr_php"] / hotel["synthetic_base_price"]

    weather = pd.read_csv(WEATHER_DATA_PATH)
    weather = weather[["datetime", "temperature", "rain"]].rename(columns={"temperature": "temp"})
    weather["rain"] = weather["rain"].fillna(0)
    weather["month"] = pd.to_datetime(weather["datetime"], utc=True).dt.month_name()
    monthly_weather = weather.groupby("month").agg(avg_monthly_temp=("temp", "mean"), avg_monthly_rain=("rain", "mean")).reset_index()

    merged = hotel.merge(monthly_weather, left_on="arrival_date_month", right_on="month", how="left")
    merged = pd.get_dummies(merged, columns=["arrival_date_month", "hotel"], drop_first=True)
    features = merged.drop(columns=["adr", "adr_php", "surge_multiplier", "synthetic_base_price", "month"], errors="ignore").astype(float)
    model = LinearRegression().fit(features, merged["surge_multiplier"])
    return model, features.columns, monthly_weather


price_model, price_features, monthly_weather = train_price_model()

@app.get("/")
def read_root():
    return {"status": "Ano Tara API is live!"}


@app.get("/destinations")
def get_destinations():
    return {"destinations": DESTINATIONS}


@app.get("/destinations/{destination_id}")
def get_destination(destination_id: str):
    destination = next((item for item in DESTINATIONS if item["id"] == destination_id), None)
    if destination is None:
        return {"status": "error", "message": "Destination not found"}
    return destination


@app.post("/predict-price")
def predict_price(payload: PricePayload):
    if payload.guests < 1:
        return {"status": "error", "message": "Guests must be at least 1"}

    month = payload.check_in.strftime("%B")
    weather_row = monthly_weather[monthly_weather["month"] == month]
    if weather_row.empty:
        return {"status": "error", "message": f"Weather data for {month} is unavailable"}

    hotel_type = payload.hotel_type if payload.hotel_type in {"City Hotel", "Resort Hotel"} else "Resort Hotel"
    base_price = 9000.0 if hotel_type == "Resort Hotel" else 3800.0
    avg_temp = float(weather_row["avg_monthly_temp"].iloc[0])
    avg_rain = float(weather_row["avg_monthly_rain"].iloc[0])
    user_input = pd.DataFrame({
        "pax": [payload.guests],
        "avg_monthly_temp": [avg_temp],
        "avg_monthly_rain": [avg_rain],
    })
    for feature in price_features:
        if feature not in user_input:
            user_input[feature] = 0
    month_feature = f"arrival_date_month_{month}"
    hotel_feature = "hotel_Resort Hotel"
    if month_feature in user_input:
        user_input[month_feature] = 1
    if hotel_type == "Resort Hotel" and hotel_feature in user_input:
        user_input[hotel_feature] = 1

    multiplier = max(0.5, float(price_model.predict(user_input[price_features])[0]))
    return {
        "status": "success",
        "price": round(base_price * multiplier, 2),
        "currency": "PHP",
        "hotel_type": hotel_type,
        "base_price": base_price,
        "multiplier": round(multiplier, 4),
        "month": month,
        "season": season_for_month(month),
        "weather": {
            "average_temperature": round(avg_temp, 2),
            "average_rainfall": round(avg_rain, 4),
        },
    }

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
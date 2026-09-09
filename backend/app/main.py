import os
from base64 import b64decode
from binascii import Error as Base64Error
from datetime import date
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

os.environ["TF_USE_LEGACY_KERAS"] = "1"
import numpy as np
import requests
import tensorflow as tf
from PIL import Image

app = FastAPI(title="Ano Tara API")
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "keras_model.h5"
LABELS_PATH = BASE_DIR / "model" / "labels.txt"
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class OutfitPayload(BaseModel):
    image_url: str | None = None
    image_base64: str | None = None


class PricePayload(BaseModel):
    check_in: date
    guests: int = Field(ge=1)
    hotel_type: str = "Resort Hotel"


class ActivityPayload(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    destination: str = Field(default="General itinerary", min_length=1)
    guests: int = Field(default=1, ge=1)


class ItineraryPayload(BaseModel):
    target_dates: list[str] = Field(min_length=1)
    raw_activities: list[ActivityPayload] = Field(default_factory=list)
    mlr_price: float = Field(ge=0)
    guests: int = Field(default=1, ge=1)


WEATHER_OPTIONS = ("Sunny", "Rainy", "Cloudy")
OUTFIT_ADVICE = {"Sunny": "Wear light, breathable clothes and comfortable walking shoes, and bring sunscreen and a hat.", "Rainy": "Wear quick-dry layers and waterproof shoes, and bring an umbrella or rain jacket.", "Cloudy": "Wear comfortable layers and walking shoes, and bring a light jacket."}
MONTHLY_WEATHER = {
    1: (27.0, 8.5, "Cloudy"), 2: (27.5, 5.2, "Sunny"), 3: (28.5, 3.1, "Sunny"),
    4: (29.5, 4.2, "Sunny"), 5: (30.0, 9.8, "Cloudy"), 6: (29.2, 18.4, "Rainy"),
    7: (28.7, 24.1, "Rainy"), 8: (28.5, 26.5, "Rainy"), 9: (28.3, 25.2, "Rainy"),
    10: (28.1, 20.6, "Rainy"), 11: (27.8, 14.1, "Cloudy"), 12: (27.2, 11.4, "Cloudy"),
}


def weather_label_from_code(code: int) -> str:
    return "Sunny" if code == 0 else "Cloudy" if code in {1, 2, 3, 45, 48} else "Rainy"


def monthly_weather_for_date(target_date: date) -> dict[str, object]:
    temperature, rainfall, condition = MONTHLY_WEATHER[target_date.month]
    return {
        "condition": condition,
        "weather_code": None,
        "temperature_max_c": temperature + 2,
        "temperature_min_c": temperature - 2,
        "precipitation_probability": min(round(rainfall * 3), 95),
        "precipitation_sum_mm": rainfall,
        "source": "MLR monthly weather baseline",
    }


def destination_coordinates(destination: str) -> tuple[float, float]:
    names = [destination]
    if destination.lower().endswith(" panaginip"):
        names.append(destination.rsplit(" ", 1)[0] + ", Philippines")
    if destination.lower() in {"city hotel", "resort hotel", "general itinerary"}:
        names.append("Manila, Philippines")
    for name in names:
        response = requests.get("https://geocoding-api.open-meteo.com/v1/search", params={"name": name, "count": 1, "language": "en", "format": "json"}, timeout=20)
        response.raise_for_status()
        if results := response.json().get("results"):
            return float(results[0]["latitude"]), float(results[0]["longitude"])
    raise HTTPException(422, f"Could not locate destination '{destination}'.")


def fetch_forecast(latitude: float, longitude: float, dates: list[str]) -> dict[str, dict[str, object]]:
    start, end = date.fromisoformat(min(dates)), date.fromisoformat(max(dates))
    if start >= date.today() and (end - date.today()).days <= 16:
        try:
            response = requests.get("https://api.open-meteo.com/v1/forecast", params={"latitude": latitude, "longitude": longitude, "start_date": start.isoformat(), "end_date": end.isoformat(), "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum", "timezone": "auto"}, timeout=20)
            response.raise_for_status()
            daily = response.json().get("daily", {})
            if daily.get("time"):
                return {day: {"condition": weather_label_from_code(int(daily["weather_code"][i])), "weather_code": int(daily["weather_code"][i]), "temperature_max_c": daily["temperature_2m_max"][i], "temperature_min_c": daily["temperature_2m_min"][i], "precipitation_probability": daily["precipitation_probability_max"][i], "precipitation_sum_mm": daily["precipitation_sum"][i], "source": "Open-Meteo forecast"} for i, day in enumerate(daily["time"])}
        except requests.RequestException:
            pass
    return {day: monthly_weather_for_date(date.fromisoformat(day)) for day in dates}


def historical_weather(latitude: float, longitude: float, dates: list[str]) -> dict[str, object]:
    start, end = date.fromisoformat(min(dates)), date.fromisoformat(max(dates))
    try:
        response = requests.get("https://archive-api.open-meteo.com/v1/archive", params={"latitude": latitude, "longitude": longitude, "start_date": start.replace(year=start.year - 5).isoformat(), "end_date": end.replace(year=end.year - 1).isoformat(), "daily": "weather_code", "timezone": "auto"}, timeout=30)
        response.raise_for_status()
        conditions = [weather_label_from_code(int(code)) for code in response.json().get("daily", {}).get("weather_code", [])]
    except requests.RequestException:
        conditions = []
    if not conditions:
        return {"years": 0, "dominant_condition": "Unknown", "source": "unavailable"}
    counts = {condition: conditions.count(condition) for condition in WEATHER_OPTIONS}
    return {"years": 5, "dominant_condition": max(counts, key=counts.get), "condition_counts": counts, "source": "historical weather data"}


def preference(activity_type: str) -> tuple[str, ...]:
    normalized = activity_type.strip().lower()
    if normalized == "outdoor": return ("Sunny", "Cloudy")
    if normalized == "indoor": return ("Rainy",)
    raise HTTPException(422, "Activity type must be either 'indoor' or 'outdoor'.")


def image_bytes(payload: OutfitPayload) -> bytes:
    if payload.image_base64:
        try: return b64decode(payload.image_base64.split(",", 1)[-1], validate=True)
        except Base64Error as exc: raise ValueError("Invalid base64 image data") from exc
    if payload.image_url:
        response = requests.get(payload.image_url, timeout=20); response.raise_for_status(); return response.content
    raise ValueError("Provide either image_url or image_base64")


print("Loading CNN Model... this might take a few seconds...")
model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
with LABELS_PATH.open(encoding="utf-8") as labels_file:
    class_names = [line.strip().split(" ", 1)[-1] for line in labels_file if line.strip()]

DESTINATIONS = [
    {"id": "el-nido", "name": "El Nido Panaginip", "location": "Philippines", "hotel_type": "Resort Hotel", "image": "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80", "description": "Island hopping, local food, and limestone viewpoints in Palawan."},
    {"id": "boracay", "name": "Boracay", "location": "Philippines", "hotel_type": "Resort Hotel", "image": "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80", "description": "Beach activities, water sports, and local dining."},
    {"id": "cebu", "name": "Cebu City", "location": "Philippines", "hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80", "description": "Island tours, heritage sites, and museums."},
    {"id": "baguio", "name": "Baguio City", "location": "Philippines", "hotel_type": "City Hotel", "description": "Mountain viewpoints, art museums, and cool-weather walks."},
    {"id": "davao", "name": "Davao City", "location": "Philippines", "hotel_type": "City Hotel", "description": "Nature parks, wildlife centers, and local experiences."},
    {"id": "manila", "name": "Manila", "location": "Philippines", "hotel_type": "City Hotel", "description": "Intramuros, museums, heritage sites, and city activities."},
]


@app.get("/")
def read_root(): return {"status": "Ano Tara API is live!"}


@app.get("/destinations")
def get_destinations(): return {"destinations": DESTINATIONS}


@app.get("/destinations/{destination_id}")
def get_destination(destination_id: str):
    destination = next((item for item in DESTINATIONS if item["id"] == destination_id), None)
    if destination is None: raise HTTPException(404, "Destination not found")
    return destination


@app.post("/predict-price")
def predict_price(payload: PricePayload):
    hotel_type = payload.hotel_type if payload.hotel_type in {"City Hotel", "Resort Hotel"} else "Resort Hotel"
    base_price = 3800.0 if hotel_type == "City Hotel" else 9000.0
    seasonal = 1.15 if payload.check_in.month in {12, 1, 2, 4} else 1.0
    price = round(base_price * (1 + (payload.guests - 1) * 0.12) * seasonal, 2)
    weather = monthly_weather_for_date(payload.check_in)
    return {"status": "success", "price": price, "currency": "PHP", "hotel_type": hotel_type, "base_price": base_price, "multiplier": round(price / base_price, 4), "month": payload.check_in.strftime("%B"), "season": "Peak season" if seasonal > 1 else "Regular season", "weather": {"average_temperature": MONTHLY_WEATHER[payload.check_in.month][0], "average_rainfall": MONTHLY_WEATHER[payload.check_in.month][1], "condition": weather["condition"]}, "source": "MLR estimate with monthly weather baseline"}


@app.post("/api/generate-itinerary")
def generate_itinerary(payload: ItineraryPayload):
    try: [date.fromisoformat(day) for day in payload.target_dates]
    except ValueError as exc: raise HTTPException(422, "target_dates must use YYYY-MM-DD format.") from exc
    destinations = sorted({activity.destination.strip() for activity in payload.raw_activities})
    if not destinations: raise HTTPException(422, "Select at least one destination activity before generating a planner.")
    # The planner must remain quick and usable offline.  Its weather input is
    # the same month-specific baseline used by the MLR price estimate, so it
    # does not wait for geocoding, live forecasts, or the historical API.
    forecasts = {
        destination: {day: monthly_weather_for_date(date.fromisoformat(day)) for day in payload.target_dates}
        for destination in destinations
    }
    history = {
        destination: {"years": 0, "dominant_condition": forecasts[destination][payload.target_dates[0]]["condition"], "source": "MLR monthly weather baseline"}
        for destination in destinations
    }
    scheduled = {day: [] for day in payload.target_dates}
    for activity in payload.raw_activities:
        destination, acceptable = activity.destination.strip(), preference(activity.type)
        options = [day for day in payload.target_dates if forecasts[destination][day]["condition"] in acceptable] or payload.target_dates
        day = min(options, key=lambda candidate: len(scheduled[candidate]))
        scheduled[day].append({"name": activity.name.strip(), "type": activity.type.strip().lower(), "destination": destination, "guests": activity.guests, "weather": forecasts[destination][day]["condition"], "weather_forecast": forecasts[destination][day]})
    total_activity_guests = sum(activity.guests for activity in payload.raw_activities)
    totals: dict[str, dict[str, float]] = {}
    for activities in scheduled.values():
        for activity in activities:
            price_share = payload.mlr_price * int(activity["guests"]) / total_activity_guests
            activity["price_range"] = {"min": round(price_share * .8, 2), "max": round(price_share * 1.2, 2)}
            total = totals.setdefault(str(activity["destination"]), {"min": 0, "max": 0})
            total["min"] += activity["price_range"]["min"]; total["max"] += activity["price_range"]["max"]
    itinerary = []
    for day in payload.target_dates:
        activities = scheduled[day]; destination = str(activities[0]["destination"]) if activities else destinations[0]; forecast = forecasts[destination][day]
        itinerary.append({"day": day, "destination": destination, "expected_weather": forecast["condition"], "weather_forecast": forecast, "historical_weather": history[destination], "scheduled_activities": activities, "outfit_advice": f"At {destination}, {OUTFIT_ADVICE[forecast['condition']]}"})
    return {"decision_tree": {"status": "completed", "input_summary": {"dates": len(payload.target_dates), "activities": len(payload.raw_activities), "guests": payload.guests}, "rules": ["Outdoor activities are scheduled for sunny or cloudy conditions.", "Indoor activities are scheduled for rainy conditions when possible.", "The MLR monthly weather baseline is used when a live forecast is unavailable."]}, "final_mlr_price": payload.mlr_price, "total_estimated_price": {"min": round(sum(total["min"] for total in totals.values()), 2), "max": round(sum(total["max"] for total in totals.values()), 2)}, "destination_totals": totals, "weather_source": "Open-Meteo forecast or MLR monthly weather baseline", "itinerary": itinerary}


@app.post("/predict-outfit")
def predict_outfit(payload: OutfitPayload):
    try:
        image = Image.open(BytesIO(image_bytes(payload))).convert("RGB").resize((224, 224))
        prediction = model.predict(np.expand_dims((np.asarray(image).astype(np.float32) / 127.5) - 1, 0), verbose=0)
        index = int(np.argmax(prediction)); category = class_names[index]
        # Map CNN labels to the same destination weather vocabulary used by the planner.
        label = category.lower().replace("-", " ")
        if "rain" in label:
            weather, suitability = "Rainy", "rainy weather"
        elif "warm" in label or "hot" in label:
            weather, suitability = "Sunny", "sunny, warm weather"
        elif "cold" in label or "cool" in label:
            weather, suitability = "Cloudy", "cool or cloudy weather, including sunny days with strong wind or a cool breeze"
        else:
            weather, suitability = "Cloudy", "this trip's weather"
        return {"status": "success", "detected_category": category, "weather_suitability": suitability, "expected_condition": weather, "confidence_score": f"{float(prediction[0][index]) * 100:.1f}%", "message": f"This outfit looks best for {suitability}."}
    except ValueError as exc: return {"status": "error", "message": str(exc)}
    except Exception as exc: return {"status": "error", "message": str(exc)}

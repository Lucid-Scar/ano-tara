import csv
import re
from base64 import b64decode
from binascii import Error as Base64Error
from datetime import date, datetime
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import numpy as np
import requests
from ultralytics import YOLO
import cv2
import base64

app = FastAPI(title="Ano Tara API")
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"
MODEL_PATH = BASE_DIR / "model" / "best.pt"
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class OutfitPayload(BaseModel):
    image_url: str | None = None
    image_base64: str | None = None


class PricePayload(BaseModel):
    check_in: date
    check_out: date
    guests: int
    hotel_type: str
    room_type: str
    destination_id: str | None = None
    destination_name: str | None = None


class ActivityPayload(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    destination: str = Field(default="General itinerary", min_length=1)
    guests: int = Field(default=1, ge=1)
    assigned_day: str | None = None
    time: str | None = None
    hotel_type: str | None = None
    room_type: str = "Standard Room"


class ItineraryPayload(BaseModel):
    target_dates: list[str] = Field(min_length=1)
    raw_activities: list[ActivityPayload] = Field(default_factory=list)
    mlr_price: float = Field(ge=0)
    guests: int = Field(default=1, ge=1)
    outfit: dict | None = None


WEATHER_OPTIONS = ("Sunny", "Rainy", "Cloudy")
OUTFIT_ADVICE = {"Sunny": "Wear light, breathable clothes and comfortable walking shoes, and bring sunscreen and a hat.", "Rainy": "Wear quick-dry layers and waterproof shoes, and bring an umbrella or rain jacket.", "Cloudy": "Wear comfortable layers and walking shoes, and bring a light jacket."}
MONTHLY_WEATHER = {
    1: (27.0, 8.5, "Cloudy"), 2: (27.5, 5.2, "Sunny"), 3: (28.5, 3.1, "Sunny"),
    4: (29.5, 4.2, "Sunny"), 5: (30.0, 9.8, "Cloudy"), 6: (29.2, 18.4, "Rainy"),
    7: (28.7, 24.1, "Rainy"), 8: (28.5, 26.5, "Rainy"), 9: (28.3, 25.2, "Rainy"),
    10: (28.1, 20.6, "Rainy"), 11: (27.8, 14.1, "Cloudy"), 12: (27.2, 11.4, "Cloudy"),
}

DEFAULT_BASE_PRICES = {"City Hotel": 6625.63, "Resort Hotel": 5999.72}

# Load the trained unified MLR bundle once when the API starts.
PRICE_MODEL_PATH = BASE_DIR / "model" / "price_model_bundle.joblib"
try:
    PRICE_MODEL_BUNDLE = joblib.load(PRICE_MODEL_PATH)
except (FileNotFoundError, ImportError, ValueError):
    PRICE_MODEL_BUNDLE = None

BASE_PRICES = (
    PRICE_MODEL_BUNDLE.get("base_prices", DEFAULT_BASE_PRICES)
    if PRICE_MODEL_BUNDLE
    else DEFAULT_BASE_PRICES
)

# Load the NEW trained Weather Decision Tree
WEATHER_MODEL_PATH = BASE_DIR / "model" / "weather_decision_tree.joblib"
try:
    WEATHER_DECISION_TREE = joblib.load(WEATHER_MODEL_PATH)
except (FileNotFoundError, ImportError, ValueError):
    WEATHER_DECISION_TREE = None


def predict_mlr_price(
    check_in: date,
    guests: int,
    hotel_type: str,
    length_of_stay: int,
    room_type: str,
) -> tuple[float, float, dict]:
    bundle = PRICE_MODEL_BUNDLE
    if bundle is None:
        raise RuntimeError("The trained price model bundle is unavailable.")
    weather_table = bundle["monthly_weather"]
    weather_row = weather_table.loc[weather_table["month"] == check_in.strftime("%B")]
    if weather_row.empty:
        raise RuntimeError("No monthly weather baseline exists for this date.")

    base_price = float(bundle["base_prices"][hotel_type])
    pax = float(guests)
    lead_time = max(0, (check_in - datetime.now().date()).days)
    is_weekend = float(check_in.weekday() in {4, 5, 6})
    is_resort = float(hotel_type == "Resort Hotel")
    model_input = pd.DataFrame({
        "pax": [pax],
        "lead_time": [float(lead_time)],
        "length_of_stay": [float(length_of_stay)],
        "is_premium_room": [float(room_type != "Standard Room")],
        "is_weekend": [is_weekend],
        "pax_squared": [pax ** 2],
        "avg_monthly_temp": [avg_temp],
        "avg_monthly_rain": [avg_rain],
        "hotel_is_resort": [is_resort],
        "hotel_temp": [is_resort * avg_temp],
        "hotel_rain": [is_resort * avg_rain],
        "hotel_pax": [is_resort * pax],
    })

    for feature in bundle["features"]:
        if feature not in model_input:
            model_input[feature] = 0.0
    month_feature = f"arrival_date_month_{check_in.strftime('%B')}"
    if month_feature in model_input:
        model_input[month_feature] = 1.0
    model_input = model_input[bundle["features"]].astype(float)

    predicted_log_multiplier = float(bundle["model"].predict(model_input)[0])
    multiplier = max(1.0, float(np.exp(predicted_log_multiplier)))
    price = round(base_price * multiplier, 2)

    return price, multiplier, {}


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
        "wind_speed_kmh": 12.0,
        "source": "MLR monthly weather baseline",
    }


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


CLOTHING_WEATHER_MAP = {
    "kaos": {"conditions": ["Sunny"], "phrase": "sunny, warm weather", "primary": "Sunny"},
    "kemeja": {"conditions": ["Sunny"], "phrase": "sunny, warm weather", "primary": "Sunny"},
    "polo": {"conditions": ["Sunny"], "phrase": "sunny, warm weather", "primary": "Sunny"},
    "celana pendek": {"conditions": ["Sunny"], "phrase": "sunny, warm weather", "primary": "Sunny"},
    "gaun": {"conditions": ["Sunny"], "phrase": "sunny, warm weather", "primary": "Sunny"},
    "rok": {"conditions": ["Sunny"], "phrase": "sunny, warm weather", "primary": "Sunny"},
    "hoodie": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
    "sweater": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
    "jaket": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
    "jaket denim": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
    "jaket olahraga": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
    "mantel": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
    "blazer": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
    "celana panjang": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
    "jeans": {"conditions": ["Cloudy", "Rainy"], "phrase": "cool, cloudy, or rainy weather", "primary": "Cloudy"},
}


def classify_clothing_weather(category: str) -> dict[str, object]:
    normalized = category.strip().lower().replace("-", " ").replace("_", " ")
    mapping = CLOTHING_WEATHER_MAP.get(normalized)
    if mapping:
        return mapping
        
    fallbacks = {
        "kaos": CLOTHING_WEATHER_MAP["kaos"],
        "kemeja": CLOTHING_WEATHER_MAP["kemeja"],
        "polo": CLOTHING_WEATHER_MAP["polo"],
        "celana pendek": CLOTHING_WEATHER_MAP["celana pendek"],
        "gaun": CLOTHING_WEATHER_MAP["gaun"],
        "rok": CLOTHING_WEATHER_MAP["rok"],
        "hoodie": CLOTHING_WEATHER_MAP["hoodie"],
        "sweater": CLOTHING_WEATHER_MAP["sweater"],
        "jaket": CLOTHING_WEATHER_MAP["jaket"],
        "jaket denim": CLOTHING_WEATHER_MAP["jaket denim"],
        "jaket olahraga": CLOTHING_WEATHER_MAP["jaket olahraga"],
        "mantel": CLOTHING_WEATHER_MAP["mantel"],
        "blazer": CLOTHING_WEATHER_MAP["blazer"],
        "celana panjang": CLOTHING_WEATHER_MAP["celana panjang"],
        "jeans": CLOTHING_WEATHER_MAP["jeans"],
    }
    return fallbacks.get(normalized, {"conditions": ["Cloudy"], "phrase": "mild or unpredictable conditions", "primary": "Cloudy"})

DESTINATION_METADATA = {
    "Baguio": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80", "description": "The Summer Capital of the Philippines known for cool pine-scented breezes."},
    "Cebu City": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80", "description": "The Queen City of the South blending rich historical Spanish landmarks."},
    "Davao": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80", "description": "The King City of the South renowned for majestic Mount Apo."},
    "Manila": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1518544866330-95a85b8f8f6f?auto=format&fit=crop&w=1200&q=80", "description": "The historic capital featuring Intramuros walled city."},
    "Puerto Princesa City": {"hotel_type": "Resort Hotel", "image": "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80", "description": "The eco-tourism haven of Palawan, home to the Subterranean River."},
    "Tagaytay City": {"hotel_type": "Resort Hotel", "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80", "description": "A picturesque mountain ridge getaway offering breathtaking panoramic views."},
    "Alaminos": {"hotel_type": "Resort Hotel", "image": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80", "description": "Gateway to the iconic Hundred Islands National Park."},
    "Iloilo City": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80", "description": "The City of Love celebrated for heritage mansions."},
    "Bacolod": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=1200&q=80", "description": "The City of Smiles known for the iconic Ruins."},
    "Vigan": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80", "description": "A UNESCO World Heritage city showcasing Spanish colonial architecture."},
    "Legazpi City": {"hotel_type": "Resort Hotel", "image": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80", "description": "The adventure capital of Bicol with front-row vistas of Mayon Volcano."},
    "Dumaguete": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80", "description": "The City of Gentle People featuring breezy coastal boulevards."},
    "Zamboanga City": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80", "description": "The vibrant Asia Latin City known for pink sand beaches."},
    "Laoag": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80", "description": "The Sunshine City of Ilocos Norte boasting sprawling sand dunes."},
    "Batangas City": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1470214304380-aadaedcfff0b?auto=format&fit=crop&w=1200&q=80", "description": "An industrial and cultural port city rich in Southern Tagalog history."},
    "Angeles City": {"hotel_type": "City Hotel", "image": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80", "description": "The culinary capital of Pampanga offering heritage mansions."},
}

CURATED_IMAGES = [
    "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80",
]


def load_destinations() -> list[dict]:
    dest_path = DATA_DIR / "destinations.csv"
    act_path = DATA_DIR / "activities.csv"
    acts_by_dest: dict[str, list[dict]] = {}
    if act_path.exists():
        with act_path.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                act_type = row["activity_type"].strip().lower()
                dest_name = row["destination"]
                existing = acts_by_dest.setdefault(dest_name, [])
                if not any(a["type"] == act_type for a in existing):
                    existing.append({
                        "name": row["activity_name"],
                        "type": act_type,
                        "hotel_type": "Resort Hotel" if act_type == "outdoor" else "City Hotel",
                        "duration_hours": int(row.get("duration_hours", 4 if act_type == "outdoor" else 3)),
                    })
    destinations = []
    if dest_path.exists():
        with dest_path.open(encoding="utf-8") as f:
            for idx, row in enumerate(csv.DictReader(f)):
                name = row["destination"]
                meta = DESTINATION_METADATA.get(name, {})
                image = meta.get("image", CURATED_IMAGES[idx % len(CURATED_IMAGES)])
                desc = meta.get("description", f"Discover scenic attractions, cultural landmarks, and local experiences in {name}.")
                dest_acts = acts_by_dest.get(name, [])
                
                outdoor = next((a for a in dest_acts if a["type"] == "outdoor"), {
                    "name": f"{name} scenic landmarks & nature park tour",
                    "type": "outdoor",
                    "hotel_type": "Resort Hotel",
                    "duration_hours": 4,
                })
                indoor = next((a for a in dest_acts if a["type"] == "indoor"), {
                    "name": f"{name} cultural heritage museum & culinary tasting",
                    "type": "indoor",
                    "hotel_type": "City Hotel",
                    "duration_hours": 3,
                })

                is_cold = bool(re.search(r"baguio|tagaytay|malaybalay|canlaon|bontoc|sagada", name, re.I))
                outdoor["weather_tag"] = "Cold" if is_cold else "Sunny"
                indoor["weather_tag"] = "Cold" if is_cold else "Rainy"

                destinations.append({
                    "id": slugify(name),
                    "name": name,
                    "location": name,
                    "country": row.get("country", "Philippines"),
                    "hotel_type": meta.get("hotel_type", "City Hotel"),
                    "base_price": BASE_PRICES[meta.get("hotel_type", "City Hotel")],
                    "base_prices": BASE_PRICES,
                    "latitude": float(row["latitude"]),
                    "longitude": float(row["longitude"]),
                    "main_weather": "Cold" if is_cold else row.get("main_weather", "Cloudy"),
                    "image": image,
                    "description": desc,
                    "activities": [outdoor, indoor],
                })
    return destinations


DESTINATIONS = load_destinations()
DESTINATION_COORDINATES = {d["name"].lower(): (d["latitude"], d["longitude"]) for d in DESTINATIONS}
for d in DESTINATIONS:
    DESTINATION_COORDINATES[d["id"]] = (d["latitude"], d["longitude"])


def destination_coordinates(destination: str) -> tuple[float, float]:
    key = destination.strip().lower()
    if key in DESTINATION_COORDINATES:
        return DESTINATION_COORDINATES[key]
    if key.endswith(" city") and key[:-5] in DESTINATION_COORDINATES:
        return DESTINATION_COORDINATES[key[:-5]]
    if f"{key} city" in DESTINATION_COORDINATES:
        return DESTINATION_COORDINATES[f"{key} city"]
    if key in {"city hotel", "resort hotel", "general itinerary"}:
        return DESTINATION_COORDINATES.get("manila", (14.6042, 120.9822))
    names = [destination, destination + ", Philippines"]
    for name in names:
        try:
            response = requests.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": name, "count": 1, "language": "en", "format": "json"},
                timeout=20,
            )
            response.raise_for_status()
            if results := response.json().get("results"):
                return float(results[0]["latitude"]), float(results[0]["longitude"])
        except Exception:
            pass
    raise HTTPException(422, f"Could not locate destination '{destination}'.")

WEATHER_CACHE: dict[str, dict] = {}
FORECAST_WINDOW_CACHE: dict[str, dict] = {}

def fetch_forecast(latitude: float, longitude: float, dates: list[str]) -> dict[str, dict[str, object]]:
    results: dict[str, dict[str, object]] = {}
    today = date.today()
    forecast_dates = {
        day_str for day_str in dates
        if 0 <= (date.fromisoformat(day_str) - today).days <= 16
    }
    forecast_cache_key = f"fc_window_{today.isoformat()}_{latitude:.4f}_{longitude:.4f}"
    live_daily = FORECAST_WINDOW_CACHE.get(forecast_cache_key)

    if forecast_dates and live_daily is None:
        try:
            response = requests.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "forecast_days": 16,
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max,apparent_temperature_max",
                    "timezone": "Asia/Manila",
                },
                timeout=12,
            )
            if response.status_code == 200:
                live_daily = response.json().get("daily", {})
                if live_daily.get("time"):
                    FORECAST_WINDOW_CACHE[forecast_cache_key] = live_daily
        except Exception as exc:
            print(f"Open-Meteo live forecast error: {exc}")

    for day_str in dates:
        cache_key = f"fc_{latitude:.4f}_{longitude:.4f}_{day_str}"
        if cache_key in WEATHER_CACHE:
            results[day_str] = WEATHER_CACHE[cache_key]
            continue

        target_date = date.fromisoformat(day_str)
        days_diff = (target_date - today).days
        day_forecast = None

        if 0 <= days_diff <= 16:
            try:
                if live_daily is not None:
                    daily = live_daily
                    time_list = daily.get("time", [])
                    if day_str in time_list:
                        i = time_list.index(day_str)
                        w_code = int(daily["weather_code"][i])
                        t_max = round(float(daily["temperature_2m_max"][i]), 1)
                        t_min = round(float(daily["temperature_2m_min"][i]), 1)
                        heat_idx = round(float(daily["apparent_temperature_max"][i]), 1) if daily.get("apparent_temperature_max") and daily["apparent_temperature_max"][i] is not None else t_max + 4.0
                        p_prob = int(daily["precipitation_probability_max"][i]) if daily.get("precipitation_probability_max") and daily["precipitation_probability_max"][i] is not None else (90 if weather_label_from_code(w_code) == "Rainy" else 20)
                        p_sum = round(float(daily["precipitation_sum"][i]), 1) if daily.get("precipitation_sum") and daily["precipitation_sum"][i] is not None else 0.0
                        w_speed = round(float(daily["windspeed_10m_max"][i]), 1) if daily.get("windspeed_10m_max") and daily["windspeed_10m_max"][i] is not None else 12.0
                        
                        day_forecast = {
                            "condition": weather_label_from_code(w_code),
                            "weather_code": w_code,
                            "temperature_max_c": t_max,
                            "temperature_min_c": t_min,
                            "average_temperature": round((t_max + t_min) / 2, 1),
                            "apparent_temperature_max": heat_idx,
                            "precipitation_probability": p_prob,
                            "precipitation_sum_mm": p_sum,
                            "wind_speed_kmh": w_speed,
                            "source": "Open-Meteo live forecast",
                        }
            except Exception as exc:
                print(f"Open-Meteo live forecast error: {exc}")

        elif days_diff < 0:
            try:
                response = requests.get(
                    "https://archive-api.open-meteo.com/v1/archive",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "start_date": day_str,
                        "end_date": day_str,
                        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max",
                        "timezone": "Asia/Manila",
                    },
                    timeout=12,
                )
                if response.status_code == 200:
                    daily = response.json().get("daily", {})
                    if daily.get("time"):
                        w_code = int(daily["weather_code"][0])
                        t_max = round(float(daily["temperature_2m_max"][0]), 1)
                        t_min = round(float(daily["temperature_2m_min"][0]), 1)
                        heat_idx = round(float(daily["apparent_temperature_max"][0]), 1) if daily.get("apparent_temperature_max") and daily["apparent_temperature_max"][0] is not None else t_max + 4.0
                        p_sum = round(float(daily["precipitation_sum"][0]), 1) if daily.get("precipitation_sum") and daily["precipitation_sum"][0] is not None else 0.0
                        w_speed = round(float(daily["windspeed_10m_max"][0]), 1) if daily.get("windspeed_10m_max") and daily["windspeed_10m_max"][0] is not None else 12.0
                        
                        day_forecast = {
                            "condition": weather_label_from_code(w_code),
                            "weather_code": w_code,
                            "temperature_max_c": t_max,
                            "temperature_min_c": t_min,
                            "average_temperature": round((t_max + t_min) / 2, 1),
                            "apparent_temperature_max": heat_idx,
                            "precipitation_probability": 85 if weather_label_from_code(w_code) == "Rainy" else 15,
                            "precipitation_sum_mm": p_sum,
                            "wind_speed_kmh": w_speed,
                            "source": "Open-Meteo archive data",
                        }
            except Exception as exc:
                print(f"Open-Meteo archive past error: {exc}")

        if day_forecast is None and days_diff > 16:
            try:
                hist_start = target_date.replace(year=today.year - 5)
                hist_end = target_date.replace(year=today.year - 1)
                response = requests.get(
                    "https://archive-api.open-meteo.com/v1/archive",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "start_date": hist_start.isoformat(),
                        "end_date": hist_end.isoformat(),
                        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max",
                        "timezone": "Asia/Manila",
                    },
                    timeout=12,
                )
                if response.status_code == 200:
                    daily = response.json().get("daily", {})
                    matches = [
                        idx for idx, t in enumerate(daily.get("time", []))
                        if t.endswith(f"-{target_date.month:02d}-{target_date.day:02d}")
                    ]
                    if matches:
                        codes = [daily["weather_code"][idx] for idx in matches if daily["weather_code"][idx] is not None]
                        rains = [daily["precipitation_sum"][idx] for idx in matches if daily.get("precipitation_sum") and daily["precipitation_sum"][idx] is not None]
                        t_maxs = [daily["temperature_2m_max"][idx] for idx in matches if daily["temperature_2m_max"][idx] is not None]
                        t_mins = [daily["temperature_2m_min"][idx] for idx in matches if daily["temperature_2m_min"][idx] is not None]
                        w_speeds = [daily["windspeed_10m_max"][idx] for idx in matches if daily.get("windspeed_10m_max") and daily["windspeed_10m_max"][idx] is not None]
                        heat_idxs = [daily["apparent_temperature_max"][idx] for idx in matches if daily.get("apparent_temperature_max") and daily["apparent_temperature_max"][idx] is not None]
                        
                        cond_counts = {c: [weather_label_from_code(code) for code in codes].count(c) for c in WEATHER_OPTIONS}
                        dom_cond = max(cond_counts, key=cond_counts.get) if codes else "Sunny"
                        avg_rain = round(sum(rains) / len(rains), 1) if rains else round(MONTHLY_WEATHER[target_date.month][1], 1)
                        avg_max = round(sum(t_maxs) / len(t_maxs), 1) if t_maxs else (MONTHLY_WEATHER[target_date.month][0] + 2)
                        avg_min = round(sum(t_mins) / len(t_mins), 1) if t_mins else (MONTHLY_WEATHER[target_date.month][0] - 2)
                        avg_wind = round(sum(w_speeds) / len(w_speeds), 1) if w_speeds else 12.0
                        avg_heat = round(sum(heat_idxs) / len(heat_idxs), 1) if heat_idxs else avg_max + 4.0
                        
                        day_forecast = {
                            "condition": dom_cond,
                            "weather_code": codes[0] if codes else 0,
                            "temperature_max_c": avg_max,
                            "temperature_min_c": avg_min,
                            "average_temperature": round((avg_max + avg_min) / 2, 1),
                            "apparent_temperature_max": avg_heat,
                            "precipitation_probability": min(round(avg_rain * 4), 95),
                            "precipitation_sum_mm": avg_rain,
                            "wind_speed_kmh": avg_wind,
                            "source": "Open-Meteo multi-year climate forecast",
                        }
            except Exception as exc:
                print(f"Open-Meteo future climate error: {exc}")

        if day_forecast is None:
            day_forecast = monthly_weather_for_date(target_date)
            day_forecast["apparent_temperature_max"] = day_forecast["temperature_max_c"] + 4.0
            day_forecast["source"] = "MLR monthly weather baseline (offline fallback)"

        WEATHER_CACHE[cache_key] = day_forecast
        results[day_str] = day_forecast

    return results


def historical_weather(latitude: float, longitude: float, dates: list[str]) -> dict[str, object]:
    start = date.fromisoformat(min(dates))
    today = date.today()
    cache_key = f"hist_{latitude:.4f}_{longitude:.4f}_{start.month}_{start.day}"
    if cache_key in WEATHER_CACHE:
        return WEATHER_CACHE[cache_key]

    try:
        hist_start = start.replace(year=today.year - 5)
        hist_end = start.replace(year=today.year - 1)
        response = requests.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "start_date": hist_start.isoformat(),
                "end_date": hist_end.isoformat(),
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
                "timezone": "Asia/Manila",
            },
            timeout=15,
        )
        if response.status_code == 200:
            daily = response.json().get("daily", {})
            matches = [
                idx for idx, t in enumerate(daily.get("time", []))
                if t.endswith(f"-{start.month:02d}-{start.day:02d}")
            ]
            if not matches:
                matches = [
                    idx for idx, t in enumerate(daily.get("time", []))
                    if f"-{start.month:02d}-" in t
                ]
            if matches:
                codes = [daily["weather_code"][idx] for idx in matches if daily["weather_code"][idx] is not None]
                rains = [daily["precipitation_sum"][idx] for idx in matches if daily.get("precipitation_sum") and daily["precipitation_sum"][idx] is not None]
                t_maxs = [daily["temperature_2m_max"][idx] for idx in matches if daily["temperature_2m_max"][idx] is not None]
                t_mins = [daily["temperature_2m_min"][idx] for idx in matches if daily["temperature_2m_min"][idx] is not None]
                
                conditions = [weather_label_from_code(int(code)) for code in codes]
                counts = {cond: conditions.count(cond) for cond in WEATHER_OPTIONS}
                dominant = max(counts, key=counts.get) if counts else "Cloudy"
                avg_rain = round(sum(rains) / len(rains), 1) if rains else round(MONTHLY_WEATHER[start.month][1], 1)
                avg_temp = round((sum(t_maxs) + sum(t_mins)) / (len(t_maxs) + len(t_mins)), 1) if (t_maxs and t_mins) else MONTHLY_WEATHER[start.month][0]
                
                hist_result = {
                    "years": 5,
                    "dominant_condition": dominant,
                    "average_rainfall_mm": avg_rain,
                    "average_temperature_c": avg_temp,
                    "condition_counts": counts,
                    "source": "Open-Meteo 5-year archive",
                }
                WEATHER_CACHE[cache_key] = hist_result
                return hist_result
    except Exception as exc:
        print(f"Open-Meteo 5-year historical archive error: {exc}")

    temp, rain, cond = MONTHLY_WEATHER[start.month]
    hist_result = {
        "years": 5,
        "dominant_condition": cond,
        "average_rainfall_mm": rain,
        "average_temperature_c": temp,
        "condition_counts": {cond: 5},
        "source": "MLR historical baseline (offline fallback)",
    }
    WEATHER_CACHE[cache_key] = hist_result
    return hist_result


def build_weather_comparison(forecast: dict, historical: dict) -> dict:
    fc_rain = float(forecast.get("precipitation_sum_mm", 0.0))
    hist_rain = float(historical.get("average_rainfall_mm", 0.0))
    diff_rain = round(fc_rain - hist_rain, 1)
    diff_pct = round(((fc_rain - hist_rain) / hist_rain) * 100) if hist_rain > 0 else 0

    if diff_rain < 0:
        summary = f"Predicted rain ({fc_rain} mm) is {abs(diff_pct)}% lower than the 5-year historical average ({hist_rain} mm). Conditions are drier than historical trends, making outdoor activities favorable."
    elif diff_rain > 0:
        summary = f"Predicted rain ({fc_rain} mm) is {diff_pct}% higher than the 5-year historical average ({hist_rain} mm). Elevated precipitation expected; indoor activities are recommended."
    else:
        summary = f"Predicted rain ({fc_rain} mm) matches the 5-year historical average ({hist_rain} mm)."

    return {
        "forecast_rain_mm": fc_rain,
        "historical_rain_mm": hist_rain,
        "rain_difference_mm": diff_rain,
        "rain_difference_percent": diff_pct,
        "summary": summary,
    }


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

model = None

def load_outfit_model() -> bool:
    global model
    if model is not None:
        return True
    if not MODEL_PATH.is_file():
        return False
    try:
        print("Loading YOLOv8 Model... this might take a few seconds...")
        model = YOLO(str(MODEL_PATH))
        return True
    except Exception as error:
        print(f"YOLOv8 model unavailable; outfit prediction is disabled: {error}")
        return False

@app.post("/predict-outfit")
def predict_outfit(payload: OutfitPayload):
    if not load_outfit_model():
        raise HTTPException(status_code=503, detail="Outfit prediction is unavailable because the YOLO model could not be loaded.")
    
    try:
        # Load image bytes into an OpenCV numpy array
        image_data = np.frombuffer(image_bytes(payload), np.uint8)
        img = cv2.imdecode(image_data, cv2.IMREAD_COLOR)

        # Run YOLO inference
        results = model.predict(img, conf=0.25, verbose=False)
        result = results[0] # Get the first (and only) image result

        if len(result.boxes) == 0:
            return {
                "status": "error", 
                "message": "No clothing detected. Please ensure the clothing is clearly visible."
            }

        detected_items = []
        
        # Iterate over all detected bounding boxes
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            confidence = float(box.conf[0])
            class_index = int(box.cls[0])
            category = result.names[class_index]
            
            # Crop the bounding box from the original image
            cropped_img = img[y1:y2, x1:x2]
            
            # Encode the cropped image to base64
            _, buffer = cv2.imencode('.jpg', cropped_img)
            cropped_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
            
            # Classify the cropped image's weather suitability
            weather_match = classify_clothing_weather(category)
            
            detected_items.append({
                "category": category,
                "confidence_score": f"{confidence * 100:.1f}%",
                "weather_suitability": weather_match["phrase"],
                "expected_condition": weather_match["primary"],
                "conditions": weather_match["conditions"],
                "cropped_image": cropped_base64
            })

        return {
            "status": "success",
            "message": f"Successfully detected {len(detected_items)} items of clothing.",
            "items": detected_items
        }

    except Exception as exc: 
        return {"status": "error", "message": str(exc)}

@app.get("/")
def read_root(): return {"status": "Ano Tara API is live!"}


@app.get("/destinations")
def get_destinations(): return {"destinations": DESTINATIONS}


@app.get("/destinations/{destination_id}")
def get_destination(destination_id: str):
    destination = next((item for item in DESTINATIONS if item["id"] == destination_id), None)
    if destination is None: raise HTTPException(404, "Destination not found")
    return destination


@app.get("/destinations/{destination_id}/forecast")
def get_destination_forecast(destination_id: str, date_str: str | None = None):
    destination = next((item for item in DESTINATIONS if item["id"] == destination_id or item["name"].lower() == destination_id.lower()), None)
    if destination is None:
        raise HTTPException(404, "Destination not found")

    target_date = date_str or date.today().isoformat()
    lat, lon = destination["latitude"], destination["longitude"]
    
    fc_map = fetch_forecast(lat, lon, [target_date])
    fc = fc_map[target_date]
    hist = historical_weather(lat, lon, [target_date])
    comparison = build_weather_comparison(fc, hist)
    
    # NEW MACHINE LEARNING ROUTING (5-feature binary Decision Tree):
    if WEATHER_DECISION_TREE:
        avg_temp = float(fc.get('average_temperature', 28.0))
        precip = float(fc.get('precipitation_sum_mm', 0.0))
        wind = float(fc.get('wind_speed_kmh', 12.0))
        heat_idx = float(fc.get('apparent_temperature_max', avg_temp + 4.0))
        
        features_df = pd.DataFrame([[avg_temp, precip, wind, heat_idx, 1]], columns=['average_temperature_c', 'precipitation_mm', 'wind_speed_kmh', 'heat_index_c', 'hotel_is_resort'])
        prediction = int(WEATHER_DECISION_TREE.predict(features_df)[0])
        # Model outputs: 1 = Safe / Suitable, 0 = Unsafe / Hazardous
        is_outdoor_friendly = (prediction == 1)
    else:
        is_outdoor_friendly = fc["condition"] in {"Sunny", "Cloudy"}

    rec_type = "outdoor" if is_outdoor_friendly else "indoor"
    rec_reason = (
        f"Today's forecast in {destination['name']} is {fc['condition']} ({fc['average_temperature']}°C, {fc['precipitation_sum_mm']} mm rain) — outdoor activities are highly recommended!"
        if is_outdoor_friendly else
        f"Rain is forecasted in {destination['name']} ({fc['precipitation_sum_mm']} mm rain, {fc['precipitation_probability']}% chance) — indoor cultural and culinary experiences are recommended for comfort and safety."
    )

    tagged_activities = []
    for act in destination.get("activities", []):
        act_type = act["type"].strip().lower()
        is_rec = (act_type == "outdoor" and is_outdoor_friendly) or (act_type == "indoor" and not is_outdoor_friendly)
        tagged_activities.append({
            **act,
            "hotel_type": "Resort Hotel" if act_type == "outdoor" else "City Hotel",
            "recommended": is_rec,
            "locked": not is_rec,
            "lock_reason": f"Locked: Recommended for {'Rainy' if act_type == 'indoor' else 'Sunny/Cloudy'} weather only." if not is_rec else None,
        })

    return {
        "destination_id": destination["id"],
        "destination_name": destination["name"],
        "target_date": target_date,
        "forecast": fc,
        "historical_weather": hist,
        "comparison": comparison,
        "recommended_activity_type": rec_type,
        "activity_recommendation_reason": rec_reason,
        "activities": tagged_activities,
    }


@app.post("/predict-price")
def predict_price(payload: PricePayload):
    if payload.check_out <= payload.check_in:
        raise HTTPException(422, "check_out must be after check_in.")

    hotel_type = payload.hotel_type if payload.hotel_type in {"City Hotel", "Resort Hotel"} else "Resort Hotel"
    base_price = float(BASE_PRICES[hotel_type])
    length_of_stay = max(1, (payload.check_out - payload.check_in).days)
    try:
        price, multiplier, model_evaluation = predict_mlr_price(
            payload.check_in,
            payload.guests,
            hotel_type,
            length_of_stay,
            payload.room_type,
        )
        multiplier = min(multiplier, 3.0)
        price = base_price * multiplier
        season = "Peak season" if payload.check_in.month in {12, 1, 2, 4} else "Regular season"
        price_source = "Unified MLR with log target and engineered interactions"
    except RuntimeError:
        seasonal = 1.15 if payload.check_in.month in {12, 1, 2, 4} else 1.0
        price = round(base_price * (1 + (payload.guests - 1) * 0.12) * seasonal, 2)
        multiplier = round(price / base_price, 4)
        model_evaluation = {}
        season = "Peak season" if seasonal > 1 else "Regular season"
        price_source = "Rule-based fallback; trained MLR bundle unavailable"

    dest_name = payload.destination_name or payload.destination_id
    if dest_name:
        try:
            lat, lon = destination_coordinates(dest_name)
            fc_map = fetch_forecast(lat, lon, [payload.check_in.isoformat()])
            weather = fc_map[payload.check_in.isoformat()]
            hist = historical_weather(lat, lon, [payload.check_in.isoformat()])
            comparison = build_weather_comparison(weather, hist)
        except Exception:
            weather = monthly_weather_for_date(payload.check_in)
            hist = historical_weather(14.6042, 120.9822, [payload.check_in.isoformat()])
            comparison = build_weather_comparison(weather, hist)
    else:
        weather = monthly_weather_for_date(payload.check_in)
        hist = historical_weather(14.6042, 120.9822, [payload.check_in.isoformat()])
        comparison = build_weather_comparison(weather, hist)

    # Use Machine Learning logic here as well
    if WEATHER_DECISION_TREE:
        avg_temp = float(weather.get('average_temperature', 28.0))
        precip = float(weather.get('precipitation_sum_mm', 0.0))
        wind = float(weather.get('wind_speed_kmh', 12.0))
        heat_idx = float(weather.get('apparent_temperature_max', avg_temp + 4.0))
        
        features_df = pd.DataFrame([[avg_temp, precip, wind, heat_idx, 1]], columns=['average_temperature_c', 'precipitation_mm', 'wind_speed_kmh', 'heat_index_c', 'hotel_is_resort'])
        prediction = int(WEATHER_DECISION_TREE.predict(features_df)[0])
        rec_type = "outdoor" if prediction == 1 else "indoor"
    else:
        rec_type = "outdoor" if weather["condition"] in {"Sunny", "Cloudy"} else "indoor"

    rec_reason = (
        f"Forecast is {weather['condition']} ({weather.get('average_temperature', 28)}°C) — recommended for outdoor activities."
        if rec_type == "outdoor" else
        f"Rainy forecast detected ({weather.get('precipitation_sum_mm', 10)} mm rain) — indoor activities are recommended."
    )
    
    daily_price = round(price, 2)
    total_price = round(daily_price * length_of_stay, 2)

    return {
        "status": "success",
        "price": total_price,
        "daily_price": daily_price,
        "total_price": total_price,
        "length_of_stay": length_of_stay,
        "currency": "PHP",
        "hotel_type": hotel_type,
        "base_price": base_price,
        "multiplier": round(multiplier, 4),
        "surge_multiplier": round(multiplier, 2),
        "month": payload.check_in.strftime("%B"),
        "season": season,
        "model_evaluation": model_evaluation,
        "weather": {
            "average_temperature": weather.get("average_temperature", MONTHLY_WEATHER[payload.check_in.month][0]),
            "average_rainfall": weather.get("precipitation_sum_mm", MONTHLY_WEATHER[payload.check_in.month][1]),
            "condition": weather["condition"],
            "temperature_max_c": weather.get("temperature_max_c"),
            "temperature_min_c": weather.get("temperature_min_c"),
            "precipitation_probability": weather.get("precipitation_probability"),
            "source": weather.get("source", "Open-Meteo forecast"),
        },
        "historical_weather": hist,
        "comparison": comparison,
        "recommended_activity_type": rec_type,
        "activity_recommendation_reason": rec_reason,
        "source": price_source,
    }


@app.post("/api/generate-itinerary")
def generate_itinerary(payload: ItineraryPayload):
    try:
        [date.fromisoformat(day) for day in payload.target_dates]
    except ValueError as exc:
        raise HTTPException(422, "target_dates must use YYYY-MM-DD format.") from exc

    destinations = sorted({activity.destination.strip() for activity in payload.raw_activities})
    if not destinations:
        raise HTTPException(422, "Select at least one destination activity before generating a planner.")

    forecasts: dict[str, dict[str, dict]] = {}
    history: dict[str, dict] = {}
    comparisons: dict[str, dict[str, dict]] = {}

    for destination in destinations:
        try:
            lat, lon = destination_coordinates(destination)
        except Exception:
            lat, lon = (14.6042, 120.9822)

        fc_map = fetch_forecast(lat, lon, payload.target_dates)
        hist_data = historical_weather(lat, lon, payload.target_dates)
        
        forecasts[destination] = fc_map
        history[destination] = hist_data
        comparisons[destination] = {
            day: build_weather_comparison(fc_map[day], hist_data)
            for day in payload.target_dates
        }

    scheduled = {day: [] for day in payload.target_dates}
    for activity in payload.raw_activities:
        destination = activity.destination.strip()
        acceptable = preference(activity.type)
        
        options = [
            day for day in payload.target_dates
            if forecasts.get(destination, {}).get(day, {}).get("condition") in acceptable
        ]
        weather_matched = bool(options)
        options = options or payload.target_dates

        assigned_date = None
        if activity.assigned_day and activity.assigned_day.startswith("Day "):
            try:
                assigned_index = int(activity.assigned_day.removeprefix("Day ")) - 1
                if 0 <= assigned_index < len(payload.target_dates):
                    assigned_date = payload.target_dates[assigned_index]
            except ValueError:
                assigned_date = None

        day = assigned_date or min(options, key=lambda candidate: len(scheduled[candidate]))
        matched_fc = forecasts.get(destination, {}).get(day, monthly_weather_for_date(date.fromisoformat(day)))
        
        act_type = activity.type.strip().lower()
        hotel_type = activity.hotel_type if activity.hotel_type in BASE_PRICES else ("Resort Hotel" if act_type == "outdoor" else "City Hotel")
        hotel_is_resort = int(hotel_type == "Resort Hotel")
        activity_date = date.fromisoformat(day)
        try:
            _, multiplier, _ = predict_mlr_price(activity_date, activity.guests, hotel_type, 1, activity.room_type)
            estimated_price = round(float(BASE_PRICES[hotel_type]) * min(multiplier, 3.0), 2)
        except RuntimeError:
            seasonal = 1.15 if activity_date.month in {12, 1, 2, 4} else 1.0
            estimated_price = round(float(BASE_PRICES[hotel_type]) * (1 + (activity.guests - 1) * 0.12) * seasonal, 2)
        average_temperature = float(matched_fc.get("average_temperature", MONTHLY_WEATHER[date.fromisoformat(day).month][0]))
        rainfall = float(matched_fc.get("precipitation_sum_mm", 0.0) or 0.0)
        decision_features = {
            "is_weekend": int(date.fromisoformat(day).weekday() in {4, 5, 6}),
            "pax": activity.guests,
            "pax_squared": activity.guests ** 2,
            "average_temperature_c": average_temperature,
            "rainfall_mm": rainfall,
            "hotel_type": hotel_type,
            "hotel_is_resort": hotel_is_resort,
            "hotel_temp": hotel_is_resort * average_temperature,
            "hotel_rain": hotel_is_resort * rainfall,
            "hotel_pax": hotel_is_resort * activity.guests,
        }
        if act_type == "outdoor":
            decision_msg = (
                f"Scheduled on {matched_fc['condition']} day in {destination} (outdoor-friendly weather)."
                if weather_matched else
                f"Scheduled on {matched_fc['condition']} day in {destination}; no outdoor-friendly date was available."
            )
        else:
            decision_msg = (
                f"Scheduled on {matched_fc['condition']} day in {destination} (indoor cultural/culinary activity)."
                if weather_matched else
                f"Scheduled on {matched_fc['condition']} day in {destination}; no rainy date was available."
            )

        # NEW MACHINE LEARNING ROUTING FOR HAZARD FLAGS:
        if WEATHER_DECISION_TREE:
            avg_temp = float(matched_fc.get('average_temperature', average_temperature))
            precip = float(rainfall)
            wind = float(matched_fc.get('wind_speed_kmh', 12.0))
            heat_idx = float(matched_fc.get('apparent_temperature_max', avg_temp + 4.0))
            is_resort_val = 1 if act_type == "outdoor" else 0
            
            features_df = pd.DataFrame([[avg_temp, precip, wind, heat_idx, is_resort_val]], columns=['average_temperature_c', 'precipitation_mm', 'wind_speed_kmh', 'heat_index_c', 'hotel_is_resort'])
            prediction = int(WEATHER_DECISION_TREE.predict(features_df)[0])
            # If prediction is 0 (Unsafe/Hazardous), trigger hazard flag for outdoor activities
            hazard_flag = (act_type == "outdoor" and prediction == 0)
        else:
            hazard_flag = act_type == "outdoor" and matched_fc["condition"] == "Rainy"

        scheduled[day].append({
            "name": activity.name.strip(),
            "type": act_type,
            "destination": destination,
            "assigned_day": activity.assigned_day,
            "guests": activity.guests,
            "time": activity.time,
            "estimated_price": estimated_price,
            "weather": matched_fc["condition"],
            "weather_forecast": matched_fc,
            "decision_features": decision_features,
            "decision": decision_msg,
            "hazard_flag": hazard_flag,
        })

    totals: dict[str, dict[str, float]] = {}
    for activities in scheduled.values():
        for activity in activities:
            estimated_price = float(activity["estimated_price"])
            activity["price_range"] = {"min": round(estimated_price * 0.8, 2), "max": round(estimated_price * 1.2, 2)}
            total = totals.setdefault(str(activity["destination"]), {"min": 0, "max": 0})
            total["min"] += activity["price_range"]["min"]
            total["max"] += activity["price_range"]["max"]

    itinerary = []
    for day in payload.target_dates:
        activities = scheduled[day]
        destination = str(activities[0]["destination"]) if activities else destinations[0]
        forecast = forecasts.get(destination, {}).get(day, monthly_weather_for_date(date.fromisoformat(day)))
        hist = history.get(destination, {"years": 5, "dominant_condition": "Unknown", "average_rainfall_mm": 0, "source": "historical weather data"})
        comp = comparisons.get(destination, {}).get(day, build_weather_comparison(forecast, hist))

        dest_forecasts = []
        for dest in destinations:
            d_fc = forecasts.get(dest, {}).get(day, forecast)
            d_hist = history.get(dest, hist)
            d_comp = comparisons.get(dest, {}).get(day, comp)
            dest_forecasts.append({
                "destination": dest,
                "forecast": d_fc,
                "historical_weather": d_hist,
                "comparison": d_comp,
            })

        itinerary.append({
            "day": day,
            "destination": destination,
            "expected_weather": forecast["condition"],
            "weather_forecast": forecast,
            "historical_weather": hist,
            "comparison": comp,
            "destination_forecasts": dest_forecasts,
            "scheduled_activities": activities,
            "outfit_advice": f"At {destination}, {OUTFIT_ADVICE.get(forecast['condition'], OUTFIT_ADVICE['Cloudy'])}",
        })

    outfit_response = None
    if payload.outfit:
        outfit_response = {**payload.outfit}

    return {
        "decision_tree": {
            "status": "completed",
            "input_summary": {
                "dates": len(payload.target_dates),
                "activities": len(payload.raw_activities),
                "guests": payload.guests,
            },
            "rules": [
                "Open-Meteo live forecast & 5-year historical climate comparison prioritized for all destinations.",
                "Weather classifications and activity suitability are mathematically predicted using the trained Decision Tree Classifier.",
                "Activity choices are locked to weather-matching recommendations in destination view and cross-referenced in the planner.",
            ],
        },
        "final_mlr_price": payload.mlr_price,
        "total_estimated_price": {
            "min": round(sum(total["min"] for total in totals.values()), 2),
            "max": round(sum(total["max"] for total in totals.values()), 2),
        },
        "destination_totals": totals,
        "weather_source": "Open-Meteo live forecast & historical archive",
        "itinerary": itinerary,
        "outfit": outfit_response,
    }

import os
import csv
import re
from base64 import b64decode
from binascii import Error as Base64Error
from datetime import date
from io import BytesIO
from pathlib import Path

import joblib
import pandas as pd
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
DATA_DIR = BASE_DIR.parent / "data"
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
    destination_id: str | None = None
    destination_name: str | None = None


class ActivityPayload(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    destination: str = Field(default="General itinerary", min_length=1)
    guests: int = Field(default=1, ge=1)
    assigned_day: str | None = None


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

# Load the trained unified MLR bundle once when the API starts.
PRICE_MODEL_PATH = BASE_DIR / "model" / "price_model_bundle.joblib"
try:
    PRICE_MODEL_BUNDLE = joblib.load(PRICE_MODEL_PATH)
except (FileNotFoundError, ImportError, ValueError):
    PRICE_MODEL_BUNDLE = None


def predict_mlr_price(check_in: date, guests: int, hotel_type: str) -> tuple[float, float, dict]:
    """Predict a PHP price using the same features and log equation as training."""
    # Use the stable training weather baseline, because live weather is not known at training time.
    bundle = PRICE_MODEL_BUNDLE
    if bundle is None:
        raise RuntimeError("The trained price model bundle is unavailable.")
    weather_table = bundle["monthly_weather"]
    weather_row = weather_table.loc[weather_table["month"] == check_in.strftime("%B")]
    if weather_row.empty:
        raise RuntimeError("No monthly weather baseline exists for this date.")

    # Recreate every engineered numeric feature used by mlr-price.py.
    base_price = float(bundle["base_prices"][hotel_type])
    pax = float(guests)
    is_weekend = float(check_in.weekday() in {4, 5, 6})
    avg_temp = float(weather_row["avg_monthly_temp"].iloc[0])
    avg_rain = float(weather_row["avg_monthly_rain"].iloc[0])
    is_resort = float(hotel_type == "Resort Hotel")
    model_input = pd.DataFrame({
        "pax": [pax],
        "is_weekend": [is_weekend],
        "pax_squared": [pax ** 2],
        "avg_monthly_temp": [avg_temp],
        "avg_monthly_rain": [avg_rain],
        "hotel_is_resort": [is_resort],
        "hotel_temp": [is_resort * avg_temp],
        "hotel_rain": [is_resort * avg_rain],
        "hotel_pax": [is_resort * pax],
    })

    # Initialize absent one-hot month columns to zero, then activate this arrival month.
    for feature in bundle["features"]:
        if feature not in model_input:
            model_input[feature] = 0.0
    month_feature = f"arrival_date_month_{check_in.strftime('%B')}"
    if month_feature in model_input:
        model_input[month_feature] = 1.0
    model_input = model_input[bundle["features"]].astype(float)

    # Equation: multiplier = exp(model(log_multiplier)); clamp only impossible low prices.
    predicted_log_multiplier = float(bundle["model"].predict(model_input)[0])
    multiplier = max(0.5, float(np.exp(predicted_log_multiplier)))
    price = round(base_price * multiplier, 2)
    return price, multiplier, bundle.get("evaluation", {})


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


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


DESTINATION_METADATA = {
    "Baguio": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
        "description": "The Summer Capital of the Philippines known for cool pine-scented breezes, vibrant night markets, and mountain viewpoints.",
    },
    "Cebu City": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80",
        "description": "The Queen City of the South blending rich historical Spanish landmarks with modern urban excitement and island gateways.",
    },
    "Davao": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80",
        "description": "The King City of the South renowned for majestic Mount Apo, Philippine eagle sanctuaries, and lush nature parks.",
    },
    "Manila": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1518544866330-95a85b8f8f6f?auto=format&fit=crop&w=1200&q=80",
        "description": "The historic capital featuring Intramuros walled city, grand national museums, Binondo Chinatown food, and vibrant city nightlife.",
    },
    "Puerto Princesa City": {
        "hotel_type": "Resort Hotel",
        "image": "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80",
        "description": "The eco-tourism haven of Palawan, home to the world-famous Subterranean River Underground Park and pristine island reefs.",
    },
    "Tagaytay City": {
        "hotel_type": "Resort Hotel",
        "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        "description": "A picturesque mountain ridge getaway offering breathtaking panoramic views of Taal Volcano and crisp cool breezes.",
    },
    "Alaminos": {
        "hotel_type": "Resort Hotel",
        "image": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
        "description": "Gateway to the iconic Hundred Islands National Park featuring pristine islets, caves, and turquoise coastal waters.",
    },
    "Iloilo City": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
        "description": "The City of Love celebrated for heritage mansions, Spanish-colonial churches, and world-class culinary wonders like La Paz Batchoy.",
    },
    "Bacolod": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=1200&q=80",
        "description": "The City of Smiles known for the iconic Ruins, sweet delicacies, and warm Negrense hospitality.",
    },
    "Vigan": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80",
        "description": "A UNESCO World Heritage city showcasing remarkably preserved 16th-century Spanish colonial architecture along Calle Crisologo.",
    },
    "Legazpi City": {
        "hotel_type": "Resort Hotel",
        "image": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
        "description": "The adventure capital of Bicol with front-row vistas of the perfect cone Mayon Volcano, ATV trails, and Cagsawa Ruins.",
    },
    "Dumaguete": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
        "description": "The City of Gentle People featuring breezy coastal boulevards, heritage academic centers, and nearby marine sanctuaries.",
    },
    "Zamboanga City": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
        "description": "The vibrant Asia Latin City known for pink sand beaches of Santa Cruz Island, historic Fort Pilar, and colorful vintas.",
    },
    "Laoag": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80",
        "description": "The Sunshine City of Ilocos Norte boasting sprawling sand dunes, baroque heritage cathedrals, and northern cuisine.",
    },
    "Batangas City": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1470214304380-aadaedcfff0b?auto=format&fit=crop&w=1200&q=80",
        "description": "An industrial and cultural port city rich in Southern Tagalog history, basilicas, and delicious culinary traditions.",
    },
    "Angeles City": {
        "hotel_type": "City Hotel",
        "image": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        "description": "The culinary capital of Pampanga offering heritage mansions, Clark eco-tourism, and legendary Kapampangan dining.",
    },
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
                # Strictly 1 outdoor and 1 indoor per destination
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
                
                # Ensure strictly 1 outdoor and 1 indoor activity
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
                    "location": name,  # Tag is now the city itself
                    "country": row.get("country", "Philippines"),
                    "hotel_type": meta.get("hotel_type", "City Hotel"),
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


# In-memory cache for weather and geocoding to ensure blazing fast response times
WEATHER_CACHE: dict[str, dict] = {}


def fetch_forecast(latitude: float, longitude: float, dates: list[str]) -> dict[str, dict[str, object]]:
    """
    Fetch weather forecast with strict PRIORITY to Open-Meteo APIs.
    1. For near-term dates (today up to 16 days ahead), calls Open-Meteo live forecast.
    2. For past dates, calls Open-Meteo Archive API.
    3. For future dates beyond 16 days, calls Open-Meteo Archive API for recent matching calendar days to generate high-fidelity climate predictions.
    4. Falls back to monthly baseline only if Open-Meteo is completely unreachable.
    """
    results: dict[str, dict[str, object]] = {}
    today = date.today()

    for day_str in dates:
        cache_key = f"fc_{latitude:.4f}_{longitude:.4f}_{day_str}"
        if cache_key in WEATHER_CACHE:
            results[day_str] = WEATHER_CACHE[cache_key]
            continue

        target_date = date.fromisoformat(day_str)
        days_diff = (target_date - today).days
        day_forecast = None

        # Priority 1: Open-Meteo live forecast (0 to 16 days ahead)
        if 0 <= days_diff <= 16:
            try:
                response = requests.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "forecast_days": 16,
                        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
                        "timezone": "Asia/Manila",
                    },
                    timeout=12,
                )
                if response.status_code == 200:
                    daily = response.json().get("daily", {})
                    time_list = daily.get("time", [])
                    if day_str in time_list:
                        i = time_list.index(day_str)
                        w_code = int(daily["weather_code"][i])
                        t_max = round(float(daily["temperature_2m_max"][i]), 1)
                        t_min = round(float(daily["temperature_2m_min"][i]), 1)
                        p_prob = int(daily["precipitation_probability_max"][i]) if daily.get("precipitation_probability_max") and daily["precipitation_probability_max"][i] is not None else (90 if weather_label_from_code(w_code) == "Rainy" else 20)
                        p_sum = round(float(daily["precipitation_sum"][i]), 1) if daily.get("precipitation_sum") and daily["precipitation_sum"][i] is not None else 0.0
                        day_forecast = {
                            "condition": weather_label_from_code(w_code),
                            "weather_code": w_code,
                            "temperature_max_c": t_max,
                            "temperature_min_c": t_min,
                            "average_temperature": round((t_max + t_min) / 2, 1),
                            "precipitation_probability": p_prob,
                            "precipitation_sum_mm": p_sum,
                            "source": "Open-Meteo live forecast",
                        }
            except Exception as exc:
                print(f"Open-Meteo live forecast error: {exc}")

        # Priority 2: If date is in the past, query Open-Meteo Archive
        elif days_diff < 0:
            try:
                response = requests.get(
                    "https://archive-api.open-meteo.com/v1/archive",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "start_date": day_str,
                        "end_date": day_str,
                        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
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
                        p_sum = round(float(daily["precipitation_sum"][0]), 1) if daily.get("precipitation_sum") and daily["precipitation_sum"][0] is not None else 0.0
                        day_forecast = {
                            "condition": weather_label_from_code(w_code),
                            "weather_code": w_code,
                            "temperature_max_c": t_max,
                            "temperature_min_c": t_min,
                            "average_temperature": round((t_max + t_min) / 2, 1),
                            "precipitation_probability": 85 if weather_label_from_code(w_code) == "Rainy" else 15,
                            "precipitation_sum_mm": p_sum,
                            "source": "Open-Meteo archive data",
                        }
            except Exception as exc:
                print(f"Open-Meteo archive past error: {exc}")

        # Priority 3: Beyond 16 days in the future, query Open-Meteo Archive for past 5 years of matching dates
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
                        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
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
                        
                        cond_counts = {c: [weather_label_from_code(code) for code in codes].count(c) for c in WEATHER_OPTIONS}
                        dom_cond = max(cond_counts, key=cond_counts.get) if codes else "Sunny"
                        avg_rain = round(sum(rains) / len(rains), 1) if rains else round(MONTHLY_WEATHER[target_date.month][1], 1)
                        avg_max = round(sum(t_maxs) / len(t_maxs), 1) if t_maxs else (MONTHLY_WEATHER[target_date.month][0] + 2)
                        avg_min = round(sum(t_mins) / len(t_mins), 1) if t_mins else (MONTHLY_WEATHER[target_date.month][0] - 2)
                        
                        day_forecast = {
                            "condition": dom_cond,
                            "weather_code": codes[0] if codes else 0,
                            "temperature_max_c": avg_max,
                            "temperature_min_c": avg_min,
                            "average_temperature": round((avg_max + avg_min) / 2, 1),
                            "precipitation_probability": min(round(avg_rain * 4), 95),
                            "precipitation_sum_mm": avg_rain,
                            "source": "Open-Meteo multi-year climate forecast",
                        }
            except Exception as exc:
                print(f"Open-Meteo future climate error: {exc}")

        # Fallback (only if all Open-Meteo attempts fail)
        if day_forecast is None:
            day_forecast = monthly_weather_for_date(target_date)
            day_forecast["source"] = "MLR monthly weather baseline (offline fallback)"

        WEATHER_CACHE[cache_key] = day_forecast
        results[day_str] = day_forecast

    return results


def historical_weather(latitude: float, longitude: float, dates: list[str]) -> dict[str, object]:
    """
    Fetch 5-year historical weather data from Open-Meteo Archive API.
    Calculates dominant condition, average rainfall amount (mm), and average temperature.
    """
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

    # Fallback if archive API failed
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


print("Loading CNN Model... this might take a few seconds...")
model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
with LABELS_PATH.open(encoding="utf-8") as labels_file:
    class_names = [line.strip().split(" ", 1)[-1] for line in labels_file if line.strip()]


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
    
    # Priority Open-Meteo forecast and 5-year archive
    fc_map = fetch_forecast(lat, lon, [target_date])
    fc = fc_map[target_date]
    hist = historical_weather(lat, lon, [target_date])
    comparison = build_weather_comparison(fc, hist)
    
    # Recommendation logic: Sunny or Cloudy => Outdoor, Rainy => Indoor
    is_outdoor_friendly = fc["condition"] in {"Sunny", "Cloudy"}
    rec_type = "outdoor" if is_outdoor_friendly else "indoor"
    rec_reason = (
        f"Today's forecast in {destination['name']} is {fc['condition']} ({fc['average_temperature']}°C, {fc['precipitation_sum_mm']} mm rain) — outdoor activities are highly recommended!"
        if is_outdoor_friendly else
        f"Rain is forecasted in {destination['name']} ({fc['precipitation_sum_mm']} mm rain, {fc['precipitation_probability']}% chance) — indoor cultural and culinary experiences are recommended for comfort and safety."
    )

    # Tag activities with recommendation and locked status
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
    hotel_type = payload.hotel_type if payload.hotel_type in {"City Hotel", "Resort Hotel"} else "Resort Hotel"
    base_price = 3800.0 if hotel_type == "City Hotel" else 9000.0
    # Prefer the trained log-linear MLR and retain the old formula only as an offline fallback.
    try:
        price, multiplier, model_evaluation = predict_mlr_price(
            payload.check_in, payload.guests, hotel_type
        )
        season = "Peak season" if payload.check_in.month in {12, 1, 2, 4} else "Regular season"
        price_source = "Unified MLR with log target and engineered interactions"
    except RuntimeError:
        seasonal = 1.15 if payload.check_in.month in {12, 1, 2, 4} else 1.0
        price = round(base_price * (1 + (payload.guests - 1) * 0.12) * seasonal, 2)
        multiplier = round(price / base_price, 4)
        model_evaluation = {}
        season = "Peak season" if seasonal > 1 else "Regular season"
        price_source = "Rule-based fallback; trained MLR bundle unavailable"

    # If destination information is provided, fetch priority Open-Meteo weather
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

    rec_type = "outdoor" if weather["condition"] in {"Sunny", "Cloudy"} else "indoor"
    rec_reason = (
        f"Forecast is {weather['condition']} ({weather.get('average_temperature', 28)}°C) — recommended for outdoor activities."
        if rec_type == "outdoor" else
        f"Rainy forecast detected ({weather.get('precipitation_sum_mm', 10)} mm rain) — indoor activities are recommended."
    )

    return {
        "status": "success",
        "price": price,
        "currency": "PHP",
        "hotel_type": hotel_type,
        "base_price": base_price,
        "multiplier": round(multiplier, 4),
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

    # Fetch live Open-Meteo forecasts and 5-year historical climate for every destination (Open-Meteo is priority)
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

    # Decision Tree scheduling
    scheduled = {day: [] for day in payload.target_dates}
    for activity in payload.raw_activities:
        destination = activity.destination.strip()
        acceptable = preference(activity.type)
        
        # Schedule on days where the destination's forecast matches acceptable conditions
        options = [
            day for day in payload.target_dates
            if forecasts.get(destination, {}).get(day, {}).get("condition") in acceptable
        ]
        # Preserve every requested activity even when no date matches its ideal weather.
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
        # Carry the MLR-aligned decision variables into the planner output for traceability.
        hotel_type = "Resort Hotel" if act_type == "outdoor" else "City Hotel"
        hotel_is_resort = int(hotel_type == "Resort Hotel")
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

        hazard_flag = act_type == "outdoor" and matched_fc["condition"] == "Rainy"

        scheduled[day].append({
            "name": activity.name.strip(),
            "type": act_type,
            "destination": destination,
            "assigned_day": activity.assigned_day,
            "guests": activity.guests,
            "weather": matched_fc["condition"],
            "weather_forecast": matched_fc,
            "decision_features": decision_features,
            "decision": decision_msg,
            "hazard_flag": hazard_flag,
        })

    total_activity_guests = sum(activity.guests for activity in payload.raw_activities) or 1
    totals: dict[str, dict[str, float]] = {}
    for activities in scheduled.values():
        for activity in activities:
            price_share = payload.mlr_price * int(activity["guests"]) / total_activity_guests
            activity["price_range"] = {"min": round(price_share * 0.8, 2), "max": round(price_share * 1.2, 2)}
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

        # Collect forecasts for all destinations involved on this day
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

    # Validate outfit if provided
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
                "Outdoor activities are scheduled for sunny or cloudy conditions.",
                "Indoor activities are scheduled for rainy conditions when possible.",
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

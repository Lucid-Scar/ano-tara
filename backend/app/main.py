import os
import csv
from base64 import b64decode
from binascii import Error as Base64Error
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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


class PricePayload(BaseModel):
    check_in: date
    guests: int = Field(ge=1)
    hotel_type: str = "Resort Hotel"


class ActivityPayload(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    destination: str = Field(default="General itinerary", min_length=1)


class ItineraryPayload(BaseModel):
    target_dates: list[str] = Field(min_length=1)
    raw_activities: list[ActivityPayload] = Field(default_factory=list)
    mlr_price: float = Field(ge=0)
    guests: int = Field(default=1, ge=1)


WEATHER_OPTIONS = ("Sunny", "Rainy", "Cloudy")
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
OUTFIT_ADVICE = {
    "Sunny": "Wear light, breathable clothes and comfortable walking shoes, and bring sunscreen and a hat.",
    "Rainy": "Wear quick-dry layers and waterproof shoes, and bring an umbrella or rain jacket.",
    "Cloudy": "Wear comfortable layers and walking shoes, and bring a light jacket.",
}


def weather_label_from_code(weather_code: int) -> str:
    if weather_code == 0:
        return "Sunny"
    if weather_code in {1, 2, 3, 45, 48}:
        return "Cloudy"
    return "Rainy"


def destination_coordinates(destination: str) -> tuple[float, float]:
    search_names = [destination]
    if destination.lower().endswith(" panaginip"):
        search_names.append(destination.rsplit(" ", 1)[0] + ", Philippines")
    if destination.lower().startswith("destinasyon") or destination.lower() in {"city hotel", "resort hotel"}:
        search_names.append("Manila, Philippines")

    for search_name in search_names:
        response = requests.get(
            OPEN_METEO_GEOCODING_URL,
            params={"name": search_name, "count": 1, "language": "en", "format": "json"},
            timeout=20,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        if results:
            return float(results[0]["latitude"]), float(results[0]["longitude"])

    raise HTTPException(status_code=422, detail=f"Could not locate destination '{destination}'.")


def fetch_forecast(
    latitude: float,
    longitude: float,
    target_dates: list[str],
) -> dict[str, dict[str, object]]:
    start_date = date.fromisoformat(min(target_dates))
    end_date = date.fromisoformat(max(target_dates))
    if (end_date - date.today()).days > 16:
        raise HTTPException(status_code=422, detail="Open-Meteo provides forecasts up to 16 days ahead.")

    response = requests.get(
        OPEN_METEO_FORECAST_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
            "timezone": "auto",
        },
        timeout=20,
    )
    response.raise_for_status()
    daily = response.json().get("daily", {})
    forecasts = {}
    for index, forecast_date in enumerate(daily.get("time", [])):
        weather_code = int(daily["weather_code"][index])
        forecasts[forecast_date] = {
            "condition": weather_label_from_code(weather_code),
            "weather_code": weather_code,
            "temperature_max_c": daily["temperature_2m_max"][index],
            "temperature_min_c": daily["temperature_2m_min"][index],
            "precipitation_probability": daily["precipitation_probability_max"][index],
            "precipitation_sum_mm": daily["precipitation_sum"][index],
        }
    return forecasts


def fetch_historical_weather_summary(
    latitude: float,
    longitude: float,
    target_dates: list[str],
) -> dict[str, object]:
    start = date.fromisoformat(min(target_dates))
    end = date.fromisoformat(max(target_dates))
    historical_start = start.replace(year=start.year - 5)
    historical_end = end.replace(year=end.year - 1)
    try:
        response = requests.get(
            OPEN_METEO_ARCHIVE_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "start_date": historical_start.isoformat(),
                "end_date": historical_end.isoformat(),
                "daily": "weather_code,temperature_2m_mean,precipitation_sum",
                "timezone": "auto",
            },
            timeout=30,
        )
        response.raise_for_status()
        daily = response.json().get("daily", {})
        conditions = [weather_label_from_code(int(code)) for code in daily.get("weather_code", [])]
        source = "historical weather data"
    except requests.RequestException:
        conditions = local_weather_conditions()
        source = "available local weather data"

    if not conditions:
        return {"years": 0, "dominant_condition": "Unknown", "source": source}
    counts = {condition: conditions.count(condition) for condition in WEATHER_OPTIONS}
    return {
        "years": 5,
        "dominant_condition": max(counts, key=counts.get),
        "condition_counts": counts,
        "source": source,
    }


def local_weather_conditions() -> list[str]:
    conditions = []
    weather_directory = BASE_DIR / "weather"
    for weather_file in weather_directory.glob("*.csv"):
        try:
            with weather_file.open("r", newline="", encoding="utf-8") as file:
                reader = csv.DictReader(file)
                for row in reader:
                    rain = float(row.get("rain.1h") or row.get("rain") or 0)
                    temperature = float(row.get("main.temp") or row.get("temperature") or 25)
                    conditions.append("Rainy" if rain > 0 else ("Sunny" if temperature >= 28 else "Cloudy"))
        except (OSError, ValueError):
            continue
    return conditions


def activity_weather_preferences(activity_type: str) -> tuple[str, ...]:
    normalized_type = activity_type.strip().lower()
    if normalized_type == "outdoor":
        return ("Sunny", "Cloudy")
    if normalized_type == "indoor":
        return ("Rainy",)
    raise HTTPException(status_code=422, detail="Activity type must be either 'indoor' or 'outdoor'.")


def arrange_activities(
    activities: list[ActivityPayload],
    weather_by_destination: dict[str, dict[str, dict[str, object]]],
) -> dict[str, list[dict[str, str]]]:
    target_dates = list(next(iter(weather_by_destination.values())).keys())
    scheduled_by_date = {target_date: [] for target_date in target_dates}

    for activity in activities:
        preferred_weather = activity_weather_preferences(activity.type)
        destination = activity.destination.strip()
        destination_weather = weather_by_destination[destination]
        preferred_dates = [
            target_date
            for target_date, weather in destination_weather.items()
            if weather["condition"] in preferred_weather
        ]
        candidate_dates = preferred_dates or target_dates
        scheduled_date = min(candidate_dates, key=lambda date: len(scheduled_by_date[date]))
        matched_weather = destination_weather[scheduled_date]["condition"] in preferred_weather
        scheduled_by_date[scheduled_date].append(
            {
                "name": activity.name.strip(),
                "type": activity.type.strip().lower(),
                "destination": destination,
                "weather": destination_weather[scheduled_date]["condition"],
                "weather_forecast": destination_weather[scheduled_date],
                "decision": (
                    f"Scheduled on {scheduled_date} because {activity.type.strip().lower()} "
                    f"activities fit {destination_weather[scheduled_date]['condition']} weather in {destination}."
                    if matched_weather
                    else f"Scheduled on {scheduled_date} as a fallback because no preferred weather day was available."
                ),
            }
        )

    return scheduled_by_date


def daily_advice(weather: str, activities: list[dict[str, str]]) -> str:
    destinations = sorted({activity["destination"] for activity in activities})
    activity_types = sorted({activity["type"] for activity in activities})
    destination_text = ", ".join(destinations) if destinations else "your destination"
    activity_text = " and ".join(activity_types) if activity_types else "planned"
    return f"At {destination_text}, your {activity_text} activities are planned for this forecast. {OUTFIT_ADVICE[weather]}"

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


@app.get("/destinations")
def get_destinations():
    return {
        "destinations": [
            {
                "id": "el-nido",
                "name": "El Nido Panaginip",
                "location": "Philippines",
                "hotel_type": "Resort Hotel",
                "description": "Island hopping, local food, and limestone viewpoints in Palawan.",
            },
            {
                "id": "boracay",
                "name": "Boracay",
                "location": "Philippines",
                "hotel_type": "Resort Hotel",
                "description": "Beach activities, water sports, and local dining.",
            },
            {
                "id": "cebu",
                "name": "Cebu City",
                "location": "Philippines",
                "hotel_type": "City Hotel",
                "description": "Island tours, heritage sites, and museums.",
            },
            {
                "id": "baguio",
                "name": "Baguio City",
                "location": "Philippines",
                "hotel_type": "City Hotel",
                "description": "Mountain viewpoints, art museums, and cool-weather walks.",
            },
            {
                "id": "davao",
                "name": "Davao City",
                "location": "Philippines",
                "hotel_type": "City Hotel",
                "description": "Nature parks, wildlife centers, and local experiences.",
            },
            {
                "id": "manila",
                "name": "Manila",
                "location": "Philippines",
                "hotel_type": "City Hotel",
                "description": "Intramuros, museums, heritage sites, and city activities.",
            },
        ]
    }


@app.get("/destinations/{destination_id}")
def get_destination(destination_id: str):
    destination = next(
        (item for item in get_destinations()["destinations"] if item["id"] == destination_id),
        None,
    )
    if destination is None:
        raise HTTPException(status_code=404, detail="Destination not found")
    return destination


@app.post("/predict-price")
def predict_price(payload: PricePayload):
    hotel_type = payload.hotel_type if payload.hotel_type in {"City Hotel", "Resort Hotel"} else "Resort Hotel"
    base_price = 3800.0 if hotel_type == "City Hotel" else 9000.0
    guest_factor = 1 + ((payload.guests - 1) * 0.12)
    seasonal_factor = 1.15 if payload.check_in.month in {12, 1, 2, 4} else 1.0
    price = round(base_price * guest_factor * seasonal_factor, 2)
    return {
        "status": "success",
        "price": price,
        "currency": "PHP",
        "hotel_type": hotel_type,
        "base_price": base_price,
        "multiplier": round(price / base_price, 4),
        "month": payload.check_in.strftime("%B"),
        "season": "Peak season" if seasonal_factor > 1 else "Regular season",
        "weather": {
            "average_temperature": 28.0,
            "average_rainfall": 0.0,
        },
        "source": "placeholder MLR estimate",
    }


@app.post("/api/generate-itinerary")
def generate_itinerary(payload: ItineraryPayload):
    try:
        for target_date in payload.target_dates:
            date.fromisoformat(target_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="target_dates must use YYYY-MM-DD format.") from exc

    destinations = sorted({activity.destination.strip() for activity in payload.raw_activities})
    if not destinations:
        raise HTTPException(status_code=422, detail="Select at least one destination activity before generating a planner.")

    try:
        coordinates_by_destination = {
            destination: destination_coordinates(destination) for destination in destinations
        }
        weather_by_destination = {
            destination: fetch_forecast(latitude, longitude, payload.target_dates)
            for destination, (latitude, longitude) in coordinates_by_destination.items()
        }
        historical_by_destination = {
            destination: fetch_historical_weather_summary(latitude, longitude, payload.target_dates)
            for destination, (latitude, longitude) in coordinates_by_destination.items()
        }
    except HTTPException:
        raise
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Open-Meteo weather service is unavailable.") from exc
    scheduled_by_date = arrange_activities(payload.raw_activities, weather_by_destination)
    activity_count = max(len(payload.raw_activities), 1)
    activity_prices = []
    for activity in payload.raw_activities:
        price_share = payload.mlr_price / activity_count
        activity_prices.append(
            {
                "name": activity.name.strip(),
                "type": activity.type.strip().lower(),
                "destination": activity.destination.strip(),
                "price_range": {
                    "min": round(price_share * 0.8, 2),
                    "max": round(price_share * 1.2, 2),
                },
            }
        )

    destination_totals = {}
    for activity in activity_prices:
        destination = activity["destination"]
        totals = destination_totals.setdefault(destination, {"min": 0, "max": 0})
        totals["min"] += activity["price_range"]["min"]
        totals["max"] += activity["price_range"]["max"]

    activities_by_name = {activity["name"]: activity for activity in activity_prices}
    for day in scheduled_by_date.values():
        for activity in day:
            activity["price_range"] = activities_by_name[activity["name"]]["price_range"]

    daily_itinerary = []
    for target_date in payload.target_dates:
        scheduled_activities = scheduled_by_date[target_date]
        day_destinations = list(dict.fromkeys(
            activity["destination"] for activity in scheduled_activities
        )) or [destinations[0]]
        weather_destination = day_destinations[0]
        forecast = weather_by_destination[weather_destination][target_date]
        daily_itinerary.append(
            {
                "day": target_date,
                "destination": weather_destination,
                "expected_weather": forecast["condition"],
                "weather_forecast": forecast,
                "historical_weather": historical_by_destination[weather_destination],
                "destination_forecasts": [
                    {
                        "destination": destination,
                        "forecast": weather_by_destination[destination][target_date],
                    }
                    for destination in day_destinations
                ],
                "scheduled_activities": scheduled_activities,
                "outfit_advice": daily_advice(forecast["condition"], scheduled_activities),
            }
        )

    return {
        "decision_tree": {
            "status": "completed",
            "input_summary": {
                "dates": len(payload.target_dates),
                "activities": len(payload.raw_activities),
                "guests": payload.guests,
            },
            "rules": [
                "Outdoor activities are suggested for Sunny or Cloudy days.",
                "Indoor activities are suggested for Rainy days",
                "If no preferred day exists, the least busy day is selected.",
                "Historical datas are used as context for the destination profile.",
            ],
        },
        "final_mlr_price": payload.mlr_price,
        "total_estimated_price": {
            "min": round(sum(totals["min"] for totals in destination_totals.values()), 2),
            "max": round(sum(totals["max"] for totals in destination_totals.values()), 2),
        },
        "destination_totals": destination_totals,
        "weather_source": "Open-Meteo Forecast API and Historical Weather API",
        "itinerary": daily_itinerary,
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
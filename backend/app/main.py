# checkpoint

import csv
import re
from base64 import b64decode
from binascii import Error as Base64Error
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

import json
import joblib
import pandas as pd
import holidays
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
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class OutfitPayload(BaseModel):
    image_url: str | None = None
    image_base64: str | None = None


class PricePayload(BaseModel):
    check_in: date
    check_out: date
    guests: int
    destination: str | None = None
    hotel_type: str | None = "City Hotel"
    room_type: str = "Standard Room"
    selected_base_rate: float | None = Field(default=None, gt=0)
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
    exact_latitude: float | None = None
    exact_longitude: float | None = None
    price_per_pax: float | str | None = None
    price_display: str | None = None
    real_price_php: float | None = None


class ItineraryPayload(BaseModel):
    target_dates: list[str] = Field(min_length=1)
    raw_activities: list[ActivityPayload] = Field(default_factory=list)
    mlr_price: float = Field(ge=0)
    guests: int = Field(default=1, ge=1)
    outfit: dict | None = None


WEATHER_OPTIONS = ()
OUTFIT_ADVICE = {
    "Clear / Sunny": "Wear light, breathable clothes and comfortable walking shoes, and bring sunscreen and a hat.",
    "Fair / Partly Cloudy": "Wear comfortable layers and walking shoes, and bring a light jacket.",
    "Light Rain / Drizzle": "Wear quick-dry layers and waterproof shoes, and bring an umbrella or rain jacket.",
    "Heavy Rain / Rainy": "Wear waterproof layers, sturdy boots, and carry a heavy-duty umbrella.",
    "Windy / Stormy": "Stay indoors if possible; wear warm, windproof layers if you must go out.",
    "Extreme Heat / Danger": "Wear ultra-light, breathable clothing, stay hydrated, and strictly avoid prolonged sun exposure."
}
MONTHLY_WEATHER = {
    1: (27.0, 8.5, "Light Rain / Drizzle"), 2: (27.5, 5.2, "Clear / Sunny"), 3: (28.5, 3.1, "Clear / Sunny"),
    4: (29.5, 4.2, "Clear / Sunny"), 5: (30.0, 9.8, "Light Rain / Drizzle"), 6: (29.2, 18.4, "Heavy Rain / Rainy"),
    7: (28.7, 24.1, "Heavy Rain / Rainy"), 8: (28.5, 26.5, "Heavy Rain / Rainy"), 9: (28.3, 25.2, "Heavy Rain / Rainy"),
    10: (28.1, 20.6, "Heavy Rain / Rainy"), 11: (27.8, 14.1, "Light Rain / Drizzle"), 12: (27.2, 11.4, "Light Rain / Drizzle"),
}

HEAT_INDEX_HAZARD_THRESHOLD = 41.5
WIND_SPEED_HAZARD_THRESHOLD = 42.0
DAILY_PRECIPITATION_HAZARD_THRESHOLD = 12.5


def get_pagasa_condition(temp: float, rain: float, wind: float, heat_index: float) -> str:
    if heat_index >= HEAT_INDEX_HAZARD_THRESHOLD: return 'Extreme Heat / Danger'
    if wind >= WIND_SPEED_HAZARD_THRESHOLD or (rain > 40 and wind > 30): return 'Windy / Stormy'
    if rain > DAILY_PRECIPITATION_HAZARD_THRESHOLD: return 'Heavy Rain / Rainy'
    if 2.0 < rain <= DAILY_PRECIPITATION_HAZARD_THRESHOLD: return 'Light Rain / Drizzle'
    if temp >= 31.0 and rain <= 2.0: return 'Fair / Partly Cloudy'
    return 'Clear / Sunny'


DEFAULT_BASE_PRICES = {"City Hotel": 6625.63, "Resort Hotel": 5999.72}
PHILIPPINE_PEAK_MONTHS = {12, 1, 2, 4}
CURRENT_PSA_INFLATION_RATE = 7.2
INFLATION_BASELINE_RATE = 4.0


def normalize_city_name(value: str) -> str:
    city = value.strip().casefold()
    city = re.sub(r"^city of\s+", "", city)
    return re.sub(r"\s+(city|municipality)$", "", city)


def activity_price_per_pax(row: pd.Series) -> float | None:
    price = pd.to_numeric(row.get("Price_Per_Pax_PHP"), errors="coerce")
    if pd.notna(price) and price > 0:
        return round(float(price), 2)

    basis = str(row.get("Price_Unit_or_Basis", "")).casefold()
    display = row.get("Price_Display")
    if re.search(r"\bper\s+(visitor|person|pax)\b", basis) and not pd.isna(display):
        display_amount = display_price_amount(display)
        if display_amount is not None:
            return display_amount

    return round(float(price), 2) if pd.notna(price) else None


def display_price_amount(value: object) -> float | None:
    """Extract the first PHP numeric amount from a display-price string."""
    if value is None or pd.isna(value):
        return None
    match = re.search(r"(?:₱|PHP\s*)\s*([\d,]+(?:\.\d{1,2})?)", str(value), re.IGNORECASE)
    if not match:
        return None
    return round(float(match.group(1).replace(",", "")), 2)


def resolved_activity_price_per_pax(
    payload_price: object,
    price_display: object,
    dataset_price: float | None,
) -> float | None:
    numeric_price = pd.to_numeric(payload_price, errors="coerce")
    display_text = str(price_display or "").strip()
    display_amount = display_price_amount(display_text)

    if pd.notna(numeric_price) and numeric_price > 0:
        return round(float(numeric_price), 2)
    if display_amount is not None:
        return display_amount
    if re.match(r"^free(?:\s*\(|$)", display_text, re.IGNORECASE):
        return 0.0
    if dataset_price is not None and dataset_price > 0:
        return dataset_price
    if pd.notna(numeric_price):
        return round(float(numeric_price), 2)
    return dataset_price


# Load the newly trained MLR models
try:
    MLR_MODEL = joblib.load(BASE_DIR / "model" / "price_surge_mlr_model.joblib")
    MLR_FEATURES = joblib.load(BASE_DIR / "model" / "model_features.joblib")
except (FileNotFoundError, ImportError, ValueError):
    try:
        price_model_bundle = joblib.load(BASE_DIR / "model" / "price_model_bundle.joblib")
        MLR_MODEL = price_model_bundle["model"]
        MLR_FEATURES = price_model_bundle["features"]
    except (FileNotFoundError, ImportError, KeyError, TypeError, ValueError):
        MLR_MODEL = None
        MLR_FEATURES = []

# Load local Philippine hotel and activity data.
PHILIPPINE_HOTEL_RATES = {}
PHILIPPINE_ACTIVITY_COSTS = {}
PHILIPPINE_ACTIVITY_PRICES = {}
PHILIPPINE_TOURISM_PATH = DATA_DIR / "philippines_tourism_with_coordinates_final.csv"
if not PHILIPPINE_TOURISM_PATH.is_file():
    raise FileNotFoundError(f"Tourism dataset not found at {PHILIPPINE_TOURISM_PATH}")

PHILIPPINE_TOURISM_DATA = pd.read_csv(PHILIPPINE_TOURISM_PATH, encoding="utf-8-sig")
ACTIVITY_SUITABILITY_PATH = DATA_DIR / "activity_suitability.csv"
if not ACTIVITY_SUITABILITY_PATH.is_file():
    raise FileNotFoundError(f"Activity suitability dataset not found at {ACTIVITY_SUITABILITY_PATH}")
ACTIVITY_SUITABILITY_DATA = pd.read_csv(ACTIVITY_SUITABILITY_PATH, usecols=["destination", "weather_condition"])
WEATHER_OPTIONS = tuple(sorted(
    ACTIVITY_SUITABILITY_DATA["weather_condition"].dropna().astype(str).str.strip().unique()
))
SUITABILITY_WEATHER_BY_DESTINATION = {
    str(destination).strip().casefold(): tuple(sorted(group["weather_condition"].dropna().astype(str).str.strip().unique()))
    for destination, group in ACTIVITY_SUITABILITY_DATA.groupby("destination")
}
hotel_rows = PHILIPPINE_TOURISM_DATA[
    pd.to_numeric(PHILIPPINE_TOURISM_DATA["Hotel_Rate_PHP_per_Night"], errors="coerce").notna()
]
hotel_rates_by_city = {}
for _, row in hotel_rows.iterrows():
    city = normalize_city_name(str(row["City_or_Municipality"]))
    price = float(row["Hotel_Rate_PHP_per_Night"])
    if price > 0:
        hotel_rates_by_city.setdefault(city, []).append(price)
PHILIPPINE_HOTEL_RATES = {
    city: sum(prices) / len(prices)
    for city, prices in hotel_rates_by_city.items()
}

activity_prices_by_name = {}
for _, row in PHILIPPINE_TOURISM_DATA.iterrows():
    price = activity_price_per_pax(row)
    if price is None:
        continue
    city = normalize_city_name(str(row["City_or_Municipality"]))
    PHILIPPINE_ACTIVITY_COSTS.setdefault(city, []).append(price)
    name = str(row["Name"]).strip().casefold()
    if name:
        activity_prices_by_name.setdefault((city, name), []).append(price)
PHILIPPINE_ACTIVITY_PRICES = {
    name: sum(prices) / len(prices)
    for name, prices in activity_prices_by_name.items()
}

print(
    f"Loaded tourism data from {PHILIPPINE_TOURISM_PATH}: "
    f"{PHILIPPINE_TOURISM_DATA['City_or_Municipality'].nunique()} cities, "
    f"{len(PHILIPPINE_HOTEL_RATES)} cities with hotel rates."
)

# Load the NEW trained Weather Decision Tree
WEATHER_MODEL_PATH = BASE_DIR / "model" / "weather_decision_tree.joblib"
try:
    WEATHER_DECISION_TREE = joblib.load(WEATHER_MODEL_PATH)
except (FileNotFoundError, ImportError, ValueError):
    WEATHER_DECISION_TREE = None


# Helper: predict a stay price using the trained MLR bundle.
def predict_mlr_price(
    check_in: date,
    guests: int,
    destination: str,
    length_of_stay: int,
    room_type: str,
    hotel_type: str,
) -> tuple[float, float, dict, str, float, str]:
    if MLR_MODEL is None:
        raise RuntimeError("The trained price model is unavailable.")

    is_resort = float(hotel_type == "Resort Hotel")
    base_price, base_price_source = accommodation_base_price(destination, hotel_type)

    # Use the monthly weather map already defined in this file
    avg_temp, avg_rain, _ = MONTHLY_WEATHER.get(
        check_in.month,
        (28.0, 10.0, "Clear / Sunny")
    )

    pax = float(guests)
    lead_time = max(0, (check_in - datetime.now().date()).days)
    is_weekend = float(check_in.weekday() in {4, 5, 6})

    ph_holidays = holidays.PH(years=[check_in.year])
    is_holiday = float(check_in in ph_holidays)
    feature_dict = {
        "lead_time": float(lead_time),
        "pax": pax,
        "length_of_stay": float(length_of_stay),
        "is_weekend": is_weekend,
        "is_premium_room": float(room_type != "Standard Room"),
        "hotel_is_resort": is_resort,
        "is_holiday": is_holiday,
        "avg_monthly_temp": float(avg_temp),
        "avg_monthly_rain": float(avg_rain),
        "psa_inflation_rate": CURRENT_PSA_INFLATION_RATE,
        "hotel_temp": is_resort * avg_temp,
        "hotel_rain": is_resort * avg_rain,
        "hotel_pax": is_resort * pax,
        "pax_squared": pax ** 2,
    }

    for feature in MLR_FEATURES:
        if feature.startswith("arrival_date_month_"):
            feature_dict[feature] = float(
                feature.removeprefix("arrival_date_month_") == check_in.strftime("%B")
            )
    model_input = pd.DataFrame([feature_dict])
    for feature in MLR_FEATURES:
        if feature not in model_input:
            model_input[feature] = 0.0
    model_input = model_input[MLR_FEATURES].astype(float)

    predicted_log_multiplier = float(MLR_MODEL.predict(model_input)[0])
    multiplier = float(np.exp(predicted_log_multiplier))
    
    is_peak_month = check_in.month in PHILIPPINE_PEAK_MONTHS
    if is_peak_month:
        multiplier *= 1.15

    inflation_factor = max(
        0.0,
        (CURRENT_PSA_INFLATION_RATE - INFLATION_BASELINE_RATE) * 0.01,
    )
    multiplier *= (1.0 + inflation_factor)

    final_price = round(base_price * multiplier, 2)

    return (
        final_price,
        multiplier,
        {},
        "Unified MLR adapted for Philippine seasonality and inflation",
        base_price,
        base_price_source,
    )


def accommodation_base_price(destination: str, hotel_type: str) -> tuple[float, str]:
    city_key = normalize_city_name(destination)
    if city_key in PHILIPPINE_HOTEL_RATES:
        return PHILIPPINE_HOTEL_RATES[city_key], "local_csv_average"
    return float(DEFAULT_BASE_PRICES[hotel_type]), "regional_baseline"


def infer_hotel_type(destination: str) -> str:
    resort_cities = {"puerto princesa city", "tagaytay city", "alaminos", "legazpi city", "bohol"}
    return "Resort Hotel" if destination.strip().casefold() in resort_cities else "City Hotel"


def estimate_hotel_price(
    check_in: date,
    guests: int,
    destination: str,
    length_of_stay: int,
    room_type: str,
    hotel_type: str,
    selected_base_rate: float | None = None,
) -> dict:
    base_price, base_price_source = accommodation_base_price(destination, hotel_type)
    if selected_base_rate is not None:
        base_price = selected_base_rate
        base_price_source = "selected_csv_rate"
    season = "Peak season" if check_in.month in PHILIPPINE_PEAK_MONTHS else "Regular season"

    try:
        _, multiplier, model_evaluation, model_source, _, _ = predict_mlr_price(
            check_in, guests, destination, length_of_stay, room_type, hotel_type,
        )
        multiplier = min(multiplier, 3.0)
        price_source = f"{model_source} × {base_price_source.replace('_', ' ')}"
    except RuntimeError:
        seasonal = 1.15 if check_in.month in PHILIPPINE_PEAK_MONTHS else 1.0
        multiplier = (1 + (guests - 1) * 0.12) * seasonal
        inflation_factor = max(
            0.0,
            (CURRENT_PSA_INFLATION_RATE - INFLATION_BASELINE_RATE) * 0.01,
        )
        multiplier = min(multiplier * (1.0 + inflation_factor), 3.0)
        model_evaluation = {}
        price_source = f"Rule-based fallback × {base_price_source.replace('_', ' ')}; trained MLR unavailable"

    if multiplier is None or not np.isfinite(multiplier):
        seasonal = 1.15 if check_in.month in {12, 1, 2, 4} else 1.0
        multiplier = (1 + (guests - 1) * 0.12) * seasonal
        model_evaluation = {}
        price_source = f"Rule-based fallback × {base_price_source.replace('_', ' ')}; invalid MLR output"

    daily_price = round(base_price * multiplier, 2)
    return {
        "daily_price": daily_price,
        "total_price": round(daily_price * length_of_stay, 2),
        "length_of_stay": length_of_stay,
        "base_price": base_price,
        "base_price_source": base_price_source,
        "applied_multiplier": multiplier,
        "multiplier": round(multiplier, 4),
        "season": season,
        "model_evaluation": model_evaluation,
        "source": price_source,
    }


# Helper: translate Open-Meteo weather codes into the app's weather labels.
def weather_label_from_code(code: int) -> str:
    return "Clear / Sunny" if code == 0 else "Fair / Partly Cloudy" if code in {1, 2, 3, 45, 48} else "Heavy Rain / Rainy"


# Helper: provide the offline monthly weather fallback.
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


# Helper: convert destination names into stable URL-safe IDs.
def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


CLOTHING_WEATHER_MAP = {
    # These are the class names embedded in backend/app/model/best.pt.
    "short sleeve top": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "light, breathable coverage for sunny or hot weather",
        "primary": "Clear / Sunny",
    },
    "short sleeve dress": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "light, breathable coverage for sunny or hot weather",
        "primary": "Clear / Sunny",
    },
    "short sleeve outwear": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "light outer coverage for sunny or hot weather",
        "primary": "Fair / Partly Cloudy",
    },
    "shorts": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "short, breathable coverage for sunny or hot weather",
        "primary": "Clear / Sunny",
    },
    "skirt": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "lighter coverage for sunny or hot weather",
        "primary": "Clear / Sunny",
    },
    "sling dress": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "light, breathable coverage for sunny or hot weather",
        "primary": "Clear / Sunny",
    },
    "sling": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "minimal, breathable coverage for sunny or hot weather",
        "primary": "Clear / Sunny",
    },
    "vest dress": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "light, breathable coverage for sunny or hot weather",
        "primary": "Clear / Sunny",
    },
    "vest": {
        "conditions": ["Clear / Sunny", "Fair / Partly Cloudy", "Extreme Heat / Danger"],
        "phrase": "light, breathable coverage for sunny or hot weather",
        "primary": "Clear / Sunny",
    },
    "long sleeve top": {
        "conditions": ["Fair / Partly Cloudy", "Light Rain / Drizzle", "Heavy Rain / Rainy", "Windy / Stormy"],
        "phrase": "warmer coverage for cloudy, rainy, or windy weather",
        "primary": "Fair / Partly Cloudy",
    },
    "long sleeve outwear": {
        "conditions": ["Fair / Partly Cloudy", "Light Rain / Drizzle", "Heavy Rain / Rainy", "Windy / Stormy"],
        "phrase": "more protective coverage for cool, rainy, or windy weather",
        "primary": "Fair / Partly Cloudy",
    },
    "long sleeve dress": {
        "conditions": ["Fair / Partly Cloudy", "Light Rain / Drizzle", "Heavy Rain / Rainy", "Windy / Stormy"],
        "phrase": "more skin coverage for cloudy, rainy, or windy weather",
        "primary": "Fair / Partly Cloudy",
    },
    "trousers": {
        "conditions": ["Fair / Partly Cloudy", "Light Rain / Drizzle", "Heavy Rain / Rainy", "Windy / Stormy"],
        "phrase": "more skin coverage for cool, rainy, or windy weather",
        "primary": "Fair / Partly Cloudy",
    },
}

# Helper: map a detected clothing category to suitable weather conditions.
def classify_clothing_weather(category: str) -> dict[str, object]:
    normalized = category.strip().lower().replace("-", " ").replace("_", " ")
    mapping = CLOTHING_WEATHER_MAP.get(normalized)
    if mapping:
        return mapping
    return {"conditions": ["Fair / Partly Cloudy"], "phrase": "mild or unpredictable conditions", "primary": "Fair / Partly Cloudy"}

# Data helper: load the tourism dataset and build destination activity records.
GOLDEN_CSV_PATH = DATA_DIR / "philippines_tourism_with_coordinates_final.csv"
LEGACY_GOLDEN_CSV_PATH = DATA_DIR / "philippines_tourism_with_coordinates_final.csv"

def activity_group_name(raw_name: str) -> tuple[str, str]:
    """Split an activity's base name from an em/en-dash option suffix."""
    parts = re.split(r"\s+[—–]\s+", raw_name, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return raw_name.strip(), ""

# Helper: convert the source CSV into the destination structure used by the API.
def load_destinations_from_golden_dataset() -> list[dict]:
    dataset_path = GOLDEN_CSV_PATH if GOLDEN_CSV_PATH.exists() else LEGACY_GOLDEN_CSV_PATH
    if not dataset_path.exists():
        print("WARNING: Golden CSV not found. Ensure it is inside the /data folder.")
        return []

    data = pd.read_csv(dataset_path, encoding="utf-8-sig")
    destinations_by_city: dict[str, dict] = {}
    column_names = {str(column).strip().casefold(): column for column in data.columns}

    def row_value(row: pd.Series, *names: str):
        for name in names:
            column = column_names.get(name.casefold())
            if column is not None:
                value = row.get(column)
                if pd.notna(value) and str(value).strip():
                    return value
        return None

    for _, row in data.iterrows():
        city_name = str(row.get("City_or_Municipality", "")).strip()
        if not city_name or city_name.casefold() == "nan":
            continue

        city_key = normalize_city_name(city_name)
        destination = destinations_by_city.setdefault(
            city_key,
            {
                "name": city_name,
                "latitude": None,
                "longitude": None,
                "activities": [],
            },
        )

        latitude = pd.to_numeric(row.get("latitude"), errors="coerce")
        longitude = pd.to_numeric(row.get("longitude"), errors="coerce")
        if destination["latitude"] is None and pd.notna(latitude) and pd.notna(longitude):
            destination["latitude"] = float(latitude)
            destination["longitude"] = float(longitude)

        raw_name = str(row.get("Name", "")).strip()
        if not raw_name or raw_name.casefold() == "nan":
            continue
        name, name_variant = activity_group_name(raw_name)

        price = activity_price_per_pax(row)
        price_display = str(row.get("Price_Display", "")).strip()
        if not price_display or price_display.casefold() == "nan":
            price_display = ""
        hotel_rate = pd.to_numeric(row.get("Hotel_Rate_PHP_per_Night"), errors="coerce")
        numeric_price = (
            float(hotel_rate)
            if pd.notna(hotel_rate)
            else price if price is not None
            else display_price_amount(price_display)
        )
        hotel_room_type = str(row.get("Hotel_Room_Type", "")).strip()
        if hotel_room_type.casefold() == "nan":
            hotel_room_type = ""
        room_type = hotel_room_type or name_variant
        if not room_type:
            room_type = str(row.get("Activity_or_Room_Category", "")).strip()
        if not room_type or room_type.casefold() == "nan":
            room_type = name_variant or "Standard Room"
        record_type = str(row_value(row, "Record_Type") or "").strip()
        data_quality_notes = str(row_value(row, "Data_Quality_Notes") or "").strip()
        source_type = str(row_value(row, "Source_Type") or "").strip()
        source_url = source_url_for_row(row)
        nearby_activities = str(row_value(row, "Nearby_Activities_or_Attractions") or "").strip()
        nearby_proximity_basis = str(row_value(row, "Nearby_Proximity_Basis") or "").strip()
        hotel_check_in = str(row_value(row, "Hotel_Check_In", "Hotel_Check_in") or "").strip()
        hotel_check_out = str(row_value(row, "Hotel_Check_Out", "Hotel_Check_out") or "").strip()
        activity_duration = str(row_value(row, "Activity_Duration") or "").strip()
        open_days = str(row_value(row, "Open_Days") or "").strip()
        opening_time = str(row_value(row, "Opening_Time") or "").strip()
        closing_time = str(row_value(row, "Closing_Time") or "").strip()
        amenities = str(row_value(row, "Amenities_or_Inclusions") or "").strip()
        promos = str(row_value(row, "Promos_or_Discounts") or "").strip()
        hotel_rate = float(hotel_rate) if pd.notna(hotel_rate) else None
        hotel_occupancy = pd.to_numeric(row_value(row, "Hotel_Occupancy_Pax"), errors="coerce")
        hotel_occupancy = int(hotel_occupancy) if pd.notna(hotel_occupancy) and hotel_occupancy > 0 else None
        hotel_rate_per_pax = pd.to_numeric(row_value(row, "Hotel_Rate_PHP_per_Pax_per_Night"), errors="coerce")
        hotel_rate_per_pax = float(hotel_rate_per_pax) if pd.notna(hotel_rate_per_pax) else None
        tier = {
            "room_type": room_type,
            "option_label": name_variant or room_type,
            "price": numeric_price,
            "price_per_pax": price,
            "price_display": price_display,
            "record_type": record_type,
            "category": str(row.get("Activity_or_Room_Category", "")).strip(),
            "amenities_or_inclusions": amenities,
            "promos_or_discounts": promos,
            "data_quality_notes": data_quality_notes,
            "source_type": source_type,
            "source_url": source_url,
            "nearby_activities": nearby_activities,
            "nearby_proximity_basis": nearby_proximity_basis,
            "hotel_check_in": hotel_check_in,
            "hotel_check_out": hotel_check_out,
            "hotel_rate_per_night": hotel_rate,
            "hotel_occupancy_pax": hotel_occupancy,
            "hotel_rate_per_pax_per_night": hotel_rate_per_pax,
            "activity_duration": activity_duration,
            "open_days": open_days,
            "opening_time": opening_time,
            "closing_time": closing_time,
        }

        existing_activity = next(
            (activity for activity in destination["activities"] if activity["name"] == name),
            None,
        )
        if existing_activity is not None:
            if not any(
                option["room_type"] == tier["room_type"]
                and option["price"] == tier["price"]
                for option in existing_activity["pricing_tiers"]
            ):
                existing_activity["pricing_tiers"].append(tier)
            if tier["record_type"] and tier["record_type"] not in existing_activity["record_types"]:
                existing_activity["record_types"].append(tier["record_type"])
            if data_quality_notes and data_quality_notes not in existing_activity["data_quality_notes"]:
                existing_activity["data_quality_notes"].append(data_quality_notes)
            if nearby_activities and nearby_activities not in existing_activity["nearby_activities"]:
                existing_activity["nearby_activities"].append(nearby_activities)
            if not existing_activity["source_type"] and source_type:
                existing_activity["source_type"] = source_type
            if not existing_activity["source_url"] and source_url:
                existing_activity["source_url"] = source_url
            if not existing_activity["nearby_proximity_basis"] and nearby_proximity_basis:
                existing_activity["nearby_proximity_basis"] = nearby_proximity_basis
            if not existing_activity["hotel_check_in"] and hotel_check_in:
                existing_activity["hotel_check_in"] = hotel_check_in
            if not existing_activity["hotel_check_out"] and hotel_check_out:
                existing_activity["hotel_check_out"] = hotel_check_out
            if not existing_activity["amenities_or_inclusions"] and amenities:
                existing_activity["amenities_or_inclusions"] = amenities
            if not existing_activity["promos_or_discounts"] and promos:
                existing_activity["promos_or_discounts"] = promos
            if not existing_activity["activity_duration"] and activity_duration:
                existing_activity["activity_duration"] = activity_duration
            if not existing_activity["open_days"] and open_days:
                existing_activity["open_days"] = open_days
            if not existing_activity["opening_time"] and opening_time:
                existing_activity["opening_time"] = opening_time
            if not existing_activity["closing_time"] and closing_time:
                existing_activity["closing_time"] = closing_time
            numeric_tiers = [
                option for option in existing_activity["pricing_tiers"]
                if option["price"] is not None
            ]
            if numeric_tiers:
                primary_tier = min(numeric_tiers, key=lambda option: option["price"])
                existing_activity["price_per_pax"] = primary_tier["price_per_pax"]
                existing_activity["price_display"] = primary_tier["price_display"]
                existing_activity["real_price_php"] = primary_tier["price"]
            continue

        activity = {
            "name": name,
            "type": activity_type_for_record(row),
            "record_type": record_type,
            "record_types": [tier["record_type"]] if tier["record_type"] else [],
            "data_quality_notes": [data_quality_notes] if data_quality_notes else [],
            "source_type": source_type,
            "source_url": source_url,
            "nearby_activities": [nearby_activities] if nearby_activities else [],
            "nearby_proximity_basis": nearby_proximity_basis,
            "hotel_check_in": hotel_check_in,
            "hotel_check_out": hotel_check_out,
            "hotel_rate_per_night": hotel_rate,
            "hotel_occupancy_pax": hotel_occupancy,
            "hotel_rate_per_pax_per_night": hotel_rate_per_pax,
            "activity_duration": activity_duration,
            "open_days": open_days,
            "opening_time": opening_time,
            "closing_time": closing_time,
            "amenities_or_inclusions": amenities,
            "promos_or_discounts": promos,
            "hotel_type": "Resort Hotel" if activity_type_for_record(row) == "outdoor" else "City Hotel",
            "duration_hours": activity_duration_hours(row.get("Activity_Duration", "")),
            "exact_latitude": float(latitude) if pd.notna(latitude) else destination["latitude"],
            "exact_longitude": float(longitude) if pd.notna(longitude) else destination["longitude"],
            "price_per_pax": price,
            "price_display": price_display,
            "real_price_php": price if price is not None else 0.0,
            "pricing_tiers": [tier],
        }
        destination["activities"].append(activity)

    destinations_list = []
    for destination in destinations_by_city.values():
        city_name = destination["name"]
        activities = destination["activities"]
        city_lat = destination["latitude"] or 14.6042
        city_lon = destination["longitude"] or 120.9822

        if not any(activity["type"] == "indoor" for activity in activities):
            activities.append({
                "name": f"{city_name} Heritage Tour",
                "type": "indoor",
                "hotel_type": "City Hotel",
                "duration_hours": 3,
                "exact_latitude": city_lat,
                "exact_longitude": city_lon,
                "real_price_php": 0.0,
                "source_url": "City Center Fallback",
            })
        if not any(activity["type"] == "outdoor" for activity in activities):
            activities.append({
                "name": f"{city_name} City Park Walk",
                "type": "outdoor",
                "hotel_type": "Resort Hotel",
                "duration_hours": 3,
                "exact_latitude": city_lat,
                "exact_longitude": city_lon,
                "real_price_php": 0.0,
                "source_url": "City Center Fallback",
            })

        is_cold = bool(re.search(
            r"baguio|tagaytay|malaybalay|canlaon|bontoc|sagada",
            city_name,
            re.IGNORECASE,
        ))
        for activity in activities:
            activity["weather_tags"] = list(SUITABILITY_WEATHER_BY_DESTINATION.get(
                city_name.casefold(),
                WEATHER_OPTIONS,
            ))

        destinations_list.append({
            "id": slugify(city_name),
            "name": city_name,
            "location": city_name,
            "country": "Philippines",
            "hotel_type": "City Hotel",
            "base_price": PHILIPPINE_HOTEL_RATES.get(
                city_key,
                DEFAULT_BASE_PRICES["City Hotel"],
            ),
            "has_local_rate": city_key in PHILIPPINE_HOTEL_RATES,
            "latitude": city_lat,
            "longitude": city_lon,
            "main_weather": list(SUITABILITY_WEATHER_BY_DESTINATION.get(city_name.casefold(), WEATHER_OPTIONS))[0],
            "weather_tags": list(SUITABILITY_WEATHER_BY_DESTINATION.get(city_name.casefold(), WEATHER_OPTIONS)),
            "image": "https://images.unsplash.com/photo-1518544866330-95a85b8f8f6f?auto=format&fit=crop&w=1200&q=80",
            "activities": activities,
        })

    return destinations_list


def activity_type_for_record(row: pd.Series) -> str:
    text = " ".join(
        str(row.get(field, ""))
        for field in ("Record_Type", "Name", "Activity_or_Room_Category")
    ).casefold()
    if re.search(r"museum|gallery|indoor|culinary|food|tasting|aquarium|religious|heritage", text):
        return "indoor"
    return "outdoor"


def activity_duration_hours(value: object) -> int:
    text = str(value).casefold()
    if "full day" in text or "whole day" in text:
        return 8
    if "half day" in text:
        return 4
    match = re.search(r"\d+(?:\.\d+)?", text)
    if not match:
        return 3
    duration = float(match.group())
    if "minute" in text:
        return max(1, int(np.ceil(duration / 60)))
    if "day" in text:
        return max(1, int(duration * 8))
    return max(1, int(np.ceil(duration)))


def source_url_for_row(row: pd.Series) -> str | None:
    values = [
        row.get(column)
        for column in ("Source_URL", "Source_URLs")
        if column in row.index
    ]
    for value in values:
        if pd.isna(value):
            continue
        for candidate in re.split(r"[;\r\n,]+", str(value)):
            candidate = candidate.strip()
            parsed = urlparse(candidate)
            if parsed.scheme in {"http", "https"} and parsed.netloc:
                return candidate
    return None

DESTINATIONS = load_destinations_from_golden_dataset()

# Flatten coordinate dictionary so OSRM routing can lookup any specific activity name or city
DESTINATION_COORDINATES = {}
for d in DESTINATIONS:
    DESTINATION_COORDINATES[d["name"].lower()] = (d["latitude"], d["longitude"])
    DESTINATION_COORDINATES[d["id"]] = (d["latitude"], d["longitude"])
    for act in d["activities"]:
        DESTINATION_COORDINATES[act["name"].lower()] = (act["exact_latitude"], act["exact_longitude"])

# Helper: resolve a destination or activity name to latitude and longitude.
def destination_coordinates(destination: str) -> tuple[float, float]:
    key = destination.strip().lower()
    if key in DESTINATION_COORDINATES:
        return DESTINATION_COORDINATES[key]
    if key.endswith(" city") and key[:-5] in DESTINATION_COORDINATES:
        return DESTINATION_COORDINATES[key[:-5]]
    if f"{key} city" in DESTINATION_COORDINATES:
        return DESTINATION_COORDINATES[f"{key} city"]
        
    # If not found, return Manila center so the API never crashes
    return 14.6042, 120.9822


# Helper: query OSRM for a road route between two exact coordinate pairs.
def get_osrm_route(start_lat: float, start_lon: float, end_lat: float, end_lon: float) -> dict:
    """
    Queries the public OSRM routing engine using exact latitude and longitude.
    Returns GeoJSON road geometry, total road distance in meters, and travel duration in seconds.
    """
    # CRITICAL: OSRM expects coordinates in longitude,latitude order!
    url = f"http://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson"
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            return {
                "status": "success",
                "distance_meters": route["distance"],
                "distance_km": round(route["distance"] / 1000.0, 2),
                "duration_seconds": route["duration"],
                "duration_minutes": round(route["duration"] / 60.0, 1),
                "geometry": route["geometry"],  # GeoJSON line geometry for Leaflet.
            }
    except Exception as exc:
        print(f"OSRM Routing warning: Could not fetch road path ({exc})")

    # Fallback response when the public OSRM service is unavailable.
    return {
        "status": "fallback",
        "distance_meters": 0.0,
        "distance_km": 0.0,
        "duration_seconds": 0.0,
        "duration_minutes": 0.0,
        "geometry": None
    }


WEATHER_CACHE: dict[str, dict] = {}
FORECAST_WINDOW_CACHE: dict[str, dict] = {}
DESTINATION_LIST_FORECAST_CACHE: dict[str, dict[str, dict]] = {}


def fetch_destination_list_forecasts(target_date: date) -> dict[str, dict]:
    """Fetch one forecast window for all destination coordinates used by the listing."""
    cache_key = target_date.isoformat()
    if cache_key in DESTINATION_LIST_FORECAST_CACHE:
        return DESTINATION_LIST_FORECAST_CACHE[cache_key]

    coordinates = [
        destination for destination in DESTINATIONS
        if destination.get("latitude") is not None and destination.get("longitude") is not None
    ]
    days_diff = (target_date - date.today()).days
    forecasts: dict[str, dict] = {}
    if coordinates and 0 <= days_diff <= 16:
        try:
            response = requests.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": ",".join(str(item["latitude"]) for item in coordinates),
                    "longitude": ",".join(str(item["longitude"]) for item in coordinates),
                    "forecast_days": 16,
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max,apparent_temperature_max",
                    "timezone": "Asia/Manila",
                },
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
            payloads = payload if isinstance(payload, list) else [payload]
            for destination, forecast_payload in zip(coordinates, payloads):
                daily = forecast_payload.get("daily", {})
                if target_date.isoformat() not in daily.get("time", []):
                    continue
                index = daily["time"].index(target_date.isoformat())
                weather_code = int(daily["weather_code"][index])
                temperature_max = round(float(daily["temperature_2m_max"][index]), 1)
                temperature_min = round(float(daily["temperature_2m_min"][index]), 1)
                condition = weather_label_from_code(weather_code)
                forecasts[destination["id"]] = {
                    "condition": get_pagasa_condition(
                        round((temperature_max + temperature_min) / 2, 1),
                        float(daily["precipitation_sum"][index] or 0),
                        float(daily["windspeed_10m_max"][index] or 12),
                        float(daily["apparent_temperature_max"][index] or temperature_max + 4),
                    ),
                    "weather_code": weather_code,
                    "temperature_max_c": temperature_max,
                    "temperature_min_c": temperature_min,
                    "average_temperature": round((temperature_max + temperature_min) / 2, 1),
                    "precipitation_probability": daily["precipitation_probability_max"][index],
                    "precipitation_sum_mm": daily["precipitation_sum"][index],
                    "source": "Open-Meteo live forecast",
                }
        except (requests.RequestException, ValueError, TypeError, KeyError) as exc:
            print(f"Open-Meteo destination list forecast error: {exc}")

    if not forecasts:
        fallback = monthly_weather_for_date(target_date)
        forecasts = {destination["id"]: fallback for destination in coordinates}

    DESTINATION_LIST_FORECAST_CACHE[cache_key] = forecasts
    return forecasts

# Helper: fetch and cache live, historical, or fallback weather data.
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
                        p_prob = int(daily["precipitation_probability_max"][i]) if daily.get("precipitation_probability_max") and daily["precipitation_probability_max"][i] is not None else (90 if weather_label_from_code(w_code) == "Heavy Rain / Rainy" else 20)
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
                            "precipitation_probability": 85 if weather_label_from_code(w_code) == "Heavy Rain / Rainy" else 15,
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
                        dom_cond = max(cond_counts, key=cond_counts.get) if codes else "Clear / Sunny"
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

    # STRICT PAGASA INTERCEPT BEFORE RETURNING TO FRONTEND
    for day_str, fc in results.items():
        t = float(fc.get("average_temperature", 28.0))
        r = float(fc.get("precipitation_sum_mm", 0.0))
        w = float(fc.get("wind_speed_kmh", 12.0))
        h = float(fc.get("apparent_temperature_max", t + 4.0))
        fc["condition"] = get_pagasa_condition(t, r, w, h)

    return results


# Helper: calculate a five-year historical weather comparison.
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
                dominant = max(counts, key=counts.get) if counts else "Fair / Partly Cloudy"
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


# Helper: compare a forecast's rainfall with historical rainfall.
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


# Helper: return weather conditions preferred by an activity type.
def preference(activity_type: str) -> tuple[str, ...]:
    normalized = activity_type.strip().lower()
    if normalized == "outdoor": 
        return ("Clear / Sunny", "Fair / Partly Cloudy")
    if normalized == "indoor": 
        return ("Light Rain / Drizzle", "Heavy Rain / Rainy", "Windy / Stormy", "Extreme Heat / Danger")
    raise HTTPException(422, "Activity type must be either 'indoor' or 'outdoor'.")


# Helper: load outfit image bytes from base64 data or a URL.
def image_bytes(payload: OutfitPayload) -> bytes:
    if payload.image_base64:
        try: return b64decode(payload.image_base64.split(",", 1)[-1], validate=True)
        except Base64Error as exc: raise ValueError("Invalid base64 image data") from exc
    if payload.image_url:
        response = requests.get(payload.image_url, timeout=20); response.raise_for_status(); return response.content
    raise ValueError("Provide either image_url or image_base64")

model = None

# Helper: lazily load the YOLO clothing model on first use.
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
            category = model.names[class_index]
            
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
def get_destinations(
    check_in: date | None = None,
    check_out: date | None = None,
    guests: int = 1,
    room_type: str = "Standard Room",
):
    if guests < 1:
        raise HTTPException(422, "guests must be at least one.")

    target_date = check_in or date.today()
    if check_out and check_out < target_date:
        raise HTTPException(422, "check_out must not be before check_in.")
    length_of_stay = max(1, (check_out - target_date).days) if check_out else 1

    destinations = []
    list_forecasts = fetch_destination_list_forecasts(target_date)
    for destination in DESTINATIONS:
        forecast = list_forecasts.get(destination["id"], {})
        estimated_prices = {}
        for hotel_type in ("City Hotel", "Resort Hotel"):
            estimate = estimate_hotel_price(
                target_date,
                guests,
                destination["name"],
                length_of_stay,
                room_type,
                hotel_type,
            )
            estimated_prices[hotel_type] = estimate
        destinations.append({
            **destination,
            "weather_condition": forecast.get("condition", destination["main_weather"]),
            "weather_forecast": forecast,
            "estimated_prices": estimated_prices,
        })
    return {"destinations": destinations}


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
    try:
        lat, lon = destination_coordinates(destination["name"])
        fc_map = fetch_forecast(lat, lon, [target_date])
        fc = fc_map[target_date]
        hist = historical_weather(lat, lon, [target_date])
    except HTTPException:
        fc = monthly_weather_for_date(date.fromisoformat(target_date))
        fc["average_temperature"] = MONTHLY_WEATHER[date.fromisoformat(target_date).month][0]
        hist = historical_weather(14.6042, 120.9822, [target_date])
    comparison = build_weather_comparison(fc, hist)
    
    # Keep activity recommendations aligned with final-planner preference rules.
    # The decision tree remains responsible for safety/hazard classification.
    is_outdoor_friendly = fc["condition"] in preference("outdoor")

    # Run the decision tree consistently for the forecast payload's hazard metadata.
    if WEATHER_DECISION_TREE:
        avg_temp = float(fc.get('average_temperature', 28.0))
        precip = float(fc.get('precipitation_sum_mm', 0.0))
        wind = float(fc.get('wind_speed_kmh', 12.0))
        heat_idx = float(fc.get('apparent_temperature_max', avg_temp + 4.0))
        
        features_df = pd.DataFrame([[avg_temp, precip, wind, heat_idx, 1]], columns=['average_temperature_c', 'precipitation_mm', 'wind_speed_kmh', 'heat_index_c', 'hotel_is_resort'])
        prediction = int(WEATHER_DECISION_TREE.predict(features_df)[0])
        fc["decision_tree_hazard"] = prediction == 0
    else:
        fc["decision_tree_hazard"] = None

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

    destination_name = payload.destination or payload.destination_name
    if not destination_name and payload.destination_id:
        destination_record = next(
            (item for item in DESTINATIONS if item["id"] == payload.destination_id),
            None,
        )
        destination_name = destination_record["name"] if destination_record else None
    if not destination_name:
        raise HTTPException(422, "A destination name or valid destination_id is required.")

    hotel_type = payload.hotel_type
    if hotel_type not in {"City Hotel", "Resort Hotel"}:
        hotel_type = infer_hotel_type(destination_name)
    length_of_stay = max(1, (payload.check_out - payload.check_in).days)
    estimate = estimate_hotel_price(
        payload.check_in,
        payload.guests,
        destination_name,
        length_of_stay,
        payload.room_type,
        hotel_type,
        payload.selected_base_rate,
    )
    base_price = estimate["base_price"]
    base_price_source = estimate["base_price_source"]
    multiplier = estimate["multiplier"]
    model_evaluation = estimate["model_evaluation"]
    season = estimate["season"]
    price_source = estimate["source"]

    if multiplier is None or base_price is None:
        return {
            "status": "success",
            "price": None,
            "daily_price": None,
            "total_price": None,
            "length_of_stay": length_of_stay,
            "currency": "PHP",
            "hotel_type": hotel_type,
            "base_price": base_price,
            "base_price_source": base_price_source,
            "price_source_flag": "not_listed",
            "multiplier": None,
            "surge_multiplier": None,
            "month": payload.check_in.strftime("%B"),
            "season": season,
            "model_evaluation": model_evaluation,
            "source": price_source,
        }

    try:
        lat, lon = destination_coordinates(destination_name)
        fc_map = fetch_forecast(lat, lon, [payload.check_in.isoformat()])
        weather = fc_map[payload.check_in.isoformat()]
        hist = historical_weather(lat, lon, [payload.check_in.isoformat()])
        comparison = build_weather_comparison(weather, hist)
    except Exception:
        weather = monthly_weather_for_date(payload.check_in)
        hist = historical_weather(14.6042, 120.9822, [payload.check_in.isoformat()])
        comparison = build_weather_comparison(weather, hist)

    # Keep price recommendations aligned with final-planner preference rules.
    rec_type = "outdoor" if weather["condition"] in preference("outdoor") else "indoor"

    rec_reason = (
        f"Forecast is {weather['condition']} ({weather.get('average_temperature', 28)}°C) — recommended for outdoor activities."
        if rec_type == "outdoor" else
        f"Rainy forecast detected ({weather.get('precipitation_sum_mm', 10)} mm rain) — indoor activities are recommended."
    )
    
    daily_price = estimate["daily_price"]
    total_price = estimate["total_price"]

    return {
        "status": "success",
        "price": total_price,
        "daily_price": daily_price,
        "total_price": total_price,
        "length_of_stay": length_of_stay,
        "currency": "PHP",
        "hotel_type": hotel_type,
        "base_price": base_price,
        "base_price_source": base_price_source,
        "price_source_flag": "local_rate" if base_price_source in {"local_csv_average", "selected_csv_rate"} else "regional_baseline",
        "applied_multiplier": estimate["applied_multiplier"],
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
        hotel_type = activity.hotel_type if activity.hotel_type in DEFAULT_BASE_PRICES else ("Resort Hotel" if act_type == "outdoor" else "City Hotel")
        hotel_is_resort = int(hotel_type == "Resort Hotel")
        activity_key = (normalize_city_name(destination), activity.name.strip().casefold())
        dataset_price = PHILIPPINE_ACTIVITY_PRICES.get(activity_key)
        price_per_person = resolved_activity_price_per_pax(
            activity.price_per_pax,
            activity.price_display,
            dataset_price,
        )
        estimated_price = round(price_per_person * activity.guests, 2) if price_per_person is not None else None
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

       # FIXED HAZARD FLAG: Only flag severe conditions, NOT Light Rain / Drizzle
        if WEATHER_DECISION_TREE:
            avg_temp = float(matched_fc.get('average_temperature', average_temperature))
            precip = float(rainfall)
            wind = float(matched_fc.get('wind_speed_kmh', 12.0))
            heat_idx = float(matched_fc.get('apparent_temperature_max', avg_temp + 4.0))
            is_resort_val = 1 if act_type == "outdoor" else 0
            
            features_df = pd.DataFrame([[avg_temp, precip, wind, heat_idx, is_resort_val]], columns=['average_temperature_c', 'precipitation_mm', 'wind_speed_kmh', 'heat_index_c', 'hotel_is_resort'])
            prediction = int(WEATHER_DECISION_TREE.predict(features_df)[0])
            # Only trigger safety alert for true hazardous prediction OR heavy conditions
            hazard_flag = (act_type == "outdoor" and (prediction == 0 or matched_fc["condition"] in {"Heavy Rain / Rainy", "Windy / Stormy", "Extreme Heat / Danger"}))
        else:
            hazard_flag = act_type == "outdoor" and matched_fc["condition"] in {"Heavy Rain / Rainy", "Windy / Stormy", "Extreme Heat / Danger"}

        activity_coords = (
            (activity.exact_latitude, activity.exact_longitude)
            if activity.exact_latitude is not None and activity.exact_longitude is not None
            else DESTINATION_COORDINATES.get(
                activity.name.strip().lower(),
                destination_coordinates(destination),
            )
        )
        scheduled[day].append({
            "name": activity.name.strip(),
            "type": act_type,
            "destination": destination,
            "exact_latitude": activity_coords[0],
            "exact_longitude": activity_coords[1],
            "assigned_day": activity.assigned_day,
            "guests": activity.guests,
            "time": activity.time,
            "price_per_pax": activity.price_per_pax,
            "price_display": activity.price_display,
            "real_price_php": activity.real_price_php,
            "estimated_price": estimated_price,
            "price_source": "local_activity_csv" if estimated_price is not None else "unavailable",
            "weather": matched_fc["condition"],
            "weather_forecast": matched_fc,
            "decision_features": decision_features,
            "decision": decision_msg,
            "hazard_flag": hazard_flag,
        })

    totals: dict[str, dict[str, float]] = {}
    for activities in scheduled.values():
        for activity in activities:
            if activity["estimated_price"] is None:
                activity["price_range"] = None
                continue
            estimated_price = float(activity["estimated_price"])
            activity["price_range"] = {"min": estimated_price, "max": estimated_price}
            total = totals.setdefault(str(activity["destination"]), {"min": 0, "max": 0})
            total["min"] += activity["price_range"]["min"]
            total["max"] += activity["price_range"]["max"]

    itinerary = []
    for day in payload.target_dates:
        day_activities = scheduled[day]
        destination = str(day_activities[0]["destination"]) if day_activities else destinations[0]
        forecast = forecasts.get(destination, {}).get(day, monthly_weather_for_date(date.fromisoformat(day)))
        hist = history.get(destination, {"years": 5, "dominant_condition": "Unknown", "average_rainfall_mm": 0, "source": "historical weather data"})
        comp = comparisons.get(destination, {}).get(day, build_weather_comparison(forecast, hist))

        # Build road routes between consecutive stops using their exact coordinates.
        route_segments = []
        for i in range(len(day_activities) - 1):
            curr = day_activities[i]
            nxt = day_activities[i + 1]
            start_coords = (
                curr["exact_latitude"],
                curr["exact_longitude"],
            )
            end_coords = (
                nxt["exact_latitude"],
                nxt["exact_longitude"],
            )
            road_data = get_osrm_route(
                start_coords[0],
                start_coords[1],
                end_coords[0],
                end_coords[1],
            )
            route_segments.append({
                "from": curr["name"],
                "to": nxt["name"],
                "routing": road_data,
            })

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
            "scheduled_activities": day_activities,
            "route_segments": route_segments,
            "outfit_advice": f"At {destination}, {OUTFIT_ADVICE.get(forecast.get('condition'), OUTFIT_ADVICE['Clear / Sunny'])}",
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
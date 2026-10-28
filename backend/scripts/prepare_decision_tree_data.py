import csv
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def read_csv(filename):
    with (DATA_DIR / filename).open("r", newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def destination_key(value):
    """Create one comparison key for destination names from both source CSVs."""
    return " ".join(value.strip().casefold().split())


def weather_label(weather_code, precipitation_mm, temperature_max_c, wind_speed_kmh):
    code = int(weather_code)
    precip = float(precipitation_mm or 0)
    tmax = float(temperature_max_c or 0)
    wind = float(wind_speed_kmh or 0)
    
    # Absolute extreme / typhoon check (PAGASA-aligned)
    if code in {95, 96, 99} or wind >= 62.0 or precip >= 30.0:
        return "Typhoon / Severe Storm"
    # Truly clear or zero-rain high temperature days in tropical climates
    elif code == 0 or (precip == 0.0 and tmax >= 32.0):
        return "Clear / Sunny"
    # Partly cloudy / fair weather transition days
    elif code in {1, 2} or (precip == 0.0 and tmax >= 30.0):
        return "Partly Cloudy"
    # Overcast skies with zero precipitation
    elif code in {3, 45, 48} and precip == 0.0:
        return "Overcast"
    # Light passing tropical drizzles or minor rain (< 5mm)
    elif code in {51, 53, 55, 56, 57} or (precip > 0.0 and precip < 5.0):
        return "Light Showers / Drizzle"
    # Sustained heavy rainfall
    else:
        return "Heavy Rain"


def historical_period():
    today = date.today()
    return today.replace(year=today.year - 5), today.replace(year=today.year - 1)


def fetch_weather_chunk(destination, start_date, end_date):
    params = {
        "latitude": destination["latitude"],
        "longitude": destination["longitude"],
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,apparent_temperature_max",
        "timezone": "auto",
    }
    
    response = None
    for attempt in range(5):
        try:
            response = requests.get(ARCHIVE_URL, params=params, timeout=120)
            
            # If the server says we are going too fast, wait 60 seconds and retry
            if response.status_code == 429:
                print("  [!] Rate limit hit! Pausing for 60 seconds...")
                time.sleep(60)
                continue
                
            response.raise_for_status()
            
            # Add a 1.5 second delay after successful requests to pace them
            time.sleep(1.5)
            break
        except requests.RequestException:
            if attempt == 4:
                raise
            time.sleep(5)

    # SAFETY CHECK: Ensure response has text and is valid JSON before parsing
    if response is None or not response.text or not response.text.strip():
        print(f"\n  [!] Empty response received for {destination['destination']}.")
        return []

    try:
        data = response.json()
    except requests.exceptions.JSONDecodeError:
        print(f"\n  [!] Invalid JSON received for {destination['destination']}.")
        return []

    if "daily" not in data:
        print(f"\n  [!] API Error for {destination['destination']}: {data}")
        return []
        
    daily = data["daily"]
    
    rows = []
    for index, weather_date in enumerate(daily["time"]):
        temperature_max = daily["temperature_2m_max"][index]
        temperature_min = daily["temperature_2m_min"][index]
        average_temperature = (temperature_max + temperature_min) / 2
        precipitation = daily["precipitation_sum"][index]
        wind_speed = daily["windspeed_10m_max"][index]
        w_code = daily["weather_code"][index]
        
        weather_day = datetime.strptime(weather_date, "%Y-%m-%d").date()
        rows.append(
            {
                "date": weather_date,
                "destination": destination["destination"],
                "weather_code": w_code,
                "weather_condition": weather_label(w_code, precipitation, temperature_max, wind_speed),
                "temperature_max_c": temperature_max,
                "temperature_min_c": temperature_min,
                "average_temperature_c": average_temperature,
                "precipitation_mm": precipitation,
                "wind_speed_kmh": wind_speed,
                "heat_index_c": daily["apparent_temperature_max"][index],
                "is_weekend": int(weather_day.weekday() in {4, 5, 6}),
            }
        )
    return rows


def fetch_weather(destination, start_date, end_date):
    rows = []
    chunk_start = start_date
    while chunk_start <= end_date:
        chunk_end = min(
            chunk_start.replace(year=chunk_start.year + 1) - timedelta(days=1),
            end_date,
        )
        print(f"  Downloading {chunk_start} to {chunk_end}...")
        rows.extend(fetch_weather_chunk(destination, chunk_start, chunk_end))
        chunk_start = chunk_end + timedelta(days=1)
    return rows


def write_csv(filename, rows, fieldnames):
    with (DATA_DIR / filename).open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    destinations = read_csv("destinations.csv")
    activities = read_csv("activities.csv")
    non_philippine = [
        destination["destination"]
        for destination in destinations
        if destination["country"].strip().lower() != "philippines"
    ]
    if non_philippine:
        raise ValueError(
            "Primary Decision Tree data must be Philippines-only. "
            f"Review: {', '.join(non_philippine)}"
        )
    start_date, end_date = historical_period()

    weather_rows = []
    completed_destinations = set()
    weather_history_path = DATA_DIR / "weather_history.csv"

    # RESUME FEATURE: Check if we already downloaded some cities previously
    if weather_history_path.exists():
        existing_weather = read_csv("weather_history.csv")
        completed_destinations = {row["destination"] for row in existing_weather}
        weather_rows.extend(existing_weather)
        print(f"[+] Resuming: Found {len(completed_destinations)} destinations already saved in weather_history.csv")

    for destination in destinations:
        dest_name = destination['destination']
        if dest_name in completed_destinations:
            print(f"-> Skipping {dest_name} (already downloaded).")
            continue

        print(f"Downloading weather history for {dest_name}...")
        new_rows = fetch_weather(destination, start_date, end_date)
        if new_rows:
            weather_rows.extend(new_rows)
            # Incremental save: save progress immediately after each successful city!
            write_csv(
                "weather_history.csv",
                weather_rows,
                [
                    "date",
                    "destination",
                    "weather_code",
                    "weather_condition",
                    "temperature_max_c",
                    "temperature_min_c",
                    "average_temperature_c",
                    "precipitation_mm",
                    "wind_speed_kmh",
                    "heat_index_c",
                    "is_weekend",
                ],
            )
            print(f"[+] Saved progress for {dest_name}.")
        
        # Add a small buffer pause between cities to protect your IP quota
        time.sleep(3)

    print("All weather data downloaded successfully. Generating activity suitability matrix...")

    suitability_rows = []
    activities_by_destination = {}
    for activity in activities:
        key = destination_key(activity["destination"])
        activities_by_destination.setdefault(key, []).append(activity)

    destination_keys = {destination_key(row["destination"]) for row in destinations}
    missing_activity_destinations = sorted(
        {
            activity["destination"]
            for activity in activities
            if destination_key(activity["destination"]) not in destination_keys
        }
    )
    if missing_activity_destinations:
        raise ValueError(
            "Activities reference destinations missing from destinations.csv: "
            + ", ".join(missing_activity_destinations)
        )

    for weather in weather_rows:
        matching_activities = activities_by_destination.get(destination_key(weather["destination"]), [])
        for activity in matching_activities:
            activity_type = activity["activity_type"]
            condition = weather["weather_condition"]
            hotel_type = "Resort Hotel" if activity_type == "outdoor" else "City Hotel"
            hotel_is_resort = int(hotel_type == "Resort Hotel")
            average_temperature = float(weather["average_temperature_c"])
            rainfall = float(weather["precipitation_mm"] or 0)
            wind = float(weather.get("wind_speed_kmh", 0) or 0)
            heat = float(weather.get("heat_index_c", 0) or 0)

            is_extreme = (rainfall >= 30.0) or (wind >= 62.0) or (condition == "Typhoon / Severe Storm")

            if is_extreme:
                suitable_flag = 0
            elif activity_type == "indoor":
                suitable_flag = 1
            else:
                suitable_flag = int(
                    condition in {"Clear / Sunny", "Partly Cloudy", "Overcast", "Light Showers / Drizzle"} 
                    and rainfall < 15.0 
                    and wind < 39.0 
                    and heat < 42.0
                )

            suitability_rows.append(
                {
                    **weather,
                    "activity_name": activity["activity_name"],
                    "activity_type": activity_type,
                    "duration_hours": activity["duration_hours"],
                    "hotel_type": hotel_type,
                    "hotel_is_resort": hotel_is_resort,
                    "hotel_temp": hotel_is_resort * average_temperature,
                    "hotel_rain": hotel_is_resort * rainfall,
                    "activity_suitable": suitable_flag,
                    "decision_label_source": "prototype_rule_label",
                }
            )

    write_csv(
        "activity_suitability.csv",
        suitability_rows,
        [
            "date",
            "destination",
            "activity_name",
            "activity_type",
            "duration_hours",
            "weather_code",
            "weather_condition",
            "temperature_max_c",
            "temperature_min_c",
            "average_temperature_c",
            "precipitation_mm",
            "wind_speed_kmh",
            "heat_index_c",
            "is_weekend",
            "activity_suitable",
            "hotel_type",
            "hotel_is_resort",
            "hotel_temp",
            "hotel_rain",
            "decision_label_source",
        ],
    )
    
    weather_counts = {}
    for weather in weather_rows:
        key = destination_key(weather["destination"])
        weather_counts[key] = weather_counts.get(key, 0) + 1
    expected_rows = sum(
        weather_counts.get(destination_key(activity["destination"]), 0)
        for activity in activities
    )
    if len(suitability_rows) != expected_rows:
        raise RuntimeError(
            f"Suitability row integrity check failed: expected {expected_rows}, "
            f"created {len(suitability_rows)}."
        )
        
    print(f"Wrote {len(weather_rows)} weather rows to data/weather_history.csv")
    print(f"Wrote {len(suitability_rows)} labeled rows to data/activity_suitability.csv")


if __name__ == "__main__":
    main()
import csv
import time
from datetime import date, timedelta
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def read_csv(filename):
    with (DATA_DIR / filename).open("r", newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def weather_label(weather_code):
    code = int(weather_code)
    if code == 0:
        return "Sunny"
    if code in {1, 2, 3, 45, 48}:
        return "Cloudy"
    return "Rainy"


def historical_period():
    today = date.today()
    return today.replace(year=today.year - 5), today.replace(year=today.year - 1)


def fetch_weather_chunk(destination, start_date, end_date):
    params = {
        "latitude": destination["latitude"],
        "longitude": destination["longitude"],
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto",
    }
    for attempt in range(3):
        try:
            response = requests.get(ARCHIVE_URL, params=params, timeout=120)
            response.raise_for_status()
            break
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    daily = response.json()["daily"]
    rows = []
    for index, weather_date in enumerate(daily["time"]):
        rows.append(
            {
                "date": weather_date,
                "destination": destination["destination"],
                "weather_code": daily["weather_code"][index],
                "weather_condition": weather_label(daily["weather_code"][index]),
                "temperature_max_c": daily["temperature_2m_max"][index],
                "temperature_min_c": daily["temperature_2m_min"][index],
                "precipitation_mm": daily["precipitation_sum"][index],
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
    for destination in destinations:
        print(f"Downloading weather history for {destination['destination']}...")
        weather_rows.extend(fetch_weather(destination, start_date, end_date))

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
            "precipitation_mm",
        ],
    )

    suitability_rows = []
    activities_by_destination = {}
    for activity in activities:
        activities_by_destination.setdefault(activity["destination"], []).append(activity)

    for weather in weather_rows:
        for activity in activities_by_destination[weather["destination"]]:
            activity_type = activity["activity_type"]
            condition = weather["weather_condition"]
            suitability_rows.append(
                {
                    **weather,
                    "activity_name": activity["activity_name"],
                    "activity_type": activity_type,
                    "duration_hours": activity["duration_hours"],
                    "activity_suitable": int(
                        (activity_type == "outdoor" and condition in {"Sunny", "Cloudy"})
                        or (activity_type == "indoor" and condition == "Rainy")
                    ),
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
            "precipitation_mm",
            "activity_suitable",
            "decision_label_source",
        ],
    )
    print(f"Wrote {len(weather_rows)} weather rows to data/weather_history.csv")
    print(f"Wrote {len(suitability_rows)} labeled rows to data/activity_suitability.csv")


if __name__ == "__main__":
    main()

import pandas as pd
import numpy as np
import requests
import time
import os
from datetime import datetime

# File Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CSV_INPUT_PATH = os.path.join(BASE_DIR, 'app', 'philippines_tourism_activities_and_hotels.csv')
OUTPUT_CSV_PATH = os.path.join(BASE_DIR, 'data', 'activity_suitability.csv')

START_DATE = "2020-01-01"
END_DATE = "2026-10-31"

def get_coordinates(city_name):
    try:
        query = f"{city_name}, Philippines"
        url = f"https://geocoding-api.open-meteo.com/v1/search?name={query}&count=1&format=json"
        response = requests.get(url).json()
        if 'results' in response and len(response['results']) > 0:
            return response['results'][0]['latitude'], response['results'][0]['longitude']
    except Exception:
        pass
    return 14.5995, 120.9842 # Fallback to Manila

def fetch_weather_data(lat, lon, city):
    url = (f"https://archive-api.open-meteo.com/v1/archive?"
           f"latitude={lat}&longitude={lon}&start_date={START_DATE}&end_date={END_DATE}"
           f"&daily=temperature_2m_mean,precipitation_sum,wind_speed_10m_max,apparent_temperature_max"
           f"&timezone=Asia%2FSingapore")
    
    for attempt in range(5):
        try:
            response = requests.get(url, timeout=120)
            if response.status_code == 429:
                print(f"  [!] Rate limit hit for {city}! Pausing for 60 seconds...")
                time.sleep(60)
                continue
            
            response.raise_for_status()
            data = response.json()['daily']
            
            df = pd.DataFrame({
                'date': data['time'],
                'destination': city,
                'average_temperature_c': data['temperature_2m_mean'],
                'precipitation_mm': data['precipitation_sum'],
                'wind_speed_kmh': data['wind_speed_10m_max'],
                'heat_index_c': data['apparent_temperature_max']
            })
            
            # Add is_weekend column matching old logic
            df['is_weekend'] = pd.to_datetime(df['date']).dt.dayofweek.isin([4, 5, 6]).astype(int)
            return df.dropna()
            
        except requests.RequestException:
            time.sleep(5)
    return pd.DataFrame()

def inject_random_noise(df):
    np.random.seed(42) 
    df['average_temperature_c'] += np.random.normal(0, 1.5, len(df))
    df['precipitation_mm'] += np.random.normal(0, 3.0, len(df))
    df['precipitation_mm'] = df['precipitation_mm'].clip(lower=0.0)
    df['wind_speed_kmh'] += np.random.normal(0, 4.0, len(df))
    df['wind_speed_kmh'] = df['wind_speed_kmh'].clip(lower=0.0)
    df['heat_index_c'] += np.random.normal(0, 2.0, len(df))
    return df.round(1)

def apply_pagasa_heuristic(row):
    temp, rain = row['average_temperature_c'], row['precipitation_mm']
    wind, heat = row['wind_speed_kmh'], row['heat_index_c']
    resort = row['hotel_is_resort']
    
    if wind > 45.0: return pd.Series(['Typhoon / Severe Storm', 0])
    elif heat > 42.0: return pd.Series(['Dangerous Heat', 0])
    elif rain > 15.0: return pd.Series(['Heavy Rain', 0])
    elif rain > 2.0: return pd.Series(['Light Showers / Drizzle', 0]) if resort == 1 else pd.Series(['Light Showers / Drizzle', 1])
    elif rain <= 2.0 and temp < 31.0: return pd.Series(['Clear / Sunny', 1])
    else: return pd.Series(['Partly Cloudy', 1])

def main():
    print("--- Starting Decision Tree Data Preparation ---")
    
    try:
        activities_df = pd.read_csv(CSV_INPUT_PATH)
        cities_to_fetch = activities_df['City_or_Municipality'].dropna().unique()
    except Exception as e:
        print(f"Error reading {CSV_INPUT_PATH}: {e}")
        return

    completed_cities = set()
    if os.path.exists(OUTPUT_CSV_PATH):
        try:
            existing_df = pd.read_csv(OUTPUT_CSV_PATH)
            completed_cities = set(existing_df['destination'].unique())
            print(f"[+] Resuming: Found {len(completed_cities)} cities already saved.")
        except Exception:
            pass
            
    for city in cities_to_fetch:
        if city in completed_cities:
            print(f"-> Skipping {city} (already downloaded).")
            continue
            
        print(f"Downloading weather history for {city}...", end=" ")
        lat, lon = get_coordinates(city)
        city_df = fetch_weather_data(lat, lon, city)
        
        if not city_df.empty:
            city_df = inject_random_noise(city_df)
            
            # Simulate both contexts for every day
            city_context = city_df.copy()
            city_context['hotel_type'] = 'City Hotel'
            city_context['hotel_is_resort'] = 0
            
            resort_context = city_df.copy()
            resort_context['hotel_type'] = 'Resort Hotel'
            resort_context['hotel_is_resort'] = 1
            
            final_df = pd.concat([city_context, resort_context], ignore_index=True)
            
            # Apply labels and safe flag
            final_df[['weather_condition', 'activity_suitable']] = final_df.apply(apply_pagasa_heuristic, axis=1)
            
            # Recreate exact missing ML interaction columns
            final_df['hotel_temp'] = (final_df['hotel_is_resort'] * final_df['average_temperature_c']).round(1)
            final_df['hotel_rain'] = (final_df['hotel_is_resort'] * final_df['precipitation_mm']).round(1)
            final_df['decision_label_source'] = "prototype_rule_label"
            
            # Incremental save
            header = not os.path.exists(OUTPUT_CSV_PATH)
            final_df.to_csv(OUTPUT_CSV_PATH, mode='a', header=header, index=False)
            print("[+] Saved.")
        
        time.sleep(3)

    print(f"\n--- SUCCESS! Dataset generated for training! ---")

if __name__ == "__main__":
    main()
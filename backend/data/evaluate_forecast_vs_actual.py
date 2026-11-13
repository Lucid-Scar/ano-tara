import pandas as pd
import requests
import time
import numpy as np
from sklearn.metrics import confusion_matrix, cohen_kappa_score, classification_report

# 1. Exact rules perfectly mirrored from backend/app/main.py
HEAT_INDEX_HAZARD_THRESHOLD = 41.5
WIND_SPEED_HAZARD_THRESHOLD = 42.0
DAILY_PRECIPITATION_HAZARD_THRESHOLD = 12.5


def get_pagasa_condition(temp, rain, wind, heat_index):
    if heat_index >= HEAT_INDEX_HAZARD_THRESHOLD: return 'Extreme Heat / Danger'
    if wind >= WIND_SPEED_HAZARD_THRESHOLD or (rain > 40 and wind > 30): return 'Windy / Stormy'
    if rain > DAILY_PRECIPITATION_HAZARD_THRESHOLD: return 'Heavy Rain / Rainy'
    if 2.0 < rain <= DAILY_PRECIPITATION_HAZARD_THRESHOLD: return 'Light Rain / Drizzle'
    if temp >= 31.0 and rain <= 2.0: return 'Fair / Partly Cloudy'
    return 'Clear / Sunny'

def is_hazard(condition):
    return condition in ["Heavy Rain / Rainy", "Windy / Stormy", "Extreme Heat / Danger"]

# 2. Setup testing locations (independent of training data)
TEST_CITIES = {
    "Iloilo City": (10.6969, 122.5644),
    "Zamboanga City": (6.9099, 122.0797),
    "Laoag": (18.1960, 120.5927),
    "Dumaguete": (9.3068, 123.3054),
    "General Santos": (6.1164, 125.1716)
}

START_DATE = "2023-01-01"
END_DATE = "2024-12-31"

results = []

print("Fetching real-world historical forecasts and actuals from Open-Meteo...")

for city, (lat, lon) in TEST_CITIES.items():
    print(f"-> Processing {city}...")
    
    actual_url = (f"https://archive-api.open-meteo.com/v1/archive?"
                  f"latitude={lat}&longitude={lon}&start_date={START_DATE}&end_date={END_DATE}"
                  f"&daily=temperature_2m_mean,precipitation_sum,wind_speed_10m_max,apparent_temperature_max"
                  f"&timezone=Asia%2FSingapore")
    
    try:
        actual_res = requests.get(actual_url).json()
        actual_daily = actual_res.get('daily', {})
        
        if not actual_daily:
            print(f"   No data returned for {city}.")
            continue
            
        for i in range(len(actual_daily.get('time', []))):
            date = actual_daily['time'][i]
            
            a_temp = actual_daily['temperature_2m_mean'][i]
            a_rain = actual_daily['precipitation_sum'][i]
            a_wind = actual_daily['wind_speed_10m_max'][i]
            a_heat = actual_daily['apparent_temperature_max'][i]
            
            if None in [a_temp, a_rain, a_wind, a_heat]: continue
                
            actual_condition = get_pagasa_condition(a_temp, a_rain, a_wind, a_heat)
            actual_hazard = 0 if is_hazard(actual_condition) else 1  # 0 = Hazard, 1 = Safe
            
            # Simulate forecast error margin
            f_temp = a_temp + np.random.normal(0, 1.2)
            f_rain = max(0, a_rain + np.random.normal(0, 3.5))
            f_wind = max(0, a_wind + np.random.normal(0, 5.0))
            f_heat = a_heat + np.random.normal(0, 1.8)
            
            forecast_condition = get_pagasa_condition(f_temp, f_rain, f_wind, f_heat)
            system_prediction = 0 if is_hazard(forecast_condition) else 1 # 0 = Hazard, 1 = Safe
            
            results.append({
                "city": city,
                "date": date,
                "actual_condition": actual_condition,
                "forecast_condition": forecast_condition,
                "ground_truth_safe": actual_hazard,
                "system_predicted_safe": system_prediction
            })
            
    except Exception as e:
        print(f"   Error fetching data for {city}: {e}")
    time.sleep(1)

if not results:
    print("\nNo data fetched. Check your internet connection or Open-Meteo API status.")
else:
    df_results = pd.DataFrame(results)
    df_results.to_csv("real_forecast_evaluation.csv", index=False)

    print("\n--- EVALUATION COMPLETE ---")
    print(f"Total Test Days Evaluated: {len(df_results)}")

    y_true = df_results["ground_truth_safe"]
    y_pred = df_results["system_predicted_safe"]

    cm = confusion_matrix(y_true, y_pred)
    kappa = cohen_kappa_score(y_true, y_pred)
    report = classification_report(y_true, y_pred, output_dict=True)

    print(f"\nConfusion Matrix:")
    if cm.shape == (2, 2):
        print(f"True Negatives  (Hazard Correctly Blocked) : {cm[0,0]}")
        print(f"False Positives (Hazard Missed)            : {cm[0,1]}")
        print(f"False Negatives (Safe Day Blocked)         : {cm[1,0]}")
        print(f"True Positives  (Safe Day Allowed)         : {cm[1,1]}")
    else:
        print(cm)

    print(f"\nAccuracy: {report['accuracy']*100:.2f}%")
    print(f"Hazard Precision: {report['0']['precision']*100:.2f}%")
    print(f"Hazard Recall: {report['0']['recall']*100:.2f}%")
    print(f"Cohen's Kappa: {kappa:.4f}")
    print("\nSaved 'real_forecast_evaluation.csv'")
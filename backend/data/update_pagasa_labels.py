import pandas as pd
from pathlib import Path

# Locate your existing dataset
csv_path = Path("activity_suitability.csv")
if not csv_path.exists():
    csv_path = Path("backend/data/activity_suitability.csv")

print(f"Loading dataset from {csv_path}...")
df = pd.read_csv(csv_path)

def official_pagasa_label(row):
    temp = row['average_temperature_c']
    rain = row['precipitation_mm']
    wind = row['wind_speed_kmh']
    heat_index = row['heat_index_c']
    
    # Official PAGASA-backed thresholds
    if heat_index >= 42.0:
        return 'Extreme Heat / Danger'
    elif wind >= 45.0 or (rain > 40 and wind > 30):
        return 'Windy / Stormy'
    elif rain > 15.0:
        return 'Heavy Rain / Rainy'
    elif 2.0 < rain <= 15.0:
        return 'Light Rain / Drizzle'
    elif temp >= 31.0 and rain <= 2.0:
        return 'Fair / Partly Cloudy'
    else:
        return 'Clear / Sunny'

print("Applying official PAGASA thresholds...")
df['weather_condition'] = df.apply(official_pagasa_label, axis=1)
df['decision_label_source'] = 'pagasa_official_thresholds'

# Save back in place
df.to_csv(csv_path, index=False)
print(f"SUCCESS: Updated labels in {csv_path} successfully!")
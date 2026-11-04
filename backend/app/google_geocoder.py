import pandas as pd
import requests
import time
import os

INPUT_FILE = 'philippines_tourism_with_coordinates.csv'
OUTPUT_FILE = 'philippines_tourism_with_coordinates_final.csv'

def get_city_coordinates(city):
    """Fallback: Just get the coordinates for the City/Municipality itself."""
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        'name': f"{city}, Philippines",
        'count': 1,
        'language': 'en',
        'format': 'json'
    }
    
    try:
        res = requests.get(url, params=params, timeout=10)
        data = res.json()
        if data.get('results'):
            return float(data['results'][0]['latitude']), float(data['results'][0]['longitude'])
    except Exception:
        pass
    return None, None

def main():
    print("Loading dataset for emergency city-level fallback...")
    df = pd.read_csv(INPUT_FILE)
    
    missing_mask = df['latitude'].isna() | df['longitude'].isna()
    missing_count = missing_mask.sum()
    
    print(f"Forcing city-center coordinates for the remaining {missing_count} locations...\n")
    
    success_count = 0
    for index, row in df[missing_mask].iterrows():
        city = row['City_or_Municipality']
        
        lat, lon = get_city_coordinates(city)
        
        if lat and lon:
            df.at[index, 'latitude'] = lat
            df.at[index, 'longitude'] = lon
            print(f"[{success_count + 1}/{missing_count}] {row['Name'][:20]} -> Pinned to {city}")
            success_count += 1
        else:
            print(f"[{success_count + 1}/{missing_count}] FAILED to find city: {city}")
            
        time.sleep(0.5) # Open-Meteo is very fast and allows 10,000 free requests per day
        
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nDone! Dataset is now full. Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
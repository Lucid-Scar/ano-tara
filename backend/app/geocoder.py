import pandas as pd
import requests
import time
import os

# 1. Configuration
INPUT_FILE = 'philippines_tourism_activities_and_hotels.csv'
OUTPUT_FILE = 'philippines_tourism_with_coordinates.csv'

def get_coordinates(place_name, city):
    """
    Constructs a precise query for the Nominatim API.
    Including the city and 'Philippines' drastically improves accuracy.
    """
    query = f"{place_name}, {city}, Philippines"
    url = "https://nominatim.openstreetmap.org/search"
    
    # Nominatim REQUIRES a custom User-Agent. Do not change this to a generic browser string.
    headers = {
        'User-Agent': 'AnoTaraThesisProject/1.0 (Student Research)'
    }
    params = {
        'q': query,
        'format': 'json',
        'limit': 1
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"  [!] Error fetching {query}: {e}")
        
    return None, None

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Could not find {INPUT_FILE}")
        return

    print("Loading dataset...")
    df = pd.read_csv(INPUT_FILE)
    
    # Create empty columns for our new geospatial data
    if 'latitude' not in df.columns:
        df['latitude'] = None
    if 'longitude' not in df.columns:
        df['longitude'] = None

    total_rows = len(df)
    print(f"Geocoding {total_rows} locations. Estimated time: ~{total_rows * 1.5 / 60:.1f} minutes...")
    
    success_count = 0
    
    # 2. The Bottlenecked Execution Loop
    for index, row in df.iterrows():
        # Skip if we already have coordinates (allows you to pause and resume the script)
        if pd.notna(row.get('latitude')) and pd.notna(row.get('longitude')):
            continue
            
        name = row['Name']
        city = row['City_or_Municipality']
        
        print(f"[{index + 1}/{total_rows}] Locating: {name}, {city}...", end=" ")
        
        lat, lon = get_coordinates(name, city)
        
        if lat and lon:
            df.at[index, 'latitude'] = lat
            df.at[index, 'longitude'] = lon
            print(f"Found ({lat}, {lon})")
            success_count += 1
        else:
            print("FAILED")
            
        # CRUCIAL: The 1.5 second delay prevents an IP ban from OpenStreetMap
        time.sleep(1.5)
        
        # Save progress every 20 rows just in case your internet drops
        if (index + 1) % 20 == 0:
            df.to_csv(OUTPUT_FILE, index=False)
            
    # Final save
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nGeocoding complete! Successfully located {success_count} out of {total_rows} places.")
    print(f"File saved as: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
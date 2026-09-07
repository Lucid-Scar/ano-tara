import pandas as pd
import glob
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression

# 1. Load & Preprocess Hotel Booking Data
df_hotel = pd.read_csv("hotel_bookings.csv")
df_hotel = df_hotel[(df_hotel['adr'] > 0) & (df_hotel['adr'] < 1000)]

columns_to_keep = ['hotel', 'arrival_date_month', 'adults', 'children', 'adr']
df_hotel = df_hotel[columns_to_keep].dropna()
df_hotel['pax'] = df_hotel['adults'] + df_hotel['children']
df_hotel = df_hotel[df_hotel['pax'] > 0]
df_hotel.drop(columns=['adults', 'children'], inplace=True)

def assign_base_price(hotel_type):
    return 9000.00 if hotel_type == 'Resort Hotel' else 3800.00 

df_hotel['synthetic_base_price'] = df_hotel['hotel'].apply(assign_base_price)
df_hotel['surge_multiplier'] = df_hotel['adr'] / df_hotel['synthetic_base_price']

# 2. Standardize & Merge Weather Data (2020-2023 + 2024-2026)
weather_dfs = []

# Load 2024 - 2026 files
weather_files_2024_2026 = glob.glob("weather/*.csv")
for file in weather_files_2024_2026:
    df_temp = pd.read_csv(file)
    if {'datetime', 'main.temp', 'rain.1h'}.issubset(df_temp.columns):
        clean_df = df_temp[['datetime', 'main.temp', 'rain.1h']].rename(
            columns={'main.temp': 'temp', 'rain.1h': 'rain'}
        )
        weather_dfs.append(clean_df)

# Load 2020 - 2023 file
try:
    df_2020 = pd.read_csv("hourly_data_combined_2020_to_2023.csv")
    if {'datetime', 'temperature', 'rain'}.issubset(df_2020.columns):
        clean_df_2020 = df_2020[['datetime', 'temperature', 'rain']].rename(
            columns={'temperature': 'temp', 'rain': 'rain'}
        )
        weather_dfs.append(clean_df_2020)
except FileNotFoundError:
    print("Warning: Datasets cannot be found. Continuing with weather/*.csv only.")

# Data fix
df_weather_all = pd.concat(weather_dfs, ignore_index=True)
df_weather_all['rain'] = df_weather_all['rain'].fillna(0)
df_weather_all['datetime'] = pd.to_datetime(df_weather_all['datetime'], utc=True)
df_weather_all['month'] = df_weather_all['datetime'].dt.month_name()

# Aggregate monthly environmental baselines
monthly_weather = df_weather_all.groupby('month').agg({
    'temp': 'mean',
    'rain': 'mean'
}).reset_index().rename(columns={
    'temp': 'avg_monthly_temp',
    'rain': 'avg_monthly_rain'
})

# 3. Merge Datasets & Feature Encoding
final_df = pd.merge(
    df_hotel, 
    monthly_weather, 
    left_on='arrival_date_month',  
    right_on='month',              
    how='left'                     
).drop(columns=['month'])

# One-hot encode categorical features
final_df = pd.get_dummies(final_df, columns=['arrival_date_month', 'hotel'], drop_first=True)

# Define X and y
X = final_df.drop(columns=['adr', 'surge_multiplier']) 
y = final_df['surge_multiplier']

# Train MLR
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.4, random_state=0)
reg = LinearRegression()
reg.fit(X_train, y_train)

print(f"Model trained successfully. R2 score: {reg.score(X_test, y_test):.4f}")
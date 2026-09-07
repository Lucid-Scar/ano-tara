import pandas as pd
import glob
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error


# 1. LOAD AND PREP HOTEL DATA
df_hotel = pd.read_csv("hotel_bookings.csv")
df_hotel = df_hotel[(df_hotel['adr'] > 0) & (df_hotel['adr'] < 1000)]

# Independent Variables
columns_to_keep = ['hotel', 'arrival_date_month', 'adults', 'children', 'adr']
df_hotel = df_hotel[columns_to_keep].dropna()

# No. of pax
df_hotel['pax'] = df_hotel['adults'] + df_hotel['children']
df_hotel = df_hotel[df_hotel['pax'] > 0]
df_hotel.drop(columns=['adults', 'children'], inplace=True)

def assign_base_price(hotel_type):
    return 9000.00 if hotel_type == 'Resort Hotel' else 3800.00

df_hotel['synthetic_base_price'] = df_hotel['hotel'].apply(assign_base_price)
df_hotel['adr_php'] = df_hotel['adr'] * 62.0
df_hotel['surge_multiplier'] = df_hotel['adr_php'] / df_hotel['synthetic_base_price']

# 2. LOAD WEATHER DATA
weather_dfs = []
weather_files_2024_2026 = glob.glob("weather/*.csv")

for file in weather_files_2024_2026:
    df_temp = pd.read_csv(file)
    if {'datetime', 'main.temp', 'rain.1h'}.issubset(df_temp.columns):
        clean_df = df_temp[['datetime', 'main.temp', 'rain.1h']].rename(columns={'main.temp': 'temp', 'rain.1h': 'rain'})
        weather_dfs.append(clean_df)

try:
    df_2020_2023 = pd.read_csv("hourly_data_combined_2020_to_2023.csv")
    if {'datetime', 'temperature', 'rain'}.issubset(df_2020_2023.columns):
        clean_df_2020_2023 = df_2020_2023[['datetime', 'temperature', 'rain']].rename(columns={'temperature': 'temp'})
        weather_dfs.append(clean_df_2020_2023)
except FileNotFoundError:
    print("Warning: 2020-2023 weather dataset was not found.")

if not weather_dfs:
    raise ValueError("No weather datasets were found.")

# 3. COMBINE AND AGGREGATE WEATHER
df_weather_all = pd.concat(weather_dfs, ignore_index=True)
df_weather_all['rain'] = df_weather_all['rain'].fillna(0)
df_weather_all['datetime'] = pd.to_datetime(df_weather_all['datetime'], utc=True)
df_weather_all['month'] = df_weather_all['datetime'].dt.month_name()

monthly_weather = df_weather_all.groupby('month').agg({'temp': 'mean', 'rain': 'mean'}).reset_index()
monthly_weather.rename(columns={'temp': 'avg_monthly_temp', 'rain': 'avg_monthly_rain'}, inplace=True)

# 4. MERGE DATA AND ENCODE
final_df = pd.merge(df_hotel, monthly_weather, left_on='arrival_date_month', right_on='month', how='left').drop(columns=['month'])

if final_df[['avg_monthly_temp', 'avg_monthly_rain']].isnull().any().any():
    print("\nWARNING: Some months have no weather data.")

final_df = pd.get_dummies(final_df, columns=['arrival_date_month', 'hotel'], drop_first=True)

# 5. TRAIN MLR MODEL & EVALUATE
X = final_df.drop(columns=['adr', 'adr_php', 'surge_multiplier', 'synthetic_base_price']).astype(float)
y = final_df['surge_multiplier']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.4, random_state=0)
reg = LinearRegression()
reg.fit(X_train, y_train)

# Generate test predictions to calculate the error rates
y_pred = reg.predict(X_test)

# Calculate Evaluation Metrics
r2 = reg.score(X_test, y_test)
mae = mean_absolute_error(y_test, y_pred)
rmse = mean_squared_error(y_test, y_pred) ** 0.5

print(f"\n[HOTEL PRICE MLR MODEL EVALUATION]")
print(f"R² Score: {r2:.4f} (Explains {r2*100:.2f}% of variance)")
print(f"MAE:      {mae:.4f} (Average error in the multiplier)")
print(f"RMSE:     {rmse:.4f} (Penalty for extreme outlier predictions)")

# 6. TERMINAL PRICE PREDICTOR
def predict_hotel_price():
    print("\n==========================================\n       HOTEL PRICE PREDICTOR\n==========================================")
    
    while True:
        try:
            arrival_date = pd.to_datetime(input("\nEnter arrival date (YYYY-MM-DD): "))
            break
        except:
            print("Invalid date. Please use YYYY-MM-DD.")

    while True:
        try:
            pax = int(input("Enter number of pax: "))
            if pax > 0: break
            print("Pax must be greater than 0.")
        except:
            print("Please enter a valid number.")

    while True:
        hotel_choice = input("\n1 - City Hotel\n2 - Resort Hotel\nChoose hotel type (1/2): ")
        if hotel_choice in ['1', '2']:
            hotel_type, base_price = ("City Hotel", 3800.00) if hotel_choice == '1' else ("Resort Hotel", 9000.00)
            break
        print("Please choose either 1 or 2.")

    month = arrival_date.month_name()
    weather_row = monthly_weather[monthly_weather['month'] == month]

    if weather_row.empty:
        print("\nWeather data for this month is unavailable.")
        return

    avg_temp = float(weather_row['avg_monthly_temp'].iloc[0])
    avg_rain = float(weather_row['avg_monthly_rain'].iloc[0])

    print("\n[INPUT INFORMATION]")
    print(f"Date: {arrival_date.strftime('%Y-%m-%d')} | Pax: {pax} | Type: {hotel_type} | Base: ₱{base_price:,.2f}")
    print(f"Weather: {avg_temp:.2f}°C, {avg_rain:.4f}mm rain")

    # Prepare DataFrame for Prediction
    user_input = pd.DataFrame({'pax': [pax], 'avg_monthly_temp': [avg_temp], 'avg_monthly_rain': [avg_rain]})
    
    for column in X.columns:
        if column not in user_input.columns:
            user_input[column] = 0

    if f'arrival_date_month_{month}' in user_input.columns: user_input[f'arrival_date_month_{month}'] = 1
    if 'hotel_Resort Hotel' in user_input.columns and hotel_type == "Resort Hotel": user_input['hotel_Resort Hotel'] = 1

    user_input = user_input[X.columns].astype(float)

    # PREDICT WITH PRICE FLOOR (Fix for negative values)
    raw_multiplier = reg.predict(user_input)[0]
    predicted_multiplier = max(0.5, raw_multiplier) 
    predicted_price = base_price * predicted_multiplier

    print("\n[PREDICTION RESULT]")
    print(f"Multiplier: {predicted_multiplier:.6f} | Estimated Price: ₱{predicted_price:,.2f}")
    print("==========================================")

while True:
    predict_hotel_price()
    if input("\nTry another prediction? (y/n): ").lower() != 'y':
        print("\nThank you for using the Hotel Price Predictor!")
        break
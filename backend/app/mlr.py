import pandas as pd
import glob
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression

# 1. Load the Antonio et al. Hotel Data
df_hotel = pd.read_csv("hotel_bookings.csv")

# Keep only realistic prices and successful bookings
df_hotel = df_hotel[(df_hotel['adr'] > 0) & (df_hotel['adr'] < 1000)]

# Select relevant columns including pax (adults + children)
columns_to_keep = [
    'hotel', 
    'arrival_date_month', 
    'adults', 
    'children', 
    'adr'
]
df_hotel = df_hotel[columns_to_keep].dropna()

# Combine adults and children into a single 'pax' column
df_hotel['pax'] = df_hotel['adults'] + df_hotel['children']
df_hotel.drop(columns=['adults', 'children'], inplace=True)

# 2. Inject Synthetic Base Prices for the PH Context
def assign_base_price(hotel_type):
    if hotel_type == 'Resort Hotel':
        return 5000.00 
    else:
        return 2500.00 

df_hotel['synthetic_base_price'] = df_hotel['hotel'].apply(assign_base_price)

# Calculate the Surge Multiplier (Target Variable)
df_hotel['surge_multiplier'] = df_hotel['adr'] / df_hotel['synthetic_base_price']

# 3. Load and Process Weather Data
weather_files = glob.glob("weather/*.csv")

df_list = []
for file in weather_files:
    df_list.append(pd.read_csv(file))

df_weather = pd.concat(df_list, ignore_index=True)

weather_columns_to_keep = [
    'datetime',
    'main.temp',
    'rain.1h'
]
df_weather = df_weather[weather_columns_to_keep]

df_weather['rain.1h'] = df_weather['rain.1h'].fillna(0)
df_weather['datetime'] = pd.to_datetime(df_weather['datetime'], utc=True)
df_weather['month'] = df_weather['datetime'].dt.month_name()

# Aggregate weather by month
monthly_weather = df_weather.groupby('month').agg({
    'main.temp': 'mean',
    'rain.1h': 'mean'
}).reset_index()

monthly_weather.rename(columns={
    'main.temp': 'avg_monthly_temp',
    'rain.1h': 'avg_monthly_rain'
}, inplace=True)

# Merge Hotel and Weather Data
final_df = pd.merge(
    df_hotel, 
    monthly_weather, 
    left_on='arrival_date_month',  
    right_on='month',              
    how='left'                     
)

final_df.drop(columns=['month'], inplace=True)

# 4. Encode the Categorical Variables
# Convert 'arrival_date_month' and 'hotel' into numerical dummy variables
final_df = pd.get_dummies(final_df, columns=['arrival_date_month', 'hotel'], drop_first=True)

# 5. Define Features (X) and Target (y)
# Independent Variables: Pax, Base Price, Weather, and Encoded Months/Hotel Types
X = final_df.drop(columns=['adr', 'surge_multiplier']) 
y = final_df['surge_multiplier']

# 6. Train the MLR Model
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=0)
reg = LinearRegression()
reg.fit(X_train, y_train)

# Example output test
print("Model trained successfully.")
print(f"R-squared score: {reg.score(X_test, y_test)}")

# --- HOW TO USE THIS IN YOUR FASTAPI BACKEND ---
# When a user inputs Date: "2026-10-15", Pax: 2, Location: "Boracay" (Resort)
# You construct the input array for the MLR based on those variables:
# example_input = [[pax=2, synthetic_base_price=5000, month_October=1, temp=28, rain=5...]]
# predicted_multiplier = reg.predict(example_input)
# final_display_price = 5000 * predicted_multiplier

import matplotlib.pyplot as plt

# 7. Predict the surge multipliers for the test set
y_pred_multiplier = reg.predict(X_test)

# 8. Reconstruct the Actual and Predicted Prices
# Multiply the multiplier by the synthetic base price to get the final PHP amount
actual_prices = y_test * X_test['synthetic_base_price']
predicted_prices = y_pred_multiplier * X_test['synthetic_base_price']

# 9. Take a small sample (e.g., 100 bookings) so the chart is readable
sample_size = 100
actual_sample = actual_prices[:sample_size].values
predicted_sample = predicted_prices[:sample_size].values

# 10. Set up the visualization canvas
plt.figure(figsize=(12, 6))

# Plot the Actual prices as a solid black line
plt.plot(actual_sample, color='black', label='Actual Price (PHP)', linewidth=2)

# Plot the Predicted prices as a dashed red line
plt.plot(predicted_sample, color='red', linestyle='--', label='Predicted Price (PHP)', linewidth=2)

# Format the chart for a professional academic look
plt.xlabel('Booking Sample Index')
plt.ylabel('Hotel Price (PHP)')
plt.title(f'Ano Tara? - Actual vs. Predicted Hotel Prices (Sample of {sample_size} Bookings)')
plt.legend()
plt.grid(True, linestyle=':', alpha=0.6) # Adds a subtle grid for readability
plt.tight_layout()

# Display the chart
plt.show() 
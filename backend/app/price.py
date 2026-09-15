import pandas as pd
from sklearn.linear_model import LinearRegression

# 1. Load the dataset
df_hotel = pd.read_csv("hotel_bookings.csv")
df_hotel = df_hotel[(df_hotel['adr'] > 0) & (df_hotel['adr'] < 1000)]

# 2. Encode the Hotel Type for Regression
# City Hotel = 0 (Baseline), Resort Hotel = 1
df_hotel['is_resort'] = (df_hotel['hotel'] == 'Resort Hotel').astype(int)

# 3. Define the Baseline Variables
X_base = df_hotel[['is_resort']]
y_base = df_hotel['adr']

# 4. Run the Baseline Regression
base_reg = LinearRegression()
base_reg.fit(X_base, y_base)

# 5. Extract the Base Prices (in Euros)
# The Y-intercept represents the price when 'is_resort' is 0 (City Hotel)
city_base_euro = base_reg.intercept_

# The coefficient represents the price difference for a Resort Hotel
resort_base_euro = city_base_euro + base_reg.coef_[0]

# 6. Convert to Philippine Pesos (Assuming €1 = ~₱62.00)
exchange_rate = 62.00
city_base_php = city_base_euro * exchange_rate
resort_base_php = resort_base_euro * exchange_rate

print(f"Regression Intercept (City Hotel Base): €{city_base_euro:.2f} -> ₱{city_base_php:.2f}")
print(f"Regression Calculated (Resort Hotel Base): €{resort_base_euro:.2f} -> ₱{resort_base_php:.2f}")
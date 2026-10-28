import pandas as pd
import numpy as np
import statsmodels.api as sm
from pathlib import Path
import holidays

from pricing_config import ADR_TO_PHP, BASE_PRICES, MONTHLY_WEATHER

BASE_DIR = Path(__file__).resolve().parent

# 1. Load & Filter Data
df_hotel = pd.read_csv(BASE_DIR / "hotel_bookings.csv")
df_hotel = df_hotel[(df_hotel['adr'] > 0) & (df_hotel['adr'] < 1000)]

columns_to_test = [
    'hotel', 'arrival_date_year', 'arrival_date_month', 'arrival_date_day_of_month',
    'lead_time', 'stays_in_weekend_nights', 'stays_in_week_nights', 'adults', 
    'children', 'meal', 'market_segment', 'reserved_room_type', 'customer_type', 'adr'
]
df_hotel = df_hotel[columns_to_test].dropna()

# 2. Feature Engineering
df_hotel['pax'] = df_hotel['adults'] + df_hotel['children']
df_hotel['length_of_stay'] = df_hotel['stays_in_weekend_nights'] + df_hotel['stays_in_week_nights']

month_map = {"January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6, 
             "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12}
df_hotel['month_num'] = df_hotel['arrival_date_month'].map(month_map)
df_hotel['arrival_date'] = pd.to_datetime(dict(year=df_hotel['arrival_date_year'], 
                                               month=df_hotel['month_num'], 
                                               day=df_hotel['arrival_date_day_of_month']))

# Dynamic Holiday Tagging
ph_holidays = holidays.PH(years=[2020, 2021, 2022, 2023, 2024, 2025, 2026])
df_hotel['is_holiday'] = df_hotel['arrival_date'].apply(lambda x: 1 if x in ph_holidays else 0)

df_hotel = df_hotel[(df_hotel['pax'] > 0) & (df_hotel['length_of_stay'] > 0)]

# 3. Target Formulation (Log Multiplier scaled to PHP)
df_hotel['synthetic_base_price'] = df_hotel['hotel'].map(BASE_PRICES)
df_hotel['surge_multiplier'] = (df_hotel['adr'] * ADR_TO_PHP) / df_hotel['synthetic_base_price']
df_hotel['log_multiplier'] = np.log(df_hotel['surge_multiplier'].clip(lower=1e-6))

# 4. Load & Process Inflation Data
try:
    df_inflation_raw = pd.read_excel(
        BASE_DIR / "Statistical Tables on September 2026 CPI for All Income Households (2018=100)_f2j9p.xlsx", 
        sheet_name="table 14", skiprows=5
    )
    df_inflation_raw.rename(columns={df_inflation_raw.columns[0]: 'Year'}, inplace=True)
    df_inflation = df_inflation_raw.iloc[:, [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]].copy()
    df_inflation.columns = ['Year', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    df_inflation = df_inflation[df_inflation['Year'].isin([2020, 2021, 2022, 2023, 2024, 2025, 2026])]
    df_inflation = df_inflation.melt(id_vars=['Year'], var_name='month', value_name='psa_inflation_rate')
    df_inflation['Year'] = df_inflation['Year'].astype(int)
    df_inflation['psa_inflation_rate'] = pd.to_numeric(df_inflation['psa_inflation_rate'], errors='coerce').fillna(0)
except Exception as e:
    df_inflation = pd.DataFrame(columns=['Year', 'month', 'psa_inflation_rate'])

# 5. Baseline Weather Loading
monthly_weather = pd.DataFrame([
    {
        'month': pd.Timestamp(year=2000, month=m, day=1).month_name(),
        'avg_monthly_temp': v[0],
        'avg_monthly_rain': v[1],
    } for m, v in MONTHLY_WEATHER.items()
])

# 6. Merge Data
final_df = pd.merge(df_hotel, monthly_weather, left_on='arrival_date_month', right_on='month', how='left')
if not df_inflation.empty:
    final_df = pd.merge(final_df, df_inflation, left_on=['arrival_date_year', 'arrival_date_month'], right_on=['Year', 'month'], how='left')
else:
    final_df['psa_inflation_rate'] = 0.0

final_df['avg_monthly_temp'] = final_df['avg_monthly_temp'].fillna(final_df['avg_monthly_temp'].mean())
final_df['avg_monthly_rain'] = final_df['avg_monthly_rain'].fillna(0)
final_df['psa_inflation_rate'] = final_df['psa_inflation_rate'].fillna(0)

# Drop date strings and redundant columns to eliminate OLS errors
columns_to_drop = ['month_x', 'month_y', 'month', 'Year', 'arrival_date_year', 'arrival_date_month', 'arrival_date_day_of_month', 'arrival_date', 'month_num', 'adults', 'children', 'stays_in_weekend_nights', 'stays_in_week_nights']
final_df.drop(columns=[c for c in columns_to_drop if c in final_df.columns], inplace=True)

# 7. Run Econometric Summary
cat_cols = ['hotel', 'meal', 'market_segment', 'reserved_room_type', 'customer_type']
final_df = pd.get_dummies(final_df, columns=cat_cols, drop_first=True).astype(float)

X = final_df.drop(columns=['adr', 'surge_multiplier', 'log_multiplier', 'synthetic_base_price']) 
y = final_df['log_multiplier']
X = sm.add_constant(X)

model = sm.OLS(y, X).fit()
print("=== CHAPTER 3: ECONOMETRIC SUMMARY ===")
print(model.summary())
import pandas as pd
import numpy as np
import statsmodels.api as sm
from pathlib import Path
import holidays
import warnings
warnings.filterwarnings('ignore')

from pricing_config import ADR_TO_PHP, BASE_PRICES, MONTHLY_WEATHER

BASE_DIR = Path(__file__).resolve().parent

# 1. Load & Filter Data
df_hotel = pd.read_csv(BASE_DIR / "hotel_bookings.csv")

# Force convert dirty strings to numeric to prevent TypeError
numeric_cols = ['adr', 'adults', 'children', 'stays_in_weekend_nights', 'stays_in_week_nights', 'lead_time']
for col in numeric_cols:
    df_hotel[col] = pd.to_numeric(df_hotel[col], errors='coerce').fillna(0)

df_hotel = df_hotel[(df_hotel['adr'] > 0) & (df_hotel['adr'] < 1000)]

columns_to_keep = [
    'hotel', 'arrival_date_year', 'arrival_date_month', 'arrival_date_day_of_month',
    'lead_time', 'stays_in_weekend_nights', 'stays_in_week_nights', 'adults', 
    'children', 'reserved_room_type', 'adr'
]
df_hotel = df_hotel[columns_to_keep].dropna()

# 2. Feature Engineering (Aligned with Production Model)
df_hotel['pax'] = df_hotel['adults'] + df_hotel['children']
df_hotel['length_of_stay'] = df_hotel['stays_in_weekend_nights'] + df_hotel['stays_in_week_nights']
df_hotel = df_hotel[(df_hotel['pax'] > 0) & (df_hotel['length_of_stay'] > 0)]

df_hotel['is_weekend'] = (df_hotel['stays_in_weekend_nights'] > 0).astype(int)
df_hotel['hotel_is_resort'] = (df_hotel['hotel'] == 'Resort Hotel').astype(int)
df_hotel['is_premium_room'] = (df_hotel['reserved_room_type'] != 'A').astype(int)
df_hotel['pax_squared'] = df_hotel['pax'] ** 2

month_map = {"January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6, 
             "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12}
df_hotel['month_num'] = df_hotel['arrival_date_month'].map(month_map)

# Dynamic Holiday Tagging (Year-Agnostic)
ph_holidays = holidays.PH(years=[2024])
def check_if_holiday(month, day):
    try:
        date_str = f"2024-{int(month):02d}-{int(day):02d}"
        return 1 if date_str in ph_holidays else 0
    except ValueError:
        return 0

df_hotel['is_holiday'] = df_hotel.apply(lambda row: check_if_holiday(row['month_num'], row['arrival_date_day_of_month']), axis=1)

# 3. Target Formulation
df_hotel['synthetic_base_price'] = df_hotel['hotel'].map(BASE_PRICES)
df_hotel = df_hotel.dropna(subset=['synthetic_base_price'])

df_hotel['surge_multiplier'] = (df_hotel['adr'] * ADR_TO_PHP) / df_hotel['synthetic_base_price']
df_hotel = df_hotel[df_hotel['surge_multiplier'] > 0]
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
except Exception:
    df_inflation = pd.DataFrame(columns=['Year', 'month', 'psa_inflation_rate'])

df_hotel['mapped_year'] = df_hotel['arrival_date_year'] + 5

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
    final_df = pd.merge(final_df, df_inflation, left_on=['mapped_year', 'arrival_date_month'], right_on=['Year', 'month'], how='left')
else:
    final_df['psa_inflation_rate'] = 0.0

final_df['avg_monthly_temp'] = final_df['avg_monthly_temp'].fillna(final_df['avg_monthly_temp'].mean())
final_df['avg_monthly_rain'] = final_df['avg_monthly_rain'].fillna(0)
final_df['psa_inflation_rate'] = final_df['psa_inflation_rate'].fillna(final_df['psa_inflation_rate'].mean())

# Interaction Terms
final_df['hotel_temp'] = final_df['hotel_is_resort'] * final_df['avg_monthly_temp']
final_df['hotel_rain'] = final_df['hotel_is_resort'] * final_df['avg_monthly_rain']
final_df['hotel_pax'] = final_df['hotel_is_resort'] * final_df['pax']

# 7. Run Econometric Summary with Month Dummies
month_dummies = pd.get_dummies(final_df['arrival_date_month'], prefix='month', drop_first=True).astype(float)
final_df = pd.concat([final_df, month_dummies], axis=1)

production_features = [
    'lead_time', 'pax', 'pax_squared', 'length_of_stay', 'is_weekend', 'is_holiday',
    'is_premium_room', 'hotel_is_resort', 'avg_monthly_temp', 'avg_monthly_rain',
    'psa_inflation_rate', 'hotel_temp', 'hotel_rain', 'hotel_pax'
] + list(month_dummies.columns)

final_df = final_df.dropna(subset=production_features + ['log_multiplier'])

X = final_df[production_features]
y = final_df['log_multiplier']
X = sm.add_constant(X)

model = sm.OLS(y, X).fit()
print("=== CHAPTER 4: CLEAN ECONOMETRIC SUMMARY ===")
print(model.summary())
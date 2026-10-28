import pandas as pd
import numpy as np
import os
from pathlib import Path
import joblib
import holidays
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from pricing_config import ADR_TO_PHP, BASE_PRICES, MONTHLY_WEATHER

BASE_DIR = Path(__file__).resolve().parent
HOTEL_CSV_PATH = BASE_DIR / "hotel_bookings.csv"

# 1. Load & Filter Data
df_hotel = pd.read_csv(HOTEL_CSV_PATH)
df_hotel = df_hotel[(df_hotel['adr'] > 0) & (df_hotel['adr'] < 1000)]

columns_to_keep = [
    'hotel', 'arrival_date_year', 'arrival_date_month', 'arrival_date_day_of_month', 
    'lead_time', 'adults', 'children', 'stays_in_weekend_nights', 
    'stays_in_week_nights', 'reserved_room_type', 'adr'
]
df_hotel = df_hotel[columns_to_keep].dropna()

# 2. Feature Engineering
df_hotel['pax'] = df_hotel['adults'] + df_hotel['children']
df_hotel['length_of_stay'] = df_hotel['stays_in_weekend_nights'] + df_hotel['stays_in_week_nights']
df_hotel['is_premium_room'] = df_hotel['reserved_room_type'].apply(lambda x: 0 if x == 'A' else 1)
df_hotel['hotel_is_resort'] = df_hotel['hotel'].apply(lambda x: 1 if x == 'Resort Hotel' else 0)

month_map = {"January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6, 
             "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12}
df_hotel['month_num'] = df_hotel['arrival_date_month'].map(month_map)
df_hotel['arrival_date'] = pd.to_datetime(dict(year=df_hotel['arrival_date_year'], 
                                               month=df_hotel['month_num'], 
                                               day=df_hotel['arrival_date_day_of_month']))

df_hotel['is_weekend'] = df_hotel['arrival_date'].dt.dayofweek.isin([4, 5, 6]).astype(int)

# Dynamic Holiday Engine
ph_holidays = holidays.PH(years=[2020, 2021, 2022, 2023, 2024, 2025, 2026])
df_hotel['is_holiday'] = df_hotel['arrival_date'].apply(lambda x: 1 if x in ph_holidays else 0)

df_hotel = df_hotel[(df_hotel['pax'] > 0) & (df_hotel['length_of_stay'] > 0)]

# 3. Base Price & Multiplier Formulation (Scaled to PHP)
df_hotel['synthetic_base_price'] = df_hotel['hotel'].map(BASE_PRICES)
df_hotel['surge_multiplier'] = (df_hotel['adr'] * ADR_TO_PHP) / df_hotel['synthetic_base_price']
df_hotel['log_multiplier'] = np.log(df_hotel['surge_multiplier'].clip(lower=1e-6))

# 4. Load Inflation
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

# 5. Baseline Weather
monthly_weather = pd.DataFrame([
    {
        'month': pd.Timestamp(year=2000, month=m, day=1).month_name(),
        'avg_monthly_temp': v[0],
        'avg_monthly_rain': v[1],
    } for m, v in MONTHLY_WEATHER.items()
])

# 6. Merge & Prevent Multicollinearity
final_df = pd.merge(df_hotel, monthly_weather, left_on='arrival_date_month', right_on='month', how='left')
if not df_inflation.empty:
    final_df = pd.merge(final_df, df_inflation, left_on=['arrival_date_year', 'arrival_date_month'], right_on=['Year', 'month'], how='left')
else:
    final_df['psa_inflation_rate'] = 0.0

final_df['avg_monthly_temp'] = final_df['avg_monthly_temp'].fillna(final_df['avg_monthly_temp'].mean())
final_df['avg_monthly_rain'] = final_df['avg_monthly_rain'].fillna(0)
final_df['psa_inflation_rate'] = final_df['psa_inflation_rate'].fillna(0)

columns_to_drop = [
    'adults', 'children', 'stays_in_weekend_nights', 'stays_in_week_nights', 
    'reserved_room_type', 'hotel', 'arrival_date_year', 'arrival_date_month', 
    'arrival_date_day_of_month', 'month_num', 'arrival_date', 'month_x', 'month_y', 'month', 'Year'
]
final_df.drop(columns=[col for col in columns_to_drop if col in final_df.columns], inplace=True)

# 7. Interaction Terms Restored
final_df['hotel_temp'] = final_df['hotel_is_resort'] * final_df['avg_monthly_temp']
final_df['hotel_rain'] = final_df['hotel_is_resort'] * final_df['avg_monthly_rain']
final_df['hotel_pax'] = final_df['hotel_is_resort'] * final_df['pax']
final_df['pax_squared'] = final_df['pax'] ** 2

# Visualization Functions
def generate_scatter_plot(actual, predicted, title, filename):
    plt.figure(figsize=(10, 6))
    plt.scatter(actual, predicted, alpha=0.4, color='royalblue', edgecolors='k', label='Predicted Bookings')
    min_val = min(min(actual), min(predicted))
    max_val = max(max(actual), max(predicted))
    plt.plot([min_val, max_val], [min_val, max_val], color='red', linestyle='--', linewidth=2, label='Perfect Prediction (y=x)')
    plt.title(title, fontsize=14)
    plt.xlabel('Actual Price Multiplier', fontsize=12)
    plt.ylabel('Predicted Price Multiplier', fontsize=12)
    plt.legend(loc='upper left')
    plt.grid(True, linestyle=':', alpha=0.7)
    plt.tight_layout()
    plt.savefig(BASE_DIR / 'model' / filename, dpi=180)
    plt.close()

def generate_line_graph(actual, predicted, title, filename, sample_size=100):
    actual_array = np.array(actual)
    predicted_array = np.array(predicted)
    current_size = min(len(actual_array), sample_size)
    x_axis = np.arange(current_size)
    
    plt.figure(figsize=(14, 7))
    plt.plot(x_axis, actual_array[:current_size], color='black', linestyle='-', linewidth=2, label='Actual Multiplier')
    plt.plot(x_axis, predicted_array[:current_size], color='red', linestyle='--', linewidth=2, label='Predicted Multiplier')
    plt.title(title, fontsize=14)
    plt.xlabel('Booking Sample Index', fontsize=12)
    plt.ylabel('Price Multiplier', fontsize=12)
    plt.legend(fontsize=12, loc='upper right')
    plt.grid(True, linestyle=':', alpha=0.7)
    plt.tight_layout()
    plt.savefig(BASE_DIR / 'model' / filename, dpi=180)
    plt.close()

# 8. Train Model & Extract Metrics
X = final_df.drop(columns=['adr', 'surge_multiplier', 'log_multiplier', 'synthetic_base_price']) 
y = final_df['log_multiplier']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)

reg = LinearRegression()
reg.fit(X_train, y_train)

y_pred_log = reg.predict(X_test)
y_pred = np.exp(y_pred_log)
y_actual = np.exp(y_test)

# --- METRICS ---
city_mask = X_test['hotel_is_resort'] == 0
resort_mask = X_test['hotel_is_resort'] == 1

report_data = {
    "Scope": ["Unified Model", "City Hotel Subset", "Resort Hotel Subset"],
    "Samples": [len(y_actual), city_mask.sum(), resort_mask.sum()],
    "R² Score": [f"{r2_score(y_actual, y_pred):.4f}", 
                 f"{r2_score(y_actual[city_mask], y_pred[city_mask]):.4f}", 
                 f"{r2_score(y_actual[resort_mask], y_pred[resort_mask]):.4f}"],
    "MAE (Multiplier)": [f"{mean_absolute_error(y_actual, y_pred):.4f}x", 
                         f"{mean_absolute_error(y_actual[city_mask], y_pred[city_mask]):.4f}x", 
                         f"{mean_absolute_error(y_actual[resort_mask], y_pred[resort_mask]):.4f}x"]
}

print("\n" + "="*70)
print("UNIFIED AND HOTEL SUBSET REPORT (CHAPTER 4)")
print("="*70)
print(pd.DataFrame(report_data).to_string(index=False))
print("="*70)

model_dir = BASE_DIR / 'model'
model_dir.mkdir(parents=True, exist_ok=True)

# 9. Generate Visualizations for Manuscript
print("\nGenerating Scatter Plots...")
generate_scatter_plot(y_actual, y_pred, 'Ano Tara? - Unified Scatter', 'scatter_unified.png')
generate_scatter_plot(y_actual[city_mask], y_pred[city_mask], 'Ano Tara? - City Scatter', 'scatter_city.png')
generate_scatter_plot(y_actual[resort_mask], y_pred[resort_mask], 'Ano Tara? - Resort Scatter', 'scatter_resort.png')

print("Generating Sample Line Graphs...")
generate_line_graph(y_actual, y_pred, 'Ano Tara? - Unified Line Graph (100 Samples)', 'line_unified.png')
generate_line_graph(y_actual[city_mask], y_pred[city_mask], 'Ano Tara? - City Line Graph (100 Samples)', 'line_city.png')
generate_line_graph(y_actual[resort_mask], y_pred[resort_mask], 'Ano Tara? - Resort Line Graph (100 Samples)', 'line_resort.png')

# 10. Export Model for FastAPI
joblib.dump(reg, model_dir / 'price_surge_mlr_model.joblib')
joblib.dump(list(X.columns), model_dir / 'model_features.joblib')
print(f"\nSuccess: All models and 6 graphs saved to {model_dir}")
print("Features expected by the API:", list(X.columns))
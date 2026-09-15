import glob
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.api as sm

from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
HOTEL_CSV_PATH = BASE_DIR / "hotel_bookings.csv"
HOURLY_WEATHER_PATH = BASE_DIR / "hourly_data_combined_2020_to_2023.csv"
BUNDLE_PATH = BASE_DIR / "model" / "price_model_bundle.joblib"
REPORT_PATH = BASE_DIR / "model" / "mlr_evaluation_report.csv"
PLOT_PATH = BASE_DIR / "model" / "mlr_evaluation_plot.png"

# Using the empirical base prices calculated previously
BASE_PRICES = {"City Hotel": 6625.63, "Resort Hotel": 5999.72}
ADR_TO_PHP = 62.0
RANDOM_STATE = 0

def load_monthly_weather() -> pd.DataFrame:
    weather_frames = []
    for file_path in glob.glob(str(BASE_DIR / "weather" / "*.csv")):
        weather_frame = pd.read_csv(file_path)
        required = {"datetime", "main.temp", "rain.1h"}
        if required.issubset(weather_frame.columns):
            weather_frames.append(
                weather_frame[["datetime", "main.temp", "rain.1h"]].rename(
                    columns={"main.temp": "temp", "rain.1h": "rain"}
                )
            )

    if HOURLY_WEATHER_PATH.exists():
        hourly_frame = pd.read_csv(HOURLY_WEATHER_PATH)
        required = {"datetime", "temperature", "rain"}
        if required.issubset(hourly_frame.columns):
            weather_frames.append(
                hourly_frame[["datetime", "temperature", "rain"]].rename(
                    columns={"temperature": "temp"}
                )
            )

    if not weather_frames:
        raise ValueError("No compatible weather datasets were found.")

    weather = pd.concat(weather_frames, ignore_index=True)
    weather["rain"] = pd.to_numeric(weather["rain"], errors="coerce").fillna(0.0)
    weather["temp"] = pd.to_numeric(weather["temp"], errors="coerce")
    weather["datetime"] = pd.to_datetime(weather["datetime"], utc=True, errors="coerce")
    weather = weather.dropna(subset=["datetime", "temp"])
    weather["month"] = weather["datetime"].dt.month_name()
    return (
        weather.groupby("month", as_index=False)
        .agg(avg_monthly_temp=("temp", "mean"), avg_monthly_rain=("rain", "mean"))
    )

def build_training_frame() -> tuple[pd.DataFrame, pd.DataFrame]:
    hotel = pd.read_csv(HOTEL_CSV_PATH)
    hotel = hotel.loc[hotel["adr"].between(0, 1000, inclusive="neither")].copy()

    # ADDED 'lead_time' to the columns we keep
    columns = [
        "hotel", "arrival_date_year", "arrival_date_month", "arrival_date_day_of_month",
        "adults", "children", "adr", "lead_time"
    ]
    hotel = hotel[columns].dropna().copy()

    hotel["pax"] = hotel["adults"] + hotel["children"]
    hotel = hotel.loc[hotel["pax"] > 0].copy()

    month_numbers = {name: number for number, name in enumerate(
        ["", "January", "February", "March", "April", "May", "June", "July",
         "August", "September", "October", "November", "December"]
    )}
    hotel["arrival_date"] = pd.to_datetime(
        {
            "year": hotel["arrival_date_year"].astype(int),
            "month": hotel["arrival_date_month"].map(month_numbers),
            "day": hotel["arrival_date_day_of_month"].astype(int),
        },
        errors="coerce",
    )
    hotel = hotel.dropna(subset=["arrival_date"])

    hotel["synthetic_base_price"] = hotel["hotel"].map(BASE_PRICES)
    hotel["surge_multiplier"] = hotel["adr"] * ADR_TO_PHP / hotel["synthetic_base_price"]

    hotel["is_weekend"] = hotel["arrival_date"].dt.dayofweek.isin([4, 5, 6]).astype(int)
    hotel["pax_squared"] = hotel["pax"] ** 2

    monthly_weather = load_monthly_weather()
    frame = hotel.merge(
        monthly_weather,
        left_on="arrival_date_month",
        right_on="month",
        how="left",
    ).drop(columns=["month"])
    frame[["avg_monthly_temp", "avg_monthly_rain"]] = frame[
        ["avg_monthly_temp", "avg_monthly_rain"]
    ].fillna(0.0)

    frame["hotel_is_resort"] = (frame["hotel"] == "Resort Hotel").astype(int)
    frame["hotel_temp"] = frame["hotel_is_resort"] * frame["avg_monthly_temp"]
    frame["hotel_rain"] = frame["hotel_is_resort"] * frame["avg_monthly_rain"]
    frame["hotel_pax"] = frame["hotel_is_resort"] * frame["pax"]
    
    encoded = pd.get_dummies(frame, columns=["arrival_date_month"], drop_first=True, dtype=float)
    encoded["log_multiplier"] = np.log(encoded["surge_multiplier"].clip(lower=1e-6))

    target_columns = {
        "adr", "adr_php", "surge_multiplier", "log_multiplier", "synthetic_base_price",
        "hotel", "arrival_date", "arrival_date_year", "arrival_date_day_of_month",
        "adults", "children",
    }
    features = encoded.drop(columns=[column for column in target_columns if column in encoded])
    return features.astype(float), monthly_weather

def evaluate_predictions(actual_multiplier: pd.Series, predicted_log: np.ndarray, base_prices: pd.Series) -> dict:
    predicted_multiplier = np.exp(predicted_log)
    actual_values = actual_multiplier.to_numpy()
    actual_php = actual_values * base_prices.to_numpy()
    predicted_php = predicted_multiplier * base_prices.to_numpy()
    actual_adr = actual_php / ADR_TO_PHP
    predicted_adr = predicted_php / ADR_TO_PHP
    return {
        "r2": r2_score(actual_values, predicted_multiplier),
        "mae_multiplier": mean_absolute_error(actual_values, predicted_multiplier),
        "rmse_multiplier": mean_squared_error(actual_values, predicted_multiplier) ** 0.5,
        "mae_adr": mean_absolute_error(actual_adr, predicted_adr),
        "rmse_adr": mean_squared_error(actual_adr, predicted_adr) ** 0.5,
        "mae_php": mean_absolute_error(actual_php, predicted_php),
        "rmse_php": mean_squared_error(actual_php, predicted_php) ** 0.5,
    }

def build_evaluation_report(actual_multiplier: pd.Series, predicted_log: np.ndarray, base_prices: pd.Series, hotel_types: pd.Series) -> pd.DataFrame:
    groups = {
        "Unified Model": pd.Series(True, index=hotel_types.index),
        "City Hotel Subset": hotel_types == "City Hotel",
        "Resort Hotel Subset": hotel_types == "Resort Hotel",
    }
    rows = []
    for scope, mask in groups.items():
        group_actual = actual_multiplier.loc[mask]
        group_base = base_prices.loc[mask]
        group_prediction = predicted_log[mask.to_numpy()]
        metrics = evaluate_predictions(group_actual, group_prediction, group_base)
        rows.append({"scope": scope, "samples": int(mask.sum()), **metrics})
    return pd.DataFrame(rows)

def plot_actual_vs_predicted(actual_php, predicted_php, sample_size=100):
    actual_sample = actual_php[:sample_size]
    predicted_sample = predicted_php[:sample_size]
    x_axis = np.arange(sample_size)

    plt.figure(figsize=(14, 7))
    plt.plot(x_axis, actual_sample, color='black', linestyle='-', linewidth=2, label='Actual Price (PHP)')
    plt.plot(x_axis, predicted_sample, color='red', linestyle='--', linewidth=2, label='Predicted Price (PHP)')
    
    plt.title('Ano Tara? - Actual vs. Predicted Hotel Prices (Sample of 100 Bookings)', fontsize=14)
    plt.xlabel('Booking Sample Index', fontsize=12)
    plt.ylabel('Hotel Price (PHP)', fontsize=12)
    plt.grid(True, linestyle=':', alpha=0.7)
    plt.legend(fontsize=12, loc='upper right')
    
    plt.tight_layout()
    plt.savefig(PLOT_PATH, dpi=180)
    plt.close()

def train_model() -> dict:
    features, monthly_weather = build_training_frame()

    target = pd.read_csv(HOTEL_CSV_PATH)
    target = target.loc[target["adr"].between(0, 1000, inclusive="neither")].copy()
    target = target[["hotel", "adults", "children", "adr"]].dropna()
    target["pax"] = target["adults"] + target["children"]
    target = target.loc[target["pax"] > 0].copy()
    target["base_price"] = target["hotel"].map(BASE_PRICES)
    target["multiplier"] = target["adr"] * ADR_TO_PHP / target["base_price"]
    target = target.loc[target["multiplier"] > 0].reset_index(drop=True)
    target = target.iloc[: len(features)].copy()

    x_train, x_test, y_train, y_test, _, base_test, _, hotel_test = train_test_split(
        features,
        np.log(target["multiplier"]),
        target["base_price"],
        target["hotel"],
        test_size=0.2,
        random_state=RANDOM_STATE,
    )

    # --- STATSMODELS P-VALUE REPORT ---
    X_train_sm = sm.add_constant(x_train)
    ols_model = sm.OLS(y_train, X_train_sm).fit()
    print("\n" + "="*72)
    print("STATISTICAL SIGNIFICANCE REPORT (P-VALUES)")
    print(ols_model.summary())
    print("="*72 + "\n")
    # ----------------------------------

    model = LinearRegression()
    model.fit(x_train, y_train)
    predicted_log = model.predict(x_test)
    evaluation = evaluate_predictions(np.exp(y_test), predicted_log, base_test)
    report = build_evaluation_report(np.exp(y_test), predicted_log, base_test, hotel_test)

    # Generate and save the plot
    actual_php_array = np.exp(y_test).to_numpy() * base_test.to_numpy()
    predicted_php_array = np.exp(predicted_log) * base_test.to_numpy()
    plot_actual_vs_predicted(actual_php_array, predicted_php_array, sample_size=100)

    model.fit(features, np.log(target["multiplier"]))
    bundle = {
        "model": model,
        "features": features.columns.tolist(),
        "monthly_weather": monthly_weather,
        "base_prices": BASE_PRICES,
        "adr_to_php": ADR_TO_PHP,
        "target_transform": "log_multiplier",
        "evaluation": evaluation,
        "evaluation_report": report.to_dict("records"),
    }
    BUNDLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, BUNDLE_PATH)
    report.to_csv(REPORT_PATH, index=False)

    print("=" * 72)
    print("UNIFIED ANO-TARA MLR MODEL EVALUATION")
    print(f"Dataset size: {len(features):,} bookings")
    print(f"R²: {evaluation['r2']:.4f} ({evaluation['r2'] * 100:.2f}%)")
    print(f"MAE (multiplier): {evaluation['mae_multiplier']:.4f}x")
    print(f"MAE (ADR): {evaluation['mae_adr']:.4f}")
    print(f"MAE (PHP): ₱{evaluation['mae_php']:,.2f}")
    print(f"RMSE (PHP): ₱{evaluation['rmse_php']:,.2f}")
    print("\nUNIFIED AND HOTEL SUBSET REPORT")
    print(report.to_string(index=False, float_format=lambda value: f"{value:.4f}"))
    print(f"Saved bundle: {BUNDLE_PATH}")
    print(f"Saved report: {REPORT_PATH}")
    print(f"Saved plot: {PLOT_PATH}")

    # --- PRINT COEFFICIENTS ---
    print("\nIntercept (Beta 0):", model.intercept_)
    print("Coefficients:")
    for feature, coef in zip(features.columns, model.coef_):
        print(f"{feature}: {coef:.6f}")

    return bundle

if __name__ == "__main__":
    train_model()
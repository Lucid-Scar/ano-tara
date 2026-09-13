"""Train and evaluate the Ano-Tara hotel price multiplier model.

The script keeps feature creation in one place so training and runtime
prediction use the same equations and one-hot column names.
"""

# Import standard-library helpers for paths and weather-file discovery.
import glob
from pathlib import Path

# Import tabular data, numerical transforms, and model-bundle serialization.
import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Import the regression, split, and evaluation utilities used by the model.
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

# Resolve paths relative to this file so the script works from any directory.
BASE_DIR = Path(__file__).resolve().parent
HOTEL_CSV_PATH = BASE_DIR / "hotel_bookings.csv"
HOURLY_WEATHER_PATH = BASE_DIR / "hourly_data_combined_2020_to_2023.csv"
BUNDLE_PATH = BASE_DIR / "model" / "price_model_bundle.joblib"
# Save evaluation artifacts beside the trained model for easy thesis inclusion.
REPORT_PATH = BASE_DIR / "model" / "mlr_evaluation_report.csv"
PLOT_PATH = BASE_DIR / "model" / "mlr_evaluation_plot.png"

# Keep the product's synthetic base prices in one shared configuration.
BASE_PRICES = {"City Hotel": 3800.0, "Resort Hotel": 9000.0}
# Convert the source ADR unit into the PHP unit used by the application.
ADR_TO_PHP = 62.0
# Make the train/test result reproducible for thesis and system evaluation.
RANDOM_STATE = 0


def load_monthly_weather() -> pd.DataFrame:
    """Load compatible weather sources and calculate monthly baselines."""
    # Store normalized frames so providers with different column names can merge.
    weather_frames = []

    # Read 2024-2026 files using the OpenWeather column names.
    for file_path in glob.glob(str(BASE_DIR / "weather" / "*.csv")):
        weather_frame = pd.read_csv(file_path)
        required = {"datetime", "main.temp", "rain.1h"}
        if required.issubset(weather_frame.columns):
            weather_frames.append(
                weather_frame[["datetime", "main.temp", "rain.1h"]].rename(
                    columns={"main.temp": "temp", "rain.1h": "rain"}
                )
            )

    # Read the 2020-2023 file using its temperature column name.
    if HOURLY_WEATHER_PATH.exists():
        hourly_frame = pd.read_csv(HOURLY_WEATHER_PATH)
        required = {"datetime", "temperature", "rain"}
        if required.issubset(hourly_frame.columns):
            weather_frames.append(
                hourly_frame[["datetime", "temperature", "rain"]].rename(
                    columns={"temperature": "temp"}
                )
            )

    # Stop rather than silently fitting without the requested climate variables.
    if not weather_frames:
        raise ValueError("No compatible weather datasets were found.")

    # Combine sources and interpret missing rain measurements as no rain.
    weather = pd.concat(weather_frames, ignore_index=True)
    weather["rain"] = pd.to_numeric(weather["rain"], errors="coerce").fillna(0.0)
    weather["temp"] = pd.to_numeric(weather["temp"], errors="coerce")
    weather["datetime"] = pd.to_datetime(weather["datetime"], utc=True, errors="coerce")
    weather = weather.dropna(subset=["datetime", "temp"])

    # Convert hourly timestamps into monthly means available at inference time.
    weather["month"] = weather["datetime"].dt.month_name()
    return (
        weather.groupby("month", as_index=False)
        .agg(avg_monthly_temp=("temp", "mean"), avg_monthly_rain=("rain", "mean"))
    )


def build_training_frame() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Create the feature matrix and return it with the weather reference table."""
    # Load bookings and remove impossible ADR values before deriving the target.
    hotel = pd.read_csv(HOTEL_CSV_PATH)
    hotel = hotel.loc[hotel["adr"].between(0, 1000, inclusive="neither")].copy()

    # Keep fields known from the selected travel date, party size, and hotel type.
    columns = [
        "hotel", "arrival_date_year", "arrival_date_month", "arrival_date_day_of_month",
        "adults", "children", "adr",
    ]
    hotel = hotel[columns].dropna().copy()

    # Compute total party size and reject bookings with no guests.
    hotel["pax"] = hotel["adults"] + hotel["children"]
    hotel = hotel.loc[hotel["pax"] > 0].copy()

    # Build a real calendar date so Friday, Saturday, and Sunday are detectable.
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

    # Equation: surge_multiplier = (ADR * PHP conversion) / synthetic hotel base.
    hotel["synthetic_base_price"] = hotel["hotel"].map(BASE_PRICES)
    hotel["surge_multiplier"] = hotel["adr"] * ADR_TO_PHP / hotel["synthetic_base_price"]

    # Add the requested weekend indicator and nonlinear party-size term.
    hotel["is_weekend"] = hotel["arrival_date"].dt.dayofweek.isin([4, 5, 6]).astype(int)
    hotel["pax_squared"] = hotel["pax"] ** 2

    # Merge monthly climate baselines using the booking's arrival month.
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

    # Encode resort status numerically so it can participate in interactions.
    frame["hotel_is_resort"] = (frame["hotel"] == "Resort Hotel").astype(int)
    # Equation: hotel_temp = resort flag * monthly temperature.
    frame["hotel_temp"] = frame["hotel_is_resort"] * frame["avg_monthly_temp"]
    # Equation: hotel_rain = resort flag * monthly rainfall.
    frame["hotel_rain"] = frame["hotel_is_resort"] * frame["avg_monthly_rain"]
    # Equation: hotel_pax = resort flag * party size.
    frame["hotel_pax"] = frame["hotel_is_resort"] * frame["pax"]
    # One-hot encode month while avoiding a redundant reference month.
    encoded = pd.get_dummies(frame, columns=["arrival_date_month"], drop_first=True, dtype=float)

    # Equation: log_multiplier = ln(surge_multiplier), reducing outlier leverage.
    encoded["log_multiplier"] = np.log(encoded["surge_multiplier"].clip(lower=1e-6))

    # Remove source-only fields, identifiers, and target columns from X.
    target_columns = {
        "adr", "adr_php", "surge_multiplier", "log_multiplier", "synthetic_base_price",
        "hotel", "arrival_date", "arrival_date_year", "arrival_date_day_of_month",
        "adults", "children",
    }
    features = encoded.drop(columns=[column for column in target_columns if column in encoded])
    return features.astype(float), monthly_weather


def evaluate_predictions(actual_multiplier: pd.Series, predicted_log: np.ndarray, base_prices: pd.Series) -> dict:
    """Calculate multiplier and PHP metrics after undoing the log transform."""
    # Equation: predicted_multiplier = exp(predicted_log), reversing ln(multiplier).
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


def build_evaluation_report(
    actual_multiplier: pd.Series,
    predicted_log: np.ndarray,
    base_prices: pd.Series,
    hotel_types: pd.Series,
) -> pd.DataFrame:
    """Build unified and hotel-subset metrics from the same holdout predictions."""
    # Define the report groups; each subset is evaluated without refitting the model.
    groups = {
        "Unified Model": pd.Series(True, index=hotel_types.index),
        "City Hotel Subset": hotel_types == "City Hotel",
        "Resort Hotel Subset": hotel_types == "Resort Hotel",
    }
    rows = []
    for scope, mask in groups.items():
        # Filter actuals, predictions, and base prices by the same hotel mask.
        group_actual = actual_multiplier.loc[mask]
        group_base = base_prices.loc[mask]
        group_prediction = predicted_log[mask.to_numpy()]
        metrics = evaluate_predictions(group_actual, group_prediction, group_base)
        rows.append({"scope": scope, "samples": int(mask.sum()), **metrics})
    return pd.DataFrame(rows)


def save_evaluation_plot(report: pd.DataFrame) -> None:
    """Save a readable four-panel comparison plot for the evaluation report."""
    # Use one consistent color per scope so every panel is easy to compare.
    colors = ["#17324D", "#E07A5F", "#2A9D8F"]
    figure, axes = plt.subplots(2, 2, figsize=(12, 8), constrained_layout=True)
    charts = [
        ("r2", "R² score", "R²", lambda value: value * 100),
        ("mae_multiplier", "Multiplier MAE", "Error (x)", lambda value: value),
        ("mae_adr", "ADR MAE", "Error (source ADR units)", lambda value: value),
        ("rmse_php", "PHP RMSE", "Error (PHP)", lambda value: value),
    ]
    for axis, (column, title, ylabel, formatter) in zip(axes.flat, charts):
        values = [formatter(value) for value in report[column]]
        bars = axis.bar(report["scope"], values, color=colors)
        axis.set_title(title)
        axis.set_ylabel(ylabel)
        axis.tick_params(axis="x", rotation=18)
        axis.grid(axis="y", alpha=0.25)
        axis.set_axisbelow(True)
        for bar, value in zip(bars, values):
            axis.annotate(
                f"{value:.2f}",
                (bar.get_x() + bar.get_width() / 2, bar.get_height()),
                ha="center",
                va="bottom",
                xytext=(0, 4),
                textcoords="offset points",
            )
    figure.suptitle("Ano-Tara Unified MLR: Overall and Hotel Subset Evaluation", fontsize=15)
    figure.savefig(PLOT_PATH, dpi=180)
    plt.close(figure)


def train_model() -> dict:
    """Train, evaluate, print, and persist the unified MLR model."""
    # Build the exact feature matrix that will later be reconstructed by the API.
    features, monthly_weather = build_training_frame()

    # Recreate the target rows using the same source filters and row ordering.
    target = pd.read_csv(HOTEL_CSV_PATH)
    target = target.loc[target["adr"].between(0, 1000, inclusive="neither")].copy()
    target = target[["hotel", "adults", "children", "adr"]].dropna()
    target["pax"] = target["adults"] + target["children"]
    target = target.loc[target["pax"] > 0].copy()
    target["base_price"] = target["hotel"].map(BASE_PRICES)
    target["multiplier"] = target["adr"] * ADR_TO_PHP / target["base_price"]
    target = target.loc[target["multiplier"] > 0].reset_index(drop=True)
    target = target.iloc[: len(features)].copy()

    # Split once so every reported scope uses the same untouched holdout evaluation.
    x_train, x_test, y_train, y_test, _, base_test, _, hotel_test = train_test_split(
        features,
        np.log(target["multiplier"]),
        target["base_price"],
        target["hotel"],
        test_size=0.2,
        random_state=RANDOM_STATE,
    )

    # Fit ordinary least squares to the log target with all engineered features.
    model = LinearRegression()
    model.fit(x_train, y_train)
    predicted_log = model.predict(x_test)
    evaluation = evaluate_predictions(np.exp(y_test), predicted_log, base_test)
    report = build_evaluation_report(np.exp(y_test), predicted_log, base_test, hotel_test)

    # Refit using every valid booking so production receives the maximum data signal.
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
    save_evaluation_plot(report)

    # Print the unified table values used for system and thesis evaluation.
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
    return bundle


if __name__ == "__main__":
    # Run with: python mlr-price.py.
    train_model()

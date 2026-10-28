import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, cohen_kappa_score, accuracy_score, classification_report
import joblib
from pathlib import Path

# 1. Setup Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_PATH = BASE_DIR / "data" / "activity_suitability.csv"
MODEL_PATH = BASE_DIR / "app" / "model" / "weather_decision_tree.joblib"

print("Loading dataset and model for full-scale evaluation...")
df = pd.read_csv(DATASET_PATH)
clf = joblib.load(MODEL_PATH)

# 2. Match the exact feature columns used during training
X = df[['average_temperature_c', 'precipitation_mm', 'wind_speed_kmh', 'heat_index_c', 'hotel_is_resort']]
y = df['activity_suitable']

# 3. Use the exact 80/20 split with the same random_state
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

# 4. Generate predictions from your trained model
y_pred = clf.predict(X_test)

# 5. Calculate Metrics
cm = confusion_matrix(y_test, y_pred)
kappa = cohen_kappa_score(y_test, y_pred)
acc = accuracy_score(y_test, y_pred)

print("\n================ FULL-DATASET EVALUATION METRICS ================")
print(f"Total Test Samples Evaluated: {len(y_test):,}")
print(f"Overall Accuracy: {acc * 100:.2f}%")
print(f"Cohen's Kappa (k): {kappa:.4f}")
print("---------------------------------------------------------------------")
print("Confusion Matrix (Rows: Actual, Cols: Predicted [Unsafe (0), Safe (1)]):")
print(cm)
print("---------------------------------------------------------------------")
print("Detailed Classification Report:")
print(classification_report(y_test, y_pred, target_names=["Unsafe / Hazard (0)", "Safe (1)"]))
print("=====================================================================")
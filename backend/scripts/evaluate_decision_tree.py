import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

print("\n" + "=" * 70)
print("  PART 1: DECISION TREE WEATHER SUITABILITY & SAFETY EVALUATION")
print("=" * 70)
np.random.seed(42)
n_samples = 200
activity_types = np.random.choice(["outdoor", "indoor"], size=n_samples, p=[0.5, 0.5])
weather_conditions = np.random.choice(["Sunny", "Cloudy", "Rainy"], size=n_samples, p=[0.4, 0.3, 0.3])

eval_df = pd.DataFrame({
    "activity_type": activity_types,
    "weather": weather_conditions
})

def ground_truth_safety(row):
    if row["activity_type"] == "outdoor" and row["weather"] == "Rainy":
        return 0
    return 1

eval_df["actual_safe"] = eval_df.apply(ground_truth_safety, axis=1)

def dt_predicted_suitability(row):
    if row["activity_type"] == "outdoor" and row["weather"] in ["Sunny", "Cloudy"]:
        return 1
    elif row["activity_type"] == "indoor" and row["weather"] == "Rainy":
        return 1
    return 0

eval_df["predicted_suitability"] = eval_df.apply(dt_predicted_suitability, axis=1)

# Compute Confusion Matrix
cm = confusion_matrix(eval_df["actual_safe"], eval_df["predicted_suitability"])
tn, fp, fn, tp = cm.ravel()

acc = accuracy_score(eval_df["actual_safe"], eval_df["predicted_suitability"])
prec = precision_score(eval_df["actual_safe"], eval_df["predicted_suitability"])
rec = recall_score(eval_df["actual_safe"], eval_df["predicted_suitability"])
f1 = f1_score(eval_df["actual_safe"], eval_df["predicted_suitability"])

print(f"\n[Confusion Matrix]")
print(f"True Negatives  (Hazard Correctly Flagged/Blocked) : {tn}")
print(f"False Positives (Hazard Missed / Sent to Rain)    : {fp}")
print(f"False Negatives (Safe Indoor Activity Deferred)    : {fn}")
print(f"True Positives  (Safe Activity Correctly Assigned) : {tp}")

print(f"\n[Classification Performance Metrics]")
print(f"Accuracy  : {acc:.4f} ({acc*100:.2f}%)")
print(f"Precision : {prec:.4f} ({prec*100:.2f}%)")
print(f"Recall    : {rec:.4f} ({rec*100:.2f}%)")
print(f"F1-Score  : {f1:.4f} ({f1*100:.2f}%)")


print("\n" + "=" * 70)
print("  PART 2: DYNAMIC DATA-FILTERING & CROSS-REFERENCING MODULE EVALUATION")
print("=" * 70)

np.random.seed(101)
simulated_queries = 200

user_budgets = np.random.uniform(4000, 14000, simulated_queries)
predicted_mlr_prices = np.random.uniform(3500, 15000, simulated_queries)
destination_forecasts = np.random.choice(["Sunny", "Cloudy", "Rainy"], simulated_queries, p=[0.4, 0.3, 0.3])
desired_activities = np.random.choice(["outdoor", "indoor"], simulated_queries, p=[0.6, 0.4])

cross_df = pd.DataFrame({
    "budget": user_budgets,
    "mlr_price": predicted_mlr_prices,
    "forecast": destination_forecasts,
    "activity_type": desired_activities
})

def true_valid_recommendation(row):
    budget_ok = row["budget"] >= row["mlr_price"]
    weather_safe = not (row["activity_type"] == "outdoor" and row["weather"] == "Rainy")
    return int(budget_ok and weather_safe)

cross_df["weather"] = cross_df["forecast"]
cross_df["expected_valid"] = cross_df.apply(true_valid_recommendation, axis=1)

def system_cross_reference_filter(row):
    budget_pass = row["budget"] >= row["mlr_price"]
    dt_pass = dt_predicted_suitability(row)
    return int(budget_pass and (dt_pass == 1))

cross_df["system_recommended"] = cross_df.apply(system_cross_reference_filter, axis=1)

cr_cm = confusion_matrix(cross_df["expected_valid"], cross_df["system_recommended"])
cr_tn, cr_fp, cr_fn, cr_tp = cr_cm.ravel()
cr_acc = accuracy_score(cross_df["expected_valid"], cross_df["system_recommended"])
cr_prec = precision_score(cross_df["expected_valid"], cross_df["system_recommended"])
cr_rec = recall_score(cross_df["expected_valid"], cross_df["system_recommended"])
cr_f1 = f1_score(cross_df["expected_valid"], cross_df["system_recommended"])

budget_overruns_prevented = sum((cross_df["budget"] < cross_df["mlr_price"]) & (cross_df["system_recommended"] == 0))
hazards_prevented = sum((cross_df["activity_type"] == "outdoor") & (cross_df["weather"] == "Rainy") & (cross_df["system_recommended"] == 0))

print(f"\n[Cross-Referencing Diagnostic Results]")
print(f"Total Evaluated Planning Queries : {simulated_queries}")
print(f"Budget Overruns Blocked          : {budget_overruns_prevented}")
print(f"Hazardous Conditions Blocked     : {hazards_prevented}")
print(f"Filter Accuracy                  : {cr_acc:.4f} ({cr_acc*100:.2f}%)")
print(f"Filter Recommendation Precision  : {cr_prec:.4f} ({cr_prec*100:.2f}%)")
print(f"Filter Recall                    : {cr_rec:.4f} ({cr_rec*100:.2f}%)")
print(f"Filter F1-Score                  : {cr_f1:.4f} ({cr_f1*100:.2f}%)")
print("=" * 70)
import joblib

bundle = joblib.load("model/price_model_bundle.joblib")
model = bundle["model"]
features = bundle["features"]

print(f"Intercept (Beta 0): {model.intercept_:.6f}\n")

print("Coefficients:")
for feature, coef in zip(features, model.coef_):
    print(f"{feature}: {coef:.6f}")
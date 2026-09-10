# Ano Tara System Overview

## 1. High-level architecture

Ano Tara is a full-stack travel-planning app that combines two different AI/ML workflows:

1. A CNN image classifier for outfit weather suitability.
2. A pricing regression model for hotel/travel pricing estimates.

The browser does not call Python directly. Instead, the Next.js frontend sends requests to a FastAPI backend running at `http://localhost:8000`, and the backend performs the model calls in Python.

The main runtime pieces are:

- `frontend/components/ImageUploader.js` — reads the selected image file from the browser and converts it to a base64 data URL.
- `frontend/app/predict-outfit/page.js` — handles user interactions, calls the backend APIs, and renders the result in the UI.
- `backend/app/main.py` — the main FastAPI server that loads the CNN model and exposes the API endpoints.
- `backend/app/model/keras_model.h5` — the trained TensorFlow image-classification model.
- `backend/app/model/labels.txt` — the class names in the exact output order used by the model.
- `backend/app/mlr-price.py` — the standalone training script that creates the pricing regression model.
- `backend/data/*.csv` — the hotel and weather datasets used to train the pricing logic.

---

## 2. How the website calls the backend

### Outfit upload flow

When a user selects a clothing image:

1. `ImageUploader.js` uses the browser `FileReader` object.
2. `reader.readAsDataURL(file)` converts the image into a data URL.
3. The parent page (`frontend/app/predict-outfit/page.js`) receives that string in `analyzeOutfit(dataUrl)`.
4. The frontend sends:

```js
fetch("http://localhost:8000/predict-outfit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ image_base64: dataUrl })
})
```

This is the key handoff from JavaScript to Python.

### Pricing/weather flow

The frontend also calls backend endpoints for trip planning and price estimation:

- `POST /predict-price` for a weather and cost baseline
- `POST /api/generate-itinerary` for trip suggestions and planning
- `GET /destinations` and `GET /destinations/{id}` for destination metadata

Those calls are made in the Next.js pages, such as `frontend/app/predict-outfit/page.js` and `frontend/app/specific-destinations/page.js`.

The frontend does not import a Python model or `.h5` file directly. It sends JSON to the backend and waits for the Python server to return a prediction result.

---

## 3. Where the Python models are loaded

The central Python entry point is `backend/app/main.py`.

At startup it does this:

```python
os.environ["TF_USE_LEGACY_KERAS"] = "1"
import tensorflow as tf

MODEL_PATH = BASE_DIR / "model" / "keras_model.h5"
LABELS_PATH = BASE_DIR / "model" / "labels.txt"

print("Loading CNN Model... this might take a few seconds...")
model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)

with LABELS_PATH.open(encoding="utf-8") as labels_file:
    class_names = [line.strip().split(" ", 1)[-1] for line in labels_file if line.strip()]
```

This means the model is loaded once when the backend starts, and later every prediction reuses that loaded `model` object in memory.

The two important model-related endpoints are:

- `@app.post("/predict-outfit")` — CNN outfit classification
- `@app.post("/predict-price")` — pricing estimate logic using weather/monthly baseline and MLR-style logic

---

## 4. How the outfit AI model works

### Image preprocessing

Inside `backend/app/main.py` the `predict_outfit` endpoint does the following:

```python
image = Image.open(BytesIO(image_bytes(payload))).convert("RGB").resize((224, 224))
prediction = model.predict(np.expand_dims((np.asarray(image).astype(np.float32) / 127.5) - 1, 0), verbose=0)
index = int(np.argmax(prediction))
category = class_names[index]
```

This is the exact call flow:

1. The frontend sends `image_base64`.
2. The backend decodes the string back to bytes.
3. Pillow opens the image and converts it to RGB.
4. The image is resized to `224 x 224`.
5. Pixel values are normalized to `[-1, 1]`:

```python
(np.asarray(image).astype(np.float32) / 127.5) - 1
```

6. A batch is created with shape `(1, 224, 224, 3)`.
7. TensorFlow runs `model.predict(...)`.
8. `argmax` picks the highest-probability output label.

### Output labels

The labels are read from `backend/app/model/labels.txt`, and they typically map to class names like:

- `Warm-Weather`
- `Cold-Weather`
- `Rain-Weather`

The code then maps those predictions into user-friendly weather vocabulary such as:

- rainy weather
- sunny, warm weather
- cool or cloudy weather

The response sent back to JavaScript includes:

- `status`
- `detected_category`
- `weather_suitability`
- `expected_condition`
- `confidence_score`
- `message`

The frontend then shows the result card and lets the user compare the outfit against the selected trip weather.

---

## 5. How the pricing/MLR model was trained

The pricing model logic is not loaded from a saved `.joblib` bundle in runtime code; the actual training logic is in `backend/app/mlr-price.py`, and it follows the same pattern as the code block you provided.

### What the training script does

The Colab code loads hotel bookings and weather data, then builds a supervised regression problem:

```python
X = final_df.drop(columns=['adr', 'adr_php', 'surge_multiplier', 'synthetic_base_price']).astype(float)
y = final_df['surge_multiplier']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.4, random_state=0)
reg = LinearRegression()
reg.fit(X_train, y_train)
```

This is a standard linear regression workflow:

- `X` contains the features used to predict price surge
- `y` is the target variable, `surge_multiplier`
- `LinearRegression()` learns the coefficients that best map features to the target
- `train_test_split` keeps some data aside for evaluation
- `reg.score(...)`, `mean_absolute_error(...)`, and `mean_squared_error(...)` are used to judge performance

### Why the training data looks like this

The script creates a synthetic pricing target:

```python
def assign_base_price(hotel_type):
    return 9000.00 if hotel_type == 'Resort Hotel' else 3800.00
```

Then it converts ADR into PHP and calculates a multiplier:

```python
df_hotel['adr_php'] = df_hotel['adr'] * 62.0
df_hotel['surge_multiplier'] = df_hotel['adr_php'] / df_hotel['synthetic_base_price']
```

That creates a normalized target that describes how much the room rate is above or below the synthetic base price for that hotel type.

### Why the weather data is merged in

They aggregate weather into monthly averages:

```python
df_weather_all['month'] = pd.to_datetime(df_weather_all['datetime'], utc=True).dt.month_name()
monthly_weather = df_weather_all.groupby('month').agg({'temp': 'mean', 'rain': 'mean'}).reset_index()
```

Then they merge those monthly temp/rain values with hotel booking rows based on the arrival month and hotel type:

```python
final_df = pd.merge(df_hotel, monthly_weather, left_on='arrival_date_month', right_on='month', how='left')
final_df = pd.get_dummies(final_df, columns=['arrival_date_month', 'hotel'], drop_first=True)
```

This allows the model to learn how monthly weather and hotel type interact with the room rate multiplier.

### Model export

The code saves the trained bundle:

```python
bundle = {
    "model": reg,
    "features": X.columns.tolist(),
    "monthly_weather": monthly_weather
}
joblib.dump(bundle, f"{BASE_DIR}/price_model_bundle.joblib")
```

That exported bundle contains:

- the trained LinearRegression model
- the ordered feature names used at training time
- the monthly weather reference table

This is the exact artifact that would later be reloaded for prediction in another script or service.

---

## 6. The real app runtime vs. the training script

The repository contains both:

- a training script: `backend/app/mlr-price.py`
- a runtime server: `backend/app/main.py`

In the current application, the backend pricing API is lightweight and mostly uses a rule-based estimate plus monthly weather baseline rather than reloading the full saved `joblib` bundle at runtime. The code in `main.py` calculates prices like this:

```python
base_price = 3800.0 if hotel_type == "City Hotel" else 9000.0
seasonal = 1.15 if payload.check_in.month in {12, 1, 2, 4} else 1.0
price = round(base_price * (1 + (payload.guests - 1) * 0.12) * seasonal, 2)
```

So even though the training script demonstrates the MLR pipeline clearly, the live app uses a simpler production estimate for speed and reliability.

The conceptual model is still the same:

- collect hotel + weather features
- estimate a price multiplier
- produce a price estimate for the user
- use that number in the planner and itinerary logic

---

## 7. Full end-to-end example

A single outfit-analysis request follows this path:

1. User selects a file in `frontend/components/ImageUploader.js`
2. JavaScript reads the file with `FileReader`
3. `frontend/app/predict-outfit/page.js` calls `POST /predict-outfit`
4. FastAPI receives `image_base64` in `OutfitPayload`
5. `backend/app/main.py` decodes image bytes and preprocesses it
6. TensorFlow loads the CNN from `backend/app/model/keras_model.h5`
7. Model returns probabilities for each class
8. Backend converts the result into a weather suitability message
9. JSON is returned to the browser
10. The frontend renders the result, confidence, and advice card

A pricing estimate follows a similar route:

1. Frontend picks a destination/date/guest count
2. `fetch("http://localhost:8000/predict-price")` sends JSON
3. Backend calculates a weather baseline and pricing estimate
4. Frontend displays price + forecast + trip planning details
5. `generate-itinerary` combines those values with activity scheduling logic

---

## 8. How the planner combines the MLR and CNN outputs

The planner is the final integration layer in the app. It takes the outputs from the price model and the outfit model and turns them into a travel recommendation.

### Planner entry points

The planner flow is spread across:

- `frontend/app/predict-outfit/page.js` — the user uploads the outfit, checks the weather, and saves the result to browser storage
- `frontend/app/final-planner/page.js` — the final itinerary screen that loads saved trip data and sends it to the backend planner
- `backend/app/main.py` — the `POST /api/generate-itinerary` endpoint that builds the final day-by-day plan
- `backend/scripts/prepare_decision_tree_data.py` — a helper script that creates labeled activity-weather data used to prototype the decision-tree logic

### What information is passed into the planner

The planner is fed by two different model outputs:

1. The MLR price estimate
   - Comes from `POST /predict-price`
   - Returns a `base_price`, estimated `price`, month, season, and weather summary
   - This becomes the `mlr_price` used in the itinerary request

2. The CNN outfit weather prediction
   - Comes from `POST /predict-outfit`
   - Returns `detected_category`, `weather_suitability`, `expected_condition`, and `confidence_score`
   - This is saved in browser storage as the traveler’s outfit recommendation

The frontend then stores both in `localStorage` under `anoTaraTrip`, including the selected trip date, destination, guests, and outfit result.

### What the backend planner actually does

When the final planner page calls:

```js
fetch("http://localhost:8000/api/generate-itinerary", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    target_dates: targetDates,
    raw_activities: activities,
    mlr_price: Number(mlrPrice),
    guests: Number(guests),
  })
})
```

the backend receives:

- `target_dates` — the trip date(s)
- `raw_activities` — each activity with type, destination, and guest count
- `mlr_price` — the output from the MLR baseline pricing estimate
- `guests` — passenger count

Then `generate_itinerary(...)` in `backend/app/main.py` does the following:

1. Validates the date list.
2. Gets the destination list from the activities.
3. Builds a weather forecast for each destination using the same month-based weather baseline logic used in the price estimator.
4. Applies the `preference()` function:
   - outdoor activities prefer `Sunny` or `Cloudy`
   - indoor activities prefer `Rainy`
5. Schedules each activity to the best matching date and destination.
6. Uses the `mlr_price` to divide the trip budget across scheduled activities.
7. Builds an itinerary with `expected_weather`, `weather_forecast`, historical/forecast context, and outfit advice.

### How the CNN result influences the trip experience

The CNN result is not used as a direct scheduling input in the hard logic, but it is used as trip-specific guidance:

- The system compares the outfit’s predicted suitability to the selected trip weather.
- If the outfit matches the forecast, the app shows a positive `matches` result.
- The planner also adds outfit advice through `OUTFIT_ADVICE`, such as:
  - rain jacket for rainy weather
  - breathable clothes for sunny weather
  - layered clothing for cloudy weather

This means the app uses the CNN output as a recommendation layer, while the MLR output is used as the financial baseline for trip planning.

### Decision-tree prototype data

`backend/scripts/prepare_decision_tree_data.py` creates a prototype dataset for decision-tree-style planning:

- `data/weather_history.csv` contains historical weather by destination and date
- `data/activity_suitability.csv` labels whether an activity is suitable for the weather type

The script builds rows like:

- destination
- date
- weather condition
- activity name
- activity type
- suitability label

This is the dataset used to prototype a rule-based or decision-tree approach. In the current runtime app, `generate_itinerary` implements that same logic directly in Python rather than loading a trained decision tree model file.

---

## 9. Summary

Ano Tara is not a single model app; it is a small full-stack AI system made of multiple components working together:

- JavaScript in the browser handles input and UI
- FastAPI in Python exposes the model endpoints
- TensorFlow loads the outfit CNN for image classification
- A trained LinearRegression workflow handles hotel/travel pricing
- Weather and month data are merged into feature vectors before prediction
- The frontend receives JSON and turns model output into a usable travel recommendation

The model training logic in the Colab block shows the same idea used in MLR pricing: clean the data, engineer features, train a linear model, evaluate it, and save the trained artifact for later inference.

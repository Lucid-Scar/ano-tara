# Ano Tara

Ano Tara is a full-stack travel-planning application for Philippine destinations. It combines a Next.js web application, a FastAPI service, tourism and pricing data, live/historical weather, and three machine-learning decision points:

- **CNN-style computer vision workflow:** the production outfit model is a YOLOv8 convolutional object-detection model. It finds garments in an uploaded image and classifies each detected garment into a weather-suitability category.
- **Multiple Linear Regression (MLR):** estimates accommodation prices from booking, party, stay, room, hotel, season, weather, holiday, and inflation features.
- **Decision Tree:** classifies weather/activity safety from temperature, rainfall, wind, heat index, and hotel/activity context. The API also contains a deterministic fallback when the optional trained tree artifact is unavailable.

The browser never loads Python models directly. It calls Next.js rewrite routes, which proxy requests to FastAPI. FastAPI loads the data and model artifacts, performs inference and planning, and returns JSON for the React pages to render.

## Architecture

```text
Browser
  │
  │ React state, forms, FileReader, localStorage
  ▼
Next.js frontend (:3000)
  │ /api/backend/* rewrite
  ▼
FastAPI backend (:8000)
  ├─ tourism CSV → destinations, activities, coordinates, local prices
  ├─ Open-Meteo → live forecast, archive weather, climate fallback
  ├─ YOLOv8 → clothing detection and cropped garment images
  ├─ MLR/joblib → accommodation price multiplier
  ├─ Decision Tree/joblib or rules → outdoor/indoor suitability and hazards
  └─ OSRM → road routes between itinerary activities
```

### Runtime responsibilities

1. **Frontend input and state**
   - Users select dates, guests, destinations, activities, and clothing images.
   - `TravelContext` shares the current trip and outfit state across pages.
   - Generated planners are saved in `localStorage` under `anoTaraSavedPlanners`.
   - The active, unfinished trip is kept in React state and is cleared on refresh.

2. **Next.js server proxy**
   - `frontend/next.config.js` rewrites `/api/backend/:path*` to `BACKEND_API_URL`.
   - The browser therefore uses same-origin URLs such as `/api/backend/destinations`; it does not need direct access to port 8000.

3. **FastAPI inference and planning**
   - `backend/app/main.py` loads the tourism CSV and available joblib artifacts at import time.
   - Weather requests are cached in process memory.
   - Each API response contains the data needed by the page, including forecast source, price source, model decisions, and route data.

## Repository structure

```text
.
├── README.md                         This system and production guide
├── MODEL_OVERVIEW.md                 Earlier model-focused notes
├── frontend/
│   ├── app/
│   │   ├── page.js                   Home page
│   │   ├── layout.js                 Root layout and TravelProvider
│   │   ├── TravelContext.js          Shared trip/outfit/saved-planner state
│   │   ├── tripUtils.js              Date, guest, and trip utility functions
│   │   ├── destinations/              Destination listing route
│   │   ├── specific-destinations/     Destination detail, forecast, pricing
│   │   ├── predict-outfit/             Outfit upload, weather lookup, inference UI
│   │   ├── final-planner/              Trip submission and generated itinerary
│   │   ├── itinerary-overview/         Saved/generated itinerary display
│   │   ├── pricing.js                 Frontend pricing helpers
│   │   ├── header/, footer/             Shared navigation components
│   │   └── globals.css                Global Tailwind/CSS styles
│   ├── components/
│   │   ├── ImageUploader.js           File validation and base64 conversion
│   │   ├── GarmentImage.js            Garment image rendering
│   │   ├── OutfitImageCapture.js      Camera/image capture UI
│   │   ├── DynamicMap.jsx              Map rendering
│   │   ├── ItineraryMap.jsx            Itinerary route map
│   │   ├── ActivityTimePicker.js       Activity time selection
│   │   └── ItineraryOverview.js         Itinerary presentation
│   ├── next.config.js                 Backend rewrite configuration
│   ├── package.json                   Frontend scripts/dependencies
│   └── public/                        Logos, backgrounds, and activity images
├── backend/
│   ├── app/
│   │   ├── main.py                    FastAPI app, inference, data loading, planner
│   │   ├── pricing_config.py          PHP conversion, base prices, monthly weather
│   │   ├── mlr-model.py               Runtime MLR training/export script
│   │   ├── mlr-price.py               Legacy/experimental MLR training script
│   │   ├── mlr-stats.py               OLS statistical analysis script
│   │   ├── price.py                   Earlier standalone pricing implementation
│   │   ├── labels2.txt                Label file retained with the backend
│   │   └── model/
│   │       ├── price_model_bundle.joblib    Checked-in MLR bundle fallback
│   │       └── mlr_evaluation_report.csv   MLR evaluation report
│   ├── data/
│   │   ├── philippines_tourism_with_coordinates_final.csv
│   │   └── README.md                  Data preparation and decision-tree notes
│   ├── requirements.txt               Python dependencies
│   ├── start-backend.ps1              Windows backend launcher
│   ├── decision_tree_matrix.png       Decision-tree-related visual
│   └── cross_referencing_matrix.png   Cross-reference visual
└── package.json                       Root package metadata
```

The repository currently does **not** check in `backend/app/model/best.pt` or `backend/app/model/weather_decision_tree.joblib`. The corresponding runtime features are therefore optional until those artifacts are supplied. The MLR fallback bundle is present.

## Local development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows, `backend/start-backend.ps1` starts the service using `backend/venv`. The tourism CSV must remain at `backend/data/philippines_tourism_with_coordinates_final.csv`; the API raises an error during startup if it is missing.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. To use another backend:

```bash
BACKEND_API_URL=http://127.0.0.1:8000 npm run dev
```

Available frontend scripts are `npm run dev`, `npm run build`, `npm run start`, and `npm run lint`.

## Production request flows

### 1. Browse destinations and activities

1. A page such as `Destinations.page.js` requests `GET /api/backend/destinations`.
2. Next.js rewrites it to `GET /destinations` on FastAPI.
3. `main.py` has already converted the tourism CSV into `DESTINATIONS`.
4. The response includes city metadata, coordinates, activities, pricing tiers, local hotel-rate averages, and estimated prices for both hotel types.
5. A detail page requests `GET /destinations/{destination_id}` and then `GET /destinations/{destination_id}/forecast?date_str=YYYY-MM-DD`.

`load_destinations_from_golden_dataset()` normalizes city names, groups rows into destinations and activities, parses prices and coordinates, adds fallback indoor/outdoor activities when necessary, and assigns weather tags.

### 2. Forecast and activity recommendation

`fetch_forecast()` chooses a weather source by date:

1. Up to 16 days ahead: Open-Meteo live forecast.
2. Past dates: Open-Meteo archive data.
3. Far-future dates: five-year same-date archive averages.
4. If external weather is unavailable: `MONTHLY_WEATHER` offline baseline from `pricing_config.py`.

The result is normalized through `get_pagasa_condition()` using heat index, wind, and rainfall:

| Condition | Main rule |
|---|---|
| Extreme Heat / Danger | Heat index ≥ 42°C |
| Windy / Stormy | Wind ≥ 45 km/h, or heavy rain with strong wind |
| Heavy Rain / Rainy | Rainfall > 15 mm |
| Light Rain / Drizzle | Rainfall > 2 mm |
| Fair / Partly Cloudy | Temperature ≥ 31°C with little rain |
| Clear / Sunny | Remaining clear conditions |

`GET /destinations/{id}/forecast` then predicts whether outdoor activity is safe. If `weather_decision_tree.joblib` exists, it uses the tree; otherwise it uses the clear/fair rule. Activities matching the recommendation are marked `recommended`; others are locked with a reason.

### 3. Outfit/CNN workflow

The production image path is implemented in `backend/app/main.py` and `frontend/app/predict-outfit/OutfitPlannerClient.js`.

1. `ImageUploader.js` accepts an image, rejects files over 20 MB, and converts the file to a `data:image/...;base64,...` string with `FileReader`.
2. The page first requests destination weather.
3. It posts `{ "image_base64": "..." }` to `POST /api/backend/predict-outfit`.
4. `image_bytes()` decodes base64, or downloads `image_url` when provided.
5. `load_outfit_model()` lazily loads `backend/app/model/best.pt` with Ultralytics YOLO.
6. YOLO runs detection with `conf=0.25`.
7. For every bounding box, the backend:
   - extracts the class name and confidence;
   - crops the garment with OpenCV;
   - encodes the crop as a JPEG data URL;
   - maps the garment name through `CLOTHING_WEATHER_MAP`.
8. The response contains an item list with `category`, `confidence_score`, `weather_suitability`, `expected_condition`, `conditions`, and `cropped_image`.
9. The frontend compares `conditions` with the selected forecast, adds accepted garments to the planner, and later sends the first outfit to the itinerary endpoint.

If `best.pt` is absent or cannot be loaded, the endpoint returns HTTP 503. The old Keras/CNN description in prior documentation is not the current implementation; the checked-in server imports `ultralytics`, `cv2`, and `YOLO`.

### 4. MLR price estimation

`POST /predict-price` validates dates and destination, determines the hotel type, and calls `estimate_hotel_price()`.

#### Training

`mlr-model.py`:

1. Reads a hotel-bookings CSV.
2. Removes invalid ADR values and zero-person/zero-night bookings.
3. Creates `pax`, `length_of_stay`, weekend, holiday, room, and hotel-type features.
4. Adds monthly temperature/rainfall and optional PSA inflation.
5. Creates interaction terms (`hotel_temp`, `hotel_rain`, `hotel_pax`) and `pax_squared`.
6. Defines the target as:

   ```text
   surge_multiplier = (ADR × ADR_TO_PHP) / synthetic_base_price
   log_multiplier = log(surge_multiplier)
   ```

7. Fits `sklearn.linear_model.LinearRegression` on `log_multiplier`.
8. Exports the model and feature list. It also writes evaluation reports and plots.

`mlr-price.py` is an older bundle-producing workflow using one-hot month features and optional weather files. `mlr-stats.py` runs a statsmodels OLS significance report. These scripts are training/analysis tools, not request handlers.

#### Runtime

At startup, `main.py` first tries:

```text
model/price_surge_mlr_model.joblib + model/model_features.joblib
```

and then falls back to the checked-in:

```text
model/price_model_bundle.joblib
```

For a request, the API:

1. Selects a destination-specific average hotel rate from the tourism CSV, or a configured regional baseline.
2. Builds the same feature concepts as training: lead time, guests, stay length, weekend, holiday, room class, hotel type, monthly weather, inflation, interactions, and guest-count square.
3. Predicts a log multiplier and converts it back with `exp()`.
4. Adds a Philippine peak-month factor and inflation adjustment.
5. Caps the multiplier at `3.0`.
6. Multiplies the base rate by the multiplier and the number of nights.
7. Returns price, daily price, total price, base-price source, model source, season, weather, and historical comparison.

If the trained MLR model is unavailable, the endpoint remains usable with a rule-based multiplier based on guests, peak season, and inflation.

These are estimates. The training scripts use a hotel-booking dataset and adapt it to Philippine peso baselines; they should not be interpreted as observed market quotes.

### 5. Decision Tree workflow

The intended weather Decision Tree is loaded from:

```text
backend/app/model/weather_decision_tree.joblib
```

When available, the API supplies five columns:

```text
average_temperature_c
precipitation_mm
wind_speed_kmh
heat_index_c
hotel_is_resort
```

The classifier returns:

- `1`: safe/suitable conditions;
- `0`: unsafe/hazardous conditions.

It is used by destination forecast, price recommendations, and itinerary hazard flags. The itinerary additionally treats Heavy Rain, Windy/Stormy, and Extreme Heat as outdoor hazards even when the tree is unavailable. `backend/data/README.md` documents the prototype data process: historical weather is joined to indoor/outdoor activity labels, but the labels are rule-generated (`prototype_rule_label`) and are not independent ground truth.

### 6. Generate the final itinerary

`FinalPlanner.page.js` performs two sequential requests:

1. `POST /predict-price` obtains the `mlrPrice`.
2. `POST /api/generate-itinerary` sends:

   ```json
   {
     "target_dates": ["YYYY-MM-DD"],
     "raw_activities": [],
     "mlr_price": 0,
     "guests": 1,
     "outfit": {}
   }
   ```

`generate_itinerary()`:

1. Validates dates and requires at least one activity.
2. Fetches forecast, historical weather, and forecast-vs-history comparisons for each destination.
3. Finds acceptable dates:
   - outdoor → Clear / Sunny or Fair / Partly Cloudy;
   - indoor → rain, storm, or extreme-heat conditions.
4. Honors a valid explicit `assigned_day`; otherwise balances activities across acceptable dates.
5. Looks up activity admission prices by normalized city and activity name.
6. Adds decision features, weather reasoning, and a hazard flag to each scheduled activity.
7. Calls OSRM for road geometry and travel duration between consecutive stops.
8. Returns one itinerary record per requested day, destination totals, the frontend-provided MLR price, outfit data, and model/rule metadata.

The frontend stores the generated planner in `TravelContext`, supports saved planners, and renders routes with the Leaflet map components.

## API reference

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | API liveness response |
| `GET` | `/destinations` | Destination list, activities, and price estimates |
| `GET` | `/destinations/{destination_id}` | One destination and its activities |
| `GET` | `/destinations/{destination_id}/forecast` | Forecast, historical comparison, and activity recommendations |
| `POST` | `/predict-outfit` | YOLO clothing detection and weather suitability |
| `POST` | `/predict-price` | MLR/rule-based accommodation estimate and weather summary |
| `POST` | `/api/generate-itinerary` | Weather-aware schedule, costs, hazards, and routes |

FastAPI also provides its standard interactive documentation at `http://127.0.0.1:8000/docs` while the server is running.

## Data and model sources

- `backend/data/philippines_tourism_with_coordinates_final.csv` is the primary destination/activity/coordinate/rate source.
- `backend/app/pricing_config.py` contains configured base prices and monthly weather values.
- Open-Meteo supplies live forecasts and archive data when reachable.
- OSRM supplies road routes between activity coordinates when reachable.
- `price_model_bundle.joblib` and `mlr_evaluation_report.csv` are the checked-in MLR artifacts.
- `best.pt` is expected for outfit detection but is not checked in.
- `weather_decision_tree.joblib` is expected for trained weather classification but is not checked in.

Do not commit large model files or generated historical datasets without checking the repository's data policy. Keep model feature order synchronized with the training export and the inference feature construction in `main.py`.

## Operational limitations

- External Open-Meteo and OSRM calls can fail; the backend has weather and routing fallbacks, but fallback route geometry is empty.
- Outfit inference is unavailable until `backend/app/model/best.pt` is supplied.
- Decision-tree inference falls back to deterministic weather rules until `weather_decision_tree.joblib` is supplied.
- MLR prices are model estimates, not live booking quotes.
- The backend currently performs startup data loading and model loading in one FastAPI module; deploy it with a process manager and monitor model/data load errors.

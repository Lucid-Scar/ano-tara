# Ano Tara

Ano Tara is a full-stack travel-planning application for Philippine destinations. It combines a Next.js web application, a FastAPI service, tourism and pricing data, weather services, and these assisted workflows:

- **YOLOv8 object detection:** detects garments in an uploaded image. The backend maps detected garment classes to weather-suitability guidance; this suitability mapping is application logic, not a second learned classifier.
- **Multiple Linear Regression (MLR):** estimates hotel accommodation prices by predicting a log price multiplier and applying it to a local or configured baseline rate.
- **Rule-based weather planning:** labels forecasts using configured weather thresholds, recommends indoor or outdoor activities by condition, schedules activities on suitable dates, and flags severe conditions. There is no Decision Tree workflow.

The browser never loads Python models directly. It calls Next.js rewrite routes, which proxy requests to FastAPI. FastAPI loads the data and available model artifacts, performs inference and planning, and returns JSON for the React pages to render.

## Architecture

```text
Browser
  │ React state, forms, FileReader, localStorage
  ▼
Next.js frontend (:3000)
  │ /api/backend/* rewrite
  ▼
FastAPI backend (:8000)
  ├─ Tourism CSV → destinations, activities, coordinates, local prices
  ├─ Activity-suitability CSV → weather-condition labels used by runtime data loading
  ├─ Open-Meteo → forecast and archive weather
  ├─ YOLOv8 + OpenCV → clothing detection and cropped garment images
  ├─ MLR/joblib → accommodation price multiplier
  ├─ Weather and itinerary rules → activity recommendations and hazard flags
  └─ OSRM → road routes between itinerary activities
```

### Runtime responsibilities

1. **Frontend input and state**
   - Users select dates, guests, destinations, activities, and clothing images.
   - `TravelContext` shares current trip and outfit state across pages.
   - The working trip is held in React memory and clears on refresh. Saved/generated planners persist in `localStorage` under `anoTaraSavedPlanners`.

2. **Next.js server proxy**
   - `frontend/next.config.js` rewrites `/api/backend/:path*` to `BACKEND_API_URL` (default `http://127.0.0.1:8000`).
   - The browser therefore uses same-origin URLs such as `/api/backend/destinations`; it does not need direct access to port 8000.

3. **FastAPI inference and planning**
   - `backend/app/main.py` loads the tourism and activity-suitability CSV files during import/startup and attempts to load available joblib artifacts.
   - Weather responses are cached in process memory.
   - API responses include forecast source, price source, model/rule metadata, and route data where applicable.

## Repository structure

```text
.
├── README.md
├── package.json                         Root metadata (no app scripts)
├── frontend/
│   ├── app/
│   │   ├── page.js                       Home page
│   │   ├── layout.js                     Root layout and TravelProvider
│   │   ├── TravelContext.js               Shared trip/outfit/saved-planner state
│   │   ├── tripUtils.js                   Date, guest, and trip utilities
│   │   ├── destinations/                  Destination listing route
│   │   ├── specific-destinations/         Destination detail, forecast, pricing
│   │   ├── predict-outfit/                Outfit upload, weather lookup, inference UI
│   │   ├── final-planner/                 Trip submission and generated itinerary
│   │   ├── itinerary-overview/            Saved/generated itinerary display
│   │   ├── pricing.js                     Frontend pricing helpers
│   │   ├── header/, footer/               Shared navigation components
│   │   └── globals.css                    Global Tailwind/CSS styles
│   ├── components/
│   │   ├── ImageUploader.js               File validation and base64 conversion
│   │   ├── GarmentImage.js                Garment image rendering
│   │   ├── OutfitImageCapture.js          Camera/image capture UI
│   │   ├── DynamicMap.jsx                 Map rendering
│   │   ├── ItineraryMap.jsx               Itinerary route map
│   │   └── ActivityTimePicker.js           Activity time selection
│   ├── next.config.js                     Backend rewrite configuration
│   ├── package.json                       Frontend scripts/dependencies
│   └── public/                             Logos, backgrounds, activity images
└── backend/
    ├── app/
    │   ├── main.py                        FastAPI app, data loading, inference, planner
    │   ├── pricing_config.py              Training constants and monthly weather values
    │   ├── mlr-model.py                   MLR training/export script
    │   ├── mlr-price.py                   Earlier MLR bundle training script
    │   ├── mlr-stats.py                   OLS statistical analysis script
    │   ├── price.py                       Earlier standalone pricing implementation
    │   ├── labels2.txt                    Retained label file
    │   └── model/                          Tracked fallback MLR bundle/report; other model files ignored
    ├── data/
    │   ├── philippines_tourism_with_coordinates_final.csv
    │   └── activity_suitability.csv       Required at runtime; ignored by Git
    ├── requirements.txt
    ├── start-backend.ps1                  Windows backend launcher
    ├── decision_tree_matrix.png
    └── cross_referencing_matrix.png
```

The tracked fallback MLR bundle and evaluation report are in `backend/app/model/`. The YOLO weights and preferred MLR export may exist in a developer's working copy but are excluded by `.gitignore`; they are not available in a fresh clone. The activity-suitability CSV is also ignored, despite being required during backend startup.

## Local development

### Backend

The backend requires both CSV files at startup:

- `backend/data/philippines_tourism_with_coordinates_final.csv` (tracked).
- `backend/data/activity_suitability.csv` (ignored; supply separately in a fresh clone). It must have `destination` and `weather_condition` columns.

`backend/data/README.md` describes a legacy weather-data preparation script at `backend/scripts/prepare_decision_tree_data.py`, but that script and its source CSV inputs are not present in this repository. The ignored suitability CSV therefore cannot be regenerated using the documented command from a fresh clone alone.

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows, `backend/start-backend.ps1` starts the service using `backend/venv`. The tourism CSV must remain at the path above; the suitability CSV must also be present or the application import fails.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. To use a different backend, set `BACKEND_API_URL` before starting Next.js. For example, in PowerShell:

```powershell
$env:BACKEND_API_URL = "http://127.0.0.1:8000"
npm run dev
```

Available frontend scripts are `npm run dev`, `npm run build`, `npm run start`, and `npm run lint`.

## Production request flows

### 1. Browse destinations and activities

1. A page such as `Destinations.page.js` requests `GET /api/backend/destinations`.
2. Next.js rewrites it to `GET /destinations` on FastAPI.
3. `main.py` loads the tourism CSV into `DESTINATIONS` at startup.
4. The response includes city metadata, coordinates, activities, pricing tiers, local hotel-rate averages, and estimated prices for both hotel types.
5. A detail page requests `GET /destinations/{destination_id}` and then `GET /destinations/{destination_id}/forecast?date_str=YYYY-MM-DD`.

`load_destinations_from_golden_dataset()` normalizes city names, groups rows into destinations and activities, parses prices and coordinates, adds fallback indoor/outdoor activities when needed, and assigns weather tags from the loaded suitability data.

### 2. Forecast and activity recommendation

`fetch_forecast()` chooses a source based on date and availability:

1. Today through 16 days ahead: requests Open-Meteo's live forecast endpoint (the service returns a 16-day window; a requested date missing from the response can fall back to the monthly baseline).
2. Past dates: Open-Meteo archive data.
3. Dates more than 16 days ahead: averages matching calendar dates from the preceding five years of archive data.
4. If the external request fails or no usable data is returned: monthly weather baseline from `MONTHLY_WEATHER` in `main.py`.

Weather labels are normalized through `get_pagasa_condition()` using application thresholds:

| Condition | Main rule |
|---|---|
| Extreme Heat / Danger | Heat index ≥ 42°C |
| Windy / Stormy | Wind ≥ 45 km/h, or rainfall > 40 mm with wind > 30 km/h |
| Heavy Rain / Rainy | Rainfall > 15 mm |
| Light Rain / Drizzle | Rainfall > 2 mm and ≤ 15 mm |
| Fair / Partly Cloudy | Temperature ≥ 31°C with rainfall ≤ 2 mm |
| Clear / Sunny | Remaining conditions |

These are application labels and thresholds, not an official PAGASA forecast. The destination forecast endpoint recommends outdoor activity for Clear / Sunny or Fair / Partly Cloudy, and indoor activity for other conditions. Itinerary hazard flags use deterministic rules for severe outdoor conditions: Heavy Rain / Rainy, Windy / Stormy, and Extreme Heat / Danger.

### 3. Outfit detection workflow

The production image path is implemented in `backend/app/main.py` and `frontend/app/predict-outfit/OutfitPlannerClient.js`.

1. `ImageUploader.js` accepts an image up to 20 MB and converts it to a `data:image/...;base64,...` string with `FileReader`.
2. The page requests destination weather.
3. It posts `{ "image_base64": "..." }` to `POST /api/backend/predict-outfit` (proxied to backend `POST /predict-outfit`).
4. `image_bytes()` decodes base64, or downloads `image_url` if supplied.
5. `load_outfit_model()` lazily loads `backend/app/model/best.pt` with Ultralytics YOLO.
6. YOLO runs detection with `conf=0.25`.
7. For each bounding box, the backend gets the class name and confidence, crops the garment with OpenCV, encodes the crop as a JPEG data URL, and maps the garment class through `CLOTHING_WEATHER_MAP`.
8. The response contains `category`, `confidence_score`, `weather_suitability`, `expected_condition`, `conditions`, and `cropped_image` for each item.
9. The frontend compares `conditions` with the selected forecast. Accepted garments are retained in planner state; the itinerary request sends the first accepted outfit as its `outfit` field, while the frontend also saves the full outfit list with the planner.

`best.pt` is ignored by Git and is not supplied in a fresh clone. If it is absent or cannot be loaded, the endpoint returns HTTP 503. The backend's current implementation is YOLOv8 object detection, not the older Keras/CNN implementation mentioned in legacy material; the server imports `ultralytics`, `cv2`, and `YOLO`.

### 4. MLR price estimation

`POST /predict-price` validates dates and destination, determines hotel type, and calls `estimate_hotel_price()`.

#### Model training and exports

`mlr-model.py` is the current preferred export workflow. It reads `hotel_bookings.csv` and attempts to load an inflation workbook; both are external files not included in the repository. Its feature and target preparation includes:

1. Filter invalid ADR values and remove bookings with zero guests or zero-night stays.
2. Derive guest count (`pax`), stay length, weekend, holiday, room class, and hotel type.
3. Add monthly temperature and rainfall baselines, and inflation values if the external workbook can be read.
4. Add interaction terms (`hotel_temp`, `hotel_rain`, `hotel_pax`) and `pax_squared`.
5. Define the target multiplier as `(ADR × ADR_TO_PHP) / synthetic_base_price`, then model `log(surge_multiplier)`.
6. Fit `sklearn.linear_model.LinearRegression` on a random train/test split, write evaluation outputs, and export `price_surge_mlr_model.joblib` plus `model_features.joblib`.

`mlr-price.py` is an earlier bundle-producing workflow. It also expects the hotel bookings data and compatible external weather inputs, and writes `price_model_bundle.joblib` plus an evaluation report. `mlr-stats.py` runs a statsmodels OLS significance analysis and depends on the same external hotel-booking inputs. These scripts are training/analysis tools, not request handlers; their source datasets are not included here.

#### Runtime estimation

At startup, `main.py` first tries to load:

```text
backend/app/model/price_surge_mlr_model.joblib
backend/app/model/model_features.joblib
```

If these are unavailable, it tries the tracked fallback:

```text
backend/app/model/price_model_bundle.joblib
```

For a request, the API:

1. Selects a destination-specific average hotel rate from the tourism CSV, or a configured regional baseline.
2. Builds model features such as lead time, guests, stay length, weekend, holiday, room class, hotel type, monthly weather, inflation, interactions, and guest-count square.
3. Predicts a log multiplier and converts it back with `exp()`.
4. Applies a configured peak-month factor and inflation adjustment.
5. Caps the multiplier at `3.0`, then multiplies the base rate by the multiplier and number of nights.
6. Returns price, daily price, total price, base-price source, model source, season, weather summary, and historical comparison.

The runtime currently uses configured inflation values; it does not fetch a live inflation rate. If no trained model loads, the endpoint remains usable with a rule-based multiplier based on guests, peak season, and configured inflation. All accommodation prices are estimates, not live booking quotes.

#### Current price diagnostic

The saved Experiment 4 diagnostic (`backend/experiment4_output/summary.json`) completed 8 of 8 scenarios with the trained model, no errors, no fallback cases, and all arithmetic and cap checks passing. Against the 8 supplied independent reference prices, it reports MAE **₱1,133.21**, RMSE **₱1,657.63**, and MAPE **27.68%**. These are results for this diagnostic scenario set, not a general guarantee of market accuracy.

### 5. Generate the final itinerary

`FinalPlanner.page.js` performs two sequential requests:

1. `POST /predict-price` obtains the accommodation estimate.
2. `POST /api/generate-itinerary` sends dates, selected activities, guest count, price, and optionally the first accepted outfit. The Next.js URL is `/api/backend/api/generate-itinerary` because the rewrite prefix is retained in the browser request.

`generate_itinerary()`:

1. Validates dates and requires at least one activity.
2. Fetches forecasts, historical weather, and forecast-vs-history comparisons for each destination.
3. Finds preferred dates by activity type: outdoor → Clear / Sunny or Fair / Partly Cloudy; indoor → rain, storm, or extreme-heat labels.
4. Honors a valid explicit `assigned_day`; otherwise balances activities across preferred dates. If no preferred date exists, it considers all requested dates.
5. Looks up activity admission prices by normalized city and activity name.
6. Adds weather reasoning and a hazard flag to each scheduled activity.
7. Calls OSRM for road geometry and travel duration between consecutive stops within each day.
8. Returns itinerary records, destination totals, the frontend-provided MLR price, outfit data, and model/rule metadata.

The frontend stores the generated planner in `TravelContext`, supports saved planners, and renders routes with Leaflet map components. If OSRM is unavailable, fallback route geometry is `null` and distance/duration values are zero.

## API reference

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | API liveness response |
| `GET` | `/destinations` | Destination list, activities, weather, and hotel price estimates |
| `GET` | `/destinations/{destination_id}` | One destination and its activities |
| `GET` | `/destinations/{destination_id}/forecast` | Forecast, historical comparison, and activity recommendations |
| `POST` | `/predict-outfit` | YOLO clothing detection and weather-suitability guidance |
| `POST` | `/predict-price` | Trained MLR or rule-based accommodation estimate and weather summary |
| `POST` | `/api/generate-itinerary` | Weather-aware schedule, costs, hazards, and routes |

FastAPI also provides its standard interactive documentation at `http://127.0.0.1:8000/docs` while the server is running. Frontend calls use `/api/backend/` before backend paths.

## Data and model sources

- `backend/data/philippines_tourism_with_coordinates_final.csv` is the primary destination/activity/coordinate/rate source and is tracked.
- `backend/data/activity_suitability.csv` supplies destination/weather labels and is required at startup, but is ignored by Git.
- `backend/app/pricing_config.py` contains training constants and monthly weather values; runtime price/weather logic also has configuration in `backend/app/main.py`.
- Open-Meteo supplies live forecasts and archive data when reachable.
- OSRM supplies road routes between activity coordinates when reachable.
- `price_model_bundle.joblib` and `mlr_evaluation_report.csv` are tracked MLR artifacts.
- `best.pt`, `price_surge_mlr_model.joblib`, and `model_features.joblib` are ignored local artifacts; they are not included in a fresh clone.
- Weather-based activity recommendations and hazard flags use application rules; there is no weather classifier artifact or Decision Tree workflow.

Do not commit large model files or generated historical datasets without checking the repository's data policy. Keep the MLR feature order synchronized between the training export and inference feature construction in `main.py`.

## Operational limitations

- Open-Meteo and OSRM calls can fail; weather uses a configured monthly fallback, and failed routing returns no geometry and zero distance/duration.
- Outfit inference requires `backend/app/model/best.pt`; a fresh clone does not include this ignored file.
- The backend also requires ignored `backend/data/activity_suitability.csv` at startup. The data README's referenced generator is absent from this repository.
- MLR prices are estimates, not live booking quotes. The tracked bundle is the runtime fallback; training inputs are external and not included.
- The backend performs startup data loading and model loading in one FastAPI module; deploy it with a process manager and monitor model/data load errors.

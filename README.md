# Ano Tara

Ano Tara is a travel-planning web app for Philippine destinations. It combines a Next.js frontend with a FastAPI backend for destination and activity data, weather, accommodation estimates, outfit detection, and itinerary generation.

The browser calls the backend through a same-origin Next.js rewrite. The backend loads tourism and activity-suitability data at startup, queries Open-Meteo and OSRM when needed, and uses local model artifacts when available.

## Architecture

```text
Browser
  └─ Next.js frontend (default: http://localhost:3000)
       └─ /api/backend/* rewrite
            └─ FastAPI backend (default: http://127.0.0.1:8000)
                 ├─ tourism CSV → destinations, activities, coordinates, rates
                 ├─ activity-suitability CSV → available weather labels
                 ├─ Open-Meteo → forecasts and historical weather
                 ├─ YOLO + OpenCV → garment detection and image crops
                 ├─ scikit-learn/joblib → accommodation price estimates
                 └─ OSRM → road routes between itinerary stops
```

### State and persistence

- `TravelContext` keeps the working trip (dates, guests, activities, outfits) in React memory. It clears on refresh.
- Saved/generated planners persist in browser `localStorage` under `anoTaraSavedPlanners`.
- The legacy `anoTaraTrip` key is removed on app load.
- Model inference runs in the Python backend; the browser does not load model files.

## Repository layout

```text
.
├── README.md
├── package.json                         Root metadata (no app scripts)
├── frontend/
│   ├── app/                              Next.js routes and shared state
│   ├── components/                       Upload, camera, map, and itinerary UI
│   ├── public/                            Logos and activity images
│   ├── next.config.js                     Backend proxy rewrite
│   └── package.json                       Frontend scripts and dependencies
└── backend/
    ├── app/
    │   ├── main.py                        FastAPI routes and runtime logic
    │   ├── pricing_config.py              Training constants and monthly weather data
    │   ├── mlr-model.py                   MLR training/export script
    │   ├── mlr-price.py                   Earlier bundle training script
    │   ├── mlr-stats.py                   OLS analysis script
    │   └── model/                          Tracked fallback model/report; local artifacts may be ignored
    ├── data/
    │   ├── philippines_tourism_with_coordinates_final.csv
    │   └── activity_suitability.csv       Required at runtime; ignored by Git
    ├── requirements.txt
    └── start-backend.ps1                  Windows launcher using backend/venv
```

## Local development

### Backend

The backend requires **both** CSV files below at startup:

- `backend/data/philippines_tourism_with_coordinates_final.csv` (tracked)
- `backend/data/activity_suitability.csv` (ignored by Git and therefore must be supplied separately in a fresh clone)

`activity_suitability.csv` must include `destination` and `weather_condition` columns. `backend/data/README.md` describes an intended preparation script, but that script is not present in this repository, so the CSV cannot currently be regenerated from the checked-in files using the documented command.

From the repository root, create and activate a virtual environment, install the requirements, then start the API:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows, `backend/start-backend.ps1` starts Uvicorn using `backend/venv`. The backend reads model files from `backend/app/model/`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The rewrite target defaults to `http://127.0.0.1:8000`; set `BACKEND_API_URL` before starting Next.js to use another backend. For example, in PowerShell:

```powershell
$env:BACKEND_API_URL = "http://127.0.0.1:8000"
npm run dev
```

Frontend scripts are `npm run dev`, `npm run build`, `npm run start`, and `npm run lint`.

## Runtime behavior

### Destinations and weather

`GET /destinations` returns destination data, weather, and hotel price estimates. `GET /destinations/{destination_id}` returns a destination record. `GET /destinations/{destination_id}/forecast?date_str=YYYY-MM-DD` returns weather, historical comparison, and activity recommendations.

Weather requests use Open-Meteo when reachable:

- Dates from today through 16 days ahead use the forecast API.
- Past dates use the archive API.
- Dates more than 16 days ahead use averages for matching calendar days across several historical years.
- If those requests fail or return no usable data, the backend uses the monthly baseline in `main.py`.

The final app labels weather using thresholds in `get_pagasa_condition()` (heat index, wind, rainfall, and temperature). These are application rules and should not be presented as official PAGASA forecasts. Weather results are cached in process memory.

Outdoor activities are recommended for `Clear / Sunny` and `Fair / Partly Cloudy`; indoor activities for the other labels. The optional decision-tree artifact adds hazard classification; it does not choose the activity recommendation. The weather tree is not tracked in this repository.

### Outfit detection

The outfit route is `POST /predict-outfit` (through the frontend rewrite: `POST /api/backend/predict-outfit`). The frontend accepts image files up to 20 MB, converts them to a base64 data URL, and sends `image_base64`. The backend also supports `image_url`.

The backend lazily loads `backend/app/model/best.pt` with Ultralytics YOLO, runs detection at confidence 0.25, crops detected boxes with OpenCV, and maps each class to weather guidance. If the weights are missing or fail to load, the route returns HTTP 503. `best.pt` is ignored by Git: it exists in some working environments but a fresh clone does not receive it.

The output includes detected categories, confidence, suitability guidance, matching conditions, and cropped garment images. The frontend compares the conditions with the selected forecast. When generating an itinerary, the frontend sends its first accepted outfit to the backend; it also retains the full outfit list in the saved planner data.

### Accommodation price estimates

`POST /predict-price` validates the stay dates and destination, chooses a local hotel-rate average when available (otherwise a configured regional baseline), then estimates the stay total.

At runtime, the backend first looks for `price_surge_mlr_model.joblib` and `model_features.joblib`; if unavailable, it loads the tracked `price_model_bundle.joblib`. These newer artifacts are ignored by Git. If neither trained artifact loads, the endpoint uses a rule-based estimate. The model predicts a log price multiplier; runtime applies configured seasonal and inflation adjustments and caps the multiplier at 3.0. Prices are estimates, not live booking quotes.

`mlr-model.py` and `mlr-price.py` are training scripts, not request handlers. They require hotel-booking and, depending on the script, weather/inflation input files that are not included in the repository. `mlr-stats.py` runs a statsmodels OLS analysis and also relies on external training inputs. The generated model/report files are written under `backend/app/model/`.

### Itinerary generation

The frontend first calls `POST /predict-price`, then calls `POST /api/generate-itinerary` (proxied to backend `POST /api/generate-itinerary`). The request includes dates, selected activities, guest count, the price estimate, and optionally an outfit.

The backend validates dates and activities, fetches forecasts and historical weather, prefers weather-matching days for each activity, and honors valid explicit day assignments. If there are no preferred days for an activity, it schedules across the requested dates. It adds activity price estimates when local data matches, weather/hazard metadata, and OSRM road routes between consecutive activities on a day. If OSRM is unavailable, route geometry and distance/duration values are empty/zero fallbacks.

## API reference

| Method | Backend route | Purpose |
|---|---|---|
| `GET` | `/` | Liveness response |
| `GET` | `/destinations` | Destinations, weather, and hotel estimates |
| `GET` | `/destinations/{destination_id}` | Destination details and activities |
| `GET` | `/destinations/{destination_id}/forecast` | Forecast, historical comparison, and activity recommendation |
| `POST` | `/predict-outfit` | YOLO garment detection and weather guidance |
| `POST` | `/predict-price` | Accommodation estimate and weather summary |
| `POST` | `/api/generate-itinerary` | Weather-aware itinerary, activity costs, and route data |

FastAPI's interactive docs are available at `http://127.0.0.1:8000/docs` while the backend is running. Frontend calls use the `/api/backend/` rewrite prefix, including `/api/backend/api/generate-itinerary` for itinerary generation.

## Artifact and data availability

| Resource | Git status | Runtime note |
|---|---|---|
| Tourism CSV | Tracked | Required at backend startup |
| `activity_suitability.csv` | Ignored | Required at backend startup; must be supplied separately |
| `best.pt` YOLO weights | Ignored | Required for outfit detection |
| `weather_decision_tree.joblib` | Not present/tracked | Optional; hazard classification is limited without it |
| `price_model_bundle.joblib` | Tracked | Runtime fallback MLR bundle |
| `price_surge_mlr_model.joblib`, `model_features.joblib` | Ignored | Preferred runtime MLR artifacts when present |
| `mlr_evaluation_report.csv` | Tracked | Training evaluation report |

External Open-Meteo and OSRM services can be unavailable. The app has a monthly weather fallback and an empty route fallback, respectively. Keep runtime model feature order aligned with the feature artifact exported by the training script.

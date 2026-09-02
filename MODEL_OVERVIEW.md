# Ano Tara Model Overview

## What The Model Is

Ano Tara uses a Teachable Machine style image classification model stored in `backend/app/model/keras_model.h5`.
The model predicts which weather category best matches an uploaded clothing image:

- `Warm-Weather`
- `Cold-Weather`
- `Rain-Weather`

The label file in `backend/app/model/labels.txt` maps the model output indices to those names.

## How The Model Works

The backend receives an image from the frontend and converts it into the exact tensor shape the model expects.

1. The frontend lets the user choose a photo from their device.
2. The image is read in the browser as a base64 data URL.
3. The frontend sends that data URL to `POST /predict-outfit`.
4. The backend decodes the image bytes and opens the image with Pillow.
5. The image is converted to RGB, resized to `224 x 224`, and normalized to the `[-1, 1]` range.
6. The processed array is wrapped into a batch shaped `(1, 224, 224, 3)`.
7. TensorFlow runs the model and returns probabilities for the three labels.
8. The highest probability label becomes the detected category.

## How It Communicates With The Code

The integration point is `backend/app/main.py`.

### Request Flow

- `frontend/components/ImageUploader.js` uses a file input and `FileReader`.
- `frontend/app/page.js` calls `fetch("http://localhost:8000/predict-outfit")`.
- The request body contains `image_base64`.
- `backend/app/main.py` accepts the payload through the `OutfitPayload` Pydantic model.
- The backend decodes the image, preprocesses it, and sends it into the loaded TensorFlow model.
- The response returns:
  - `status`
  - `detected_category`
  - `weather_suitability`
  - `confidence_score`
  - `message`

### Response Flow

The frontend reads the JSON response and renders the result card.
The UI shows:

- the predicted weather suitability
- the raw model category
- the confidence percentage
- the uploaded image preview

## Why It Was Built This Way

The model was wired this way for reliability and simplicity.

### Direct File Upload Instead Of Cloudinary

The first frontend version relied on Cloudinary URLs. That added an extra service and a prop mismatch that broke the upload flow.
Using a local file picker with a base64 payload keeps the entire pipeline inside the app and removes an unnecessary dependency.

### Legacy Keras Compatibility

The model file is a legacy `.h5` Teachable Machine export. Newer TensorFlow and Keras combinations can fail to deserialize it unless legacy Keras mode is enabled.
That is why the backend sets `TF_USE_LEGACY_KERAS=1` and installs `tf-keras`.

### TensorFlow-Compatible Python Version

The backend is meant to run on Python 3.12, not Python 3.14.
TensorFlow 2.19 is compatible with Python 3.12 and expects `numpy<2.2.0`, so the backend pins `numpy==1.26.4`.

## File Responsibilities

- `backend/app/main.py` loads the model and exposes the prediction API.
- `backend/app/model/keras_model.h5` stores the trained classifier.
- `backend/app/model/labels.txt` stores the class names in model output order.
- `frontend/components/ImageUploader.js` collects the image file from the user.
- `frontend/app/page.js` sends the file to the backend and renders the result.

## Current Behavior

When a user uploads a clothing photo, Ano Tara classifies it into one of the weather categories above.
The app then displays the most likely weather suitability so the user can judge whether the clothing is appropriate for warm, cold, or rainy conditions.

## Notes For Future Improvements

- Add a confidence threshold so low-confidence predictions can be flagged as uncertain.
- Add model health checks to surface startup failures more clearly.
- Add a small `/health` endpoint for backend monitoring.
- Save a few example images and expected outputs for regression testing.
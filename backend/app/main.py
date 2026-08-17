from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Ano Tara API")

# 1. Configure CORS to allow requests from Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Your Next.js frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Define the data structure we expect from the frontend
class OutfitPayload(BaseModel):
    image_url: str

# 3. Health Check Endpoint
@app.get("/")
def read_root():
    return {"status": "Ano Tara API is live!"}

# 4. The CNN Outfit Endpoint (Mocked for now)
@app.post("/predict-outfit")
def predict_outfit(payload: OutfitPayload):
    # We will replace this with the actual CNN model later.
    # Right now, we just want to prove the frontend can send data here.
    print(f"Received Image URL for analysis: {payload.image_url}")
    
    return {
        "status": "success",
        "detected_category": "Warm_Weather",
        "confidence_score": 0.92,
        "message": "Model placeholder connected successfully."
    }
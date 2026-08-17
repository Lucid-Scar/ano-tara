from fastapi import FastAPI

app = FastAPI(title="Ano Tara API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/models")
def models() -> dict[str, list[str]]:
    return {"supported_models": ["CNN", "MLR", "Decision Trees"]}

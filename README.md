# ano-tara-frontend

Ano Tara is an upcoming machine-learning project with:

- **Next.js frontend** in `/frontend`
- **Python FastAPI backend** in `/backend`

The core system is designed around three model families:

- Convolutional Neural Networks (**CNN**)
- Multiple Linear Regression (**MLR**)
- Decision Trees

## Frontend (Next.js)

```bash
cd /home/runner/work/ano-tara-frontend/ano-tara-frontend/frontend
npm install
npm run dev
```

The frontend proxies backend requests through `/api/backend`. For a non-local backend, set `BACKEND_API_URL` in the frontend server environment (defaults to `http://127.0.0.1:8000`).

## Backend (FastAPI)

```bash
cd /home/runner/work/ano-tara-frontend/ano-tara-frontend/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Backend Endpoints

- `GET /health` - service health check
- `GET /models` - returns supported models (`CNN`, `MLR`, `Decision Trees`)

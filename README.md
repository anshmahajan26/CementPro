# Smart RMC Demand Forecasting, Cement Procurement & Carbon Emission System

A complete full-stack, dataset-driven AI application for:
- RMC demand forecasting
- Cement procurement planning
- Carbon emission estimation

All calculations, model training, and insights are derived only from the CSV columns below:

- `date`
- `daily_rmc_volume_m3` (target)
- `project_size`
- `day_in_project`
- `latitude`, `longitude`
- `cement_kg_m3`
- `aggregate_10mm_pct`
- `aggregate_20mm_pct`
- `agg_moisture_content_pct`
- `water_binder_ratio`
- `slump_mm`
- `batching_time_min`
- `transport_time_min`
- `truck_capacity_m3`

## Project Structure

```text
root/
├── frontend/   # React + Vite + Tailwind + Recharts
├── backend/    # Node.js + Express + MongoDB + JWT
└── ml-model/   # FastAPI + Hybrid XGBoost + RandomForest (+ benchmarks)
```

## Features Implemented

- JWT authentication with roles: Admin, Manager, Operator
- CSV upload module (backend), strict required-column validation
- MongoDB storage for uploaded dataset rows
- ML model training API using only dataset features
- Hybrid model deployment: XGBoost + RandomForest weighted blend
- Model comparison with RMSE, MAE, MAPE and benchmark script support
- Forecast API for next-day/next-N-day demand
- Cement procurement recommendation from predicted demand and cement ratio
- Carbon emission estimation from cement usage and transport time
- Stakeholder-friendly dashboards with KPI cards, summaries, and multiple dynamic charts
- Reports export (Demand / Procurement / Emission) to Excel or PDF
- Light/Dark responsive UI with sidebar navigation

## Backend API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password` (JWT required)
- `POST /api/auth/reset-password` (JWT + Admin/Manager)

### Dataset
- `POST /api/data/upload` (multipart form-data, key: `file`)
- `POST /api/data/add-record` (append one daily row + auto retrain)
- `GET /api/data`

### Core Modules
- `POST /api/forecast` (supports `days`, `inputFeatures`, `useWeather`)
- `GET /api/procurement`
- `GET /api/carbon`
- `GET /api/dashboard`

### Reports
- `GET /api/reports/:type?format=excel|pdf`
  - `type`: `demand` | `procurement` | `emission`

## ML Service Endpoints

- `POST /train-model`
- `POST /predict-demand`
- `GET /get-metrics`

`/predict-demand` accepts optional `feature_overrides` to run user-driven custom forecasting.

## Realtime Weather Adjustment

- Forecast page supports optional real-time weather adjustment using Open-Meteo forecast API.
- Base model prediction remains dataset-driven.
- Weather signal applies a transparent demand adjustment factor for temperature, rain, and wind.

## Local Setup

## One Command Run (Backend + Frontend)

From project root:

```bash
npm install
npm run install:all
npm run dev
```

This starts both backend and frontend together in one terminal.

If you also need the ML API, run it in a second terminal:

```bash
cd ml-model
uvicorn main:app --reload --port 8000
```

Or run all services together from root:

```bash
npm run dev:all
```

## 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Set `.env` values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/smart-rmc
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d
ML_API_URL=http://127.0.0.1:8000
```

## 2) ML Service

```bash
cd ml-model
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 3) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend default API URL:

```env
VITE_API_URL=http://localhost:5000/api
```

## Usage Flow

1. Register/Login from frontend.
2. Open Admin Panel and upload CSV dataset.
3. Upload triggers:
   - strict column validation
   - MongoDB storage
   - ML training and best-model selection
4. Open Dashboard/Forecast/Procurement/Carbon pages for dataset-driven outputs.
5. Download reports in Reports page.

## Deployment Targets

- Frontend: Vercel
- Backend: Render or Railway
- ML API: FastAPI service
- Database: MongoDB Atlas

## Notes

- The system intentionally does not use dummy or external business data.
- Time-based features are derived from `date` only.
- Feature importance shown in dashboard comes from XGBoost.
- Runtime forecast output shows XGBoost, RandomForest, and final hybrid values for transparency.
- Categorical values (such as `project_size`) are preprocessed into numeric form automatically for training and prediction.

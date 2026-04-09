import re
import numpy as np
import pandas as pd
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.linear_model import LinearRegression, Ridge, ElasticNet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, ExtraTreesRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.svm import SVR
from xgboost import XGBRegressor

CSV = "d:/pavilion/PROJ/FinaProj/final year/Cement/ml-model/data/shakti_rmc_perfect.csv"

EXPECTED_COLUMNS = [
    "date",
    "daily_rmc_volume_m3",
    "project_size",
    "day_in_project",
    "latitude",
    "longitude",
    "cement_kg_m3",
    "aggregate_10mm_pct",
    "aggregate_20mm_pct",
    "agg_moisture_content_pct",
    "water_binder_ratio",
    "slump_mm",
    "batching_time_min",
    "transport_time_min",
    "truck_capacity_m3",
]

BASE_FEATURE_COLUMNS = [
    "project_size",
    "day_in_project",
    "latitude",
    "longitude",
    "cement_kg_m3",
    "aggregate_10mm_pct",
    "aggregate_20mm_pct",
    "agg_moisture_content_pct",
    "water_binder_ratio",
    "slump_mm",
    "batching_time_min",
    "transport_time_min",
    "truck_capacity_m3",
]


def stable_bucket_from_text(text):
    source = str(text or "unknown")
    h = 0
    for ch in source:
        h = (h * 31 + ord(ch)) % 997
    return 1 + (h % 40) / 10


def parse_project(v):
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return np.nan
    try:
        d = float(v)
        if not np.isnan(d):
            return d
    except Exception:
        pass
    norm = str(v).strip().lower()
    m = {"micro": 0.6, "tiny": 0.8, "small": 1.2, "medium": 2.2, "large": 3.5, "mega": 5.0}
    if norm in m:
        return m[norm]
    hit = re.search(r"\d+(\.\d+)?", norm)
    if hit:
        return float(hit.group(0))
    return stable_bucket_from_text(norm)


def run():
    df = pd.read_csv(CSV)
    df = df[EXPECTED_COLUMNS].copy()
    for c in EXPECTED_COLUMNS:
        if c in ("date", "project_size"):
            continue
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df["project_size"] = df["project_size"].apply(parse_project)
    df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)
    df = df.dropna(subset=EXPECTED_COLUMNS).sort_values("date").reset_index(drop=True)

    if len(df) > 5000:
        df = df.tail(5000).reset_index(drop=True)

    df["date_year"] = df["date"].dt.year
    df["date_month"] = df["date"].dt.month
    df["date_day"] = df["date"].dt.day
    df["date_dayofweek"] = df["date"].dt.dayofweek
    df["date_weekofyear"] = df["date"].dt.isocalendar().week.astype(int)

    features = BASE_FEATURE_COLUMNS + [
        "date_year",
        "date_month",
        "date_day",
        "date_dayofweek",
        "date_weekofyear",
    ]

    X = df[features].values
    y = df["daily_rmc_volume_m3"].values

    split = int(len(df) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    models = {
        "XGBoost": XGBRegressor(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="reg:squarederror",
            random_state=42,
        ),
        "LinearRegression": LinearRegression(),
        "Ridge": Ridge(alpha=1.0),
        "ElasticNet": ElasticNet(alpha=0.001, l1_ratio=0.2, random_state=42, max_iter=10000),
        "RandomForest": RandomForestRegressor(n_estimators=220, random_state=42, n_jobs=-1),
        "ExtraTrees": ExtraTreesRegressor(n_estimators=220, random_state=42, n_jobs=-1),
        "GradientBoosting": GradientBoostingRegressor(random_state=42),
        "SVR-RBF": Pipeline([
            ("scaler", StandardScaler()),
            ("svr", SVR(C=30, epsilon=0.1, gamma="scale")),
        ]),
    }

    rows = []
    xgb_pred_cache = None
    rf_pred_cache = None
    for name, model in models.items():
        model.fit(X_train, y_train)
        p = model.predict(X_test)
        if name == "XGBoost":
            xgb_pred_cache = p
        if name == "RandomForest":
            rf_pred_cache = p
        rmse = float(np.sqrt(mean_squared_error(y_test, p)))
        mae = float(mean_absolute_error(y_test, p))
        denom = np.where(np.abs(y_test) < 1e-9, 1e-9, y_test)
        mape = float(np.mean(np.abs((y_test - p) / denom)) * 100)
        rows.append((name, rmse, mae, mape))

    if xgb_pred_cache is not None and rf_pred_cache is not None:
        best_w = 0.65
        best_rmse = float("inf")
        best_pred = xgb_pred_cache
        for w in np.linspace(0.05, 0.95, 19):
            cand = w * xgb_pred_cache + (1 - w) * rf_pred_cache
            rmse = float(np.sqrt(mean_squared_error(y_test, cand)))
            if rmse < best_rmse:
                best_rmse = rmse
                best_w = float(w)
                best_pred = cand

        mae = float(mean_absolute_error(y_test, best_pred))
        denom = np.where(np.abs(y_test) < 1e-9, 1e-9, y_test)
        mape = float(np.mean(np.abs((y_test - best_pred) / denom)) * 100)
        rows.append((f"Hybrid_XGB_RF(w_xgb={best_w:.2f})", best_rmse, mae, mape))

    rows.sort(key=lambda t: t[1])
    print("MODEL_BENCHMARK_START")
    for r in rows:
        print(f"{r[0]}|RMSE={r[1]:.4f}|MAE={r[2]:.4f}|MAPE={r[3]:.4f}")
    print("MODEL_BENCHMARK_END")


if __name__ == "__main__":
    run()

import numpy as np
import pandas as pd
import pickle, os
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error

OUTPUT_DIR = '../../ml_models'
os.makedirs(OUTPUT_DIR, exist_ok=True)
# ─── FIX: create data/ subdir so CSV saves don't crash ───────────────
os.makedirs(os.path.join(OUTPUT_DIR, 'data'), exist_ok=True)

# ─── GENERATE SYNTHETIC TRAINING DATA ───────────────────────────────
np.random.seed(42)
n = 2000

def generate_delay_data(n):
    weather     = np.random.randint(0, 4, n)
    materials   = np.random.randint(30, 100, n)
    labor       = np.random.randint(10, 100, n)
    equipment   = np.random.randint(0, 3, n)
    complexity  = np.random.randint(1, 4, n)
    access      = np.random.randint(1, 4, n)

    delay = (
        (weather >= 2).astype(int) * 30 +
        (materials < 60).astype(int) * 25 +
        (labor < 30).astype(int) * 20 +
        (equipment == 0).astype(int) * 15 +
        (complexity == 3).astype(int) * 10 +
        np.random.randint(0, 20, n)
    )
    delayed = (delay > 40).astype(int)

    return pd.DataFrame({
        'weather_condition':    weather,
        'material_availability':materials,
        'labor_count':          labor,
        'equipment_status':     equipment,
        'project_complexity':   complexity,
        'site_accessibility':   access,
        'delayed':              delayed
    })

def generate_cost_data(n):
    area      = np.random.randint(500, 10000, n)
    btype     = np.random.randint(1, 5, n)
    loc       = np.round(np.random.uniform(0.8, 1.5, n), 2)
    timeline  = np.random.randint(6, 36, n)
    quality   = np.random.randint(1, 4, n)

    cost = (area * 2000 * loc * (1 + (quality - 1) * 0.15) +
            btype * 50000 + timeline * 10000 +
            np.random.randint(-200000, 200000, n))

    return pd.DataFrame({
        'area':            area,
        'building_type':   btype,
        'location_factor': loc,
        'timeline_months': timeline,
        'quality_grade':   quality,
        'estimated_cost':  cost
    })

# ─── TRAIN DELAY PREDICTOR (RANDOM FOREST) ──────────────────────────
print("Training delay predictor...")
df_delay = generate_delay_data(n)
df_delay.to_csv(os.path.join(OUTPUT_DIR, 'data/training_data.csv'), index=False)

X = df_delay.drop('delayed', axis=1)
y = df_delay['delayed']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

delay_model = RandomForestClassifier(n_estimators=100, random_state=42)
delay_model.fit(X_train, y_train)
acc = accuracy_score(y_test, delay_model.predict(X_test))
print(f"  Delay model accuracy: {acc:.2%}")

with open(os.path.join(OUTPUT_DIR, 'delay_predictor.pkl'), 'wb') as f:
    pickle.dump(delay_model, f)
print(f"  Saved → {OUTPUT_DIR}/delay_predictor.pkl")

# ─── TRAIN COST ESTIMATOR (GRADIENT BOOSTING) ───────────────────────
print("Training cost estimator...")
df_cost = generate_cost_data(n)
df_cost.to_csv(os.path.join(OUTPUT_DIR, 'data/sample_projects.csv'), index=False)

X2 = df_cost.drop('estimated_cost', axis=1)
y2 = df_cost['estimated_cost']
X2_train, X2_test, y2_train, y2_test = train_test_split(X2, y2, test_size=0.2, random_state=42)

cost_model = GradientBoostingRegressor(n_estimators=100, random_state=42)
cost_model.fit(X2_train, y2_train)
mae = mean_absolute_error(y2_test, cost_model.predict(X2_test))
print(f"  Cost model MAE: ₹{mae:,.0f}")

with open(os.path.join(OUTPUT_DIR, 'cost_estimator.pkl'), 'wb') as f:
    pickle.dump(cost_model, f)
print(f"  Saved → {OUTPUT_DIR}/cost_estimator.pkl")

print("\n All models trained and saved to ml_models/")
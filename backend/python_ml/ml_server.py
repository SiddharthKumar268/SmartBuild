from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle, os, numpy as np
from design_optimizer import run_genetic_algorithm
from risk_predictor import predict_delay_risk

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"]}})

# ─── FIX 1: Use relative path so it works on Render ──────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), '../../ml_models')

def load_model(name):
    path = os.path.join(MODEL_DIR, name)
    if os.path.exists(path):
        with open(path, 'rb') as f:
            return pickle.load(f)
    return None

cost_model = load_model('cost_estimator.pkl')
delay_model = load_model('delay_predictor.pkl')

# ─── DESIGN OPTIMIZER ───────────────────────────────────────────────
@app.route('/generate-design', methods=['POST'])
def optimize_design():
    data = request.json
    designs = run_genetic_algorithm(data)
    return jsonify({ 'designs': designs })

# ─── RISK PREDICTOR ─────────────────────────────────────────────────
@app.route('/predict-risk', methods=['POST'])
def predict_risk():
    data = request.json
    result = predict_delay_risk(data, delay_model)
    return jsonify(result)

# ─── COST ESTIMATOR ─────────────────────────────────────────────────
@app.route('/estimate-cost', methods=['POST'])
def estimate_cost():
    data = request.json
    features = [
        data.get('area', 1000),
        data.get('building_type', 1),
        data.get('location_factor', 1.0),
        data.get('timeline_months', 12),
        data.get('quality_grade', 2)
    ]
    if cost_model:
        cost = float(cost_model.predict([features])[0])
    else:
        # fallback formula
        cost = features[0] * 2500 * features[2] * (1 + (features[4] - 1) * 0.15)

    return jsonify({
        'estimated_cost': round(cost, 2),
        'breakdown': {
            'material': round(cost * 0.45, 2),
            'labor':    round(cost * 0.30, 2),
            'equipment':round(cost * 0.15, 2),
            'overhead': round(cost * 0.10, 2)
        },
        'confidence': 0.82
    })

# ─── HEALTH CHECK ───────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({ 'status': 'ok', 'models': {
        'cost':  cost_model  is not None,
        'delay': delay_model is not None
    }})

# ─── FIX 2: Bind to 0.0.0.0 and read PORT from env (required by Render) ─
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
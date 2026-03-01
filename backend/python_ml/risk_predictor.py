import numpy as np

FEATURE_ORDER = [
    'weather_condition',    # 0=clear,1=cloudy,2=rain,3=storm
    'material_availability',# 0-100%
    'labor_count',          # number of workers
    'equipment_status',     # 0=idle,1=partial,2=full
    'project_complexity',   # 1=low,2=medium,3=high
    'site_accessibility'    # 1=poor,2=average,3=good
]

def predict_delay_risk(data, model=None):
    features = [
        data.get('weather_condition', 1),
        data.get('material_availability', 80),
        data.get('labor_count', 50),
        data.get('equipment_status', 1),
        data.get('project_complexity', 2),
        data.get('site_accessibility', 2)
    ]

    if model:
        prob = float(model.predict_proba([features])[0][1])
    else:
        # Rule-based fallback
        risk = 0.1
        if features[0] >= 2: risk += 0.25   # rain/storm
        if features[1] < 60: risk += 0.20   # low materials
        if features[2] < 30: risk += 0.15   # low labor
        if features[3] == 0: risk += 0.15   # idle equipment
        if features[4] == 3: risk += 0.10   # high complexity
        if features[5] == 1: risk += 0.10   # poor access
        prob = min(risk, 0.99)

    level = 'Low' if prob < 0.33 else 'Medium' if prob < 0.66 else 'High'
    color = '#22c55e' if level == 'Low' else '#f59e0b' if level == 'Medium' else '#ef4444'

    return {
        'risk_probability': round(prob * 100, 1),
        'risk_level': level,
        'color': color,
        'confidence_interval': [round((prob - 0.08) * 100, 1), round((prob + 0.08) * 100, 1)],
        'top_factors': _top_factors(features),
        'recommendations': _recommendations(features)
    }

def _top_factors(features):
    factors = []
    labels = ['Weather', 'Material Supply', 'Labor', 'Equipment', 'Complexity', 'Site Access']
    weights = [0.25, 0.20, 0.15, 0.15, 0.10, 0.10]
    for i, (label, w) in enumerate(zip(labels, weights)):
        factors.append({ 'factor': label, 'impact': round(w * 100), 'value': features[i] })
    return sorted(factors, key=lambda x: -x['impact'])

def _recommendations(features):
    recs = []
    if features[0] >= 2:
        recs.append('Reschedule outdoor work — adverse weather detected')
    if features[1] < 60:
        recs.append('Expedite material procurement immediately')
    if features[2] < 30:
        recs.append('Increase labor deployment for critical path tasks')
    if features[3] == 0:
        recs.append('Service idle equipment before next phase')
    if not recs:
        recs.append('Project is on track — maintain current pace')
    return recs
import random
import numpy as np
from deap import base, creator, tools, algorithms

# ─── GENETIC ALGORITHM ──────────────────────────────────────────────
# Chromosome: [floors, area_per_floor, material_grade, structural_type, facade_type]
# material_grade: 1=standard, 2=premium, 3=luxury
# structural_type: 1=RCC, 2=steel, 3=composite
# facade_type: 1=brick, 2=glass, 3=cladding

BOUNDS = {
    'floors':         (1, 30),
    'area_per_floor': (500, 5000),
    'material_grade': (1, 3),
    'structural_type':(1, 3),
    'facade_type':    (1, 3)
}

def decode(ind):
    return {
        'floors':          max(1, int(ind[0])),
        'area_per_floor':  max(500, int(ind[1])),
        'material_grade':  max(1, min(3, int(round(ind[2])))),
        'structural_type': max(1, min(3, int(round(ind[3])))),
        'facade_type':     max(1, min(3, int(round(ind[4]))))
    }

def fitness(individual, constraints):
    p = decode(individual)
    total_area = p['floors'] * p['area_per_floor']

    cost_per_sqft = 2000 + p['material_grade'] * 500 + p['structural_type'] * 300
    total_cost = total_area * cost_per_sqft
    timeline = 6 + p['floors'] * 1.5 + p['material_grade'] * 2
    safety_score = 60 + p['structural_type'] * 12 + p['material_grade'] * 5
    carbon = total_area * (0.8 - p['material_grade'] * 0.1 + p['structural_type'] * 0.15)

    budget = constraints.get('budget', float('inf'))
    cost_penalty = max(0, total_cost - budget) / budget if budget and budget < float('inf') else 0

    score = -(total_cost * 0.4 + timeline * 0.3 + carbon * 0.2 - safety_score * 0.1 + cost_penalty * 100000)
    return (score,)

def run_genetic_algorithm(data):
    constraints = {
        'budget':     data.get('budget', float('inf')),
        'max_floors': data.get('max_floors', 20),
        'min_area':   data.get('area', 1000)
    }
    budget = constraints['budget']

    if 'FitnessMax' not in creator.__dict__:
        creator.create('FitnessMax', base.Fitness, weights=(1.0,))
    if 'Individual' not in creator.__dict__:
        creator.create('Individual', list, fitness=creator.FitnessMax)

    toolbox = base.Toolbox()
    toolbox.register('individual', tools.initIterate, creator.Individual,
                     lambda: [random.uniform(b[0], b[1]) for b in BOUNDS.values()])
    toolbox.register('population', tools.initRepeat, list, toolbox.individual)
    toolbox.register('evaluate', lambda ind: fitness(ind, constraints))
    toolbox.register('mate', tools.cxBlend, alpha=0.3)
    toolbox.register('mutate', tools.mutGaussian, mu=0, sigma=1, indpb=0.2)
    toolbox.register('select', tools.selTournament, tournsize=3)

    pop = toolbox.population(n=100)
    algorithms.eaSimple(pop, toolbox, cxpb=0.7, mutpb=0.1, ngen=50, verbose=False)

    top3 = tools.selBest(pop, k=3)
    designs = []
    labels = ['Design A', 'Design B', 'Design C']

    for i, ind in enumerate(top3):
        p = decode(ind)
        total_area  = p['floors'] * p['area_per_floor']
        cost        = total_area * (2000 + p['material_grade'] * 500 + p['structural_type'] * 300)
        timeline_mo = round(6 + p['floors'] * 1.5 + p['material_grade'] * 2, 1)
        safety_raw  = round(60 + p['structural_type'] * 12 + p['material_grade'] * 5, 1)   # 60–111
        carbon_raw  = round(total_area * (0.8 - p['material_grade'] * 0.1), 2)

        # ── Normalised scores (0.0 – 1.0) for radar chart ──
        # cost_efficiency: how far under budget (or 0 if no budget)
        if budget and budget < float('inf'):
            cost_eff = max(0.0, round(1.0 - min(cost / budget, 1.5), 3))
        else:
            cost_eff = round(max(0.1, 1.0 - cost / 5e7), 3)   # relative to 50M default

        speed_score      = round(max(0.0, 1.0 - min(timeline_mo / 60.0, 1.0)), 3)
        safety_score_norm= round(min((safety_raw - 60) / 51.0, 1.0), 3)        # 60–111 → 0–1
        carbon_norm      = round(min(carbon_raw / max(total_area * 0.8, 1), 1.0), 3)  # relative to worst case
        quality_score    = round((p['material_grade'] / 3.0) * 0.7 + (p['structural_type'] / 3.0) * 0.3, 3)
        resilience_score = round((p['structural_type'] / 3.0) * 0.6 + (p['material_grade'] / 3.0) * 0.4, 3)

        # ── Cost breakdown percentages for donut chart ──
        labor_pct    = round(min(max(25 + p['floors'] * 0.5, 20), 40), 1)
        material_pct = round(min(max(35 + p['material_grade'] * 3, 30), 50), 1)
        equipment_pct= round(min(max(20 - p['floors'] * 0.2, 10), 25), 1)
        overhead_pct = round(max(100 - labor_pct - material_pct - equipment_pct, 5), 1)

        designs.append({
            # ── Basic info ──
            'id':              i,
            'label':           labels[i],
            'floors':          p['floors'],
            'area_per_floor':  p['area_per_floor'],
            'total_area':      total_area,
            'material_grade':  ['Standard', 'Premium', 'Luxury'][p['material_grade'] - 1],
            'structural_type': ['RCC', 'Steel', 'Composite'][p['structural_type'] - 1],
            'facade_type':     ['Brick', 'Glass', 'Cladding'][p['facade_type'] - 1],

            # ── Cost / time (raw) ──
            'estimated_cost':  round(cost, 2),
            'timeline_months': timeline_mo,
            'duration_days':   round(timeline_mo * 30),      # ← used in design cards & line chart

            # ── Safety / carbon (raw) ──
            'safety_score':    round(safety_raw / 111.0, 3), # normalised 0–1 for card display
            'carbon_footprint':carbon_raw,

            # ── Fitness ──
            'fitness':         round(ind.fitness.values[0], 2),
            'fitness_score':   round(max(0.0, min((ind.fitness.values[0] + 2e6) / 4e6, 1.0)), 3),

            # ── Radar chart scores (all 0–1) ──
            'cost_efficiency':  cost_eff,
            'speed_score':      speed_score,
            'safety_score_norm':safety_score_norm,
            'carbon_norm':      carbon_norm,
            'quality_score':    quality_score,
            'resilience_score': resilience_score,

            # ── Donut chart percentages ──
            'labor_pct':    labor_pct,
            'material_pct': material_pct,
            'equipment_pct':equipment_pct,
            'overhead_pct': overhead_pct,
        })

    return designs
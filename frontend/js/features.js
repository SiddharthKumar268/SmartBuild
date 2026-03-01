/* ============================================================
   SMARTBUILD AI — features.js
   All 10 Feature Modules (namespaced objects)
   Depends on: utils.js, api.js
   ============================================================ */

/* ============================================================
   FEATURE 1 — Smart Project Input Parser
   ============================================================ */
const Feature1 = {
  currentStep: 1,
  totalSteps: 4,
  formData: {},

  init() {
    this.bindWizardNav();
    this.bindBudgetFormatter();
    this.bindLocationAutocomplete();
    this.bindTimelineCalculator();
    this.bindValidation();
    this.renderStepIndicator();
    console.log('[Feature1] Smart Project Input Parser ready');
  },

  renderStepIndicator() {
    const el = document.getElementById('f1-step-indicator');
    if (!el) return;
    el.innerHTML = Array.from({ length: this.totalSteps }, (_, i) => `
      <div class="step-dot ${i + 1 === this.currentStep ? 'active' : i + 1 < this.currentStep ? 'done' : ''}" data-step="${i + 1}">
        <span class="step-num">${i + 1 < this.currentStep ? '✓' : i + 1}</span>
        <span class="step-label">${['Project Info', 'Site Details', 'Budget & Time', 'Review'][i]}</span>
      </div>
    `).join('<div class="step-line"></div>');
  },

  bindWizardNav() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-f1-next]')) this.nextStep();
      if (e.target.matches('[data-f1-prev]')) this.prevStep();
      if (e.target.matches('[data-f1-submit]')) this.submitProject();
    });
  },

  /* NOTE: nextStep / showStep / collectStepData / validateCurrentStep / submitProject
     are ALL overridden by the shims below to match index.html's actual DOM.
     The versions here are kept only as fallback for any future data-f1-step HTML. */

  nextStep() {
    if (!this.validateCurrentStep()) return;
    this.collectStepData();
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.showStep(this.currentStep);
      this.renderStepIndicator();
    }
  },

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.showStep(this.currentStep);
      this.renderStepIndicator();
    }
  },

  showStep(step) {
    document.querySelectorAll('[data-f1-step]').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.f1Step) === step);
    });
  },

  validateCurrentStep() {
    const step = document.querySelector(`[data-f1-step="${this.currentStep}"]`);
    if (!step) return true;
    let valid = true;
    step.querySelectorAll('[required]').forEach(input => {
      if (!input.value.trim()) {
        input.classList.add('input-error');
        valid = false;
      } else {
        input.classList.remove('input-error');
      }
    });
    return valid;
  },

  collectStepData() {
    const step = document.querySelector(`[data-f1-step="${this.currentStep}"]`);
    if (!step) return;
    step.querySelectorAll('input, select, textarea').forEach(input => {
      if (input.name) this.formData[input.name] = input.value;
    });
  },

  bindBudgetFormatter() {
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-budget-input]')) {
        const raw = e.target.value.replace(/[^\d]/g, '');
        e.target.value = Fmt.currency(raw);
        const display = document.getElementById('f1-budget-display');
        if (display) display.textContent = Fmt.currency(raw);
      }
    });
  },

  bindLocationAutocomplete() {
    const input = document.getElementById('f1-location');
    if (!input) return;
    const suggestions = [
      'Mumbai, Maharashtra', 'Delhi, NCR', 'Bengaluru, Karnataka',
      'Chennai, Tamil Nadu', 'Hyderabad, Telangana', 'Pune, Maharashtra',
      'Kolkata, West Bengal', 'Ahmedabad, Gujarat', 'Jaipur, Rajasthan',
    ];
    let dropdown = null;

    input.addEventListener('input', () => {
      const val = input.value.toLowerCase();
      if (dropdown) dropdown.remove();
      if (!val) return;
      const matches = suggestions.filter(s => s.toLowerCase().includes(val));
      if (!matches.length) return;
      dropdown = document.createElement('ul');
      dropdown.className = 'autocomplete-dropdown';
      matches.forEach(m => {
        const li = document.createElement('li');
        li.textContent = m;
        li.addEventListener('click', () => { input.value = m; dropdown.remove(); dropdown = null; });
        dropdown.appendChild(li);
      });
      input.parentElement.appendChild(dropdown);
    });

    document.addEventListener('click', (e) => {
      if (dropdown && !input.contains(e.target)) { dropdown.remove(); dropdown = null; }
    });
  },

  bindTimelineCalculator() {
    document.addEventListener('change', (e) => {
      if (e.target.matches('[data-timeline-input]')) {
        const startEl = document.querySelector('[name="start_date"]');
        const endEl = document.querySelector('[name="end_date"]');
        if (startEl?.value && endEl?.value) {
          const days = Timeline.diffDays(startEl.value, endEl.value);
          const display = document.getElementById('f1-timeline-display');
          if (display) {
            display.textContent = days > 0
              ? `${days} days (≈ ${Math.round(days / 30)} months)`
              : 'End date must be after start date';
            display.className = days > 0 ? 'timeline-ok' : 'timeline-error';
          }
        }
      }
    });
  },

  bindValidation() {
    document.addEventListener('blur', (e) => {
      if (e.target.matches('[data-f1-step] input, [data-f1-step] select')) {
        if (e.target.required && !e.target.value.trim()) {
          e.target.classList.add('input-error');
        } else {
          e.target.classList.remove('input-error');
        }
      }
    }, true);
  },

  async submitProject() {
    this.collectStepData();
    const btn = document.querySelector('[data-f1-submit]');
    setLoading(btn, true, 'Parsing...');
    try {
      const result = await DesignAPI.generateDesign(this.formData);
      Toast.success('Project parsed! Designs generated.');
      window.currentProject = result;
      Feature2.loadDesigns(result.designs);
      this.showStep(1);
      this.currentStep = 1;
      this.renderStepIndicator();
    } catch (err) {
      Toast.error('Failed to parse project: ' + err.message);
    } finally {
      setLoading(btn, false, 'Generate Designs');
    }
  },
};

/* ============================================================
   FEATURE 2 — AI Design Generator
   ============================================================ */
const Feature2 = {
  designs: [],
  selectedId: null,

  init() {
    this.bindGenerateBtn();
    console.log('[Feature2] AI Design Generator ready');
  },

  bindGenerateBtn() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-f2-generate]')) this.runGeneration();
      if (e.target.matches('[data-design-select]')) this.selectDesign(e.target.dataset.designSelect);
    });
  },

  async runGeneration() {
    const btn = document.querySelector('[data-f2-generate]');
    const progress = document.getElementById('f2-progress');
    const container = document.getElementById('f2-designs');
    if (container) container.innerHTML = '';

    setLoading(btn, true, 'Running GA...');
    this.animateProgress(progress);

    try {
      const project = window.currentProject || {};
      const result = await DesignAPI.generateDesign(project);
      this.loadDesigns(result.designs || []);
      Toast.success('3 optimized designs generated!');
    } catch {
      Toast.info('Backend offline — start the server to generate designs.');
    } finally {
      setLoading(btn, false, 'Generate Designs');
      if (progress) { progress.style.width = '100%'; setTimeout(() => { progress.style.width = '0%'; }, 1000); }
    }
  },

  animateProgress(el) {
    if (!el) return;
    let pct = 0;
    el.style.width = '0%';
    const iv = setInterval(() => {
      pct += Math.random() * 8;
      if (pct >= 90) { clearInterval(iv); pct = 90; }
      el.style.width = pct + '%';
    }, 300);
  },

  /* NOTE: loadDesigns is overridden by the shim below to also handle designsGrid */
  loadDesigns(designs) {
    this.designs = designs;
    const container = document.getElementById('f2-designs');
    if (container) container.innerHTML = designs.map((d, i) => this.renderDesignCard(d, i)).join('');
    Feature3.renderCharts(designs);
  },

  renderDesignCard(d, i) {
    const labels = ['A', 'B', 'C'];
    const badge = i === 1 ? '<span class="badge badge-info">RECOMMENDED</span>' : '';
    return `
      <div class="design-card ${i === 1 ? 'design-card--recommended' : ''}" id="design-${d.id}">
        <div class="design-card__header">
          <span class="design-label">DESIGN ${labels[i] || i}</span>
          ${badge}
          <span class="fitness-score">Fitness: <strong>${(d.fitness_score * 100).toFixed(1)}%</strong></span>
        </div>
        <div class="design-metrics">
          <div class="metric"><span class="metric-label">COST</span><span class="metric-value mono">${Fmt.currency(d.estimated_cost)}</span></div>
          <div class="metric"><span class="metric-label">DURATION</span><span class="metric-value mono">${d.duration_days} days</span></div>
          <div class="metric"><span class="metric-label">SAFETY</span><span class="metric-value mono">${(d.safety_score * 100).toFixed(0)}%</span></div>
          <div class="metric"><span class="metric-label">CARBON</span><span class="metric-value mono">${d.carbon_footprint} t CO₂</span></div>
        </div>
        <div class="design-card__footer">
          <button class="btn-outline" data-design-select="${i}">Select Design</button>
          <button class="btn-secondary" data-design-details="${d.id}">View Details →</button>
        </div>
      </div>
    `;
  },

  async selectDesign(id) {
    this.selectedId = id;
    document.querySelectorAll('.design-card').forEach(c => c.classList.remove('design-card--selected'));
    const card = document.getElementById(`design-${id}`);
    if (card) card.classList.add('design-card--selected');
    try {
      await DesignAPI.selectDesign(id);
      Toast.success(`Design ${id} selected & locked in.`);
      window.selectedDesign = this.designs.find(d => d.id === id);
      Feature8.refreshSchedule();
    } catch {
      Toast.info('Design selected (offline mode)');
    }
  },
};

/* ============================================================
   FEATURE 3 — Visual Design Comparison
   NOTE: _ctx() is overridden by shim to map to index.html canvas IDs
   ============================================================ */
const Feature3 = {
  charts: {},

  init() {
    console.log('[Feature3] Visual Design Comparison ready');
  },

  renderCharts(designs) {
    if (!designs?.length) return;
    this.destroyAll();
    this.renderRadar(designs);
    this.renderBar(designs);
    this.renderLine(designs);
    this.renderDonut(designs);
  },

  destroyAll() {
    Object.values(this.charts).forEach(c => c?.destroy());
    this.charts = {};
  },

  _ctx(id) {
    /* Overridden by shim — this fallback handles data-attribute based HTML */
    const el = document.getElementById(id);
    return el ? el.getContext('2d') : null;
  },

  renderRadar(designs) {
    const ctx = this._ctx('f3-radar');
    if (!ctx) return;
    this.charts.radar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Cost Eff.', 'Speed', 'Safety', 'Carbon', 'Quality', 'Resilience'],
        datasets: designs.map((d, i) => ({
          label: `Design ${['A', 'B', 'C'][i]}`,
          data: [
            (d.cost_efficiency || 0) * 100,
            (d.speed_score || 0) * 100,
            (d.safety_score_norm || d.safety_score || 0) * 100,
            (1 - (d.carbon_norm || 0)) * 100,
            (d.quality_score || 0) * 100,
            (d.resilience_score || 0) * 100,
          ],
          borderColor: CHART_COLORS[i],
          backgroundColor: CHART_COLORS[i] + '22',
          borderWidth: 2,
          pointBackgroundColor: CHART_COLORS[i],
        })),
      },
      options: {
        ...ChartCfg.radar(),
        maintainAspectRatio: false,
      },
    });
  },

  renderBar(designs) {
    const ctx = this._ctx('f3-bar');
    if (!ctx) return;
    this.charts.bar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Design A', 'Design B', 'Design C'],
        datasets: [{
          label: 'Estimated Cost (₹ Lakhs)',
          data: designs.map(d => ((d.estimated_cost || 0) / 100000).toFixed(2)),
          backgroundColor: CHART_COLORS,
          borderRadius: 4,
        }],
      },
      options: {
        ...ChartCfg.base(),
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
        },
      },
    });
  },

  renderLine(designs) {
    const ctx = this._ctx('f3-line');
    if (!ctx) return;
    const weeks = Array.from({ length: 10 }, (_, i) => `W${i + 1}`);
    this.charts.line = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weeks,
        datasets: designs.map((d, i) => ({
          label: `Design ${['A', 'B', 'C'][i]}`,
          data: weeks.map((_, w) => Math.round(((d.duration_days || 90) / 10) * (w + 1) * (0.9 + Math.random() * 0.2))),
          borderColor: CHART_COLORS[i],
          backgroundColor: CHART_COLORS[i] + '11',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        })),
      },
      options: {
        ...ChartCfg.base(),
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
        },
      },
    });
  },

  renderDonut(designs) {
    const ctx = this._ctx('f3-donut');
    if (!ctx) return;
    const d = designs[1] || designs[0];
    this.charts.donut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Labor', 'Materials', 'Equipment', 'Overhead'],
        datasets: [{
          data: [d.labor_pct || 35, d.material_pct || 40, d.equipment_pct || 15, d.overhead_pct || 10],
          backgroundColor: CHART_COLORS,
          borderWidth: 0,
          hoverOffset: 8,
        }],
      },
      options: {
        ...ChartCfg.doughnut(),
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'DM Mono' } } } },
      },
    });
  },
};
/* ============================================================
   FEATURE 4 — Delay Risk Predictor
   NOTE: gatherInputs() and renderResult() are overridden by shims
   ============================================================ */
const Feature4 = {
  init() {
    this.bindPredictBtn();
    console.log('[Feature4] Delay Risk Predictor ready');
  },

  bindPredictBtn() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-f4-predict]')) this.runPrediction();
    });
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-f4-input]')) {
        const display = document.getElementById(`${e.target.id}-val`);
        if (display) display.textContent = e.target.value;
      }
    });
  },

  gatherInputs() {
    /* Fallback for data-f4-* HTML — overridden by shim for index.html IDs */
    return {
      weather_condition: document.getElementById('f4-weather')?.value || '1',
      material_availability: document.getElementById('f4-materials')?.value || '80',
      labor_count: document.getElementById('f4-labor')?.value || '50',
      equipment_status: document.getElementById('f4-equipment')?.value || '2',
      project_complexity: document.getElementById('f4-complexity')?.value || '2',
      site_accessibility: document.getElementById('f4-access')?.value || '2',
    };
  },

  async runPrediction() {
    const btn = document.querySelector('[data-f4-predict]');
    const inputs = this.gatherInputs();
    setLoading(btn, true, 'Predicting...');
    try {
      const result = await PredictionAPI.predictRisk(inputs);
      this.renderResult(result);
    } catch {
      Toast.info('Backend offline — start the ML server to get predictions.');
    } finally {
      setLoading(btn, false, 'Predict Risk');
    }
  },

  /* renderResult() overridden by shim — this version handles data-f4-* HTML only */
  renderResult(result) {
    const pct = Math.round(result.risk_probability || 0);
    const level = pct >= 70 ? 'critical' : pct >= 40 ? 'warning' : 'safe';
    const labels = { critical: 'HIGH RISK', warning: 'MODERATE RISK', safe: 'LOW RISK' };

    const gauge = document.getElementById('f4-gauge');
    if (gauge) {
      gauge.className = `risk-gauge risk-gauge--${level}`;
      gauge.innerHTML = `
        <div class="gauge-ring" style="--pct:${pct}">
          <div class="gauge-inner">
            <span class="gauge-pct mono">${pct}%</span>
            <span class="gauge-label">${labels[level]}</span>
          </div>
        </div>
      `;
    }

    const factors = document.getElementById('f4-factors');
    if (factors && result.top_factors) {
      factors.innerHTML = result.top_factors.map(f => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="min-width:110px;font-family:'DM Mono',monospace;font-size:0.75rem;color:#94a3b8">${f.name || f.factor || 'Factor'}</span>
          <div style="flex:1;height:6px;background:#2a3550;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${f.impact || 0}%;background:#f59e0b;border-radius:3px"></div>
          </div>
          <span style="font-family:'DM Mono',monospace;font-size:0.75rem;color:#f59e0b">${f.impact || 0}%</span>
        </div>
      `).join('');
    }

    const ci = document.getElementById('f4-confidence');
    if (ci) {
      ci.innerHTML = `
        <span class="ci-label">95% Confidence Interval:</span>
        <span class="mono">${Math.max(0, pct - (result.margin || 8))}% — ${Math.min(100, pct + (result.margin || 8))}%</span>
        <span class="ci-accuracy">Model Accuracy: 82%</span>
      `;
    }

    if (level === 'critical') {
      Feature7.triggerAlert({
        type: 'critical',
        title: 'HIGH DELAY RISK DETECTED',
        message: `Risk predictor flagged ${pct}% delay probability. Immediate action recommended.`,
      });
    }
  },
};

/* ============================================================
   FEATURE 5 — Weather Impact Analyzer
   NOTE: renderForecast() / fetchWeather() overridden by shim for index.html
   ============================================================ */
const Feature5 = {
  init() {
    this.bindFetchBtn();
    console.log('[Feature5] Weather Impact Analyzer ready');
  },

  bindFetchBtn() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-f5-fetch]')) this.fetchWeather();
    });
  },

  async fetchWeather() {
    /* Fallback for data-f5-location HTML — overridden by shim for index.html */
    const btn = document.querySelector('[data-f5-fetch]');
    const location = document.getElementById('f5-location')?.value?.trim() || 'Mumbai';
    setLoading(btn, true, 'Fetching...');
    try {
      const result = await PredictionAPI.getWeather(location);
      this.renderForecast(result.forecast || []);
    } catch (err) {
      Toast.error('Weather fetch failed: ' + err.message);
    } finally {
      setLoading(btn, false, 'Get Forecast');
    }
  },

  /* renderForecast() overridden by shim — this handles data-f5-* HTML */
  renderForecast(forecast) {
    const grid = document.getElementById('f5-forecast');
    if (!grid) return;
    grid.innerHTML = forecast.map(day => {
      const impact = this.calcImpact(day);
      return `
        <div class="weather-card weather-card--${impact.level}">
          <div class="weather-date">${day.date}</div>
          <div class="weather-icon">${this.weatherIcon(day.condition)}</div>
          <div class="weather-temp mono">${day.temp_max}° / ${day.temp_min}°C</div>
          <div class="weather-desc">${day.condition}</div>
          <div class="weather-impact">
            <span class="impact-label">Impact:</span>
            <span class="impact-value impact-${impact.level}">${impact.label}</span>
          </div>
          <div class="weather-note" style="font-size:0.75rem;color:#94a3b8;margin-top:4px">${impact.note}</div>
        </div>
      `;
    }).join('');

    const summary = document.getElementById('f5-summary');
    if (summary) {
      const safe = forecast.filter(d => this.calcImpact(d).level === 'low').length;
      summary.innerHTML = `
        <span class="mono">${safe}/${forecast.length} workable days</span>
        <span class="impact-warn">${forecast.length - safe} days with construction impact</span>
      `;
    }
  },

  calcImpact(day) {
    if (day.rain_mm > 20 || day.wind_kmh > 50)
      return { level: 'high', label: 'HALT', note: 'Stop all outdoor work' };
    if (day.rain_mm > 5 || day.wind_kmh > 30)
      return { level: 'medium', label: 'REDUCED', note: 'Limit crane & height work' };
    if (day.temp_max > 42)
      return { level: 'medium', label: 'HEAT', note: 'Restrict labour 11am–4pm' };
    return { level: 'low', label: 'NORMAL', note: 'Full operations possible' };
  },

  weatherIcon(condition) {
    const map = {
      'Clear': '☀️', 'Sunny': '☀️', 'Cloudy': '☁️', 'Partly Cloudy': '⛅',
      'Rain': '🌧️', 'Heavy Rain': '⛈️', 'Thunderstorm': '⛈️', 'Fog': '🌫️',
      'Drizzle': '🌦️', 'Snow': '❄️',
    };
    return map[condition] || '🌡️';
  },
};

/* ============================================================
   FEATURE 6 — Real-Time Site Monitor
   ============================================================ */
const Feature6 = {
  intervalId: null,
  sensorHistory: {},

  init() {
    this.renderSensorGrid();
    this.startPolling();
    console.log('[Feature6] Real-Time Site Monitor ready');
  },

  startPolling() {
    this.pollSensors();
    this.intervalId = setInterval(() => this.pollSensors(), 5000);
  },

  async pollSensors() {
    try {
      const data = await MonitorAPI.getSensors();
      (data.sensors || []).forEach(s => this.updateSensor(s));
    } catch {
      /* Wait for real backend */
    }
  },

  renderSensorGrid() {
    const grid = document.getElementById('f6-sensor-grid');
    if (!grid) return;
    grid.innerHTML = SENSOR_CONFIG.map(s => `
      <div class="sensor-card" id="sensor-${s.id}" data-sensor="${s.id}">
        <div class="sensor-id">${s.icon} ${s.id}</div>
        <div class="sensor-metrics">
          <div class="sensor-metric">
            <span class="sensor-label">${s.name}</span>
            <span class="sensor-value mono" id="sensor-val-${s.id}">--</span>
          </div>
          <div class="sensor-metric">
            <span class="sensor-label">Unit</span>
            <span class="sensor-value mono">${s.unit}</span>
          </div>
        </div>
        <div style="margin-top:8px;height:6px;background:#2a3550;border-radius:3px;overflow:hidden">
          <div id="sensor-bar-${s.id}" style="height:100%;width:0%;background:#f59e0b;transition:width 0.5s ease;border-radius:3px"></div>
        </div>
        <div id="sensor-status-${s.id}" style="margin-top:6px;font-family:'DM Mono',monospace;font-size:0.7rem;color:#94a3b8">CONNECTING...</div>
      </div>
    `).join('');
  },

  updateSensor(data) {
    const id = data.sensorId || data.id;
    const raw = data.value;
    let value;
    if (typeof raw === 'object' && raw !== null) {
      const fieldMap = { 'S1': 'temperature', 'S2': 'humidity', 'S3': 'progress', 'S4': 'temperature' };
      value = raw[fieldMap[id]] ?? Object.values(raw)[0];
    } else {
      value = raw;
    }

    const tile = document.getElementById(`sensor-${id}`);
    const valEl = document.getElementById(`sensor-val-${id}`);
    const barEl = document.getElementById(`sensor-bar-${id}`);
    const statusEl = document.getElementById(`sensor-status-${id}`);
    if (!tile || !valEl) return;

    const cfg = SENSOR_CONFIG.find(s => s.id === id);
    const pct = cfg ? clamp((value / cfg.max) * 100, 0, 100) : 50;
    const status = cfg ? this.getSensorStatus(value, cfg) : 'normal';

    valEl.textContent = typeof value === 'number' ? value.toFixed(1) : value;
    if (barEl) {
      barEl.style.width = pct + '%';
      barEl.style.background = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f97316' : '#22c55e';
    }
    if (statusEl) statusEl.textContent = status.toUpperCase();
    tile.style.borderColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f97316' : '#2a3550';

    if (!this.sensorHistory[id]) this.sensorHistory[id] = [];
    this.sensorHistory[id].push({ t: Date.now(), v: value });
    if (this.sensorHistory[id].length > 20) this.sensorHistory[id].shift();

    if (status === 'critical') {
      Feature7.triggerAlert({
        type: 'critical',
        title: `SENSOR ALERT: ${cfg?.name || id}`,
        message: `Value ${value}${cfg?.unit || ''} exceeded threshold.`,
        sensorId: id,
      });
    }

    /* Push to dashboard */
    Feature10.updateMetric('health_score', Feature10.metrics.health_score);
    Feature6.renderSensorChart();
  },

  getSensorStatus(value, cfg) {
    if (value >= cfg.critical_high || value <= cfg.critical_low) return 'critical';
    if (value >= cfg.warning_high || value <= cfg.warning_low) return 'warning';
    return 'normal';
  },
};

/* ============================================================
   FEATURE 7 — Auto-Alert System
   ============================================================ */
const Feature7 = {
  alerts: [],
  maxAlerts: 50,

  init() {
    this.bindClearBtn();
    console.log('[Feature7] Auto-Alert System ready');
  },

  bindClearBtn() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-f7-clear]')) this.clearAlerts();
      if (e.target.matches('[data-alert-dismiss]')) this.dismissAlert(e.target.dataset.alertDismiss);
      if (e.target.matches('[data-f7-test]')) this.triggerTestAlert();
    });
  },

  triggerAlert({ type = 'info', title, message, sensorId = null }) {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type, title, message, sensorId,
      timestamp: new Date(),
      dismissed: false,
    };
    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxAlerts) this.alerts.pop();
    this.renderAlertFeed();
    this.showToastAlert(alert);
    this.updateBadge();
  },

  renderAlertFeed() {
    const feed = document.getElementById('f7-alert-feed');
    if (!feed) return;
    if (!this.alerts.length) {
      feed.innerHTML = '<div class="alert-item" style="justify-content:center;color:#94a3b8">No alerts — all systems nominal</div>';
      return;
    }
    feed.innerHTML = this.alerts.slice(0, 20).map(a => `
      <div class="alert-item alert-item--${a.type} ${a.dismissed ? 'alert-item--dismissed' : ''}" id="${a.id}">
        <div class="alert-icon">${this.alertIcon(a.type)}</div>
        <div class="alert-content">
          <div class="alert-time mono">${Fmt.time(a.timestamp)}</div>
          <div class="alert-message"><strong>${a.title}</strong> — ${a.message}</div>
        </div>
        <button class="alert-dismiss" data-alert-dismiss="${a.id}" title="Dismiss">✕</button>
      </div>
    `).join('');
  },

  showToastAlert(alert) {
    const typeMap = { critical: 'error', warning: 'warn', info: 'info', success: 'success' };
    const fn = Toast[typeMap[alert.type]] || Toast.info;
    fn(alert.title);
  },

  dismissAlert(id) {
    const a = this.alerts.find(x => x.id === id);
    if (a) a.dismissed = true;
    this.renderAlertFeed();
    this.updateBadge();
  },

  clearAlerts() {
    this.alerts = [];
    this.renderAlertFeed();
    this.updateBadge();
    Toast.success('All alerts cleared');
  },

  triggerTestAlert() {
    const types = ['critical', 'warning', 'info', 'success'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.triggerAlert({ type, title: `TEST ALERT — ${type.toUpperCase()}`, message: 'This is a simulated alert for testing purposes.' });
  },

  updateBadge() {
    const badge = document.getElementById('f7-badge');
    const count = this.alerts.filter(a => !a.dismissed).length;
    if (badge) {
      badge.textContent = count;
      badge.style.display = count ? 'inline-flex' : 'none';
    }
  },

  alertIcon(type) {
    return { critical: '🔴', warning: '🟡', info: '🔵', success: '🟢' }[type] || '⚪';
  },
};

/* ============================================================
   FEATURE 8 — Smart Schedule Adjuster
   NOTE: renderGantt() overridden by shim for ganttChart div
   ============================================================ */
const Feature8 = {
  tasks: [],

  init() {
    this.tasks = getDefaultTasks();
    this.bindAdjustBtn();
    this.renderGantt();
    console.log('[Feature8] Smart Schedule Adjuster ready');
  },

  bindAdjustBtn() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-f8-adjust]')) this.adjustSchedule();
      if (e.target.matches('[data-f8-reset]')) this.resetSchedule();
      if (e.target.matches('[data-task-toggle]')) this.toggleTask(e.target.dataset.taskToggle);
    });
  },

  async adjustSchedule() {
    const btn = document.querySelector('[data-f8-adjust]');
    setLoading(btn, true, 'Adjusting...');
    try {
      const result = await OptimizeAPI.adjustSchedule({ tasks: this.tasks });
      this.tasks = result.tasks || this.tasks;
      this.renderGantt();
      Toast.success(`Schedule optimised — ${result.days_saved || 0} days saved`);
    } catch {
      this.applyLocalAdjustment();
      Toast.info('Schedule adjusted locally (backend offline)');
    } finally {
      setLoading(btn, false, 'Auto-Adjust Schedule');
    }
  },

  applyLocalAdjustment() {
    const cpm = OptimizeAPI.calculateCriticalPath(this.tasks);
    this.tasks = cpm.tasks.map(t => ({
      ...t,
      duration: t.slack > 2 ? Math.max(1, t.duration - Math.floor(t.slack / 2)) : t.duration,
      adjusted: t.slack > 2,
      critical_path: cpm.criticalPath.includes(t.id),
    }));
    this.renderGantt();
  },

  resetSchedule() {
    this.tasks = getDefaultTasks();
    this.renderGantt();
    Toast.info('Schedule reset to baseline');
  },

  refreshSchedule() {
    this.applyLocalAdjustment();
  },

  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) { task.collapsed = !task.collapsed; this.renderGantt(); }
  },

  /* renderGantt() overridden by shim — this handles f8-gantt HTML */
  renderGantt() {
    const container = document.getElementById('f8-gantt');
    if (!container) return;
    const totalDays = Math.max(...this.tasks.map(t => t.start + t.duration), 1);
    container.innerHTML = `
      <div class="gantt-header">
        <div class="gantt-col-task">TASK</div>
        <div class="gantt-col-timeline">TIMELINE (${totalDays} days)</div>
      </div>
      ${this.tasks.map(t => this._ganttRow(t, totalDays)).join('')}
    `;
  },

  _ganttRow(task, totalDays) {
    const leftPct = (task.start / totalDays) * 100;
    const widthPct = Math.max((task.duration / totalDays) * 100, 1);
    const cls = task.critical_path ? 'critical' : task.adjusted ? 'delayed' : '';
    return `
      <div class="gantt-row">
        <div class="gantt-task-name">
          ${task.name}
          ${task.critical_path ? '<span class="badge badge-danger" style="margin-left:4px;font-size:0.6rem">CPM</span>' : ''}
          ${task.adjusted ? '<span class="badge badge-info" style="margin-left:4px;font-size:0.6rem">ADJ</span>' : ''}
        </div>
        <div class="gantt-timeline">
          <div class="gantt-bar ${cls}" style="left:${leftPct}%;width:${widthPct}%" title="${task.name}: ${task.duration} days">
            ${task.duration}d
          </div>
        </div>
      </div>
    `;
  },
};

/* ============================================================
   FEATURE 9 — Cost Impact Calculator
   NOTE: gatherInputs() and renderBreakdown() overridden by shim
   ============================================================ */
const Feature9 = {
  chart: null,

  init() {
    this.bindInputs();
    this.bindCalcBtn();
    console.log('[Feature9] Cost Impact Calculator ready');
  },

  bindInputs() {
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-f9-input]')) this.liveCalculate();
    });
  },

  bindCalcBtn() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-f9-calculate]')) this.fullCalculation();
    });
  },

  /* gatherInputs() overridden by shim for index.html IDs */
  gatherInputs() {
    const get = id => parseFloat(document.getElementById(id)?.value) || 0;
    return {
      delay_days: get('f9-delay-days'),
      daily_overhead: get('f9-daily-overhead'),
      labor_idle_cost: get('f9-labor-idle'),
      rework_cost: get('f9-rework'),
      penalty_per_day: get('f9-penalty'),
      opportunity_loss: get('f9-opportunity'),
    };
  },

  liveCalculate() {
    const totals = this._compute(this.gatherInputs());
    const liveEl = document.getElementById('f9-live-total');
    if (liveEl) liveEl.textContent = Fmt.currency(totals.grand_total);
  },

  async fullCalculation() {
    const btn = document.querySelector('[data-f9-calculate]');
    const inputs = this.gatherInputs();
    setLoading(btn, true, 'Calculating...');
    try {
      const result = await OptimizeAPI.calculateCostImpact(inputs);
      this.renderBreakdown(result);
    } catch {
      this.renderBreakdown(this._compute(inputs));
    } finally {
      setLoading(btn, false, 'Calculate Impact');
    }
  },

  _compute(inputs) {
    const direct = inputs.delay_days * (inputs.daily_overhead + inputs.labor_idle_cost);
    const indirect = inputs.delay_days * inputs.penalty_per_day + inputs.rework_cost;
    const opportunity = inputs.opportunity_loss;
    const risk = (direct + indirect) * 0.15;
    return { direct, indirect, opportunity, risk, grand_total: direct + indirect + opportunity + risk };
  },

  /* renderBreakdown() overridden by shim — this handles f9-breakdown HTML */
  renderBreakdown(data) {
    const breakdown = document.getElementById('f9-breakdown');
    if (breakdown) {
      const items = [
        { label: 'Direct Costs', value: data.direct },
        { label: 'Indirect Costs', value: data.indirect },
        { label: 'Opportunity Costs', value: data.opportunity },
        { label: 'Risk Buffer (15%)', value: data.risk },
      ];
      breakdown.innerHTML = items.map(item => `
        <div class="cost-item">
          <span class="cost-label">${item.label}</span>
          <span class="cost-value mono">${Fmt.currency(item.value)}</span>
        </div>
      `).join('') + `
        <div class="cost-item total">
          <span class="cost-label">TOTAL IMPACT</span>
          <span class="cost-value mono">${Fmt.currency(data.grand_total)}</span>
        </div>
      `;
    }

    const total = document.getElementById('f9-grand-total');
    if (total) total.textContent = Fmt.currency(data.grand_total);

    this._renderCostDonut(data);
    Feature10.updateMetric('cost_impact', data.grand_total);
  },

  _renderCostDonut(data) {
    const ctx = document.getElementById('f9-chart')?.getContext('2d');
    if (!ctx) return;
    if (this.chart) this.chart.destroy();
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Direct', 'Indirect', 'Risk'],
        datasets: [{ data: [+d, +ind, +r], backgroundColor: ['#f59e0b', '#ef4444', '#06b6d4'], borderWidth: 0 }],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'DM Mono' } } } },
      },
    });
  },
};

/* ============================================================
   FEATURE 10 — Command Center Dashboard
   NOTE: renderKPIs() overridden by shim for index.html KPI IDs
   ============================================================ */
const Feature10 = {
  metrics: {
    health_score: 72,
    budget_used: 58,
    schedule_var: 2,
    risk_index: 34,
    productivity: 78,
    cost_impact: 0,
  },
  chart: null,

  init() {
    this.bindRefreshBtn();
    this.refreshDashboard();
    setInterval(() => this.tickLiveMetrics(), 8000);
    console.log('[Feature10] Command Center Dashboard ready');
  },

  bindRefreshBtn() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-f10-refresh]')) this.refreshDashboard();
    });
  },

  async refreshDashboard() {
    const btn = document.querySelector('[data-f10-refresh]');
    setLoading(btn, true, 'Refreshing...');
    try {
      const status = await MonitorAPI.getStatus();
      this.metrics = { ...this.metrics, ...status };
    } catch {
      /* Use current metrics */
    }
    this.renderDashboard();
    setLoading(btn, false, '⟳ Refresh');
  },

  updateMetric(key, value) {
    this.metrics[key] = value;
    this.renderDashboard();
  },

  tickLiveMetrics() {
    this.metrics.productivity = clamp(this.metrics.productivity + (Math.random() * 4 - 2), 0, 100);
    this.metrics.health_score = clamp(this.metrics.health_score + (Math.random() * 2 - 1), 0, 100);
    this.renderDashboard();
  },

  renderDashboard() {
    this.renderKPIs();
    this.renderHealthRing();
    this.renderTrendChart();
    this.renderRecommendations();
  },

  /* renderKPIs() overridden by shim — this handles f10-* HTML */
  renderKPIs() {
    const m = this.metrics;
    const kpis = [
      { id: 'f10-health', label: 'PROJECT HEALTH', value: `${Math.round(m.health_score)}%`, cls: m.health_score >= 70 ? 'healthy' : m.health_score >= 40 ? 'warning' : 'critical' },
      { id: 'f10-budget', label: 'BUDGET USED', value: `${Math.round(m.budget_used)}%`, cls: m.budget_used <= 80 ? 'healthy' : m.budget_used <= 95 ? 'warning' : 'critical' },
      { id: 'f10-schedule', label: 'SCHEDULE VARIANCE', value: `${m.schedule_var > 0 ? '+' : ''}${Math.round(m.schedule_var)}d`, cls: m.schedule_var <= 0 ? 'healthy' : m.schedule_var <= 5 ? 'warning' : 'critical' },
      { id: 'f10-risk', label: 'RISK INDEX', value: `${Math.round(m.risk_index)}%`, cls: m.risk_index <= 30 ? 'healthy' : m.risk_index <= 60 ? 'warning' : 'critical' },
      { id: 'f10-productivity', label: 'TEAM PRODUCTIVITY', value: `${Math.round(m.productivity)}%`, cls: m.productivity >= 70 ? 'healthy' : m.productivity >= 50 ? 'warning' : 'critical' },
    ];
    kpis.forEach(({ id, label, value, cls }) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = `kpi-card ${cls}`;
      el.innerHTML = `<div class="kpi-label">${label}</div><div class="kpi-value mono">${value}</div>`;
    });
  },

  renderHealthRing() {
    const ring = document.getElementById('f10-health-ring');
    if (!ring) return;
    const pct = Math.round(this.metrics.health_score);
    const status = pct >= 70 ? 'good' : pct >= 40 ? 'warn' : 'bad';
    const dash = 2 * Math.PI * 54;
    const offset = dash * (1 - pct / 100);
    const color = status === 'good' ? 'var(--success)' : status === 'warn' ? 'var(--amber)' : 'var(--danger)';
    ring.innerHTML = `
      <svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--steel)" stroke-width="8"/>
        <circle cx="60" cy="60" r="54" fill="none"
          stroke="${color}" stroke-width="8"
          stroke-dasharray="${dash}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 60 60)"
          style="transition:stroke-dashoffset 0.8s ease"/>
        <text x="60" y="56" text-anchor="middle" fill="var(--white)" font-family="DM Mono" font-size="20">${pct}</text>
        <text x="60" y="72" text-anchor="middle" fill="var(--concrete)" font-family="Syne" font-size="9">HEALTH</text>
      </svg>
    `;
  },

  renderTrendChart() {
    const ctx = document.getElementById('f10-trend')?.getContext('2d');
    if (!ctx) return;
    if (this.chart) this.chart.destroy();
    const labels = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Health Score',
            data: labels.map(() => clamp(50 + Math.random() * 40, 0, 100)),
            borderColor: '#22c55e', backgroundColor: '#22c55e22',
            borderWidth: 2, fill: true, tension: 0.4,
          },
          {
            label: 'Risk Index',
            data: labels.map(() => clamp(20 + Math.random() * 40, 0, 100)),
            borderColor: '#ef4444', backgroundColor: '#ef444422',
            borderWidth: 2, fill: true, tension: 0.4,
          },
        ],
      },
      options: {
        ...ChartCfg.base(),
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
          y: { min: 0, max: 100, ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
        },
      },
    });
  },

  renderRecommendations() {
    const panel = document.getElementById('f10-recommendations');
    if (!panel) return;
    const recs = generateRecommendations(this.metrics);
    panel.innerHTML = `
      <h3 style="font-size:1.25rem;color:var(--amber);margin-bottom:1rem">⚡ AI Recommendations</h3>
      ${recs.map(r => `
        <div class="recommendation-item">
          <span class="recommendation-icon">${r.icon}</span>
          <div class="recommendation-content">
            <div class="recommendation-title">${r.title}</div>
            <div class="recommendation-desc">${r.desc}</div>
          </div>
          <span class="badge badge-${r.priority === 'critical' ? 'danger' : r.priority === 'warning' ? 'warning' : r.priority === 'success' ? 'success' : 'info'}">${r.priority.toUpperCase()}</span>
        </div>
      `).join('')}
    `;
  },
};

/* ============================================================
   SHIMS — Bridge index.html onclick="FeatureX.method()" to features
   ============================================================ */

/* ── Feature1 shims ───────────────────────────────────────── */
Feature1.nextStep = function (targetStep) {
  if (!this.validateCurrentStep()) return;
  this.collectStepData();
  this.currentStep = targetStep || (this.currentStep + 1);
  this.showStep(this.currentStep);
  this.renderStepIndicator();
};

Feature1.showStep = function (step) {
  document.querySelectorAll('.wizard-pane').forEach(el => el.classList.remove('active'));
  const pane = document.getElementById('step' + step);
  if (pane) pane.classList.add('active');
  document.querySelectorAll('.wizard-steps .step').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle('active', s === step);
    el.classList.toggle('done', s < step);
  });
};

Feature1.collectStepData = function () {
  ['projectName', 'projectType', 'totalArea', 'location', 'siteAccess',
    'budget', 'qualityGrade', 'startDate', 'endDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) this.formData[id] = el.value;
    });
};

Feature1.validateCurrentStep = function () {
  const required = {
    1: ['projectName', 'totalArea'],
    2: ['location'],
    3: ['budget'],
    4: ['startDate', 'endDate'],
  };
  let valid = true;
  (required[this.currentStep] || []).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.value.trim()) { el.style.borderColor = '#ef4444'; valid = false; }
    else el.style.borderColor = '';
  });
  return valid;
};

Feature1.submitProject = async function () {
  this.collectStepData();
  const btn = document.querySelector('.wizard-pane.active .btn-primary');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Parsing...'; }
    const result = await DesignAPI.generateDesign(this.formData);
    Toast.success('Project parsed! Designs generated.');
    window.currentProject = result;
    Feature2.loadDesigns(result.designs || []);
    this.showStep(1);
    this.currentStep = 1;
  } catch {
    Toast.error('Failed to parse project — is the server running?');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Parse & Generate →'; }
  }
};

/* ── Feature2 / Feature3 shims ───────────────────────────── */
Feature2.generate = function () { this.runGeneration(); };
Feature3.selectDesign = function (id) { Feature2.selectDesign(id); };

/* Map Feature3 canvas IDs from index.html */
Feature3._ctx = function (logicalId) {
  const map = { 'f3-radar': 'radarChart', 'f3-bar': 'costChart', 'f3-line': 'timelineChart', 'f3-donut': 'resourceChart' };
  const el = document.getElementById(map[logicalId] || logicalId);
  return el ? el.getContext('2d') : null;
};

/* Show designsGrid when designs load */
const _origLoadDesigns = Feature2.loadDesigns.bind(Feature2);
Feature2.loadDesigns = function (designs) {
  const grid = document.getElementById('designsGrid');
  if (grid) { grid.style.display = 'grid'; grid.innerHTML = ''; }
  const loader = document.getElementById('designLoader');
  if (loader) loader.style.display = 'none';
  _origLoadDesigns(designs);
  if (grid) grid.innerHTML = designs.map((d, i) => Feature2.renderDesignCard(d, i)).join('');
  const row = document.getElementById('selectDesignRow');
  if (row) row.style.display = 'flex';
};

/* ── Feature4 shims ───────────────────────────────────────── */
Feature4.predict = function () {
  this.gatherInputs = function () {
    return {
      weather_condition: document.getElementById('weatherCondition')?.value || '1',
      material_availability: document.getElementById('materialAvail')?.value || '80',
      labor_count: document.getElementById('laborCount')?.value || '50',
      equipment_status: document.getElementById('equipStatus')?.value || '1',
      project_complexity: document.getElementById('complexity')?.value || '2',
      site_accessibility: '2',
    };
  };
  this.runPrediction();
};

/* FIX 1: pct = Math.round(result.risk_probability) NOT *100
   FIX 2: use f.impact (not f.weight) for bar width and display */
Feature4.renderResult = function (result) {
  const pct = Math.round(result.risk_probability || 0);          // FIX 1
  const level = pct >= 70 ? 'critical' : pct >= 40 ? 'warning' : 'safe';

  const output = document.getElementById('riskOutput');
  if (output) output.style.display = 'block';

  const scoreEl = document.getElementById('riskScore');
  const levelEl = document.getElementById('riskLevel');
  if (scoreEl) { scoreEl.textContent = pct + '%'; scoreEl.style.color = result.color || '#f59e0b'; }
  if (levelEl) { levelEl.textContent = result.risk_level || level.toUpperCase(); levelEl.style.color = result.color; }

  const factors = document.getElementById('riskFactors');
  if (factors && result.top_factors) {
    factors.innerHTML = result.top_factors.map(f => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="min-width:110px;font-family:'DM Mono',monospace;font-size:0.75rem;color:#94a3b8">${f.name || f.factor || 'Factor'}</span>
        <div style="flex:1;height:6px;background:#2a3550;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${f.impact || 0}%;background:#f59e0b;border-radius:3px"></div>
        </div>
        <span style="font-family:'DM Mono',monospace;font-size:0.75rem;color:#f59e0b">${f.impact || 0}%</span>
      </div>
    `).join('');                                                  // FIX 2
  }

  const recs = document.getElementById('riskRecs');
  if (recs && result.recommendations) {
    recs.innerHTML = result.recommendations.map(r =>
      `<div style="padding:6px 0;border-bottom:1px solid #2a3550;font-size:0.85rem;color:#cbd5e1">⚠ ${r}</div>`
    ).join('');
  }

  if (level === 'critical') {
    Feature7.triggerAlert({
      type: 'critical', title: 'HIGH DELAY RISK DETECTED',
      message: `Risk predictor flagged ${pct}% delay probability.`,
    });
  }
};

/* ── Feature5 shims ───────────────────────────────────────── */
Feature5.fetch = function () {
  const lat = document.getElementById('weatherLat')?.value || '19.076';
  const lon = document.getElementById('weatherLon')?.value || '72.877';
  this.fetchWeatherByCoords(lat, lon);
};

Feature5.fetchWeatherByCoords = async function (lat, lon) {
  const btn = document.querySelector('[onclick="Feature5.fetch()"]') ||
    document.querySelector('#f5 .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Fetching...'; }
  try {
    const result = await PredictionAPI.getWeather(`${lat},${lon}`);  // FIX 3 handled in api.js
    this.renderForecast(result.forecast || []);
  } catch {
    Toast.error('Weather fetch failed — check server or network');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Fetch Forecast'; }
  }
};
Feature5.renderForecast = function (forecast) {
  const grid = document.getElementById('weatherGrid');
  if (!grid) return;
  if (!forecast.length) { grid.innerHTML = '<p style="color:#94a3b8">No forecast data</p>'; return; }

  grid.innerHTML = forecast.map(day => {
    const impact = this.calcImpact(day);
    return `
      <div class="weather-card" style="background:#13192a;border:1px solid #2a3550;border-radius:8px;padding:12px;min-width:120px;text-align:center">
        <div style="font-family:'DM Mono',monospace;font-size:0.75rem;color:#94a3b8">${day.date || ''}</div>
        <div style="font-size:1.5rem;margin:4px 0">${this.weatherIcon(day.condition)}</div>
        <div style="font-family:'DM Mono',monospace;font-size:0.85rem;color:#e2e8f0">${day.temp_max}° / ${day.temp_min}°C</div>
        <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px">${day.condition}</div>
        <div style="margin-top:6px;font-size:0.75rem;color:${impact.level === 'high' ? '#ef4444' : impact.level === 'medium' ? '#f59e0b' : '#22c55e'};font-weight:600">${impact.label}</div>
      </div>
    `;
  }).join('');

  const ctx = document.getElementById('weatherChart')?.getContext('2d');
  const wrap = document.getElementById('weatherChartWrap');
  if (!ctx) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = 'block';

  if (this._weatherChart) this._weatherChart.destroy();
  this._weatherChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: forecast.map(d => d.date),
      datasets: [
        {
          label: 'Rain (mm)',
          data: forecast.map(d => d.rain_mm),
          backgroundColor: '#06b6d4aa',
          borderColor: '#06b6d4',
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          label: 'Wind (km/h)',
          data: forecast.map(d => d.wind_kmh),
          type: 'line',
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'DM Mono' } } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' }, title: { display: true, text: 'Rain mm', color: '#06b6d4' } },
        y1: { position: 'right', ticks: { color: '#f59e0b' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Wind km/h', color: '#f59e0b' } },
      },
    },
  });
};

/* ── Feature7 shims ───────────────────────────────────────── */
Feature7.createAlert = function () {
  const msg = document.getElementById('alertMsg')?.value?.trim();
  const type = document.getElementById('alertType')?.value || 'info';
  if (!msg) { Toast.warn('Enter an alert message first'); return; }
  this.triggerAlert({ type, title: type.toUpperCase(), message: msg });
  const input = document.getElementById('alertMsg');
  if (input) input.value = '';
  this.renderIntoAlertList();
};

Feature7.renderIntoAlertList = function () {
  const list = document.getElementById('alertList');
  if (!list) return;
  if (!this.alerts.length) {
    list.innerHTML = '<div style="color:#94a3b8;padding:12px">No alerts yet</div>';
    return;
  }
  list.innerHTML = this.alerts.slice(0, 15).map(a => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #2a3550">
      <span>${this.alertIcon(a.type)}</span>
      <div style="flex:1">
        <div style="font-weight:600;color:#e2e8f0">${a.title}</div>
        <div style="font-size:0.82rem;color:#94a3b8">${a.message}</div>
        <div style="font-size:0.72rem;color:#475569;font-family:'DM Mono',monospace;margin-top:2px">${new Date(a.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  `).join('');
};

/* Hook WebSocket alerts into alertList */
const _origTrigger = Feature7.triggerAlert.bind(Feature7);
Feature7.triggerAlert = function (opts) {
  _origTrigger(opts);
  this.renderIntoAlertList();
};

/* ── Feature8 shims ───────────────────────────────────────── */
Feature8.loadDefault = function () { this.resetSchedule(); };
Feature8.optimize = function () { this.adjustSchedule(); };

Feature8.renderGantt = function () {
  const container = document.getElementById('ganttChart');
  if (!container) return;
  const totalDays = Math.max(...this.tasks.map(t => t.start + t.duration), 1);
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:180px 1fr;gap:4px;font-family:'DM Mono',monospace;font-size:0.78rem">
      <div style="color:#94a3b8;padding:4px 0;border-bottom:1px solid #2a3550">TASK</div>
      <div style="color:#94a3b8;padding:4px 0;border-bottom:1px solid #2a3550">TIMELINE (${totalDays} days)</div>
      ${this.tasks.map(t => {
    const leftPct = (t.start / totalDays * 100).toFixed(1);
    const widthPct = Math.max((t.duration / totalDays * 100), 1).toFixed(1);
    const bg = t.critical_path ? '#ef4444' : t.adjusted ? '#06b6d4' : '#f59e0b';
    return `
          <div style="color:#cbd5e1;padding:6px 4px;border-bottom:1px solid #1e2a40;display:flex;align-items:center;gap:4px">
            ${t.name}
            ${t.critical_path ? '<span style="background:#ef444422;color:#ef4444;padding:1px 4px;border-radius:3px;font-size:0.65rem">CPM</span>' : ''}
            ${t.adjusted ? '<span style="background:#06b6d422;color:#06b6d4;padding:1px 4px;border-radius:3px;font-size:0.65rem">ADJ</span>' : ''}
          </div>
          <div style="padding:4px 0;border-bottom:1px solid #1e2a40;position:relative;height:28px">
            <div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:20px;background:${bg};border-radius:3px;display:flex;align-items:center;justify-content:center;color:#0a0d14;font-size:0.7rem;font-weight:600;margin-top:2px">${t.duration}d</div>
          </div>
        `;
  }).join('')}
    </div>
  `;
};

/* ── Feature9 shims ───────────────────────────────────────── */
Feature9.calculate = function () { this.fullCalculation(); };

Feature9.gatherInputs = function () {
  const get = id => parseFloat(document.getElementById(id)?.value) || 0;
  return {
    delay_days: get('directCost'),
    daily_overhead: 0,
    labor_idle_cost: 0,
    rework_cost: get('indirectCost'),
    penalty_per_day: 0,
    opportunity_loss: get('riskCost'),
  };
};

Feature9.renderBreakdown = function (data) {
  const output = document.getElementById('costOutput');
  if (output) output.style.display = 'block';

  const breakdown = document.getElementById('costBreakdown');
  if (breakdown) {
    const items = [
      { label: 'Direct Costs', value: data.direct || parseFloat(document.getElementById('directCost')?.value) || 0 },
      { label: 'Indirect Costs', value: data.indirect || parseFloat(document.getElementById('indirectCost')?.value) || 0 },
      { label: 'Risk Provision', value: data.risk || parseFloat(document.getElementById('riskCost')?.value) || 0 },
      { label: 'Opportunity Cost', value: data.opportunity || 0 },
    ];
    const total = items.reduce((s, i) => s + i.value, 0);
    breakdown.innerHTML = items.map(i => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2a3550">
        <span style="color:#94a3b8">${i.label}</span>
        <span style="font-family:'DM Mono',monospace;color:#f59e0b">${Fmt.currency(i.value)}</span>
      </div>
    `).join('') + `
      <div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:4px">
        <span style="font-weight:700;color:#e2e8f0">TOTAL</span>
        <span style="font-family:'DM Mono',monospace;color:#f59e0b;font-size:1.1rem;font-weight:700">${Fmt.currency(total)}</span>
      </div>
    `;
  }

  const ctx = document.getElementById('costPieChart')?.getContext('2d');
  if (ctx) {
    if (this.chart) this.chart.destroy();
    const d = parseFloat(document.getElementById('directCost')?.value) || 0;
    const ind = parseFloat(document.getElementById('indirectCost')?.value) || 0;
    const r = parseFloat(document.getElementById('riskCost')?.value) || 0;
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Direct', 'Indirect', 'Risk'],
        datasets: [{ data: [d, ind, r], backgroundColor: ['#f59e0b', '#ef4444', '#06b6d4'], borderWidth: 0 }],
      },
      options: { plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'DM Mono' } } } }, responsive: true },
    });
  }
};

Feature10.renderTrendChart = function () {
  const ctx = document.getElementById('dashboardChart')?.getContext('2d');
  if (!ctx) return;
  if (this.chart) this.chart.destroy();
  const labels = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
  this.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Health Score',
          data: labels.map(() => clamp(50 + Math.random() * 40, 0, 100)),
          borderColor: '#22c55e', backgroundColor: '#22c55e22',
          borderWidth: 2, fill: true, tension: 0.4,
        },
        {
          label: 'Risk Index',
          data: labels.map(() => clamp(20 + Math.random() * 40, 0, 100)),
          borderColor: '#ef4444', backgroundColor: '#ef444422',
          borderWidth: 2, fill: true, tension: 0.4,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      ...ChartCfg.base(),
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
        y: { min: 0, max: 100, ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
      },
    },
  });
};
/* ── Feature10 shims ──────────────────────────────────────── */
Feature10.renderKPIs = function () {
  const m = this.metrics;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('kpiHealth', Math.round(m.health_score) + '%');
  set('kpiBudget', Math.round(m.budget_used) + '%');
  set('kpiSchedule', (m.schedule_var > 0 ? '+' : '') + Math.round(m.schedule_var) + 'd');
  set('kpiRisk', Math.round(m.risk_index) + '%');
  set('kpiProductivity', Math.round(m.productivity) + '%');

  const cards = {
    'kpi-health': m.health_score >= 70,
    'kpi-budget': m.budget_used <= 80,
    'kpi-schedule': m.schedule_var <= 0,
    'kpi-risk': m.risk_index <= 30,
    'kpi-productivity': m.productivity >= 70,
  };
  Object.entries(cards).forEach(([id, ok]) => {
    const el = document.getElementById(id);
    if (el) el.style.borderColor = ok ? '#22c55e' : '#f59e0b';
  });
};
/* ── Feature6 — remap sensor grid to index.html ID ── */
Feature6.renderSensorGrid = function () {
  const grid = document.getElementById('sensorGrid');
  if (!grid) return;
  grid.innerHTML = SENSOR_CONFIG.map(s => `
    <div class="sensor-card" id="sensor-${s.id}" data-sensor="${s.id}">
      <div class="sensor-id">${s.icon} ${s.id}</div>
      <div class="sensor-metrics">
        <div class="sensor-metric">
          <span class="sensor-label">${s.name}</span>
          <span class="sensor-value mono" id="sensor-val-${s.id}">--</span>
        </div>
        <div class="sensor-metric">
          <span class="sensor-label">Unit</span>
          <span class="sensor-value mono">${s.unit}</span>
        </div>
      </div>
      <div style="margin-top:8px;height:6px;background:#2a3550;border-radius:3px;overflow:hidden">
        <div id="sensor-bar-${s.id}" style="height:100%;width:0%;background:#f59e0b;transition:width 0.5s ease;border-radius:3px"></div>
      </div>
      <div id="sensor-status-${s.id}" style="margin-top:6px;font-family:'DM Mono',monospace;font-size:0.7rem;color:#94a3b8">WAITING FOR BACKEND</div>
    </div>
  `).join('');
};
/* ── Feature6 — render sensor history chart ──────────────── */
Feature6.renderSensorChart = function () {
  const ctx = document.getElementById('sensorChart')?.getContext('2d');
  if (!ctx) return;

  const colors = { S1: '#f59e0b', S2: '#06b6d4', S3: '#22c55e', S4: '#ef4444' };
  const datasets = Object.entries(this.sensorHistory).map(([id, history]) => ({
    label: id,
    data: history.map(p => p.v),
    borderColor: colors[id] || '#94a3b8',
    backgroundColor: 'transparent',
    borderWidth: 2,
    tension: 0.4,
    pointRadius: 0,
  }));

  if (!datasets.length) return;

  if (this._sensorChart) this._sensorChart.destroy();
  this._sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 20 }, (_, i) => i + 1),
      datasets,
    },
    options: {
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'DM Mono' } } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3550' } },
      },
    },
  });
};
/* ── Material availability slider ─────────────────────────── */
const matSlider = document.getElementById('materialAvail');
if (matSlider) {
  matSlider.addEventListener('input', function () {
    const el = document.getElementById('materialAvailVal');
    if (el) el.textContent = this.value + '%';
  });
}

console.log('[SmartBuild] features.js loaded — all shims wired ✓');

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Feature1.init();
  Feature2.init();
  Feature3.init();
  Feature4.init();
  Feature5.init();
  Feature6.renderSensorGrid();
  Feature6.init();
  Feature7.init();
  Feature8.init();
  Feature9.init();
  Feature10.init();
  console.log('[SmartBuild] All 10 features initialised ✓');
});
/**
 * GENESIS GRID EMS — IoT SOLAR POWER MANAGEMENT SYSTEM
 * Central Telemetry Controller, Pixel-Perfect Vector SVG Diagram & Scenario Supervisor
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // =========================================================
  // 1. CENTRAL APPLICATION STATE (Solar EMS Core)
  // =========================================================
  const state = {
    systemOnline: true,
    operatingMode: 'auto', // 'auto' | 'solar' | 'grid'
    currentSource: 'solar_bat', // 'solar_bat' | 'solar' | 'battery' | 'grid'
    gridAvailable: true,

    // Battery Storage (LiFePO4 48V 100Ah = 4.8 kWh)
    batterySOC: 78,
    batteryVoltage: 51.2,
    batteryCurrent: 10.15,
    batteryPower: 520, // Watts
    batteryState: 'discharging', // 'discharging' | 'charging' | 'idle'
    batteryCapacityKwh: 4.8,
    minSocCutoff: 20,

    // Solar PV Generation
    solarPower: 850, // Watts
    solarVoltage: 68.4,
    solarCurrent: 12.42,

    // SMP Charge Controller (MPPT / AC-DC SMPS)
    smpPower: 0,
    smpMode: 'standby', // 'standby' | 'charging' | 'pass-through'

    // Inverter (1000W Pure Sine Wave)
    inverterCapacity: 1000, // Watts rated
    inverterPower: 720, // Active output W
    inverterVoltage: 230.1,
    inverterCurrent: 3.13,

    // Main Grid (CEB 230V 50Hz)
    gridVoltage: 231.4,
    gridCurrent: 0.0,
    gridPower: 0,
    gridEnergyToday: 1.40, // kWh

    // Time-of-Use Tariff (CEB Tiers)
    currentTariff: 'peak', // 'off_peak' | 'day' | 'peak'
    tariffRates: {
      off_peak: 13.0,
      day: 25.0,
      peak: 54.0
    },
    fixedMonthlyCharge: 540.0,

    // Financials & Monthly Savings
    monthlyGridEnergyKwh: 68.4,
    monthlyBill: 3600,
    estimatedBillWithoutSolar: 8420,
    moneySaved: 4820,

    // Individual ACS712 Branch Sensors
    appliances: {
      bulb1: { name: 'Bulb 1 (Living Room)', baseWatts: 95, current: 0.41, kwh: 0.32, cost: 8.00, active: true, duration: '3h 24m', sensor: 'ACS712-05A', segId: 'seg-bulb1' },
      bulb2: { name: 'Bulb 2 (Kitchen / Dining)', baseWatts: 110, current: 0.00, kwh: 0.00, cost: 0.00, active: false, duration: '0m', sensor: 'ACS712-05A', segId: 'seg-bulb2' },
      bulb3: { name: 'Bulb 3 (Study / Bedroom)', baseWatts: 60, current: 0.26, kwh: 0.18, cost: 4.50, active: true, duration: '3h 05m', sensor: 'ACS712-05A', segId: 'seg-bulb3' },
      socket: { name: 'Power Socket (TV / Fridge)', baseWatts: 565, current: 2.46, kwh: 1.45, cost: 36.25, active: true, duration: '2h 10m', sensor: 'ACS712-20A', isHeavy: true, segId: 'seg-socket' }
    },

    // High Load Overload Intervention
    highLoadWarning: false,
    countdownSeconds: 30,
    countdownTimer: null,
    countdownInitial: 30,

    // UI View
    activeTab: 'overview',
    chartRange: 'live',
    theme: 'dark'
  };

  // Sparkline buffer for Card 1
  const sparklineEl = document.getElementById('meter-power-load');
  const sparklineCount = 18;
  const sparkBars = [];

  if (sparklineEl) {
    sparklineEl.innerHTML = '';
    for (let i = 0; i < sparklineCount; i++) {
      const bar = document.createElement('div');
      bar.className = `spark-bar ${i >= sparklineCount - 6 ? 'active' : ''}`;
      const h = Math.round(20 + Math.random() * 80);
      bar.style.height = `${h}%`;
      sparklineEl.appendChild(bar);
      sparkBars.push(bar);
    }
  }

  // Rolling SCADA Live Chart Buffer (30 points, 1s resolution)
  const liveBuffer = [];
  const livePoints = 30;
  const initNow = Date.now();

  for (let i = livePoints - 1; i >= 0; i--) {
    const t = new Date(initNow - i * 1000);
    const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
    liveBuffer.push({
      time: timeStr,
      solar: 850 + Math.sin(i / 2) * 25,
      battery: -520 - Math.cos(i / 3) * 15,
      grid: 0,
      load: 720 + Math.sin(i / 2) * 15
    });
  }

  // =========================================================
  // 2. LIVE CLOCK & HEADER SYNCHRONIZATION
  // =========================================================
  function updateLiveClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;
    const d = new Date();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hrs}:${mins}:${secs}`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // =========================================================
  // 3. APPLIANCE RECALCULATION & OVERLOAD SUPERVISOR
  // =========================================================
  function calculateTotalHouseLoad() {
    let totalWatts = 0;
    let activeCount = 0;

    Object.keys(state.appliances).forEach(key => {
      const app = state.appliances[key];
      if (app.active) {
        totalWatts += app.baseWatts;
        app.current = parseFloat((app.baseWatts / 230.0).toFixed(2));
        activeCount++;
      } else {
        app.current = 0.0;
      }
    });

    state.inverterPower = totalWatts;
    state.inverterCurrent = parseFloat((totalWatts / state.inverterVoltage).toFixed(2));

    evaluateSystemSource();
    updateUI(activeCount);

    // Immediately push live event into chart buffer and trigger instantaneous repaint
    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    liveBuffer.shift();
    liveBuffer.push({
      time: timeStr,
      solar: state.solarPower,
      battery: state.currentSource === 'grid' ? 0 : (state.batteryState === 'charging' ? state.batteryPower : -state.batteryPower),
      grid: state.gridPower,
      load: state.inverterPower
    });

    if (state.activeTab === 'analytics' && typeof renderScadaChart === 'function') {
      renderScadaChart();
    }
  }

  function evaluateSystemSource() {
    const load = state.inverterPower;
    const isOverloaded = load > state.inverterCapacity;

    if (state.operatingMode === 'grid') {
      state.currentSource = 'grid';
      state.gridPower = load;
      state.gridCurrent = parseFloat((load / state.gridVoltage).toFixed(2));
      dismissHighLoadWarning(false);
      return;
    }

    if (!state.gridAvailable) {
      state.currentSource = 'solar_bat';
      state.gridPower = 0;
      state.gridCurrent = 0;
      if (isOverloaded) triggerHighLoadWarning(load);
      else dismissHighLoadWarning(true);
      return;
    }

    // Auto Mode Logic
    if (state.operatingMode === 'auto' || state.operatingMode === 'solar') {
      if (isOverloaded) {
        triggerHighLoadWarning(load);
      } else {
        dismissHighLoadWarning(true);

        if (state.batterySOC <= state.minSocCutoff) {
          state.currentSource = 'grid';
          state.gridPower = load;
          state.gridCurrent = parseFloat((load / state.gridVoltage).toFixed(2));
        } else {
          state.currentSource = 'solar_bat';
          state.gridPower = 0;
          state.gridCurrent = 0;
        }
      }
    }
  }

  // Trigger High Load Warning & Countdown
  function triggerHighLoadWarning(currentLoad) {
    if (state.currentSource === 'grid') return;

    const banner = document.getElementById('high-load-banner');
    const loadEl = document.getElementById('hl-current-load');
    const capEl = document.getElementById('hl-inverter-cap');
    const excessEl = document.getElementById('hl-excess-load');
    const secondsEl = document.getElementById('countdown-seconds');
    const fillEl = document.getElementById('countdown-progress-fill');

    if (loadEl) loadEl.textContent = `${(currentLoad / 1000).toFixed(2)} kW`;
    if (capEl) capEl.textContent = `${(state.inverterCapacity / 1000).toFixed(2)} kW`;
    if (excessEl) excessEl.textContent = `${currentLoad - state.inverterCapacity} W`;

    if (banner) banner.style.display = 'block';

    if (!state.highLoadWarning) {
      state.highLoadWarning = true;
      state.countdownSeconds = state.countdownInitial;

      if (state.countdownTimer) clearInterval(state.countdownTimer);

      state.countdownTimer = setInterval(() => {
        state.countdownSeconds--;
        if (secondsEl) secondsEl.textContent = state.countdownSeconds;
        if (fillEl) {
          const pct = (state.countdownSeconds / state.countdownInitial) * 100;
          fillEl.style.width = `${pct}%`;
        }

        if (state.countdownSeconds <= 0) {
          clearInterval(state.countdownTimer);
          transferToGrid('Automatic Grid Fallback (30s Overload Countdown Expired)');
        }
      }, 1000);
    }
  }

  function dismissHighLoadWarning(showNormalizedToast) {
    const banner = document.getElementById('high-load-banner');
    if (banner) banner.style.display = 'none';

    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }

    if (state.highLoadWarning && showNormalizedToast) {
      state.highLoadWarning = false;
      showToast('LOAD NORMALIZED — Continuing on Solar/Battery', 'success');
      logSwitchEvent('Inverter Active', 'Load Normalized below 1000W Inverter Capacity', '+Rs. 38.88/hr saved');
    } else {
      state.highLoadWarning = false;
    }
  }

  function transferToGrid(reason) {
    state.currentSource = 'grid';
    state.gridPower = state.inverterPower;
    state.gridCurrent = parseFloat((state.inverterPower / state.gridVoltage).toFixed(2));
    dismissHighLoadWarning(false);
    logSwitchEvent('Inverter → Grid', reason, 'Grid Import Active');
    showToast(`Transferred to Main Grid: ${reason}`, 'warning');
    updateUI();
  }

  function logSwitchEvent(transition, reason, costImpact) {
    const tbody = document.getElementById('history-events-tbody');
    if (!tbody) return;

    const d = new Date();
    const timeStr = d.toTimeString().split(' ')[0];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${timeStr}</strong></td>
      <td><span class="transition-pill ${transition.includes('Grid') ? 'bat-grid' : 'grid-bat'}">${transition}</span></td>
      <td>${reason}</td>
      <td>${state.inverterPower} W</td>
      <td>${Math.round(state.batterySOC)}%</td>
      <td><span class="status-pill ${state.currentTariff}">${state.currentTariff.toUpperCase()} Rs. ${state.tariffRates[state.currentTariff]}</span></td>
      <td><strong class="${costImpact.includes('+') ? 'text-mint' : 'text-muted'}">${costImpact}</strong></td>
    `;
    tbody.insertBefore(tr, tbody.firstChild);
  }

  // =========================================================
  // 4. UI SYNCHRONIZATION & TELEMETRY RENDERER
  // =========================================================
  function updateUI(activeCount = 3) {
    const load = state.inverterPower;
    const invCap = state.inverterCapacity;
    const invPct = Math.round((load / invCap) * 100);

    // Hero Submeta
    const heroStatus = document.getElementById('hero-status-name');
    const heroSource = document.getElementById('hero-source-name');
    const pulseDot = document.getElementById('online-pulse-dot');
    const heroSolarVal = document.getElementById('hero-solar-val');
    const heroTariffTier = document.getElementById('hero-tariff-tier');
    const heroTariffRate = document.getElementById('hero-tariff-rate');

    if (heroStatus) heroStatus.textContent = state.systemOnline ? 'ONLINE (NORMAL)' : 'OFFLINE (STANDBY)';
    if (heroSource) {
      if (state.currentSource === 'grid') heroSource.textContent = 'MAIN GRID ACTIVE (STANDBY)';
      else if (state.currentSource === 'solar' || state.operatingMode === 'solar') heroSource.textContent = '100% DIRECT SOLAR PV RUN';
      else heroSource.textContent = 'SOLAR + BATTERY ACTIVE';
    }
    if (pulseDot) {
      pulseDot.className = `live-pulse-dot ${state.currentSource === 'grid' ? 'grid' : ''}`;
    }

    // Live Solar Power Generation in Overview
    if (heroSolarVal) {
      heroSolarVal.textContent = `${state.solarPower} W`;
    }

    // Live CEB Tariff in Overview
    if (heroTariffTier && heroTariffRate) {
      const tierName = state.currentTariff ? state.currentTariff.toUpperCase() : 'PEAK';
      const rateVal = state.tariffRates[state.currentTariff] || 54.00;
      heroTariffTier.textContent = `${tierName} TARIFF:`;
      heroTariffRate.textContent = `Rs. ${rateVal.toFixed(2)}/kWh`;
    }

    // Top 4 Metric Cards
    const valPower = document.getElementById('val-power-load');
    const valBatSoc = document.getElementById('val-bat-soc');
    const valBatEnergy = document.getElementById('val-bat-energy-left');
    const valBatDesc = document.getElementById('val-bat-state-desc');
    const valMoney = document.getElementById('val-money-saved');

    if (valPower) valPower.textContent = load;
    if (valBatSoc) valBatSoc.textContent = `${Math.round(state.batterySOC)}%`;
    if (valBatEnergy) valBatEnergy.textContent = `${((state.batteryCapacityKwh * state.batterySOC) / 100).toFixed(2)} kWh`;
    if (valBatDesc) valBatDesc.textContent = `${state.batteryVoltage.toFixed(1)}V • ${state.batteryState === 'charging' ? 'Charging' : 'Discharging'}`;
    if (valMoney) valMoney.textContent = state.moneySaved.toLocaleString();

    // Capacity Load Gauge Animation & Real-Time Sync (1:1 with Reference Design)
    const gaugePctEl = document.getElementById('val-gauge-pct');
    const gaugeStatusEl = document.getElementById('val-gauge-status');
    const gaugeCurEl = document.getElementById('val-gauge-current');
    const gaugeMaxEl = document.getElementById('val-gauge-max');
    const gaugeHeadroomEl = document.getElementById('val-gauge-headroom');
    const gaugeArc = document.getElementById('gauge-arc-progress');
    const gaugeKnob = document.getElementById('gauge-arc-knob');

    const totalArcLen = 329.87;
    const clampedPct = Math.max(0, Math.min(100, invPct));
    const dashOffset = totalArcLen * (1 - (clampedPct / 100));

    if (gaugeArc) {
      gaugeArc.style.strokeDashoffset = dashOffset;
      if (invPct > 100) {
        gaugeArc.style.stroke = 'var(--rose-danger)';
      } else if (invPct > 80) {
        gaugeArc.style.stroke = 'var(--solar-amber)';
      } else {
        gaugeArc.style.stroke = 'url(#gauge-arc-gradient)';
      }
    }

    if (gaugeKnob) {
      const alpha = Math.PI * (1 - (clampedPct / 100));
      const knobX = (140 + 105 * Math.cos(alpha)).toFixed(1);
      const knobY = (125 - 105 * Math.sin(alpha)).toFixed(1);
      gaugeKnob.setAttribute('cx', knobX);
      gaugeKnob.setAttribute('cy', knobY);
      gaugeKnob.setAttribute('stroke', invPct > 100 ? '#ef4444' : (invPct > 80 ? '#f59e0b' : '#05df72'));
    }

    if (gaugePctEl) gaugePctEl.textContent = `${invPct}%`;
    if (gaugeCurEl) gaugeCurEl.innerHTML = `${load} <small>W</small>`;
    if (gaugeMaxEl) gaugeMaxEl.innerHTML = `${invCap} <small>W</small>`;
    if (gaugeHeadroomEl) {
      const headroom = Math.max(0, invCap - load);
      gaugeHeadroomEl.innerHTML = `${headroom} <small>W</small>`;
      gaugeHeadroomEl.className = `g-sub-num ${headroom === 0 ? 'text-danger' : 'text-mint'}`;
    }

    if (gaugeStatusEl) {
      if (invPct > 100) {
        gaugeStatusEl.textContent = 'High Load';
        gaugeStatusEl.className = 'gauge-status-badge badge-high';
      } else if (invPct > 75) {
        gaugeStatusEl.textContent = 'Heavy Load';
        gaugeStatusEl.className = 'gauge-status-badge badge-heavy';
      } else if (invPct > 20) {
        gaugeStatusEl.textContent = 'Normal Load';
        gaugeStatusEl.className = 'gauge-status-badge badge-normal';
      } else {
        gaugeStatusEl.textContent = 'Low Load';
        gaugeStatusEl.className = 'gauge-status-badge badge-low';
      }
    }

    // Battery BMS Visualizer (Charging & Discharging Animations)
    const bmsFlowBadge = document.getElementById('bms-flow-badge');
    const bmsFlowIcon = document.getElementById('bms-flow-icon');
    const bmsFlowText = document.getElementById('bms-flow-text');
    const bmsTimeEst = document.getElementById('bms-time-estimate');
    const valBatVolt = document.getElementById('val-bat-voltage');
    const valBatCurr = document.getElementById('val-bat-current');

    const batSoc = state.batterySOC;
    const isCharging = state.batteryState === 'charging';
    const isDischarging = state.batteryState === 'discharging';

    if (valBatVolt) valBatVolt.innerHTML = `${state.batteryVoltage.toFixed(1)} <small>V</small>`;
    if (valBatCurr) valBatCurr.innerHTML = `${(load / state.batteryVoltage).toFixed(2)} <small>A</small>`;

    if (bmsFlowBadge && bmsFlowText && bmsFlowIcon) {
      if (isCharging) {
        bmsFlowBadge.className = 'bms-flow-indicator charging';
        bmsFlowIcon.innerHTML = '<i data-lucide="arrow-up-right"></i>';
        bmsFlowText.textContent = `+${state.solarPower}W Charging`;
        if (bmsTimeEst) bmsTimeEst.textContent = 'Est. Full in: ~1h 35m (Solar PV Run)';
      } else if (isDischarging) {
        bmsFlowBadge.className = 'bms-flow-indicator discharging';
        bmsFlowIcon.innerHTML = '<i data-lucide="arrow-down-right"></i>';
        bmsFlowText.textContent = `${load}W Discharging`;
        const hoursRemaining = load > 0 ? ((state.batteryCapacityKwh * (batSoc / 100) * 1000) / load).toFixed(1) : '24';
        if (bmsTimeEst) bmsTimeEst.textContent = `Est. Runtime: ~${hoursRemaining}h at current load`;
      } else {
        bmsFlowBadge.className = 'bms-flow-indicator idle';
        bmsFlowIcon.innerHTML = '<i data-lucide="minus"></i>';
        bmsFlowText.textContent = 'Float Standby';
        if (bmsTimeEst) bmsTimeEst.textContent = 'Battery fully charged and on float';
      }
      if (window.lucide) window.lucide.createIcons();
    }

    // Update 4 Battery Cells
    for (let c = 1; c <= 4; c++) {
      const cell = document.getElementById(`bcell-${c}`);
      if (cell) {
        const threshold = c * 25;
        if (batSoc >= threshold) {
          cell.className = `bms-cell active filled ${isDischarging ? 'discharging' : ''}`;
        } else if (batSoc >= threshold - 20) {
          cell.className = `bms-cell active partial ${isDischarging ? 'discharging' : ''}`;
        } else {
          cell.className = 'bms-cell';
        }
      }
    }

    // Load Power Spectrum Animation
    const spectrumBars = document.querySelectorAll('.spectrum-bar');
    if (spectrumBars.length > 0) {
      spectrumBars.forEach((bar, idx) => {
        const baseHeight = Math.min(100, Math.max(20, (load / 1000) * 90));
        const variance = (Math.sin(Date.now() / 200 + idx) * 15);
        bar.style.height = `${Math.min(100, Math.max(15, baseHeight + variance))}%`;
      });
    }

    const miniBranches = document.getElementById('mini-branches-active');
    if (miniBranches) miniBranches.textContent = `${activeCount}/4 ON`;

    // Micro Sparklines
    if (sparkBars.length > 0) {
      sparkBars.forEach(bar => {
        const randH = Math.round(25 + Math.random() * 75);
        bar.style.height = `${randH}%`;
      });
    }

    // Disaggregation Multi-Bar
    const sumWattsEl = document.getElementById('appliances-sum-watts');
    const countBadge = document.getElementById('active-appliances-count-badge');
    if (sumWattsEl) sumWattsEl.textContent = `${load} W Total Active Demand`;
    if (countBadge) countBadge.textContent = `${activeCount} of 4 Appliances Active`;

    Object.keys(state.appliances).forEach(key => {
      const app = state.appliances[key];
      const seg = document.getElementById(app.segId);
      const card = document.getElementById(`app-card-${key}`);
      const statusTag = document.getElementById(`app-status-${key}`);
      const wattsEl = document.getElementById(`app-watts-${key}`);
      const costEl = document.getElementById(`app-cost-${key}`);
      const toggleBtn = document.getElementById(`toggle-${key}`);

      const pctOfLoad = load > 0 && app.active ? ((app.baseWatts / load) * 100).toFixed(1) : '0';
      if (seg) seg.style.width = app.active ? `${pctOfLoad}%` : '0%';
      if (card) card.classList.toggle('active', app.active);
      if (statusTag) {
        statusTag.textContent = app.active ? (app.isHeavy ? 'HEAVY LOAD' : 'ON') : 'OFF';
        statusTag.className = `dev-status-tag ${app.active ? (app.isHeavy ? 'tag-heavy' : 'tag-running') : 'tag-off'}`;
      }
      if (wattsEl) wattsEl.innerHTML = `${app.active ? app.baseWatts : 0} <small>W</small>`;
      if (costEl) costEl.textContent = `Rs. ${app.cost.toFixed(2)}`;
      if (toggleBtn) toggleBtn.classList.toggle('active', app.active);

      // Table elements
      const tblAmp = document.getElementById(`tbl-amp-${key}`);
      const tblW = document.getElementById(`tbl-w-${key}`);
      const tblStatus = document.getElementById(`tbl-status-${key}`);
      const tblBtn = document.querySelector(`.table-switch-btn[data-app="${key}"]`);

      if (tblAmp) tblAmp.textContent = `${app.current.toFixed(2)} A`;
      if (tblW) tblW.textContent = `${app.active ? app.baseWatts : 0} W`;
      if (tblStatus) {
        tblStatus.textContent = app.active ? (app.isHeavy ? 'HEAVY LOAD' : 'ACTIVE') : 'OFF';
        tblStatus.className = `status-pill ${app.active ? (app.isHeavy ? 'on heavy' : 'on') : 'off'}`;
      }
      if (tblBtn) {
        tblBtn.classList.toggle('active', app.active);
        tblBtn.textContent = app.active ? 'ON' : 'OFF';
      }
    });

    // Update Pixel-Perfect Vector SVG Diagram
    updateVectorSvgDiagram();
  }

  // =========================================================
  // 5. VECTOR SVG DISTRIBUTION DIAGRAM CONTROLLER
  // =========================================================
  function updateVectorSvgDiagram() {
    // Header Badges
    const flowSolar = document.getElementById('flow-head-solar');
    const flowBat = document.getElementById('flow-head-bat');
    const flowGrid = document.getElementById('flow-head-grid');
    const flowLoad = document.getElementById('flow-head-load');

    if (flowSolar) flowSolar.textContent = `${state.solarPower}W`;
    if (flowBat) flowBat.textContent = `${state.batteryState === 'charging' ? '+' : '-'}${state.batteryPower}W`;
    if (flowGrid) flowGrid.textContent = `${state.gridPower}W`;
    if (flowLoad) flowLoad.textContent = `${state.inverterPower}W`;

    // SVG Text Metrics
    const svgHouseWatts = document.getElementById('svg-house-watts');
    const svgHouseBadge = document.getElementById('svg-house-badge');
    const svgGridWatts = document.getElementById('svg-grid-watts');
    const svgGridBadge = document.getElementById('svg-grid-badge');
    const svgSmpWatts = document.getElementById('svg-smp-watts');
    const svgSmpBadge = document.getElementById('svg-smp-badge');
    const svgInvWatts = document.getElementById('svg-inv-watts');
    const svgInvBadge = document.getElementById('svg-inv-badge');
    const svgBatSoc = document.getElementById('svg-bat-soc');
    const svgBatBadge = document.getElementById('svg-bat-badge');
    const svgSolarWatts = document.getElementById('svg-solar-watts');
    const svgSolarBadge = document.getElementById('svg-solar-badge');

    if (svgHouseWatts) svgHouseWatts.textContent = `${state.inverterPower} W`;
    if (svgHouseBadge) svgHouseBadge.textContent = state.currentSource === 'grid' ? 'Powered by CEB Grid' : 'Powered by Inverter';

    if (svgGridWatts) svgGridWatts.textContent = state.currentSource === 'grid' ? `${state.gridPower} W Active` : '0 W (Standby)';
    if (svgGridBadge) svgGridBadge.textContent = state.gridAvailable ? (state.currentSource === 'grid' ? 'Supplying Load' : '230V • Standby') : 'Grid Outage / Offline';

    if (svgSmpWatts) svgSmpWatts.textContent = state.batteryState === 'charging' && state.solarPower > 0 ? `${state.batteryPower} W Regulated` : '48V DC Bus';
    if (svgSmpBadge) svgSmpBadge.textContent = state.batteryState === 'charging' ? 'MPPT Charging Active' : 'Bus Synchronized';

    if (svgInvWatts) svgInvWatts.textContent = `${state.inverterPower} W (${Math.round((state.inverterPower / state.inverterCapacity) * 100)}%)`;
    if (svgInvBadge) svgInvBadge.textContent = state.currentSource === 'grid' ? 'Bypassed to Grid' : 'DC → 230V AC Active';

    if (svgBatSoc) svgBatSoc.textContent = `${Math.round(state.batterySOC)}% SOC`;
    if (svgBatBadge) svgBatBadge.textContent = state.batteryState === 'charging' ? `Charging ${state.batteryPower}W` : `Discharging ${state.batteryPower}W`;

    if (svgSolarWatts) svgSolarWatts.textContent = `${state.solarPower} W`;
    if (svgSolarBadge) svgSolarBadge.textContent = state.solarPower > 50 ? 'Generating Peak' : 'Night / Standby';

    // SVG Wire Paths Active Animation
    const pathGridApp = document.getElementById('path-grid-appliances');
    const pathGridSmp = document.getElementById('path-grid-smp');
    const pathSmpInv = document.getElementById('path-smp-inverter');
    const pathSolarInv = document.getElementById('path-solar-inverter');
    const pathBatInv = document.getElementById('path-battery-inverter');
    const pathInvApp = document.getElementById('path-inverter-appliances');

    if (state.currentSource === 'grid') {
      if (pathGridApp) pathGridApp.classList.add('active-flow');
      if (pathInvApp) pathInvApp.classList.remove('active-flow');
      if (pathBatInv) pathBatInv.classList.remove('active-flow');
      if (pathGridSmp) pathGridSmp.classList.add('active-flow');
      if (pathSmpInv) pathSmpInv.classList.remove('active-flow');
    } else {
      if (pathGridApp) pathGridApp.classList.remove('active-flow');
      if (pathInvApp) pathInvApp.classList.add('active-flow');

      if (state.solarPower > 50) {
        if (pathSolarInv) pathSolarInv.classList.add('active-flow');
      } else {
        if (pathSolarInv) pathSolarInv.classList.remove('active-flow');
      }

      if (state.batteryState === 'discharging') {
        if (pathBatInv) pathBatInv.classList.add('active-flow');
      } else {
        if (pathBatInv) pathBatInv.classList.remove('active-flow');
      }

      if (state.batteryState === 'charging') {
        if (pathSmpInv) pathSmpInv.classList.add('active-flow');
      } else {
        if (pathSmpInv) pathSmpInv.classList.remove('active-flow');
      }
    }
  }

  // Node clicks inside SVG
  document.querySelectorAll('.svg-node-group').forEach(group => {
    group.addEventListener('click', () => {
      const id = group.id;
      if (id.includes('appliances')) showToast('Home Appliances Load: 720 W across 4 monitored branches.');
      else if (id.includes('ceb')) showToast('CEB Main Utility Grid: 230V 50Hz • Peak Tariff Rs. 54/kWh.');
      else if (id.includes('smp')) showToast('SMP Charge Controller: MPPT 48V DC bus synchronized.');
      else if (id.includes('inverter')) showToast('Pure Sine Wave Inverter: 1000W Capacity (72% current load).');
      else if (id.includes('battery')) showToast('Battery Storage BMS: 78% SOC • 51.2V • 3.74 kWh remaining.');
      else if (id.includes('solar')) showToast('Solar PV Generation: 850W active generation.');
    });
  });

  // =========================================================
  // 6. APPLIANCE TOGGLE HANDLERS
  // =========================================================
  document.querySelectorAll('.dev-toggle-switch, .table-switch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const appKey = btn.getAttribute('data-app');
      if (state.appliances[appKey]) {
        state.appliances[appKey].active = !state.appliances[appKey].active;
        calculateTotalHouseLoad();
        showToast(`${state.appliances[appKey].name}: Switched ${state.appliances[appKey].active ? 'ON' : 'OFF'}`);
      }
    });
  });

  // Intervention Buttons
  const btnReduceLoad = document.getElementById('btn-action-reduce-load');
  const btnSwitchGrid = document.getElementById('btn-action-switch-grid');
  const btnContinueInv = document.getElementById('btn-action-continue-inv');

  if (btnReduceLoad) {
    btnReduceLoad.addEventListener('click', () => {
      if (state.appliances.socket.active) {
        state.appliances.socket.active = false;
        calculateTotalHouseLoad();
        showToast('Load Shed: Power Socket switched OFF. Load normalized.', 'success');
      } else {
        state.appliances.bulb1.active = false;
        calculateTotalHouseLoad();
      }
    });
  }

  if (btnSwitchGrid) {
    btnSwitchGrid.addEventListener('click', () => {
      transferToGrid('User-Initiated Immediate Transfer to Grid');
    });
  }

  if (btnContinueInv) {
    btnContinueInv.addEventListener('click', () => {
      dismissHighLoadWarning(false);
      showToast('Temporary Surge Override: Continuing on Inverter for 60s', 'warning');
    });
  }

  // Operating Mode Selection
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      state.operatingMode = mode;
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-mode') === mode);
      });
      calculateTotalHouseLoad();
      showToast(`Operating Mode set to ${mode.toUpperCase()}`, 'success');
      logSwitchEvent('Mode Change', `User selected ${mode.toUpperCase()} Mode`, 'Operating state set');
    });
  });

  // =========================================================
  // 7. DEMO SCENARIO PRESETS (1-Click Engine)
  // =========================================================
  const demoBtn = document.getElementById('demo-dropdown-btn');
  const demoMenu = document.getElementById('demo-dropdown-menu');

  if (demoBtn && demoMenu) {
    demoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      demoMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => demoMenu.classList.remove('show'));
  }

  document.querySelectorAll('.demo-preset-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const scenario = opt.getAttribute('data-scenario');
      triggerScenario(scenario);
      if (demoMenu) demoMenu.classList.remove('show');
    });
  });

  function triggerScenario(scenarioId) {
    switch (scenarioId) {
      case '1':
        state.solarPower = 950;
        state.batterySOC = 88;
        state.batteryPower = 350;
        state.batteryState = 'charging';
        state.appliances.bulb1.active = true;
        state.appliances.bulb2.active = false;
        state.appliances.bulb3.active = true;
        state.appliances.socket.active = false;
        state.operatingMode = 'auto';
        state.gridAvailable = true;
        calculateTotalHouseLoad();
        showToast('Scenario 1 Activated: High Solar Gen + Low Load', 'success');
        break;

      case '2':
        state.solarPower = 0;
        state.batterySOC = 78;
        state.batteryPower = 520;
        state.batteryState = 'discharging';
        state.currentTariff = 'peak';
        state.appliances.bulb1.active = true;
        state.appliances.bulb2.active = false;
        state.appliances.bulb3.active = true;
        state.appliances.socket.active = true;
        state.appliances.socket.baseWatts = 565;
        state.operatingMode = 'auto';
        state.gridAvailable = true;
        calculateTotalHouseLoad();
        showToast('Scenario 2 Activated: Peak Tariff Economy (Battery Saving Rs.54/kWh)', 'success');
        break;

      case '3':
        state.solarPower = 200;
        state.appliances.bulb1.active = true;
        state.appliances.bulb2.active = true;
        state.appliances.bulb3.active = true;
        state.appliances.socket.active = true;
        state.appliances.socket.baseWatts = 1015; // 1280W total load!
        state.operatingMode = 'auto';
        state.gridAvailable = true;
        calculateTotalHouseLoad();
        showToast('Scenario 3: High Load Spike (1.28 kW > 1.00 kW) — 30s Countdown Started!', 'danger');
        break;

      case '4':
        state.appliances.socket.active = false;
        state.appliances.socket.baseWatts = 565;
        state.appliances.bulb2.active = false;
        calculateTotalHouseLoad();
        showToast('Scenario 4: Load Shedding Triggered — Load Normalized', 'success');
        break;

      case '5':
        state.countdownSeconds = 1;
        showToast('Scenario 5: Countdown Timeout Simulated -> Grid Transfer', 'warning');
        break;

      case '6':
        state.gridAvailable = false;
        calculateTotalHouseLoad();
        showToast('Scenario 6: Grid Blackout Outage! Inverter supplying seamless backup.', 'warning');
        logSwitchEvent('Grid Outage', 'Main utility blackout detected — Inverter ride-through', 'Backup Active');
        break;

      case '7':
        state.batterySOC = 18;
        state.gridAvailable = true;
        calculateTotalHouseLoad();
        showToast('Scenario 7: Battery SOC < 20% Cutoff — Protected transfer to Grid', 'warning');
        break;

      case 'reset':
      default:
        state.solarPower = 850;
        state.batterySOC = 78;
        state.batteryPower = 520;
        state.batteryState = 'discharging';
        state.gridAvailable = true;
        state.operatingMode = 'auto';
        state.currentTariff = 'peak';
        state.appliances.bulb1.active = true;
        state.appliances.bulb2.active = false;
        state.appliances.bulb3.active = true;
        state.appliances.socket.active = true;
        state.appliances.socket.baseWatts = 565;
        calculateTotalHouseLoad();
        showToast('System Reset to Nominal Baseline Telemetry');
        break;
    }
  }

  // =========================================================
  // 8. AI COPILOT CHAT & QUICK CHIPS
  // =========================================================
  const aiForm = document.getElementById('ai-chat-form');
  const aiInput = document.getElementById('ai-chat-input');
  const aiThread = document.getElementById('ai-chat-thread');

  if (aiForm && aiInput && aiThread) {
    aiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = aiInput.value.trim();
      if (!text) return;

      appendUserMessage(text);
      aiInput.value = '';

      setTimeout(() => respondAIMessage(text), 700);
    });
  }

  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      appendUserMessage(prompt);
      setTimeout(() => respondAIMessage(prompt), 600);
    });
  });

  function appendUserMessage(text) {
    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const div = document.createElement('div');
    div.className = 'chat-message user-msg';
    div.innerHTML = `
      <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="User" class="msg-avatar" />
      <div class="msg-body">
        <div class="msg-author-row"><span class="msg-author">Jordan Lee</span><span class="msg-time">${timeStr}</span></div>
        <p class="msg-text">${text}</p>
      </div>
    `;
    aiThread.appendChild(div);
    aiThread.scrollTop = aiThread.scrollHeight;
  }

  function respondAIMessage(query) {
    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const div = document.createElement('div');
    div.className = 'chat-message ai-msg';

    let reply = `Based on live telemetry, total house demand is <strong>${state.inverterPower} W</strong> (${Math.round((state.inverterPower / state.inverterCapacity) * 100)}% of inverter capacity).`;
    if (query.includes('Peak') || query.includes('Savings')) {
      reply = `Peak Tariff is active at <strong>Rs. 54.00/kWh</strong>. Battery storage is supplying the load, saving <strong>Rs. 38.88/hr</strong> in avoided grid peak charges!`;
    } else if (query.includes('Overload') || query.includes('Headroom')) {
      reply = `Inverter capacity limit is <strong>1000 W</strong>. Current headroom is <strong>${Math.max(0, state.inverterCapacity - state.inverterPower)} W</strong>.`;
    }

    div.innerHTML = `
      <div class="ai-msg-avatar"><i data-lucide="sparkles"></i></div>
      <div class="msg-body">
        <div class="msg-author-row"><span class="msg-author">Solaris AI</span><span class="msg-time">${timeStr}</span></div>
        <p class="msg-text">${reply}</p>
      </div>
    `;
    aiThread.appendChild(div);
    if (window.lucide) window.lucide.createIcons();
    aiThread.scrollTop = aiThread.scrollHeight;
  }

  // =========================================================
  // 9. SCADA REAL-TIME TREND CHART (Analytics Tab)
  // =========================================================
  const canvas = document.getElementById('scadaTrendChart');
  const chartWrapper = document.querySelector('.chart-canvas-wrapper');
  const chartTooltip = document.getElementById('chart-tooltip');
  let hoverX = -1;

  // Distinct Historical Horizon Data Generators
  function generateHistoricalData(range) {
    const data = [];
    const now = new Date();

    if (range === '1h') {
      // 60 points (1-minute intervals over past hour)
      for (let i = 59; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 60000);
        const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        const loadFluctuation = Math.sin(i / 4) * 80 + (i >= 12 && i <= 18 ? 220 : 0);
        const curLoad = i === 0 ? state.inverterPower : Math.max(300, Math.min(1050, Math.round(680 + loadFluctuation)));
        const solarVal = i === 0 ? state.solarPower : Math.max(150, Math.min(960, Math.round(830 + Math.cos(i / 6) * 90 - (i >= 25 && i <= 35 ? 240 : 0))));
        const batVal = i === 0 
          ? (state.batteryState === 'charging' ? state.batteryPower : -state.batteryPower) 
          : (solarVal > curLoad ? Math.round(solarVal - curLoad) : -Math.round(curLoad - solarVal));
        data.push({ time: timeStr, solar: solarVal, battery: batVal, grid: 0, load: curLoad });
      }
    } else if (range === '6h') {
      // 72 points (5-minute intervals over past 6 hours)
      for (let i = 71; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 300000);
        const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        const frac = (71 - i) / 71; // 0 (6h ago ~13:00) to 1 (now ~19:00)
        
        // Solar drops significantly from bright afternoon to dusk
        const solarVal = i === 0 ? state.solarPower : Math.max(0, Math.round(980 * Math.cos(frac * 1.55)));
        
        // Load peaks during evening dinner/lighting
        const curLoad = i === 0 ? state.inverterPower : Math.round(420 + 380 * Math.sin(frac * Math.PI));
        
        // Battery charges during afternoon, then discharges during evening peak
        let batVal = 0;
        if (solarVal > curLoad) {
          batVal = Math.min(480, solarVal - curLoad); // Charging
        } else {
          batVal = -Math.min(curLoad, curLoad - solarVal); // Discharging
        }
        if (i === 0) batVal = state.batteryState === 'charging' ? state.batteryPower : -state.batteryPower;

        data.push({ time: timeStr, solar: solarVal, battery: batVal, grid: 0, load: curLoad });
      }
    } else if (range === '24h') {
      // 96 points (15-minute intervals over full 24-hour diurnal cycle)
      for (let i = 95; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 900000);
        const hour = t.getHours() + t.getMinutes() / 60;
        const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

        // Diurnal Solar Bell Curve (06:00 to 18:00, Peak at 12:30)
        let solarVal = 0;
        if (hour >= 6.0 && hour <= 18.2) {
          const sunAngle = ((hour - 6.0) / 12.2) * Math.PI;
          solarVal = Math.round(Math.sin(sunAngle) * 1060 + (Math.sin(i / 2) * 40));
          if (solarVal < 0) solarVal = 0;
        }

        // Daily Household Demand Profile
        let curLoad = 180; // Baseline night load
        if (hour >= 6.0 && hour < 8.5) curLoad = 620; // Morning rush
        else if (hour >= 8.5 && hour < 17.0) curLoad = 410; // Daytime baseline
        else if (hour >= 17.0 && hour < 22.5) curLoad = 860; // Peak cooking/lighting
        else if (hour >= 22.5) curLoad = 260; // Night
        curLoad += Math.round(Math.sin(i * 1.5) * 35);

        // Battery & Grid Routing
        let batVal = 0;
        let gridVal = 0;
        if (solarVal > curLoad) {
          batVal = Math.min(520, solarVal - curLoad); // Charging
        } else {
          if (hour >= 18.5 && hour <= 22.5) {
            batVal = -(curLoad - solarVal); // Peak tariff avoidance discharge
          } else if (hour < 5.5) {
            gridVal = curLoad; // Off-peak grid power
            batVal = 0;
          } else {
            batVal = -(curLoad - solarVal);
          }
        }

        if (i === 0) {
          solarVal = state.solarPower;
          curLoad = state.inverterPower;
          batVal = state.batteryState === 'charging' ? state.batteryPower : -state.batteryPower;
          gridVal = state.gridPower;
        }

        data.push({ time: timeStr, solar: solarVal, battery: batVal, grid: gridVal, load: curLoad });
      }
    }
    return data;
  }

  // Update Footer Metric Values according to active time range
  function updateChartFooterMetrics(range) {
    const lbl1 = document.getElementById('chart-stat-lbl-1');
    const val1 = document.getElementById('chart-stat-val-1');
    const lbl2 = document.getElementById('chart-stat-lbl-2');
    const val2 = document.getElementById('chart-stat-val-2');
    const lbl3 = document.getElementById('chart-stat-lbl-3');
    const val3 = document.getElementById('chart-stat-val-3');
    const lbl4 = document.getElementById('chart-stat-lbl-4');
    const val4 = document.getElementById('chart-stat-val-4');
    const lbl5 = document.getElementById('chart-stat-lbl-5');
    const val5 = document.getElementById('chart-stat-val-5');

    if (!lbl1) return;

    if (range === 'live') {
      lbl1.textContent = 'CURRENT SOLAR';
      val1.textContent = `${state.solarPower} W`;
      lbl2.textContent = 'ACTIVE HOUSE LOAD';
      val2.textContent = `${state.inverterPower} W`;
      lbl3.textContent = 'INVERTER EFFICIENCY';
      val3.textContent = '95.2%';
      lbl4.textContent = 'BATTERY NET FLOW';
      val4.textContent = `${state.batteryState === 'charging' ? '+' + state.solarPower + ' W' : '-' + state.inverterPower + ' W'}`;
      lbl5.textContent = 'ACTIVE TARIFF RATE';
      val5.textContent = 'Rs. 54.00 / kWh';
    } else if (range === '1h') {
      lbl1.textContent = '1H SOLAR HARVEST';
      val1.textContent = '0.82 kWh';
      lbl2.textContent = '1H HOUSE DEMAND';
      val2.textContent = '0.69 kWh';
      lbl3.textContent = 'AVG EFFICIENCY';
      val3.textContent = '95.1%';
      lbl4.textContent = 'BATTERY DISCHARGE';
      val4.textContent = '0.51 kWh';
      lbl5.textContent = '1H COST SAVINGS';
      val5.textContent = 'Rs. 38.88';
    } else if (range === '6h') {
      lbl1.textContent = '6H SOLAR TOTAL';
      val1.textContent = '3.42 kWh';
      lbl2.textContent = 'PEAK LOAD AVOIDED';
      val2.textContent = '2.10 kWh';
      lbl3.textContent = 'AVG EFFICIENCY';
      val3.textContent = '94.6%';
      lbl4.textContent = 'BATTERY SOH';
      val4.textContent = '98.5%';
      lbl5.textContent = '6H TARIFF SAVINGS';
      val5.textContent = 'Rs. 162.00';
    } else {
      // 24h
      lbl1.textContent = 'SOLAR GENERATION TODAY';
      val1.textContent = '6.84 kWh';
      lbl2.textContent = 'AVOIDED PEAK GRID IMPORT';
      val2.textContent = '4.20 kWh';
      lbl3.textContent = 'INVERTER EFFICIENCY';
      val3.textContent = '94.8%';
      lbl4.textContent = 'BATTERY SOH';
      val4.textContent = '98.5%';
      lbl5.textContent = 'TOTAL SAVINGS TODAY';
      val5.textContent = 'Rs. 248.50';
    }
  }

  // =========================================================
  // 9. SCADA REAL-TIME CHANNEL ANALYTICS (4 Dedicated Separate Graphs)
  // =========================================================
  const solarCanvas = document.getElementById('solarTrendChart');
  const loadCanvas = document.getElementById('loadTrendChart');
  const batteryCanvas = document.getElementById('batteryTrendChart');
  const gridCanvas = document.getElementById('gridTrendChart');

  // Generic Reusable Single-Channel SCADA Canvas Drawer
  function drawSingleScadaChannel(canvas, currentData, dataKey, strokeColor, areaColorLight, areaColorDark, customMax = null) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    let w = canvas.parentElement ? canvas.parentElement.clientWidth - 12 : 400;
    let h = canvas.parentElement ? canvas.parentElement.clientHeight - 12 : 180;
    if (w < 80) w = 400;
    if (h < 80) h = 180;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.scale(dpr, dpr);

    const padL = 48;
    const padR = 15;
    const padT = 16;
    const padB = 26;
    const chartW = Math.max(10, w - padL - padR);
    const chartH = Math.max(10, h - padT - padB);

    ctx.clearRect(0, 0, w, h);
    const isLight = document.body.classList.contains('theme-light');
    const n = currentData.length;
    if (n < 2) return;

    // Peak Scale
    let peak = customMax || 0;
    if (!customMax) {
      for (let i = 0; i < n; i++) {
        const v = Math.abs(currentData[i][dataKey] || 0);
        if (v > peak) peak = v;
      }
      peak = Math.max(600, Math.ceil(peak / 200) * 200);
    }

    // Grid lines & Y-Axis Ticks (3 divisions)
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padT + (chartH / 3) * i;
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      const val = Math.round(peak - (peak / 3) * i);
      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${val}W`, padL - 6, y + 3);
    }

    const stepX = chartW / (n - 1);
    const getY = (val) => padT + chartH - (Math.max(0, Math.min(peak, val)) / peak) * chartH;

    // Gradient Area Fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, isLight ? areaColorLight : areaColorDark);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(padL, padT + chartH);
    for (let i = 0; i < n; i++) {
      const x = padL + i * stepX;
      const y = getY(Math.abs(currentData[i][dataKey] || 0));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padL + (n - 1) * stepX, padT + chartH);
    ctx.closePath();
    ctx.fill();

    // Trace Line
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = padL + i * stepX;
      const y = getY(Math.abs(currentData[i][dataKey] || 0));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Time Ticks (Start, Mid, End)
    ctx.fillStyle = isLight ? '#64748b' : '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(currentData[0].time || '', padL, padT + chartH + 16);
    
    ctx.textAlign = 'center';
    const midIdx = Math.floor(n / 2);
    ctx.fillText(currentData[midIdx].time || '', padL + midIdx * stepX, padT + chartH + 16);

    ctx.textAlign = 'right';
    ctx.fillText(currentData[n - 1].time || '', padL + (n - 1) * stepX, padT + chartH + 16);
  }

  function renderScadaChart() {
    const range = state.chartRange || 'live';
    const currentData = range === 'live' ? liveBuffer : generateHistoricalData(range);

    // 1. Solar Generation Channel
    drawSingleScadaChannel(solarCanvas, currentData, 'solar', '#f59e0b', 'rgba(245, 158, 11, 0.28)', 'rgba(245, 158, 11, 0.20)', 1200);
    const solarBadge = document.getElementById('solar-live-badge');
    if (solarBadge) solarBadge.textContent = `${state.solarPower} W`;

    // 2. Household Load Channel
    drawSingleScadaChannel(loadCanvas, currentData, 'load', '#10b981', 'rgba(16, 185, 129, 0.30)', 'rgba(16, 185, 129, 0.22)', 1400);
    const loadBadge = document.getElementById('load-live-badge');
    if (loadBadge) loadBadge.textContent = `${state.inverterPower} W`;
    const loadInvPct = document.getElementById('load-inv-pct');
    if (loadInvPct) loadInvPct.textContent = `${Math.round((state.inverterPower / 1000) * 100)}%`;

    // 3. Battery Storage Channel
    drawSingleScadaChannel(batteryCanvas, currentData, 'battery', '#a855f7', 'rgba(168, 85, 247, 0.28)', 'rgba(168, 85, 247, 0.20)', 800);
    const batBadge = document.getElementById('battery-live-badge');
    if (batBadge) {
      batBadge.textContent = state.batteryState === 'charging' ? `+${state.solarPower} W` : `-${state.inverterPower} W`;
    }
    const batSocVal = document.getElementById('battery-soc-val');
    if (batSocVal) batSocVal.textContent = `${state.batterySOC}%`;

    // 4. CEB Grid Power Channel
    drawSingleScadaChannel(gridCanvas, currentData, 'grid', '#38bdf8', 'rgba(56, 189, 248, 0.28)', 'rgba(56, 189, 248, 0.20)', 1200);
    const gridBadge = document.getElementById('grid-live-badge');
    if (gridBadge) gridBadge.textContent = `${state.gridPower} W`;

    updateChartFooterMetrics(range);
  }

  // Automatic ResizeObserver for seamless tab activation on all 4 charts
  const analyticsContainer = document.getElementById('view-analytics');
  if (analyticsContainer && window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (state.activeTab === 'analytics') {
        renderScadaChart();
      }
    });
    ro.observe(analyticsContainer);
  }

  // Time Range Filter Buttons
  document.querySelectorAll('.time-range-selector .time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-range-selector .time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const range = btn.getAttribute('data-range');
      state.chartRange = range;
      showToast(`SCADA Chart Range: ${range.toUpperCase()} Buffer Active`);
      renderScadaChart();
    });
  });

  // =========================================================
  // 10. NAVIGATION & TAB SWITCHING
  // =========================================================
  const navPills = document.querySelectorAll('.nav-pill');
  const viewContainers = {
    overview: document.getElementById('view-overview'),
    flow: document.getElementById('view-overview'),
    analytics: document.getElementById('view-analytics'),
    appliances: document.getElementById('view-appliances'),
    billing: document.getElementById('view-billing'),
    history: document.getElementById('view-history'),
    settings: document.getElementById('view-settings')
  };

  function switchTab(tabKey) {
    navPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-tab') === tabKey));
    Object.keys(viewContainers).forEach(k => {
      if (viewContainers[k]) viewContainers[k].classList.remove('active');
    });

    if (viewContainers[tabKey]) {
      viewContainers[tabKey].classList.add('active');
    }
    state.activeTab = tabKey;

    if (tabKey === 'analytics') {
      setTimeout(renderScadaChart, 60);
    }
  }

  navPills.forEach(pill => {
    pill.addEventListener('click', () => switchTab(pill.getAttribute('data-tab')));
  });

  const btnQuickBilling = document.getElementById('btn-quick-billing');
  if (btnQuickBilling) {
    btnQuickBilling.addEventListener('click', () => switchTab('billing'));
  }

  // Theme Switcher
  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('theme-dark');
      document.body.classList.toggle('theme-light', !isDark);
      state.theme = isDark ? 'dark' : 'light';
      if (themeIcon) {
        themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        if (window.lucide) window.lucide.createIcons();
      }
      renderScadaChart();
      showToast(`Switched to ${isDark ? 'Dark Theme' : 'Light Theme'}`);
    });
  }

  // Toast Utility
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : (type === 'warning' ? 'alert-triangle' : 'info')}"></i><span>${message}</span>`;
    container.appendChild(toast);

    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Real-Time Sensor Ingestion Loop (1.0s)
  setInterval(() => {
    if (state.appliances.socket.active && state.appliances.socket.baseWatts === 565) {
      state.appliances.socket.baseWatts = 555 + Math.round(Math.random() * 20);
    }
    if (state.solarPower > 0) {
      state.solarPower = Math.max(0, state.solarPower + Math.round((Math.random() - 0.5) * 15));
    }

    calculateTotalHouseLoad();

    if (state.activeTab === 'analytics') {
      renderScadaChart();
    }
  }, 1000);

  // =========================================================
  // 11. TELEMETRY DEEP-DIVE MODAL CONTROLLER
  // =========================================================
  const detailModal = document.getElementById('telemetry-detail-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnModalCloseAction = document.getElementById('btn-modal-close-action');
  const btnModalNavigate = document.getElementById('btn-modal-navigate');
  const modalChannelTitle = document.getElementById('modal-channel-title');
  const modalChannelSubtitle = document.getElementById('modal-channel-subtitle');
  const modalStatusBadge = document.getElementById('modal-status-badge');
  const modalDynamicBody = document.getElementById('modal-dynamic-body');
  const modalIconBadge = document.getElementById('modal-icon-badge');

  const detailContents = {
    solar: {
      title: "Solar PV Generation Deep-Dive",
      subtitle: "Monocrystalline Array • Direct DC String Metrics & Irradiance Analysis",
      icon: "sun",
      iconColor: "#f59e0b",
      badgeColor: "#f59e0b",
      status: "Active Harvest",
      navTab: "overview",
      navLabel: "View Distribution Flow",
      render: () => `
        <div class="modal-grid-stats">
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">LIVE PV GENERATION</span>
            <span class="modal-stat-val text-amber">${state.solarPower} W</span>
            <span class="modal-stat-sub">Real-Time DC Array Output</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">TODAY'S TOTAL HARVEST</span>
            <span class="modal-stat-val text-mint">6.84 kWh</span>
            <span class="modal-stat-sub">Peak Irradiance: 1,060 W at 12:45</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">MPPT TRACKER EFFICIENCY</span>
            <span class="modal-stat-val text-mint">98.2%</span>
            <span class="modal-stat-sub">Voltage: 48.2 V • Current: 17.6 A</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">CO₂ EMISSIONS OFFSET</span>
            <span class="modal-stat-val text-amber">5.47 kg</span>
            <span class="modal-stat-sub">Lifetime Clean Energy Harvest</span>
          </div>
        </div>

        <div class="modal-section-box">
          <span class="modal-section-title"><i data-lucide="activity"></i> Electrical String Parameters & Array Health</span>
          <table class="modal-table-simple">
            <tr><td>Solar Array Open Circuit Voltage (Voc)</td><td>58.4 V</td></tr>
            <tr><td>MPPT Operating Point Voltage (Vmp)</td><td>48.2 V</td></tr>
            <tr><td>Operating Current (Imp)</td><td>${(state.solarPower / 48.2).toFixed(1)} A</td></tr>
            <tr><td>Photovoltaic Panel Temperature</td><td>38.5 °C (Nominal)</td></tr>
            <tr><td>Inverter Clipping Threshold</td><td>1,200 W (No clipping observed)</td></tr>
          </table>
        </div>
      `
    },
    load: {
      title: "Household AC Load Demand Deep-Dive",
      subtitle: "Smart Sub-Metering & Appliance Circuit Consumption Disaggregation",
      icon: "zap",
      iconColor: "#10b981",
      badgeColor: "#10b981",
      status: "Active AC Demand",
      navTab: "appliances",
      navLabel: "Manage Appliance Loads",
      render: () => `
        <div class="modal-grid-stats">
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">TOTAL CURRENT LOAD</span>
            <span class="modal-stat-val text-mint">${state.inverterPower} W</span>
            <span class="modal-stat-sub">${Math.round((state.inverterPower / 1000) * 100)}% of 1000W Inverter Rating</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">DAILY ENERGY CONSUMED</span>
            <span class="modal-stat-val text-cyan">5.40 kWh</span>
            <span class="modal-stat-sub">Peak Load Today: 1,280 W</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">GRID VOLTAGE & FREQ</span>
            <span class="modal-stat-val">230.1 V • 50.0 Hz</span>
            <span class="modal-stat-sub">Harmonic Distortion THD &lt; 2.1%</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">POWER FACTOR</span>
            <span class="modal-stat-val text-mint">0.98 PF</span>
            <span class="modal-stat-sub">Active Smart Circuit Compensation</span>
          </div>
        </div>

        <div class="modal-section-box">
          <span class="modal-section-title"><i data-lucide="layers"></i> Live Circuit Disaggregation</span>
          <table class="modal-table-simple">
            <tr><td>Living Room (Fans, LED lighting, TV)</td><td>${state.appliances.living.active ? state.appliances.living.watts + ' W' : 'OFF (0 W)'}</td></tr>
            <tr><td>Kitchen (Refrigerator, Prep counter)</td><td>${state.appliances.kitchen.active ? state.appliances.kitchen.watts + ' W' : 'OFF (0 W)'}</td></tr>
            <tr><td>Master Bedroom (AC, LED lamps)</td><td>${state.appliances.bedroom.active ? state.appliances.bedroom.watts + ' W' : 'OFF (0 W)'}</td></tr>
            <tr><td>High-Load Socket (Water Heater, Induction)</td><td>${state.appliances.socket.active ? state.appliances.socket.watts + ' W' : 'OFF (0 W)'}</td></tr>
          </table>
        </div>
      `
    },
    battery: {
      title: "Battery Storage & BMS Deep-Dive",
      subtitle: "48V 100Ah (4.8 kWh) LiFePO4 Chemistry • Active Cell Telemetry",
      icon: "battery-charging",
      iconColor: "#a855f7",
      badgeColor: "#a855f7",
      status: "BMS Normal",
      navTab: "overview",
      navLabel: "View Energy Flow",
      render: () => `
        <div class="modal-grid-stats">
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">STATE OF CHARGE (SOC)</span>
            <span class="modal-stat-val text-mint">${Math.round(state.batterySOC)}%</span>
            <span class="modal-stat-sub">${((state.batteryCapacityKwh * state.batterySOC) / 100).toFixed(2)} kWh Usable Energy</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">PACK STATE OF HEALTH (SOH)</span>
            <span class="modal-stat-val text-purple">98.5%</span>
            <span class="modal-stat-sub">342 Completed Cycles / 6,000 Rated</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">PACK VOLTAGE & CURRENT</span>
            <span class="modal-stat-val">${state.batteryVoltage.toFixed(1)} V • ${(state.inverterPower / 51.2).toFixed(1)} A</span>
            <span class="modal-stat-sub">${state.batteryState === 'charging' ? 'Charging Flow' : 'Discharge Inverting'}</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">INTERNAL TEMPERATURE</span>
            <span class="modal-stat-val text-mint">28.4 °C</span>
            <span class="modal-stat-sub">Nominal Safe Operating Range</span>
          </div>
        </div>

        <div class="modal-section-box">
          <span class="modal-section-title"><i data-lucide="cpu"></i> Individual Cell Voltages (Active Balancing)</span>
          <table class="modal-table-simple">
            <tr><td>Cell #1 Voltage</td><td>3.325 V (Balanced)</td></tr>
            <tr><td>Cell #2 Voltage</td><td>3.321 V (Balanced)</td></tr>
            <tr><td>Cell #3 Voltage</td><td>3.328 V (Balanced)</td></tr>
            <tr><td>Cell #4 Voltage</td><td>3.324 V (Balanced)</td></tr>
            <tr><td>Automated Cutoff Threshold</td><td>20.0% SOC (Safety Reserve)</td></tr>
          </table>
        </div>
      `
    },
    grid: {
      title: "CEB Utility Grid & Tariff Deep-Dive",
      subtitle: "Time-of-Use (TOU) Smart Tariff Mapping & Grid Avoidance SCADA",
      icon: "plug",
      iconColor: "#38bdf8",
      badgeColor: "#38bdf8",
      status: "TOU Peak Optimization",
      navTab: "billing",
      navLabel: "View Billing Breakdown",
      render: () => `
        <div class="modal-grid-stats">
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">ACTIVE CEB TARIFF RATE</span>
            <span class="modal-stat-val text-danger">Rs. 54.00 / kWh</span>
            <span class="modal-stat-sub">PEAK TARIFF (18:30 — 22:30 SLST)</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">AVOIDED PEAK GRID IMPORT</span>
            <span class="modal-stat-val text-mint">4.20 kWh</span>
            <span class="modal-stat-sub">100% Shifted to Solar + Battery</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">PEAK HOURS MONEY SAVED</span>
            <span class="modal-stat-val text-amber">Rs. 226.80</span>
            <span class="modal-stat-sub">Direct Peak Tariff Cost Avoidance</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">CEB GRID IMPORT STATUS</span>
            <span class="modal-stat-val text-cyan">0 W (Idle)</span>
            <span class="modal-stat-sub">Zero Peak Grid Import</span>
          </div>
        </div>

        <div class="modal-section-box">
          <span class="modal-section-title"><i data-lucide="dollar-sign"></i> CEB Time-of-Use Schedule</span>
          <table class="modal-table-simple">
            <tr><td>Off-Peak Interval (22:30 — 05:30)</td><td>Rs. 13.00 / kWh</td></tr>
            <tr><td>Day Interval (05:30 — 18:30)</td><td>Rs. 25.00 / kWh</td></tr>
            <tr><td>Peak Interval (18:30 — 22:30)</td><td>Rs. 54.00 / kWh</td></tr>
            <tr><td>Estimated Monthly CEB Savings</td><td>Rs. 4,820.00</td></tr>
          </table>
        </div>
      `
    },
    inverter: {
      title: "Inverter Conversion & Waveform Deep-Dive",
      subtitle: "Pure Sine Wave • 1000W Continuous Inverter Efficiency & Thermal Health",
      icon: "cpu",
      iconColor: "#10b981",
      badgeColor: "#10b981",
      status: "High Efficiency",
      navTab: "overview",
      navLabel: "View Load Gauge",
      render: () => `
        <div class="modal-grid-stats">
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">CONVERSION EFFICIENCY</span>
            <span class="modal-stat-val text-mint">94.8%</span>
            <span class="modal-stat-sub">DC-AC Peak Inversion Efficiency</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">POWER HEADROOM</span>
            <span class="modal-stat-val text-mint">${Math.max(0, 1000 - state.inverterPower)} W</span>
            <span class="modal-stat-sub">Capacity Remaining Before Limit</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">INVERTER HEAT SINK TEMP</span>
            <span class="modal-stat-val">34.2 °C</span>
            <span class="modal-stat-sub">Intelligent Cooling Fan: Idle</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">SWITCHING SPEED</span>
            <span class="modal-stat-val text-cyan">&lt; 10 ms</span>
            <span class="modal-stat-sub">Zero-Flicker Seamless ATS Transfer</span>
          </div>
        </div>

        <div class="modal-section-box">
          <span class="modal-section-title"><i data-lucide="shield-check"></i> Inverter Protection Telemetry</span>
          <table class="modal-table-simple">
            <tr><td>Overload Safety Threshold</td><td>1,000 W Continuous (1,280 W Surge)</td></tr>
            <tr><td>Auto-Transfer Countdown Trigger</td><td>&gt; 1,000 W sustained for 30 seconds</td></tr>
            <tr><td>AC Output Frequency Stability</td><td>50.02 Hz ± 0.05%</td></tr>
            <tr><td>Low Voltage Cutoff Protection</td><td>44.0 V DC</td></tr>
          </table>
        </div>
      `
    },
    savings: {
      title: "Financial ROI & Savings Breakdown",
      subtitle: "Comprehensive Solar EMS Economic Analysis & Payback Trajectory",
      icon: "trending-up",
      iconColor: "#f59e0b",
      badgeColor: "#f59e0b",
      status: "ROI On Track",
      navTab: "billing",
      navLabel: "Open Billing Center",
      render: () => `
        <div class="modal-grid-stats">
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">TODAY'S TOTAL SAVINGS</span>
            <span class="modal-stat-val text-amber">Rs. 248.50</span>
            <span class="modal-stat-sub">Solar Generation + Peak Shift</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">THIS MONTH SAVED</span>
            <span class="modal-stat-val text-mint">Rs. 4,820.00</span>
            <span class="modal-stat-sub">57% Reduction on CEB Electric Bill</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">ANNUAL PROJECTED BENEFIT</span>
            <span class="modal-stat-val text-cyan">Rs. 57,840</span>
            <span class="modal-stat-sub">Indexed Against Rising Utility Tariffs</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">ESTIMATED PAYBACK TIME</span>
            <span class="modal-stat-val text-amber">2.1 Years</span>
            <span class="modal-stat-sub">ROI Accelerated by Peak TOU Avoidance</span>
          </div>
        </div>

        <div class="modal-section-box">
          <span class="modal-section-title"><i data-lucide="pie-chart"></i> Savings Source Disaggregation</span>
          <table class="modal-table-simple">
            <tr><td>Direct Daytime Solar Consumption</td><td>Rs. 171.00 (68.8%)</td></tr>
            <tr><td>Peak Night Battery Inverter Shift (Rs. 54/kWh)</td><td>Rs. 77.50 (31.2%)</td></tr>
            <tr><td>Estimated Standard Utility Bill (Without EMS)</td><td>Rs. 8,450.00 / month</td></tr>
            <tr><td>Optimized Bill With Genesis Grid EMS</td><td>Rs. 3,630.00 / month</td></tr>
          </table>
        </div>
      `
    }
  };

  function openTelemetryModal(detailKey) {
    const data = detailContents[detailKey] || detailContents.solar;
    if (!detailModal) return;

    if (modalChannelTitle) modalChannelTitle.textContent = data.title;
    if (modalChannelSubtitle) modalChannelSubtitle.textContent = data.subtitle;
    if (modalStatusBadge) {
      modalStatusBadge.textContent = data.status;
      modalStatusBadge.style.color = data.badgeColor;
      modalStatusBadge.style.borderColor = data.badgeColor;
    }
    if (modalIconBadge) {
      modalIconBadge.innerHTML = `<i data-lucide="${data.icon}"></i>`;
      modalIconBadge.style.borderColor = data.iconColor;
    }
    if (modalDynamicBody) {
      modalDynamicBody.innerHTML = data.render();
    }
    if (btnModalNavigate) {
      btnModalNavigate.textContent = data.navLabel;
      btnModalNavigate.onclick = () => {
        closeTelemetryModal();
        switchTab(data.navTab);
      };
    }

    if (window.lucide) window.lucide.createIcons();

    detailModal.classList.add('active');
  }

  function closeTelemetryModal() {
    if (detailModal) {
      detailModal.classList.remove('active');
    }
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeTelemetryModal);
  if (btnModalCloseAction) btnModalCloseAction.addEventListener('click', closeTelemetryModal);
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) closeTelemetryModal();
    });
  }

  // Global Delegated Click Listener for ANY [data-detail] Box/Card/Capsule across the app
  document.addEventListener('click', (e) => {
    // If clicking close buttons
    if (e.target.closest('#btn-close-modal') || e.target.closest('#btn-modal-close-action')) {
      closeTelemetryModal();
      return;
    }
    // If clicking inside the modal content, do not re-trigger
    if (e.target.closest('.modal-card') || e.target.closest('.demo-scenarios-wrapper') || e.target.closest('.operating-mode-capsule') || e.target.closest('.theme-toggle-btn') || e.target.closest('.nav-pill')) {
      return;
    }
    const trigger = e.target.closest('[data-detail]');
    if (trigger) {
      const detailKey = trigger.getAttribute('data-detail');
      if (detailKey) {
        openTelemetryModal(detailKey);
      }
    }
  });

  // ESC key to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTelemetryModal();
  });

  // Initial Load
  calculateTotalHouseLoad();
  renderScadaChart();
  window.addEventListener('resize', renderScadaChart);
});

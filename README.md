# ⚡ Genesis Grid — IoT Solar Power Management System

Genesis Grid is an intelligent, real-time energy management system (EMS) web dashboard designed for IoT-based solar power optimization. It visualizes and manages power distribution between **Solar PV**, **LiFePO4 Battery Storage (BMS)**, **Pure Sine Wave Inverter**, **AC-DC SMPS Charge Controller**, and the **CEB Main Utility Grid**.

---

## 🌟 Key Features

- **Pixel-Perfect Vector SVG Power Distribution Topology**:
  - 100% responsive, unified SVG vector schematic with live animated current flow paths.
  - Dynamically routes power based on active energy state (Solar $\rightarrow$ House, Battery $\rightarrow$ Inverter, CEB Grid Bypass, etc.).
- **Smart Tariff & Cost Optimization**:
  - Time-of-Use (ToU) peak tariff mitigation (avoiding Rs. 54.00/kWh peak grid rates).
  - Real-time monthly cumulative cost calculation and estimated money saved.
- **ACS712 Appliance Branch Monitoring**:
  - Individual load monitoring and control for 4 key household circuits (Living Room, Kitchen, Workspace, AC).
- **Automated SCADA & Telemetry**:
  - 24-Hour continuous SCADA time-series chart for solar irradiance, battery power, grid feed, and household demand.
- **Automated High Load Intervention**:
  - Interactive 30-second safety warning countdown when house demand approaches or exceeds inverter limits ($1000\text{ W}$).
  - One-click load shedding and manual bypass override controls.
- **One-Click EMS Demo Scenarios**:
  - 7 interactive presentation presets including Solar Peak Generation, Grid Outage Blackout, Critical Low Battery Cutoff, and Overload Spike.

---

## 🛠️ Tech Stack

- **Frontend**: Pure HTML5, Modern CSS3 (Neo-Glassmorphic Genesis Dark Theme), JavaScript (ES6+)
- **Diagrams**: Self-contained SVG Vector Coordinate System with CSS Keyframe Flow Animations
- **Icons**: Lucide Icons & Custom Vector Glyphs
- **Fonts**: Plus Jakarta Sans, JetBrains Mono

---

## 🚀 Live Demo & Deployment

Open `index.html` in any modern web browser or deploy directly to **GitHub Pages**:

1. Go to **Settings** $\rightarrow$ **Pages** in this repository.
2. Under **Build and deployment** $\rightarrow$ **Branch**, select `main` and root `/`.
3. Click **Save** to launch your live GitHub Pages URL!

---

## 📄 License

MIT License © 2026 Dhamnath Basuru

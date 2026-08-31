# 🚀 Genesis Grid EMS — Production Deployment Guide

Genesis Grid is built as a zero-dependency, high-performance web application that can be deployed instantly to any cloud platform, CDN, or local server.

---

## 🟢 1. Live Endpoints (Active)

- **Local SCADA Web Application**: [`http://localhost:3000/`](http://localhost:3000/)
- **Model & Agent Observability Inspector**: [`http://localhost:3000/model.html`](http://localhost:3000/model.html)
- **Scenario Predictor & REST API Studio**: [`http://localhost:3000/predictor.html`](http://localhost:3000/predictor.html)
- **Public Cloudflare Live Tunnel**: [`https://recognized-enhancements-collaborative-pete.trycloudflare.com`](https://recognized-enhancements-collaborative-pete.trycloudflare.com)
- **GitHub Repository**: [`https://github.com/dhamnathbasuru/Genesis-Grid`](https://github.com/dhamnathbasuru/Genesis-Grid)

---

## 💻 2. Local Server Control

To start or restart the local web server daemon:
```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 3000
```

To create a live public tunnel:
```powershell
.\cloudflared.exe tunnel --url http://127.0.0.1:3000
```

---

## 🌐 3. Cloud Deployment Options

### A. Vercel
```bash
npx vercel deploy --prod
```

### B. Netlify
```bash
npx netlify deploy --prod --dir=.
```

### C. GitHub Pages
1. Push to `main` branch:
   ```bash
   git push -u origin main
   ```
2. In GitHub repository **Settings** → **Pages** → Source: `Deploy from a branch` (`main` / `/root`).

---

## 📦 Production Bundle Structure
```
genesis-grid-webui/
├── index.html       # Main GenesisGrid EMS Application
├── model.html       # Model & Agent System Observability Dashboard
├── predictor.html   # Standalone AI Scenario Predictor Studio
├── styles.css       # Glassmorphic Dark/Light SCADA Stylesheet
├── app.js           # Decision Engine FSM & Autonomous Advisor Agent Core
├── serve.ps1        # High-Performance Local HTTP Server
├── README.md        # Architecture & Engineering Specifications
└── DEPLOYMENT.md    # Production Deployment Guide
```

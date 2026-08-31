# 🚀 Genesis Grid EMS — Production Deployment Guide

Genesis Grid is built as a zero-dependency, high-performance web application that can be deployed instantly to any cloud platform, CDN, or local server.

---

## 🟢 1. Live Permanent Endpoints (GitHub Pages CDN)

- 💻 **Main EMS Web Application**: [`https://dhamnathbasuru.github.io/Genesis-Grid/`](https://dhamnathbasuru.github.io/Genesis-Grid/)
- 🧠 **Model & Agent Observability Inspector**: [`https://dhamnathbasuru.github.io/Genesis-Grid/model.html`](https://dhamnathbasuru.github.io/Genesis-Grid/model.html)
- 🔮 **Scenario Predictor & REST API Studio**: [`https://dhamnathbasuru.github.io/Genesis-Grid/predictor.html`](https://dhamnathbasuru.github.io/Genesis-Grid/predictor.html)

---

## ☁️ 2. Edge Proxy & Local Endpoints

- **Cloudflare Tunnel**: [`https://recognized-enhancements-collaborative-pete.trycloudflare.com`](https://recognized-enhancements-collaborative-pete.trycloudflare.com)
- **Local SCADA Web Server**: [`http://localhost:3000/`](http://localhost:3000/)
- **GitHub Repository**: [`https://github.com/dhamnathbasuru/Genesis-Grid`](https://github.com/dhamnathbasuru/Genesis-Grid)

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

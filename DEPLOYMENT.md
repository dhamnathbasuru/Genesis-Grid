# 🚀 Genesis Grid — Deployment Guide

Genesis Grid is built as a zero-dependency, high-performance static web application that can be deployed instantly to any cloud platform, CDN, or local server.

---

## 🟢 1. Live Local Deployment (Active)

The built-in HTTP server daemon is currently running on:
👉 **`http://localhost:3000/`**

To manually start or restart the server on any port:
```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 3000
```

---

## 🌐 2. 1-Click Free Cloud Deployments

### A. Vercel
1. Install Vercel CLI (or connect your GitHub repo on [vercel.com](https://vercel.com)):
   ```bash
   npx vercel deploy --prod
   ```
2. Set root directory to `.` (Current folder).

---

### B. Netlify
1. Drag and drop the `genesis-grid-webui` folder into [app.netlify.com/drop](https://app.netlify.com/drop).
2. Or use the Netlify CLI:
   ```bash
   npx netlify deploy --prod --dir=.
   ```

---

### C. GitHub Pages
1. Initialize a git repository and commit files:
   ```bash
   git init
   git add .
   git commit -m "Deploy Genesis Grid WebUI"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<repo-name>.git
   git push -u origin main
   ```
2. In GitHub repository **Settings** → **Pages** → Source: `Deploy from a branch` (`main` / `/root`).

---

### D. Firebase Hosting
1. Initialize Firebase:
   ```bash
   npx -y firebase-tools@latest init hosting
   ```
   - Public directory: `.`
   - Single-page app: `Yes`
2. Deploy to CDN:
   ```bash
   npx -y firebase-tools@latest deploy --only hosting
   ```

---

### E. Cloudflare Pages
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages**.
2. Connect your Git repository or upload the folder directly.

---

## 📦 Production Bundle Structure
```
genesis-grid-webui/
├── index.html       # Clean Semantic UI, Overview & Analytics Multi-View
├── styles.css       # Neo-Glassmorphic CSS with Light/Dark Themes
├── app.js           # Real-Time Telemetry Engine, NILM & SCADA Chart
├── serve.ps1        # PowerShell High-Performance Local Server
└── DEPLOYMENT.md    # Deployment & Hosting Guide
```

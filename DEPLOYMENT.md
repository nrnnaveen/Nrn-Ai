# Deploying NRN AI for Free

NRN AI uses **FastAPI**, **WebSockets** (for real-time multi-user group chat), and **Server-Sent Events (SSE)** (for token-by-token AI response streaming).

---

## 🏆 Recommended Free Platform: **Render** (render.com)

Render provides a **free web service tier** that natively supports Python, persistent WebSockets, and live streaming out of the box with zero setup.

### Step 1: Push Code to GitHub
1. Initialize git and commit your project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of NRN AI"
   ```
2. Create a new repository on [GitHub](https://github.com/new) (e.g. `nrn-ai`).
3. Push your code:
   ```bash
   git remote add origin https://github.com/<your-username>/nrn-ai.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Deploy on Render in 2 Minutes
1. Go to [Render.com](https://render.com) and sign up / log in with your GitHub account.
2. Click **New +** → **Web Service**.
3. Select your `nrn-ai` GitHub repository.
4. Fill in the deployment details:
   - **Name**: `nrn-ai`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: **Free**
5. Under **Environment Variables**, add:
   - `OPENROUTER_API_KEY`: *(Your OpenRouter API Key)*
   - `AI_MODEL`: `nvidia/nemotron-3-super-120b-a12b:free`
   - `SECRET_KEY`: *(Any random 32+ character string)*
   - `PYTHON_VERSION`: `3.11.9`
6. Click **Create Web Service**.

Render will automatically build and deploy your application. In ~1-2 minutes, you will receive a live HTTPS URL (e.g. `https://nrn-ai.onrender.com`).

---

## ⚡ Alternative Free Platform: **Railway** (railway.app)

1. Go to [Railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select `nrn-ai`.
4. Go to **Variables** and add:
   - `OPENROUTER_API_KEY`: *(Your OpenRouter API Key)*
   - `AI_MODEL`: `nvidia/nemotron-3-super-120b-a12b:free`
   - `SECRET_KEY`: *(Random secure string)*
5. Railway automatically detects the `Dockerfile` / `Procfile` and deploys your live site with an automatic domain.

---

## ☁️ Alternative Free Platform: **Koyeb** (koyeb.com)

1. Go to [Koyeb.com](https://koyeb.com) and sign in.
2. Click **Create App** → **GitHub**.
3. Select `nrn-ai` with **Dockerfile** build.
4. Add your `OPENROUTER_API_KEY`, `AI_MODEL`, and `SECRET_KEY` under Environment Variables.
5. Click **Deploy**.

---

## ℹ️ Why Not Vercel?
Vercel is built for stateless serverless functions with a 10-second timeout limit on the free tier. Because NRN AI features **real-time WebSockets** (`/ws/group/general`) and **long-running SSE token streaming**, serverless platforms like Vercel drop active WebSocket connections. **Render**, **Railway**, and **Koyeb** provide full persistent WebSocket and streaming support.

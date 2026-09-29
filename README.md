# IncidentIQ

IncidentIQ is an AI-assisted incident response dashboard with a React/Vite frontend and an Express/SQLite backend.

## Run locally

1. Start the API from `incidentiq-main/backend` with `npm install` followed by `npm start` (API: `http://localhost:3001`).
2. In another terminal, start the frontend from `incidentiq-main/frontend` with `npm install` followed by `npm run dev`.
3. Open the local URL printed by Vite (typically `http://localhost:5173`).

The backend optionally reads `NVIDIA_API_KEY` from `incidentiq-main/backend/.env` for AI analysis. Copy `.env.example` to `.env` and add your own key; never commit `.env`.

## Deploy to Render

1. Push this project to GitHub.
2. Create two Render services:
   - Web Service: `incidentiq-main/backend`
   - Static Site: `incidentiq-main/frontend`
3. Use the included `render.yaml` file as a starting point.
4. Set the backend environment variable `NVIDIA_API_KEY` in Render.
5. Set the frontend environment variable `VITE_API_URL` to your backend Render URL, for example `https://incidentiq-backend.onrender.com/api`.
6. Deploy the backend first, then deploy the frontend.

The backend listens on `process.env.PORT`, which is required for Render. The frontend uses `VITE_API_URL` instead of a hardcoded localhost address so it works in production.

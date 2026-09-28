# IncidentIQ

IncidentIQ is an AI-assisted incident response dashboard with a React/Vite frontend and an Express/SQLite backend.

## Run locally

1. Start the API from `incidentiq-main/backend` with `npm install` followed by `npm start` (API: `http://localhost:3001`).
2. In another terminal, start the frontend from `incidentiq-main/frontend` with `npm install` followed by `npm run dev`.
3. Open the local URL printed by Vite (typically `http://localhost:5173`).

The backend optionally reads `NVIDIA_API_KEY` from `incidentiq-main/backend/.env` for AI analysis. Copy `.env.example` to `.env` and add your own key; never commit `.env`.

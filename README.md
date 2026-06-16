# VolleyTrack — Smart Volleyball Presence Network

Real-time volleyball team attendance, GPS presence tracking, live map, and a player photo showcase. React frontend + Flask backend.

## Features

- **Live GPS tracking** — Browser geolocation with periodic updates to the server
- **Match readiness** — Practice (6+) and full match (10+) thresholds
- **Live map** — Dark / satellite / hybrid tiles, player markers, ground placement, “my location”
- **Player showcase** — Auto-rotating carousel of team photos with smooth transitions
- **Photo upload** — Image + custom display name per player
- **Live player list** — Status, distance, last seen
- **Profile** — Visits, attendance %, streak, recent arrivals
- **PWA** — Installable; service worker for offline shell

### Player status (distance from ground)

| Status       | Distance   |
|-------------|------------|
| At Ground   | ≤ 100 m    |
| Nearby      | ≤ 500 m    |
| On The Way  | ≤ 2 km     |
| Away        | > 2 km     |
| Offline     | No update for 5 min |

### Match readiness

| Players present | Status                    |
|----------------|---------------------------|
| &lt; 6          | Not Enough Players        |
| 6–9            | Practice Session Possible |
| ≥ 10           | Full Match Ready          |

---

## Quick start

### Prerequisites

- Node.js 16+
- Python 3.8+
- npm and pip

### 1. Backend

```bash
cd backend

# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

API: `http://localhost:5000`

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:3000`

### 3. Use the app

1. Open `http://localhost:3000`
2. Join with name, team, and optional jersey
3. Allow location when prompted
4. Use **Dashboard** (showcase + live players), **Map**, and **Profile**

---

## Project structure

```
Volley/
├── backend/
│   ├── app.py              # Flask API
│   ├── config.py           # Ground coords, thresholds, CORS
│   ├── utils.py            # Haversine, status, cleanup
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapComponent.jsx
│   │   │   ├── PlayerShowcase.jsx
│   │   │   ├── ImageUploadModal.jsx
│   │   │   ├── MatchReadinessMeter.jsx
│   │   │   ├── PlayerList.jsx
│   │   │   └── Navigation.jsx
│   │   ├── pages/
│   │   │   ├── JoinPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── MapPage.jsx
│   │   │   └── ProfilePage.jsx
│   │   └── utils/
│   │       ├── api.js
│   │       └── locationTracking.js
│   ├── public/             # PWA manifest, service worker
│   └── package.json
│
└── README.md
```

---

## Configuration

### Ground location (`backend/config.py`)

```python
GROUND_LATITUDE = 17.3850   # Hyderabad, Telangana (default)
GROUND_LONGITUDE = 78.4867
```

Or set from the map: **Set Ground**, click map, or **Use My Location as Ground** (persists to `config.py`).

### Thresholds (`backend/config.py`)

```python
AT_GROUND_RADIUS = 100
NEARBY_RADIUS = 500
ON_THE_WAY_RADIUS = 2000
OFFLINE_THRESHOLD = 300          # seconds
MIN_PLAYERS_FOR_PRACTICE = 6
MIN_PLAYERS_FOR_FULL_MATCH = 10
```

### Frontend API URL

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:5000
```

Production example:

```
VITE_API_URL=https://your-api.example.com
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/join` | Register player |
| POST | `/location-update` | GPS update |
| GET | `/players` | Active players (incl. `profile_picture`, `picture_label`) |
| GET | `/stats` | Dashboard stats + ground location |
| GET | `/ground-status` | Match readiness at ground |
| GET | `/player/{id}` | Player + statistics |
| POST | `/upload-profile-picture` | FormData: `player_id`, `image`, optional `picture_name` |
| GET | `/player/{id}/picture` | Profile image metadata |
| POST | `/update-ground-location` | Runtime ground move |
| POST | `/save-ground-location` | Persist ground to `config.py` |
| POST | `/reset` | Clear in-memory data (testing) |

### Example: join

```bash
curl -X POST http://localhost:5000/join \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex","team":"Warriors","jersey":7}'
```

### Example: location update

```bash
curl -X POST http://localhost:5000/location-update \
  -H "Content-Type: application/json" \
  -d '{"player_id":"abc123","latitude":28.7041,"longitude":77.1025}'
```

---

## Environment variables

### Backend (optional, via `.env` + `python-dotenv`)

```
FLASK_ENV=production
DEBUG=False
GROUND_LAT=28.7041
GROUND_LON=77.1025
CORS_ORIGINS=http://localhost:3000,https://your-app.com
PORT=5000
```

### Frontend

```
VITE_API_URL=http://localhost:5000
```

---

## Deployment

### Backend (Gunicorn)

```bash
cd backend
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

**Heroku:** add `Procfile`: `web: gunicorn -w 4 -b 0.0.0.0:$PORT app:app`

**Docker:** Python 3.9 slim image, copy `requirements.txt`, run Gunicorn on port 5000.

### Frontend

```bash
cd frontend
npm run build
```

Deploy `frontend/dist/` to **Vercel**, **Netlify**, **S3 + CloudFront**, or similar. Set `VITE_API_URL` to your production API.

### Production checklist

- [ ] Set real ground coordinates
- [ ] `DEBUG = False` in `config.py`
- [ ] Restrict `CORS_ORIGINS` to your frontend domain
- [ ] HTTPS (required for geolocation in production)
- [ ] Set `VITE_API_URL` for production build

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Map blank / grey | Ensure backend is running; refresh map page; allow tiles (network) |
| API connection failed | Backend on `:5000`; check `VITE_API_URL` |
| Location not updating | Grant browser location permission; use HTTPS in production |
| Upload fails | Valid `player_id` in localStorage; image ≤ 5 MB (JPG/PNG/WebP) |
| Data gone after restart | In-memory store resets; re-join or use `/reset` only in dev |

### Dev tips

- Frontend hot-reloads; restart backend after Python changes
- Test multiple players: incognito windows or clear `localStorage` keys `volleytrack_*`
- Backend logs: terminal running `python app.py`
- Frontend logs: browser DevTools → Console

---

## Tech stack

**Frontend:** React 18, Vite, Tailwind CSS, React Router, Axios, Leaflet, Lucide React  

**Backend:** Flask, Flask-CORS, in-memory storage (no database)

---

## Storage note

Players and stats live in server memory. Restarting the backend clears data. Ground coordinates saved via **save-ground-location** are written to `config.py` and persist.

---

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| backend | `python app.py` | Dev server |
| frontend | `npm run dev` | Dev server (:3000) |
| frontend | `npm run build` | Production build |
| frontend | `npm run preview` | Preview production build |

---

**Version:** 1.1.0  
**License:** MIT

Built for volleyball teams.

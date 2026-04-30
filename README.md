# noBrokers.my

Owner-direct real estate platform for Malaysia. Owners list, buyers and tenants
deal direct — no commission-hungry middlemen. The platform automates the
paperwork agents traditionally do (verification, offers, OTR/tenancy drafts)
and keeps full control with the parties.

## Stack

| Layer    | Tech                                                   |
| -------- | ------------------------------------------------------ |
| Frontend | Vite + React 18 + Tailwind + Zustand + React Query     |
| Backend  | Node + Express + Mongoose (serverless on Vercel)       |
| Database | MongoDB Atlas (2dsphere indexed for radius search)     |
| Storage  | Cloudflare R2 (S3-compatible, presigned-PUT uploads)   |
| Hosting  | Vercel (frontend + backend, two separate projects)     |
| Maps     | Google Maps API (autocomplete + pin-drop on listing form) |

Same monorepo layout as `VinScan` and `PoultryManager`: `frontend/` and
`backend/` deploy as two independent Vercel projects.

## Layout

```
noBrokers/
├── backend/                # Express API, deploys to api.nobrokers.my
│   ├── api/index.js        # Vercel serverless entry
│   ├── src/
│   │   ├── app.js          # Express app
│   │   ├── server.js       # Local dev entry
│   │   ├── config/         # db, R2 client
│   │   ├── middleware/     # auth, admin, error handler
│   │   ├── models/         # User, Listing, Offer, Watchlist
│   │   ├── routes/         # auth, listings, offers, watchlist, uploads, admin
│   │   └── utils/          # JWT helpers
│   └── scripts/seed.js     # Seed admin user + sample listings
└── frontend/               # Vite SPA, deploys to nobrokers.my
    ├── index.html
    └── src/
        ├── App.js          # Router
        ├── main.js         # Bootstrap (BrowserRouter, QueryClient)
        ├── index.css       # Tailwind + brand tokens
        ├── components/     # ui/ atoms + composite components
        ├── layouts/        # MarketingLayout, AuthLayout, AppLayout, AdminLayout
        ├── pages/          # marketing/, auth/, listings/, dashboard/, admin/
        ├── stores/         # auth, theme, watchlist (Zustand)
        ├── hooks/
        └── lib/            # api, utils, format, constants
```

## MVP scope (live in this repo)

- Sign up / sign in / forgot password
- KYC verification submission (IC / passport / utility) — admin reviews
- List a property (sale or rent) — admin verifies ownership docs
- Browse listings with filters: type, location, price range, beds, baths,
  property type, furnished, sqft, **radius search**, **viewport bbox
  ("search as I move the map")**, and **user-drawn polygon search**
- Listing detail page with image gallery
- Watchlist (add / remove / view)
- Submit purchase offers and rent offers — back-and-forth negotiation thread
- Admin panel: verify users, verify listings
- Marketing: home / privacy / terms / about

Out of scope (deliberately deferred):

- Saved-searches persistence + email/push alerts (UI hook lives on the
  browse pill bar; backend collection is the next PR)
- MyDigitalID national e-verification (admin manually reviews KYC for now)
- Auto-generated OTR / tenancy agreement PDFs

## Google Maps setup

Google Maps powers two features:

- **List a property** (`/dashboard/listings/new`) — address autocomplete +
  pin-drop selection.
- **Browse** (`/buy`, `/rent`) — sticky split-pane map with clustered price
  bubbles, "Search as I move", and a polygon "Draw" tool.

To enable:

1. In Google Cloud Console, enable **Maps JavaScript API**, **Places API**,
   **Geocoding API**, and **Drawing Library** on a project with billing.
   (Drawing Library has no separate enable step — it ships with Maps JS,
   you just need to load it via `libraries=drawing`, which we do.)
2. Create an API key and restrict it to your Vercel domain(s) + localhost.
3. Add `VITE_GOOGLE_MAPS_API_KEY=...` to `frontend/.env` (and to the
   frontend Vercel project's env vars).

Without a key the listing form falls back to plain text inputs and the
browse map shows a placeholder; the backend still accepts manually entered
addresses, the list still renders, and the API still serves results.

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env       # fill MongoDB + R2 + JWT secrets
npm install
npm run seed               # creates admin@nobrokers.my / changeme123
npm run dev                # http://localhost:5001
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env       # VITE_API_URL=http://localhost:5001
npm install
npm run dev                # http://localhost:5173
```

## Cloudflare R2 setup

1. Create an R2 bucket (e.g. `nobrokers-listings`).
2. Generate an R2 API token with read/write on that bucket.
3. Enable a public R2.dev or custom domain so `<img>` tags can hit the URL.
4. Fill in `backend/.env`:

   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=nobrokers-listings
   R2_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
   ```

The frontend never sees R2 credentials. Upload flow:

1. Frontend POSTs to `/api/uploads/presign` with `{ contentType, kind }`.
2. Backend returns a presigned PUT URL + the public URL the file will live at.
3. Frontend `PUT`s the file binary directly to R2.
4. Frontend submits the public URL with the listing payload.

## Deploy to Vercel

Two separate Vercel projects, both pointed at this repo with different
**Root Directory** settings:

- `noBrokers-frontend` — Root Directory: `frontend`
- `noBrokers-backend`  — Root Directory: `backend`

Each subfolder ships its own `vercel.json` so no extra config is needed.

Set every variable from `.env.example` as Vercel project env vars.
Set the frontend's `VITE_API_URL` to the backend's deployed URL.

## Branding

Brand colour is a single CSS token (`--primary`) in
`frontend/src/index.css`. Default is **deep teal** (HSL `188 75% 28%`) —
trust-leaning, distinct from the typical real-estate green/blue. Swap that
HSL triplet in light + dark blocks and the whole UI re-skins. Logo slot is
`frontend/public/brand/logo.svg` — drop a real logo there once branding lands.

## License

Proprietary — Estera Tech.

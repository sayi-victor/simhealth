# SimHealth Web

Vue 3 single-page app for the SimHealth health management system. It is the staff-facing EMR:
patients, encounters and clinical forms, appointments, pharmacy, orders, admissions, billing,
inventory, reports and administration.

The API lives in a separate repository:
[sayi-victor/simhealth-api](https://github.com/sayi-victor/simhealth-api).

## Stack

- Vue 3.5 (`<script setup>`), TypeScript 6, Vite 8, Pinia 4, Vue Router 5
- No UI framework — hand-written CSS with semantic design tokens (light + dark)
- No backend code: everything goes through the API

## Local setup

```sh
npm install
cp .env.example .env      # set VITE_API_BASE_URL
npm run dev               # http://localhost:5173
```

`VITE_API_BASE_URL` must point at the API root **including** `/api`, e.g.
`http://localhost:8000/api` or `http://simhealth.test/api`.

If you leave it unset, requests go to `/api` on the dev server and are proxied to
`VITE_API_TARGET` (default `http://127.0.0.1:8000`) — see `vite.config.ts`.

```sh
npm run typecheck   # vue-tsc --noEmit
npm run build       # typecheck + production bundle
npm run preview     # serve the built app
```

## Layout

```
src/lib/api.ts         fetch wrapper, bearer token, ApiError, error envelope
src/stores/auth.ts     login/logout, token persistence, /api/me bootstrap
src/stores/theme.ts    light / dark / system, persisted, anti-FOUC in index.html
src/router/index.ts    all routes, lazy-loaded chunks
src/types/*.ts         request/response shapes per module
src/views/*.vue        one screen per module (list, create, workspace)
src/components/        AppLayout (sidebar/drawer/topbar), shared UI
src/style.css          semantic tokens + responsive rules
```

## Conventions

- Every network call goes through `apiRequest()` in `src/lib/api.ts`; never call `fetch`
  directly from a component.
- Errors surface as `ApiError` with the API's `{error:{code,message,details}}` payload. Show
  `message`, and map `details` onto the form fields it names.
- Module types live in `src/types/<module>.ts`; keep them in sync with the API resources.
- Routes are lazy-loaded (`() => import(...)`) — keep it that way for mobile load time.
- Mobile first: base styles target a 320px viewport, controls are at least 40px tall, tables
  scroll horizontally, navigation collapses into a slide-over drawer below 1024px.
- Themes: use the CSS variables (`--bg`, `--surface`, `--text`, `--muted`, `--border`,
  `--primary`, `--input-bg`). Never hardcode `#fff`, `#000`, or greys.

## Project rules

See `AGENTS.md`.

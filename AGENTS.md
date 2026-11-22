# AGENTS.md — SimHealth Web

> Read this before changing code. The API is a **separate repository**
> ([simhealth-api](https://github.com/sayi-victor/simhealth-api)); the legacy PHP app is a
> **separate read-only reference project**. Nothing here imports from either.
>
> Update **§6 Progress Log** when you finish a task.

---

## 1. What this repo is

The staff-facing SPA for a health management system: Vue 3 + TypeScript + Vite, Pinia, Vue
Router. It owns presentation and client-side state only — all rules, validation and
permissions belong to the API.

## 2. Layout

```
src/lib/api.ts        single fetch wrapper (base URL, bearer token, ApiError)
src/stores/           Pinia: auth, theme
src/router/index.ts   route table, lazy chunks, auth guard
src/types/            request/response types per module
src/views/            one screen per module
src/components/       AppLayout (sidebar/drawer/topbar) and shared UI
src/style.css         design tokens (light/dark) + responsive base styles
```

## 3. Rules

**R1 — One network path.** All HTTP goes through `apiRequest()` (`src/lib/api.ts`). No `fetch`
in components, no duplicated base URLs. The base URL comes from
`import.meta.env.VITE_API_BASE_URL` and must never be hardcoded.

**R2 — No secrets, no server logic.** This bundle is public. No API keys, no signing, no
business rules that must be enforced — put those in the API.

**R3 — Types mirror the API.** Each module has a `src/types/<module>.ts` that matches the API
resources. When the API shape changes, update the type in the same change.

**R4 — Errors are shown, not swallowed.** `ApiError` carries `code`, `message` and `details`.
Show `message` to the user; map `details` (field => messages) onto the corresponding inputs.
Never replace an API error with a generic "something went wrong".

**R5 — Mobile first.** Base CSS targets a 320px viewport; enhance upward (`768px`, `1024px`).
Touch targets are at least 40px, tables scroll horizontally rather than squeezing, and
navigation becomes a slide-over drawer below 1024px.

**R6 — Themes are tokens, not colours.** Use the CSS variables in `src/style.css`
(`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--primary`, `--input-bg`, …). Never
hardcode `#fff`, `#000` or fixed greys. Every new screen must be checked in both light and
dark, and must honour `prefers-color-scheme` through `useThemeStore`.

**R7 — Routes are lazy.** Keep `() => import('../views/X.vue')` for every route so the initial
mobile bundle stays small. A new screen means a new lazy route plus a sidebar entry in
`AppLayout.vue`.

**R8 — Auth is a store, not a prop.** `useAuthStore()` owns the token (`localStorage`), the
current user and login/logout. The router guard bootstraps `/api/me` once. Do not read the
token directly from storage in a view.

**R9 — Accessibility basics.** Every icon-only button needs `aria-label`; dialogs/drawers must
close on Escape and trap focus; form inputs need real `<label>`s; tables need `<th scope>`.

**R10 — Check before committing.** `npm run typecheck` and `npm run build` must pass. There is
no unit-test runner yet; when one is added, cover the API wrapper and stores first.

**R11 — Small conventional commits.** `feat(patients): document panel`,
`fix(calendar): keep day column scrolled`, one screen or concern per commit.

## 4. Adding a module screen

1. Types in `src/types/<module>.ts` (copy from the API resource).
2. Route in `src/router/index.ts` (lazy) + sidebar link in `AppLayout.vue`.
3. View(s) in `src/views/` — list (paged, filtered, sorted), create/edit, detail/workspace.
4. Loading, empty and error states for every request. 403 is a normal state: show "no access"
   rather than a stack trace.
5. Verify light + dark, 320px + 1440px, keyboard only.

## 5. Commands

```sh
npm run dev
npm run typecheck
npm run build
npm run preview
```

## 6. Progress Log

| Date | Area | Status | Notes |
|---|---|---|---|
| 2026-11-22 | Patient documents panel | DONE | New `DocumentsPanel.vue` (list with category filter + name search, upload with category, token-authenticated download, archive, permission-gated by `documents.view` / `documents.upload` / `documents.delete`, loading/empty/no-access states) mounted on the patient summary, as an encounter workspace tab, and beside the inspected order. Added `apiDownload()` to `src/lib/api.ts` (bearer token + `Content-Disposition` filename, `ApiError` on failure), `src/types/document.ts`, and `row-actions` / `break-all` utilities in `style.css`. `vue-tsc` + `vite build` pass; `DocumentsPanel` ships as its own 5.8 kB chunk. | — |
| 2026-11-21 | Repository split | DONE | Extracted from the legacy monorepo into its own repo; API base URL now env-driven with a dev proxy; template leftovers removed; docs written |

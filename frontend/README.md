# Frontend

React 19 + TypeScript + Vite, React Router 8 (declarative mode) and TanStack Query 5. Styling is plain CSS with design tokens in `src/styles/global.css`; there is no UI library and no global state library.

Read `../AGENTS.md` and `../docs/06_FRONTEND_AND_UX.md` first. They define the product rules this code has to respect.

## Commands

Run from this folder. pnpm is the package manager.

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Dev server on http://localhost:5173, using the mock backend by default |
| `pnpm test` | Unit and component tests (Vitest + Testing Library) |
| `pnpm lint` | Oxlint |
| `pnpm build` | Type check, then production build into `dist/` |

## Mock backend

The Spring Boot API does not exist yet, so `pnpm dev` runs against an in-browser mock (`src/services/mock/`). It is switched on by `VITE_API_MOCK=true` in `.env.development`.

- State lives in the tab's `sessionStorage`. Close the tab to reset it.
- Demo accounts: `trainee@example.com` and `trainer@example.com`, password `demo-pass-123`. The login page has buttons that fill these in.
- Checkout goes to a simulated provider page at `/mock-checkout`, where you choose the outcome. The "provider" confirms a few seconds later, which is why the return page shows a pending state first.
- The mock enforces the same rules the real backend must: ownership, enrolment-gated workout content, purchase is not enrolment, idempotent confirmation and idempotent workout logs. `src/services/mock/server.test.ts` pins those behaviours.

The mock proves the screens work. It is not evidence that the real backend, real payments or real authentication work.

To use a real backend, create `.env.local` with `VITE_API_MOCK=false`. Requests to `/api` are proxied to `http://localhost:8080` (see `vite.config.ts`).

## Structure

```text
src/
  app/          App providers, routes, page shell
  components/   Shared UI: loading, empty and error states, notices, fields
  features/     One folder per area: auth, marketplace, checkout, workouts,
                progress, trainer, accountability, assistant
  services/     http.ts (transport), api.ts (endpoints and query keys),
                types.ts (DTOs), mock/ (mock backend)
  hooks/ utils/ styles/ test/
```

## Rules this code follows

- **No tokens in the browser.** Authentication is the server's HttpOnly cookie. Requests use `credentials: 'include'`, and state-changing requests echo the `XSRF-TOKEN` cookie in an `X-XSRF-TOKEN` header. Nothing about the session is written to web storage.
- **The checkout redirect grants nothing.** `CheckoutReturnPage` polls the purchase and shows the programme only after the server returns both a `PAID` purchase and the enrolment.
- **Prices come from the server.** The client sends only a plan id to `/checkout`.
- **Route guards are not security.** `RequireAuth` decides what to render; the server authorises every request. No-access and expired-access screens explain the server's answer.
- **A workout counts as saved only after the server confirms it.** Each attempt carries a `clientRequestId` so a retry cannot create a second log.
- **An AI adjustment is a proposal.** It is reviewed before use, applies to one session, and the trainer's plan is never changed.

## Contract assumptions

`src/services/types.ts` and `src/services/api.ts` are the frontend's reading of `../docs/04_API_CONTRACTS.md`. Endpoints and fields the docs do not define yet are marked `(proposed)` in `api.ts` and listed in `../docs/09_HANDOFF_LOG.md`. Treat them as open until the backend implements them.

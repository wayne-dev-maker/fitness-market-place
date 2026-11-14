# 09 — Sequential agent handoff log

## Current status
**The React frontend exists and runs against an in-browser mock backend. There is no Spring Boot application, no database, no real authentication and no real payment integration.** The code is in git (first commit 2026-11-14); nothing has been deployed. The active technical direction is Java 21 + Spring Boot + React/Vite + PostgreSQL.

The frontend was built out of sequence at the user's explicit request (the plan puts it at stage 6, after the backend). It is therefore built on a *proposed* API contract, listed below, that the backend has not confirmed.

## Next action
Finish **Milestone 0** in `08_IMPLEMENTATION_TASKS.md` for the backend: choose package name, build tool, Spring Boot version and sandbox payment provider; install JDK 21 and PostgreSQL (neither is on the development machine); bootstrap the Spring Boot application. Then implement the endpoints the frontend already calls, confirming or correcting each proposed contract item below.

## Decision backlog
| Decision | Current state | Owner |
|---|---|---|
| Java package namespace | TBD | Product/engineering |
| Maven vs Gradle | TBD (Maven with wrapper recommended) | Engineering |
| Spring Boot version | Select supported compatible release at build time | Engineering |
| JavaScript vs TypeScript | **Decided 2026-11-14: TypeScript** | Frontend |
| Auth session/JWT and CSRF details | Not selected. Frontend assumes an HttpOnly session cookie plus an `XSRF-TOKEN` cookie echoed as `X-XSRF-TOKEN` | Backend/security |
| Payment provider/currency | TBD; validate local methods. Mock data uses ZAR | Product/backend |
| Validation status code | Frontend assumes `422` for all validation errors | Backend |
| Product name | Placeholder "Cadence" (`frontend/src/app/config.ts`, `frontend/index.html`) | Product |
| Age, privacy, deletion and data retention | TBD before production | Product/legal |
| Recurring subscription billing | Deferred from MVP | Product |

## Proposed API contract additions (frontend assumptions, unconfirmed)
`docs/04_API_CONTRACTS.md` does not define these, and the screens in `docs/06` cannot be built without them. Exact shapes are in `frontend/src/services/types.ts`.

| Method | Path | Why the frontend needs it |
|---|---|---|
| GET | `/trainer/plans` | Trainer dashboard: list own plans with status and enrolment count |
| GET | `/trainer/plans/{id}` | Plan builder: load own plan with its full week/workout/exercise structure |
| GET | `/exercises` | Plan builder: exercise library to choose from |
| GET | `/purchases/{id}` | Checkout outcome: pending, paid, failed or cancelled, for the owner only |
| GET | `/enrolments/{id}/schedule` | Programme page and "coming up": dated sessions with completion state |
| GET | `/workouts/{id}` | Workout player: prescription, gated by active enrolment (`403 NO_ACCESS` / `403 ACCESS_EXPIRED`) |
| POST | `/assistant/adaptations/{id}/accept` | Record that a reviewed adaptation was accepted |

Other assumptions the backend should confirm:
- `PATCH /trainer/plans/{id}` replaces the whole draft (details plus nested weeks, workouts and exercises) and carries `version` for optimistic locking; a stale version returns `409 VERSION_CONFLICT`, an edit to a published plan `409 PLAN_NOT_EDITABLE`.
- `POST /trainer/plans/{id}/publish` returns `422` with one `details` entry per problem.
- `POST /checkout` takes only `{ planId }` and returns `{ purchaseId, checkoutUrl }`; the provider returns the buyer to `/checkout/return?purchase={id}`.
- `POST /workout-logs` carries a client-generated `clientRequestId`; repeating it returns the stored log instead of creating another. One log per workout per enrolment (`409 ALREADY_LOGGED`).
- Money is `{ amount: "349.00", currency: "ZAR" }` with the amount as a decimal string.
- Collections are paged as `{ items, page, size, totalItems, totalPages }`.
- Schedule dates are derived from the enrolment start day (week 1, day 1 = the day access was granted). Timezone handling is still an open product decision.

## Handoff entry template
```text
Date / agent:
Milestone + exact tasks:
Changes / affected files:
Commands executed and exact results:
Tests not run (and reason):
Schema/API decisions:
Risks and open questions:
Next task / dependency:
```

## Initial entry
```text
Date: 2026-11-13
Milestone: documentation preparation (not software implementation)
Changes: AGENTS.md, README.md, docs/00–09 and archive of original README.
Validation: Markdown files generated; ZIP packaging verified (see delivery response).
Known gaps: no Spring Boot or React code, no migrations, no runtime tests, no deployment.
Next task: Milestone 0 decisions and project bootstrap.
```

## Entry: frontend built against a mock backend
```text
Date / agent: 2026-11-14 / Claude Code
Milestone + exact tasks: Milestone 0, frontend bootstrap task (complete). Also built, ahead of
  sequence at the user's request, the frontend screens for Milestones 1-5: marketplace and plan
  detail, register/login/logout with expired-session handling, checkout hand-off and outcome,
  trainee dashboard, programme schedule, workout player with rest timer, progress and history,
  trainer dashboard and plan builder, programme check-ins and adaptation review.
Changes / affected files: project set up in its own folder with the docs copied in. New
  frontend/ (43 source files, about 5,000 lines). Updated
  docs/08_IMPLEMENTATION_TASKS.md and this file. frontend/README.md rewritten.
Commands executed and exact results (in frontend/):
  pnpm lint   -> 0 warnings, 0 errors
  pnpm test   -> 5 files, 45 tests passed
  pnpm build  -> tsc -b clean; vite build succeeded (main bundle 356 kB, 108 kB gzip)
  Browser walkthrough in headless Edge against pnpm dev (mock backend), 24 steps, all passed,
  no console errors: browse and filter; login and return to plan; declined payment unlocks
  nothing; returning from checkout without paying shows pending and no access; paid purchase
  shows pending then verified access; dashboard; adaptation review and revert; workout log with
  validation, rest timer and check-in; history; trainee blocked from trainer area; trainer sees
  only own plans; publish blocked until valid, then published and listed; phone-width layouts
  without horizontal overflow; dark mode.
Tests not run (and reason): nothing against a real backend, database, payment provider or LLM,
  because none exist. No accessibility audit beyond keyboard-reachable controls, labels and focus
  handling built in. No CI configured. Admin screens were not built (not in docs/06).
Schema/API decisions: TypeScript chosen. Seven proposed endpoints and several contract
  assumptions, listed above. No database decisions.
Risks and open questions:
  - The contract is the frontend's proposal. Backend changes to it mean frontend changes.
  - CSRF: the client sends X-XSRF-TOKEN only if the XSRF-TOKEN cookie exists. The backend must
    issue that cookie before the first state-changing request (including login and register).
  - The mock backend and simulated payment page are development aids. The mock is loaded only
    when VITE_API_MOCK=true; a production build must leave it unset.
  - Free (price 0) plans go through the same checkout flow; decide whether they should.
  - No CI yet: lint, tests and build were run locally only.
Next task / dependency: backend Milestone 0 (needs JDK 21 and PostgreSQL installed, and the
  remaining bootstrap decisions).
```

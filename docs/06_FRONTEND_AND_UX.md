# 06 — React frontend and user experience

## Stack / structure
React + Vite, React Router, TanStack Query, responsive styling (custom CSS or approved UI system). Choose TypeScript vs JavaScript at bootstrap and use consistently. Avoid extra global state layers until needed.

```text
frontend/src/
  app/            # router, providers, shell
  components/     # reusable UI, forms, layout
  features/
    auth/ marketplace/ plans/ trainer/ workouts/
    progress/ assistant/ accountability/
  services/       # typed API client, auth, payments
  hooks/ utils/ styles/
```

## Required screens
1. **Marketplace:** plan cards, trainer identity, pricing, difficulty, duration, filter/search and detail page.
2. **Trainee dashboard:** active enrolments, today's workout, upcoming sessions and recent progress.
3. **Workout player:** instructions, prescribed sets/reps, performed sets/reps, optional rest timer and completion status.
4. **Trainer dashboard:** draft/published plans, plan-week-workout builder, exercise editor, pricing and publish validation, basic enrolment stats.
5. **Authentication:** register, login, logout, expired-session handling.
6. **Checkout and outcome:** trusted hosted payment handoff; pending/verified/failed states; verify access via backend before presenting paid content.
7. **P1:** progress chart, programme check-ins and proposed workout adaptation review.

## UX and safety rules
- Show loading, empty, no-access, expired-access, error and retry states for each data-backed screen.
- Mobile-first layout with accessible focus order, labels, clear error text and keyboard support.
- Do not promise access based on checkout redirect; refetch verified enrolment state.
- Never put authentication tokens in localStorage; use cookie-compatible API requests and CSRF headers where required.
- Avoid deceptive progress or body-image messaging; progress is optional and user-controlled.
- Persist completed workout only on confirmed backend success; prevent double submission.

## Frontend acceptance
- A trainee can browse, authenticate, check out in sandbox, see verified purchased plan, log workout and view saved history on desktop and mobile widths.
- A trainer can author, validate and publish a complete programme.
- Every user-facing protected interaction is backed by server authorization; the UI hiding a button is not a security control.

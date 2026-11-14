# 08 — Sequential implementation checklist

**Status key:** `[ ]` not started, `[x]` evidence-backed complete. These checkboxes are deliberately unmarked: this package is documentation, not implementation.

## Milestone 0 — Decisions and foundation
- [ ] Choose group/artifact ID, JavaScript vs TypeScript, build system (Maven/Gradle), supported stable Spring Boot release and payment sandbox provider.
- [ ] Create backend Spring Boot application with Web MVC, Security, Data JPA, Validation, Flyway, Actuator and tests.
- [x] Create frontend React/Vite application with router, Query provider, basic responsive shell and environment examples. *(2026-11-14: build, lint and 45 tests pass; see handoff log. The feature screens for Milestones 1–5 were also built ahead of sequence against a mock backend; their checkboxes stay open until they run against the real API.)*
- [ ] Configure local PostgreSQL and CI for build, tests and frontend production build.
- [ ] Establish consistent API errors, request logging, secret management and local dev commands.

**Exit:** both apps build; backend starts with Postgres; clean Flyway migration and health endpoint succeed; CI runs tests.

## Milestone 1 — Identity and schema
- [ ] Implement schema for users and profiles, Argon2 password hashing and role enums.
- [ ] Implement registration/login/logout and `/users/me` with chosen cookie/CSRF design.
- [ ] Test auth, role escalation, invalid input, cross-user access, cookie and CSRF protections.

**Exit:** authenticated session works in browser and ownership/role tests pass.

## Milestone 2 — Trainer authoring
- [ ] Migrate plans, weeks, workouts, exercises and ordered workout exercises.
- [ ] Implement draft authoring, structure/pricing validation, publish and trainer ownership.
- [ ] Implement trainer dashboard and plan builder with responsive states.

**Exit:** trainer can publish a multi-week plan; it appears in the public marketplace; another trainer cannot modify it.

## Milestone 3 — Marketplace and payment/access
- [ ] Build published catalogue and public plan detail pages.
- [ ] Add purchases, provider events and enrolments migrations and provider adapter.
- [ ] Implement backend-priced checkout and verified signature webhook handler with idempotency/atomic enrolment.
- [ ] Implement checkout state UI and purchased/enrolled programme view.
- [ ] Test wrong amount, fake/duplicate/out-of-order events, failed payments, concurrency and content authorization.

**Exit:** sandbox buyer receives access only after genuine confirmation; repeated events cause no duplicate grant.

## Milestone 4 — Training experience
- [ ] Implement scheduled workout view, actual workout/exercise logging and enrolment checks.
- [ ] Implement progress/history summary, trainee dashboard and optional basic metrics.
- [ ] Test unauthorized access, repeated saves, invalid performed data and mobile layout.

**Exit:** enrolled trainee can complete a programme workout and retrieve accurate saved history.

## Milestone 5 — Optional productivity features
- [ ] Implement programme-only check-ins with safeguards and reporting.
- [ ] Implement structured, validated LLM adaptation and opt-in acceptance without changing authored plan.
- [ ] Test rule bypasses, provider failures, privacy and cost limits.

**Exit:** deterministic validation blocks disallowed suggestions; original plan stays intact.

## Milestone 6 — Production readiness
- [ ] Full regression test suite, integration tests with PostgreSQL, frontend accessibility and responsive checks.
- [ ] Review logging, monitoring, backup/restore, migrations, secrets, audit events and privacy policy.
- [ ] Review payment provider compliance, refunds/chargebacks, recurring billing exclusions and access expiry behavior.
- [ ] Deploy **only with explicit approval**; verify deployed environment and record actual evidence.

**Exit:** reproducible build, passing test evidence, documented operations and approved deployment.

## Agent completion report template
`Milestone: ... | Changes: ... | Tests run/results: ... | Migrations: ... | API changes: ... | Known gaps: ... | Next unchecked task: ...`

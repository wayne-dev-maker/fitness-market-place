# AGENTS.md — Fitness Productivity Marketplace

## Mission and source of truth
Build a secure, responsive fitness-productivity marketplace where **trainers publish paid multi-week training programmes**, **trainees purchase and follow programmes**, and **workout logs, progress and lightweight accountability** help trainees remain consistent. This document is the entry point for coding agents. The original product brief is archived at `docs/REFERENCE_ORIGINAL_README.md`; the Java/Spring Boot decisions in this file and the numbered docs supersede its obsolete Python/FastAPI implementation details.

**Documentation precedence:** (1) explicit current user instructions, (2) `AGENTS.md`, (3) numbered `docs/00`–`docs/09`, (4) archived original brief. If requirements conflict, do not silently mix stacks; record the conflict in the handoff and request a decision when blocking.

## Approved technical architecture
- **Frontend:** React + Vite, JavaScript or TypeScript (choose one before coding), React Router, TanStack Query, responsive CSS. Do not add a global state library without demonstrated need.
- **Backend:** Java 21, Spring Boot, Spring Web MVC, Spring Security, Spring Data JPA/Hibernate, Bean Validation, Flyway, PostgreSQL. REST API rooted at `/api/v1`.
- **Authentication:** Secure, HttpOnly, appropriately configured SameSite cookies for tokens/sessions; Spring Security authorization on every protected API route. CSRF protection is required for cookie-authenticated state changes; choose and document a concrete CSRF strategy before implementation.
- **Storage:** PostgreSQL for relational data; S3-compatible object storage for media; separate payment and LLM provider adapters.
- **Architecture:** Modular monolith. Business modules may share the same deployable process and database but must have clear ownership and boundaries. No Python, FastAPI, Pydantic, SQLAlchemy, Alembic, Celery, Redis, microservices, WebSockets, or multi-agent AI unless a new decision explicitly adds them.
- **Deployment target (example, not mandatory):** static frontend on Vercel; JVM-capable backend on Railway or another Java host; managed PostgreSQL; S3-compatible media.

## Domain glossary (use names consistently)
- **User:** authenticated account with one of `TRAINEE`, `TRAINER`, `ADMIN` roles.
- **Profile:** user-facing information and optional fitness preferences; store minimal personal information.
- **TrainingPlan:** sellable programme owned by a trainer; has status `DRAFT`, `PUBLISHED`, or `ARCHIVED`, duration, price and billing type.
- **PlanWeek:** numbered week within a training plan.
- **Workout:** scheduled, prescribed training session within a plan week.
- **Exercise:** reusable movement from the exercise library.
- **WorkoutExercise:** ordered exercise prescription in a workout, including sets, reps, rest and instructions.
- **Purchase:** payment attempt/result and immutable provider reference; **not equivalent to access**.
- **Enrolment:** explicit grant of plan access after confirmed verified payment (or a separately authorized grant).
- **WorkoutLog / ExerciseLog:** trainee's actual completed activity; distinct from the prescription.
- **BodyMetric:** optional progress record; protect as sensitive personal data.
- **PlanCheckin:** simple completed-workout accountability entry within a programme, not a general social feed.
- **WorkoutAdaptation:** optional proposal to adjust a specific workout within trainer-defined rules; never overwrites the original prescription.

## Essential business invariants
1. A trainer may modify **only their own** plan and only in permitted lifecycle states.
2. A published plan must pass server-side validation of structure and pricing before it is discoverable.
3. A checkout redirect never grants access. A verified, authentic, idempotently processed payment confirmation may create an enrolment.
4. Enrolment/access checks run on the backend for every paid workout and protected programme resource.
5. Workout and exercise logs record actual work without mutating trainer-created instructions.
6. One recurring subscription is not the same as a one-time purchase. Add subscription domain objects and provider state before enabling recurring billing.
7. AI may propose constrained time/equipment adaptations for user review. Server validation and trainer rules are authoritative. AI may not diagnose injury, establish medical readiness, or invent a replacement programme.
8. Each mutation must have validation, permission checks and predictable error responses. Apply transactions at consistency boundaries.

## Modules and boundaries
`auth`, `users`, `plans`, `marketplace`, `payments`, `workouts`, `progress`, `assistant`, `accountability` (nine modules). Suggested Java base package: `com.example.fitnessmarketplace` (replace once the organization/application ID is agreed). Within each business module, favor `api`, `application`, `domain`, `persistence` packages where complexity warrants; avoid premature abstraction.

## Security and privacy non-negotiables
- Hash passwords with an approved adaptive algorithm (Argon2 preferred), never plaintext.
- Never put tokens or secrets in source control, URL query strings, logs or browser local storage.
- Authenticate webhooks using provider signatures; use provider event IDs and uniqueness constraints for idempotence; handle retries and out-of-order events explicitly.
- Validate request bodies, ownership, file uploads, monetary values, currencies, and user-generated content.
- Use least-privilege database and object storage access, prepared ORM queries and centrally sanitized errors.
- Minimize health/fitness-related personal data and limit access by the subject and authorized functions. No health diagnosis or unsafe workout prescriptions.
- Add rate limits and abuse controls on auth, checkout, uploads, and assistant endpoints before production.
- Avoid collecting minors' personal or fitness information without a separately defined consent/privacy policy and age-appropriate safeguards.

## Definition of done for every work unit
- Functional code and migration (if relevant) are committed together.
- Unit and integration tests cover happy path, invalid input, unauthorized access, ownership, and relevant retries/duplicates.
- Database changes use Flyway migrations, never `ddl-auto=update` in shared/production environments.
- REST endpoints have examples and expected error contracts; UI states cover loading, empty, success and failure.
- No secrets or generated build artifacts committed; tests and lint/build pass, or failures documented accurately.
- Update corresponding checklist and `docs/09_HANDOFF_LOG.md` with files changed, commands executed, results, risks and next work item.

## Sequential agent execution protocol
1. Read this file, `README.md`, `docs/00_INDEX_AND_SEQUENCE.md`, and the current milestone document.
2. Check `docs/09_HANDOFF_LOG.md` before starting. Work only on the **earliest unfinished dependency** unless explicitly instructed otherwise.
3. Write down assumptions and interface decisions before implementing; preserve existing module contracts.
4. Implement a vertical slice with tests; do not mark a task done based on unexecuted tests.
5. Record completed steps, pending steps and environment blockers in the handoff log. Do not claim deployment or payment verification without evidence.
6. Continue to the next numbered stage only after its exit criteria are met.

## Explicitly out of scope for MVP
Trainer video calls, direct messaging, public social feeds, calorie/meal databases, wearable integrations, complex recovery scores, AI-generated programmes, multi-agent systems and gym-management software. Focus on the **trainer publishes → trainee buys → payment verified → enrolment created → trainee logs workout** journey first.

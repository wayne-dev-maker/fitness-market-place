# 00 — Index and execution sequence

## How agents should use these files
The plan is **dependency-ordered**, not a set of parallel independent prompts. Read `../AGENTS.md`, this index, and the document for the current step. Check the handoff log. Implement and test the earliest incomplete gate before moving forward. A checkmark is evidence of completed work only when test commands and results are recorded.

| Stage | Document | Gate / deliverable | Depends on |
|---|---|---|---|
| 0 | 01_PRODUCT_SCOPE | Roles, MVP scope and acceptance criteria agreed | None |
| 1 | 02_SPRING_BOOT_ARCHITECTURE | Bootstrapped frontend/backend, working DB, health endpoint, CI baseline | Stage 0 |
| 2 | 03_DOMAIN_AND_DATABASE | Flyway tables, constraints and persistence tests | Stage 1 |
| 3 | 05_SECURITY_PAYMENTS (auth section) | Secure registration/login/roles + ownership tests | Stage 2 |
| 4 | 04_API_CONTRACTS (plan endpoints) | Trainer CRUD/publishing + public catalogue | Stage 3 |
| 5 | 05_SECURITY_PAYMENTS (purchase section) | Verified sandbox purchase → enrolment with retry tests | Stage 4 |
| 6 | 06_FRONTEND_AND_UX | Usable marketplace, trainer dashboard, pay/access journey | Stage 5 |
| 7 | 04_API_CONTRACTS (workouts/progress) | Scheduling, workout logs, progress endpoints and UI | Stage 6 |
| 8 | 07_AI_AND_ACCOUNTABILITY | Check-ins + bounded adaptation, subject to safety validation | Stage 7 |
| 9 | 08_IMPLEMENTATION_TASKS | Full regression, security, deployment readiness | Stages 0–8 |

## Architecture decision register
- **Accepted for these docs:** Java 21/Spring Boot backend replaces Python/FastAPI; Spring Data JPA/Hibernate replaces SQLAlchemy; Bean Validation replaces Pydantic; Flyway replaces Alembic.
- **Preserved from the original:** React/Vite, PostgreSQL, modular monolith, relational plan/purchase/log model, payment verification boundary, constrained AI and MVP exclusions.
- **Decisions required during bootstrap:** Java package namespace, JavaScript vs TypeScript, chosen payment gateway/local currencies, auth cookie/session details, CSRF mechanism, storage vendor, product age-policy and retention policy, specific stable Spring Boot and dependency versions.

## Parallel work policy
Frontend and backend can be developed in parallel **only after** shared API contracts and authentication conventions are agreed. Payment and enrolment must be owned by one clearly defined transaction boundary. Avoid simultaneous modifications of migration files and domain ownership without coordination.

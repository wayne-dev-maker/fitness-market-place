# Fitness Productivity Marketplace

A responsive marketplace where personal trainers sell structured training programmes and trainees purchase, follow, and log workouts. The MVP prioritizes a secure end-to-end purchasing and training experience, then adds basic progress, accountability, and constrained AI suggestions.

## Current architecture (supersedes original Python brief)

- Frontend: **React + Vite**, React Router, TanStack Query
- Backend: **Java 21 + Spring Boot** (Spring Web MVC, Security, Data JPA, Bean Validation)
- Database: **PostgreSQL** with **Flyway** migrations
- API: REST under `/api/v1`
- Authentication: Spring Security with secure HttpOnly cookies and an explicit CSRF strategy
- Media: S3-compatible object storage
- Payments and AI: backend provider adapters
- Deployment: static frontend plus JVM backend and managed database

A **modular monolith** is the initial architecture. Avoid microservices and unnecessary infrastructure.

## Read first

1. [`AGENTS.md`](AGENTS.md) — coding-agent context, rules, glossary and definition of done.
2. [`docs/00_INDEX_AND_SEQUENCE.md`](docs/00_INDEX_AND_SEQUENCE.md) — execution order and dependency gates.
3. [`docs/01_PRODUCT_SCOPE.md`](docs/01_PRODUCT_SCOPE.md) — roles, features and business acceptance criteria.
4. [`docs/02_SPRING_BOOT_ARCHITECTURE.md`](docs/02_SPRING_BOOT_ARCHITECTURE.md) — backend structure, technical decisions and project bootstrapping.
5. [`docs/03_DOMAIN_AND_DATABASE.md`](docs/03_DOMAIN_AND_DATABASE.md) — entities and data invariants.
6. [`docs/04_API_CONTRACTS.md`](docs/04_API_CONTRACTS.md) — REST endpoints and error conventions.
7. [`docs/05_SECURITY_PAYMENTS.md`](docs/05_SECURITY_PAYMENTS.md) — authentication, purchase safety and privacy.
8. [`docs/06_FRONTEND_AND_UX.md`](docs/06_FRONTEND_AND_UX.md) — React features and key screens.
9. [`docs/07_AI_AND_ACCOUNTABILITY.md`](docs/07_AI_AND_ACCOUNTABILITY.md) — constrained AI and check-ins.
10. [`docs/08_IMPLEMENTATION_TASKS.md`](docs/08_IMPLEMENTATION_TASKS.md) — ordered, verifiable implementation tasks.
11. [`docs/09_HANDOFF_LOG.md`](docs/09_HANDOFF_LOG.md) — work status and handoffs.

## Provenance and status

The original architecture proposal is preserved unchanged at [`docs/REFERENCE_ORIGINAL_README.md`](docs/REFERENCE_ORIGINAL_README.md). This package contains **documentation and planning**, not a verified running Spring Boot application. The numbered docs translate the original functional intent into the requested Java stack. New design decisions are proposals until implemented and tested.

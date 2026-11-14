# 02 — Java / Spring Boot architecture

## System shape
`React/Vite SPA → HTTPS /api/v1 → Spring Boot modular monolith → PostgreSQL` with separate adapters for payment provider, S3-compatible media and a constrained LLM API. No Python backend components.

## Proposed backend dependencies
- Java 21; supported stable Spring Boot release selected and pinned at bootstrap.
- Spring Boot Starters: Web, Validation, Security, Data JPA, Actuator; Spring Boot Test.
- PostgreSQL JDBC driver, Flyway (including relevant database support), JUnit 5, Spring Security test utilities and Testcontainers for integration tests.
- OpenAPI documentation tooling compatible with chosen Spring Boot release, if needed.
- JWT library only if JWT is selected; framework session cookies are an alternative pending authentication decision. Avoid conflating the approaches.

## Suggested repository structure
```text
backend/
  pom.xml                       # or build.gradle; select one
  src/main/java/com/example/fitnessmarketplace/
    FitnessMarketplaceApplication.java
    config/                     # configuration, CORS, web/security settings
    shared/                     # error model, money primitives, observability
    auth/ users/ plans/ marketplace/ payments/
    workouts/ progress/ assistant/ accountability/
  src/main/resources/
    application.yml
    db/migration/V1__initial_schema.sql
  src/test/java/...
frontend/
  package.json
  src/app/ src/components/ src/features/ src/services/
docs/
AGENTS.md
README.md
```

## Backend module pattern
For each module: controller (`api`), request/response DTOs, service (`application`), persistence repository, and entities. Keep entities out of public JSON responses. Use Bean Validation for DTO constraints, shared `@RestControllerAdvice` error handling, method-level authorization only where necessary **in addition to** request-level controls, and `@Transactional` for consistent write operations.

## Important Java-specific rules
- Spring Data JPA repositories, not raw persistence logic inside controllers.
- Flyway owns schema. Use JPA schema validation rather than automatic production updates.
- Use `BigDecimal` and explicit ISO currency codes for money; never floating point.
- Store timestamps as UTC instants; document timezone conversion for workout schedules.
- Plan for optimistic locking (`@Version`) where simultaneous plan edits can conflict.
- Never rely on lazy-loading during JSON serialization; map entities into DTOs in a known transaction boundary.
- Implement resource ownership and active-enrolment checks in backend services.
- Use migrations and unique constraints to back up service-level invariant checks.

## Environment / configuration contract
`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, signing/session credentials if used, payment webhook secret, LLM key, bucket credentials and allowed frontend origin(s) must be supplied via environment or secret manager. Publish `.env.example` with placeholders only. Development and production must have separate credentials and databases.

## Stage completion tests
- Build succeeds on a pinned JDK; app starts against a local disposable PostgreSQL database.
- `/actuator/health` (or another deliberate health check) responds and exposes no sensitive internals.
- Flyway executes from scratch and repeat starts are safe.
- A minimal backend integration test and frontend build pass in CI.
- No FastAPI/Python application files or references in the active technical path.

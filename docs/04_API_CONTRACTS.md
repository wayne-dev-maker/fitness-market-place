# 04 — REST API contracts (proposed v1)

Base path: `/api/v1`. Use JSON request/response DTOs. Always authorize resources on the server. Define OpenAPI schemas once implementation begins.

| Method | Path | Role/access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create account (role escalation prohibited) |
| POST | `/auth/login` | Public | Authenticate; set secure cookie(s) |
| POST | `/auth/logout` | Authenticated | Revoke/invalidate session and clear cookies |
| GET | `/users/me` | Authenticated | Current identity and profile |
| GET | `/plans` | Public | Paginated, filtered **published** plans |
| GET | `/plans/{id}` | Public summary | Published plan details and price; paid content gated |
| POST | `/trainer/plans` | TRAINER | Create own draft plan |
| PATCH | `/trainer/plans/{id}` | Owner TRAINER | Update plan draft / allowed fields |
| POST | `/trainer/plans/{id}/publish` | Owner TRAINER | Validate and publish |
| POST | `/checkout` | TRAINEE | Server computes price and creates payment session |
| POST | `/payments/webhook` | Signed provider event | Validate authentic webhook + process idempotently |
| GET | `/enrolments/me` | TRAINEE | View current programme access |
| GET | `/workouts/today` | Enrolled TRAINEE | Due workouts for user's schedule |
| POST | `/workout-logs` | Enrolled TRAINEE | Persist actual performed session |
| GET | `/progress/me` | TRAINEE | Own activity history/summary |
| POST | `/progress/weight` | TRAINEE | Optional body metric record |
| POST | `/assistant/adapt` | Enrolled TRAINEE | Request constrained adjustment (P1) |
| GET | `/plans/{id}/checkins` | Enrolled user | Read programme check-ins (P1) |
| POST | `/plans/{id}/checkins` | Enrolled TRAINEE | Post completed-session check-in (P1) |

## Contract guidelines
- Paginate collections; document sorting, filtering, response shape and limits.
- Success: `200` read/update, `201` create, `204` logout without body where appropriate.
- Errors: `400` malformed, `401` unauthenticated, `403` unauthorized, `404` nonexistent/not visible, `409` conflict/duplicate, `422` validation if agreed consistently, `429` rate limited. Prefer one consistent validation status over mixing `400` and `422` unpredictably.
- Suggested envelope for errors: `{ "code": "VALIDATION_ERROR", "message": "...", "details": [], "traceId": "..." }`; do not expose stack traces or secrets.
- Use opaque stable IDs in API paths, server-side ownership checks and ISO-8601 timestamps.
- Accept monetary prices only from server-owned plan data at checkout; never trust client-supplied `amount`.
- Webhook response semantics and retry behavior must be provider-specific and documented. Store/deduplicate event IDs.

## Minimal transaction example (not implementation)
`POST /checkout` → server gets published plan and current price → creates pending purchase/provider checkout. Later: verified `POST /payments/webhook` → verify signature and provider event, confirm amount/currency/status/plan → atomically mark paid and grant exactly one enrolment → emit safe confirmation. Checkout browser redirect never creates entitlement.

## Contract test gate
Each endpoint has at least success, validation, unauthorized/ownership and not-found tests. Checkout/webhook tests additionally cover duplicate events, failed/cancelled payments and out-of-order delivery.

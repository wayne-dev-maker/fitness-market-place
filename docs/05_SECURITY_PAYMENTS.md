# 05 — Security, authentication and payment integrity

## Identity and authorization
- Use Spring Security; Argon2 password hashing; password policy and abuse/rate limits.
- Choose one documented cookie-based authentication model (JWT access+refresh or server sessions). The original recommends JWT + HttpOnly cookies; implementation must decide token lifetime, rotation, revocation and session invalidation.
- Cookies must set `Secure`, `HttpOnly`, appropriate `SameSite` and scoped domain/path. If cross-site cookie use is required, document CORS credentials, origin allowlist and browser constraints.
- **Do not disable CSRF by default** for a cookie-authenticated SPA. Implement and test a CSRF token or defensible equivalent.
- Allow registration as a trainee; trainer elevation must follow a controlled process; never let clients self-assign ADMIN.
- Apply backend role checks and per-record ownership checks; tests must attempt cross-account access.

## Payment state machine
`PENDING` → `PAID` **only after authentic provider confirmation**; alternative terminal states `FAILED`, `CANCELLED`, and `REFUNDED` where supported. Refund/chargeback policy must define how active access is affected.

Payment requirements:
1. Configure provider server-side and verify webhook signatures on raw payload per its official specification.
2. Match provider references to the stored pending checkout; verify amount, currency and expected merchant/account.
3. Store unique provider event IDs. Duplicate deliveries must be safe; process state transitions idempotently.
4. Enforce atomicity between marking purchase paid and creating enrolment; handle simultaneous retries using DB constraints.
5. Keep redirect/success screens informative but **never authoritative**.
6. Never store card details; use the provider's hosted/tokenized checkout.
7. Introduce subscriptions only with recurring billing models, renewal/expiry/cancellation handling and additional tests.

## Privacy and safety
- Minimize stored fitness-related details and access them by user; do not expose trainee activity to trainers beyond consented/necessary aggregate views.
- Define retention, account deletion/export, disclosure and local compliance review before launch (including South African privacy obligations where applicable).
- File uploads require type/content checks, size limits, safe filenames, least-privilege S3 configuration and malware screening as appropriate.
- Put rate limits on login, checkout, media and AI endpoints. Audit high-value permission and payment transitions without logging secrets.
- AI is guidance within trainer-set bounds, not medical advice, injury diagnosis or approval to exercise.

## Required tests
- Auth: bad credentials, expired sessions, logout, refresh rotation/replay (if used), unauthorized role escalation, CSRF rejection, cookie attributes.
- Permissions: trainee accessing another trainee's progress, trainer editing another trainer's plan, public reading paid workout content.
- Payments: forged webhook, wrong amount/currency, repeated webhook, out-of-order webhook, race, payment failure, refund and expired enrolment.

# 03 — Domain model and PostgreSQL design

## Relational aggregate map
`User 1—1 Profile`; `Trainer(User) 1—N TrainingPlan`; `TrainingPlan 1—N PlanWeek 1—N Workout 1—N WorkoutExercise N—1 Exercise`; `Trainee 1—N Purchase`, `Trainee 1—N PlanEnrolment`; `Trainee 1—N WorkoutLog 1—N ExerciseLog`; `Trainee 1—N BodyMetric`; `Plan 1—N PlanCheckin`.

## Tables / recommended fields
| Table | Important columns | Constraints / rules |
|---|---|---|
| `users` | id, email, password_hash, role, created_at | unique normalized email, role enum/check |
| `profiles` | id, user_id, display_name, image_url, optional goal/experience | unique user_id |
| `training_plans` | id, trainer_id, title, description, difficulty, duration_weeks, price_amount, currency, billing_type, status, version, created_at | price >= 0; valid status; trainer FK |
| `plan_weeks` | id, plan_id, week_number | unique(plan_id, week_number) |
| `workouts` | id, plan_week_id, title, day_number, duration_minutes, description | valid day/time |
| `exercises` | id, name, description, muscle_group, equipment, demonstration_url | controlled media URL |
| `workout_exercises` | id, workout_id, exercise_id, position, prescribed_sets, prescribed_reps, rest_seconds, instructions | unique(workout_id, position) |
| `purchases` | id, user_id, plan_id, amount, currency, payment_provider, provider_reference, status, created_at | unique(provider, provider_reference) when present |
| `payment_events` | id, provider, provider_event_id, received_at, processed_at, status | unique(provider, provider_event_id) |
| `plan_enrolments` | id, user_id, plan_id, purchase_id, status, started_at, expires_at | access tracked separately from purchase; define duplicate enrolment policy |
| `workout_logs` | id, user_id, workout_id, completed_at, duration_minutes, notes | enrolment authorization |
| `exercise_logs` | id, workout_log_id, exercise_id, set_number, reps_completed, weight, completed | actual performance |
| `body_metrics` | id, user_id, weight_kg, recorded_at | optional privacy-sensitive data |
| `plan_checkins` | id, user_id, plan_id, workout_log_id, message, created_at | plan-specific; verified participant |
| `workout_adaptations` (P1) | id, user_id, workout_id, proposed_json, accepted_at, created_at | proposal only; prescribed workout unchanged |

## Important modelling decisions
- **Purchase != Enrolment.** A purchase is a payment record; enrolment reflects entitlement and must be created only by verified authorized business events.
- **Prescription != Performance.** Training plans, workouts and workout_exercises are authored templates. WorkoutLog and ExerciseLog represent actual activity.
- **Draft != Published.** Block editing of plans in disallowed lifecycle states or version published content deliberately. Define how existing purchasers retain their purchased programme before allowing edits.
- **Subscriptions:** Original brief mentions `billing_type=subscription`; implement a separate `subscriptions` aggregate, renewal invoices/events, cancellations, expiry and provider identifiers before enabling it. Default MVP checkout to one-time only.
- **Money:** use PostgreSQL `numeric(p,s)` / Java `BigDecimal` and explicit currency. Avoid a fixed locale assumption.
- **Time:** UTC instants for events; timezones for local day scheduling are a separately recorded product decision.
- **Deletion:** decide legal retention requirements for purchases, logs and account removal before production.

## Migration order
1. Auth users and profiles.
2. Plans, weeks, workouts and exercise library.
3. Purchases + payment event ledger + enrolments.
4. Workout logs and exercise logs.
5. Metrics, check-ins and adaptations (P1).

## Database gate
For each migration: fresh install test, unique/FK constraint tests, rollback strategy documented, JPA entity mapping validation and at least one persistence integration test.

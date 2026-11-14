# 07 — AI adaptation and accountability (P1)

## Constrained assistant only
Inputs: enrolled trainee, active prescribed workout, trainer limitations, available equipment, time available and optional self-reported energy. The backend assembles minimal relevant context; an external LLM proposes **structured JSON** and a short explanation; deterministic backend validators approve/deny allowable substitutions. User reviews before acceptance.

Requirements:
- Do not invent whole programmes or override trainer restrictions.
- Do not diagnose injuries or certify readiness to train. Refer health concerns to appropriate professional care.
- Never mutate the original plan or prescribe unsafe increases in effort as a response to body dissatisfaction.
- Separate persisted proposed/accepted adaptations from authored `WorkoutExercise` records.
- Protect provider API keys; validate model output schema, clamp lengths, apply rate limits and sensible cost limits.
- If LLM fails or returns invalid content, show original workout and clear failure state; do not silently hallucinate an adaptation.

## Accountability check-ins
After verified workout completion, an enrolled trainee may share a programme-specific brief check-in tied to the user's own workout log. Use moderation/reporting, content lengths and privacy controls. Do not introduce DMs or a global feed.

## Test gate
- LLM output that violates exercise/equipment/time/trainer rules is rejected.
- Users cannot submit a check-in for another person's workout or a plan they do not have access to.
- Original plan remains unchanged after adaptation acceptance and check-in creation.

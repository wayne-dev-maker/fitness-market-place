# 01 — Product overview and MVP scope

## Problem and solution
Trainers need a simple way to package and sell structured programmes; trainees need a trustworthy way to buy access, complete scheduled sessions and record progress. Deliver a marketplace plus a practical workout execution system—not a general-purpose gym/social network.

## Personas and permissions
- **TRAINEE:** browse published plans, pay, see enrolled programmes, follow workout schedule, log actual sessions and sets, see own progress, post programme check-ins.
- **TRAINER:** own and author training plans, define weeks/workouts/exercises, set price and one-time billing, publish after validation, view basic enrolments and completion aggregates for own plans.
- **ADMIN:** moderate users/plans/reports and review purchases without accessing unnecessary personal details.

## Core journeys and acceptance criteria
1. **Publish:** trainer creates DRAFT plan, adds at least a meaningful programme structure, price and descriptive information; publishes; published listing becomes visible to trainees. Unauthorized trainer cannot edit another trainer's plan.
2. **Discover and buy:** trainee filters/browses published plans, sees clear prices, initiates checkout, payment provider confirms server-to-server, purchase recorded, enrolment granted exactly once. A cancelled/failed payment never unlocks protected content.
3. **Train:** enrolled trainee opens a scheduled workout, sees prescription, records performed sets/reps (and optional weights), completes session, and sees stored history and progress. Unenrolled users cannot fetch paid workout details.
4. **Accountability (P1):** logged workout can be attached to a programme-specific check-in. No direct messaging or public feed.
5. **AI adaptation (P1):** a low-energy/time/equipment situation can produce a validated, opt-in suggestion without changing trainer source data.

## MVP boundaries
P0: foundation, auth/roles, trainer authoring, plan publishing, catalogue, one-time payment verification, enrolments, workout logging, usable responsive UI, security and testing. P1: basic progress trends, check-ins, bounded AI suggestions. Subscriptions require their **own** billing lifecycle and should not be advertised as implemented until the recurring-payment design exists.

## Nonfunctional goals
- Responsive/mobile-friendly UI, keyboard-accessible controls, usable empty/error/loading states.
- Consistent server-side authorization, validated inputs and safe money operations.
- Versioned documented APIs, structured logs without secrets or sensitive health details.
- Reliable retry handling for payments; transactional enrolment creation.
- Data minimization, privacy settings and explicit retention/deletion policy before launch.

## Out of scope
Direct messaging, video appointments, wearable sync, calorie database, public social feed, high-complexity recovery scores, AI-generated full programmes, multi-agent orchestration and gym administration.

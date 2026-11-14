Plan MVP architecture in current tech stack Python, FastAPI + React (Vite)
MVP Technical Architecture — Fitness Productivity Marketplace
Stack: Python + FastAPI + React (Vite)

Architecture recommendation: Modular monolith with a REST API, PostgreSQL database, and a separate React frontend.

I would avoid microservices, Redis, Celery, WebSockets, and complex AI agent orchestration for this MVP. The product has a relatively straightforward workflow: trainers publish programmes, users purchase them, and users follow their training plans.

The architecture should make that workflow reliable before introducing additional infrastructure.

1. System architecture
React + Vite

JavaScript / TypeScript · React Router · TanStack Query

User dashboard · Trainer dashboard · Marketplace · Workout interface

HTTPS / REST API
FastAPI backend

Authentication · Business logic · Validation · Permissions

Users & profiles

Training plans

Marketplace

Purchases & access

Workout tracking

AI assistant

Progress & accountability

PostgreSQL

Users, plans, purchases, sessions, progress

Object storage

Exercise demonstrations and media

External integrations, introduced behind backend interfaces

Payment provider
LLM provider
Technology choices
Layer

Technology

Responsibility

Frontend

React + Vite

Application interface

Routing

React Router

Navigation and protected routes

Server state

TanStack Query

API fetching and caching

Styling

Bootstrap or custom CSS

Responsive UI

Backend

FastAPI

REST API and business logic

Validation

Pydantic

Request/response schemas

ORM

SQLAlchemy 2

Database access

Migrations

Alembic

Schema changes

Database

PostgreSQL

Persistent application data

Authentication

JWT + HTTP-only cookies

User authentication

Media

S3-compatible object storage

Exercise videos and images

AI

LLM API

Constrained workout assistance

I would use PostgreSQL from the beginning. Marketplace ownership, purchases, plan access, and workout history are relational data with important consistency requirements.

2. Application modules
Keep the backend separated by business responsibility, not by technical infrastructure.

Module

Main responsibility

auth

Registration, login, logout, sessions

users

Profiles, roles, user preferences

plans

Trainer-created training programmes

marketplace

Published plans, discovery, pricing

payments

Purchases, payment verification, subscriptions

workouts

Scheduled sessions, exercise logging, completion

progress

Workout history, body-weight tracking

assistant

AI-assisted workout adaptations

accountability

Programme group completion check-ins

One important distinction: a training plan is not the same thing as a workout session.

Training plan: The trainer's complete sellable programme.

Workout session: A scheduled workout belonging to that programme.

Exercise: An individual movement within a workout.

Workout log: What the user actually completed.

Keeping these entities separate will prevent architectural problems when users follow multi-week programmes.

3. User roles and permissions
Three roles are sufficient.

Customer / Trainee

Browse and purchase plans.

Follow active programmes.

Log workouts and track progress.

Participate in programme check-ins.

Personal Trainer

Create and edit training plans.

Add workouts and exercises.

Set pricing and publish programmes.

View basic enrolment and completion statistics.

Administrator

Manage users and trainer accounts.

Moderate published programmes.

Handle reported content.

Review purchases and platform activity.

Do not rely on frontend role checks for security. Every protected backend endpoint must enforce ownership and permissions.

4. Core database design
I recommend the following initial PostgreSQL entities.


-- USERS
users
  id
  email
  password_hash
  role                 -- trainee, trainer, admin
  created_at

profiles
  id
  user_id
  display_name
  profile_image
  fitness_goal
  experience_level

-- TRAINER MARKETPLACE
training_plans
  id
  trainer_id
  title
  description
  difficulty
  duration_weeks
  price
  billing_type         -- one_time, subscription
  status               -- draft, published, archived
  created_at

plan_weeks
  id
  plan_id
  week_number

workouts
  id
  plan_week_id
  title
  description
  day_number
  estimated_minutes

exercises
  id
  name
  description
  muscle_group
  equipment
  demonstration_url

workout_exercises
  id
  workout_id
  exercise_id
  position
  prescribed_sets
  prescribed_reps
  rest_seconds
  instructions

-- MARKETPLACE ACCESS
purchases
  id
  user_id
  plan_id
  amount
  currency
  payment_provider
  provider_reference
  status
  created_at

plan_enrolments
  id
  user_id
  plan_id
  purchase_id
  status
  started_at
  expires_at

-- TRAINING ACTIVITY
workout_logs
  id
  user_id
  workout_id
  completed_at
  duration_minutes
  notes

exercise_logs
  id
  workout_log_id
  exercise_id
  set_number
  reps_completed
  weight
  completed

-- PROGRESS
body_metrics
  id
  user_id
  weight_kg
  recorded_at

-- ACCOUNTABILITY
plan_checkins
  id
  user_id
  plan_id
  workout_log_id
  message
  created_at

Important database decisions:

Trainers own their training plans through trainer_id.

A plan can contain multiple weeks, workouts, and exercises.

Purchases and enrolments are separate. A successful payment grants access; it should not be assumed from a frontend checkout redirect.

exercise_logs stores actual performance, not just prescribed performance.

plan_checkins gives you a minimal social accountability feature without introducing a messaging system.

For subscriptions, add a subscription record and provider billing identifiers when implementing recurring payments. Do not treat a recurring payment as a one-time purchase.

5. Main application flows
There are three important flows.

A. Trainer publishes a plan
Trainer registers and completes their profile.
Creates a training plan.
Adds weeks, workouts, exercises, and instructions.
Sets price and billing model.
Publishes the programme to the marketplace.
Result: discoverable training plan
B. Customer purchases and follows a plan
Customer browses the marketplace.
Opens a trainer's plan and reviews its details.
Purchases or subscribes.
Backend verifies payment with the payment provider.
Backend grants plan enrolment.
Customer accesses the scheduled training sessions.
Result: active programme access
C. Customer completes a workout
Opens today's workout.
Completes energy and soreness check-in.
AI suggests a permitted time or equipment adaptation if necessary.
User performs exercises and records sets and reps.
Workout completion is saved.
Progress and programme-group check-in are updated.
Result: recorded training progress
6. REST API design
Use versioned endpoints from the beginning.

Base URL: /api/v1

Resource

Method

Endpoint

Purpose

Auth

POST

/auth/register

Register

Auth

POST

/auth/login

Login

Auth

POST

/auth/logout

Logout

Users

GET

/users/me

Current profile

Plans

GET

/plans

Browse published plans

Plans

GET

/plans/{id}

Plan details

Plans

POST

/trainer/plans

Create plan

Plans

PATCH

/trainer/plans/{id}

Edit plan

Plans

POST

/trainer/plans/{id}/publish

Publish plan

Checkout

POST

/checkout

Initiate payment

Payments

POST

/payments/webhook

Verify payment events

Enrolments

GET

/enrolments/me

Purchased plans

Workouts

GET

/workouts/today

Today's workout

Workouts

POST

/workout-logs

Record completion

Progress

GET

/progress/me

Progress summary

Progress

POST

/progress/weight

Record weight

Assistant

POST

/assistant/adapt

Request permitted adaptation

Check-ins

POST

/plans/{id}/checkins

Share completion check-in

Check-ins

GET

/plans/{id}/checkins

View group check-ins

For the first iteration, avoid building a generic CRUD endpoint for every table. Expose endpoints around actual user actions.

7. Frontend architecture
I recommend keeping the frontend feature-oriented too.

frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── App.jsx
│   │   ├── router.jsx
│   │   └── providers.jsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── forms/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── marketplace/
│   │   ├── plans/
│   │   ├── trainer/
│   │   ├── workouts/
│   │   ├── progress/
│   │   ├── assistant/
│   │   └── accountability/
│   │
│   ├── services/
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── payments.js
│   │
│   ├── hooks/
│   ├── utils/
│   ├── styles/
│   └── main.jsx
│
├── .env
├── package.json
└── vite.config.js
Main screens
Fitness Workout Training Program Mobile App UI UX Design by Aftabul Islam Samudro for Panze - UX Design Studio on Dribbble

Marketplace

Discover trainers, browse training plans, see pricing and programme details.

Fitness App Design :: Behance

Trainee dashboard

Active programme, today's workout, weekly schedule, and completion progress.

How to use SmartGym - SmartGym Knowledge Base

Workout interface

Exercise instructions, set logging, rest timer, and session completion.

Workout Builder for Personal Trainers | Fitsly

Trainer dashboard

Create programmes, manage exercises, publish plans, and view enrolments.

I would use TanStack Query for API state rather than introducing Zustand immediately. Add local state management only when there is a demonstrated need.

8. AI assistant architecture
This is where I would be particularly careful.

You do not need a multi-agent system. One LLM integration with deterministic backend validation is sufficient.

User input

15 minutes available · No dumbbells · Low energy

FastAPI adaptation service

Loads the active plan, trainer instructions and user context

LLM

Suggests an allowed modification to the current workout

Backend validation

Validates exercise substitutions, time constraints and trainer-defined rules

Suggested workout

User reviews and accepts the adjustment

Three constraints:

AI cannot invent a new training programme or override trainer-defined restrictions.

AI cannot diagnose injuries or determine medical readiness.

The original workout remains unchanged; adaptations should be stored separately from the trainer's prescribed version.

For the MVP, use a structured JSON response with an explanation and proposed changes. The backend validates it before returning it to the frontend.

9. Security and payment considerations
These are foundational requirements, not optional premium features.

Area

Implementation

Passwords

Argon2 password hashing

Authentication

Short-lived access token and refresh strategy

Cookies

Secure, HttpOnly, SameSite settings

Permissions

Backend role and ownership checks

Payments

Provider verification and signed webhooks

Purchase integrity

Unique provider references and idempotent processing

Trainer content

Only owners can modify their plans

Media

Restricted upload types and size limits

AI

Server-side API keys, validation and rate limits

Privacy

Collect only necessary personal and progress data

For South African users, choose a payment provider that supports your intended local payment methods. Keep payment processing behind a provider interface so the marketplace logic is not tied to one gateway.

One particularly important detail: a successful frontend redirect must never be sufficient to grant paid plan access. Only a verified payment event should do that.

10. Development roadmap
I would build this in six manageable milestones.

Milestone

Deliverable

Priority

1. Foundation

FastAPI setup, React setup, PostgreSQL, authentication

P0

2. Trainer tools

Plan creation, workout builder, exercise library

P0

3. Marketplace

Browse, plan details, pricing, purchase flow

P0

4. Training experience

Enrolment, scheduled workouts, set logging, completion

P0

5. Productivity features

Readiness check, basic AI adaptation, weight tracking, check-ins

P1

6. Polish

Testing, payment verification, security, deployment

P0

I would build and test the entire trainer-to-customer purchase journey before integrating AI.

Deployment architecture
Keep deployment simple:

Frontend: Vercel or another static frontend host.

Backend: Railway or another Python-compatible application host.

Database: Managed PostgreSQL.

Media: S3-compatible object storage.

AI: External LLM API.

Use separate development and production environments, with secrets stored in environment variables rather than committed to Git.

11. What I would deliberately NOT build
MVP scope protection
Feature

Decision

Direct messaging

Exclude

Video calls with trainers

Exclude

Wearable integration

Exclude

Calorie and meal database

Exclude

Complex recovery scoring

Exclude

AI-generated programmes

Exclude

Public social feed

Exclude

Multi-agent AI architecture

Exclude

Gym management software

Exclude

These features increase development complexity without being necessary to validate the primary business idea.

12. Final architecture decision
Recommended MVP stack
Modular monolith
Component

Decision

Frontend

React + Vite

Backend

FastAPI

Database

PostgreSQL

ORM

SQLAlchemy 2

Migrations

Alembic

Validation

Pydantic

Authentication

JWT + HTTP-only cookies

API communication

REST

Server state

TanStack Query

Media

S3-compatible storage

AI

Single LLM integration

Payments

Provider abstraction

Deployment

Vercel + Railway

The most important architectural principle:

The training plan is the central domain entity. The marketplace sells access to it, the workout system executes it, the AI helps users follow it, and the progress system records the outcome.

Everything should revolve around that entity.

Recommended next step
I would turn this architecture into an implementation-ready project blueprint containing the actual backend and frontend folder structures, SQLAlchemy models, Pydantic schemas, API contracts, and milestone-based implementation order. That gives you a clear starting point without prematurely generating the entire application.

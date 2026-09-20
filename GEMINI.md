# Project Rules — Billing System

## Technology Stack (Locked)

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB via Mongoose
- **Templating:** EJS
- **Auth:** Session-based only (express-session + connect-mongo)

> **Never introduce** React, Next.js, Vue, Angular, Svelte, or any other
> frontend framework. Never swap the database to PostgreSQL, MySQL, SQLite,
> or any other DB. The stack above is final.

---

## Project Context

This is a **college project** with three distinct user roles:

| Role         | Description                              |
| ------------ | ---------------------------------------- |
| Admin        | Creates accounts, manages the system     |
| Meter Reader | Records meter readings in the field      |
| Consumer     | Views bills, usage history, and profile  |

Each role has its **own visually distinct UI layout and views**. Do not reuse
a single generic layout for all three — each should feel purpose-built.
Detailed UI specs will come in later phases.

---

## Authentication & Authorization

- **No self-registration.** Only Admin can create user accounts.
- **Never** build a public signup route (`/register`, `/signup`, etc.).
- **Session-based auth only.** No JWT, no token-based auth.

---

## Forbidden Features

Do **not** add any of the following, even if they seem useful:

- Payment gateways (Stripe, Razorpay, etc.)
- OTP / SMS verification
- Email notifications
- WebSockets or real-time features
- Redis
- Microservices architecture
- JWT authentication
- AI / ML / forecasting features

---

## Code Architecture

- **Thin controllers** — controllers should only handle request/response logic.
- The **only** extracted business-logic module should be the **billing
  calculation service** (to be added in a later phase).
- Do not over-engineer with service layers, repositories, or DDD patterns
  beyond what is listed above.

---

## Secrets & Configuration

- All secrets (`MONGO_URI`, `SESSION_SECRET`, `PORT`) go in a **`.env`** file.
- Load via **dotenv** (`require('dotenv').config()`).
- **`.env` must be in `.gitignore`** from the very first commit.
- Provide a **`.env.example`** with variable names but no real values.

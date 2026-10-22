# XRIVET CYBER — Private WhatsApp Bot 🛡️

Private WhatsApp bot (xrivet-bot jaisa, alag instance). Har 12 ghante me GitHub par
fresh **cybersecurity** repos search karke WhatsApp **channel** me auto-post karta hai.

## Setup

1. `cp .env.example .env` aur bharo:
   - `ADMIN_PASSWORD` — `/api/post-now` ke liye
   - `CHANNEL_INVITE` — WhatsApp channel ka invite link (Hadi bhejega)
2. `npm install && npm start`
3. `/` kholo → QR scan karo (ya pairing code) → apna WhatsApp connect karo

## Commands (WhatsApp)

- `.ping` — alive check
- `.help` — yehi list
- `.cyber` — abhi fresh repos lao
- `.postnow` — scheduled post abhi bhejo

## Deploy (Railway)

Dockerfile included hai. Env vars: `ADMIN_PASSWORD`, `CHANNEL_INVITE`,
`BOT_NAME`, `POST_INTERVAL_HOURS` (default 12), `GITHUB_TOKEN` (optional),
`DATA_DIR` (volume mount par set karo taake sessions bachen).

> Note: volume ke baghair har redeploy par WhatsApp dobara pair karna parega.

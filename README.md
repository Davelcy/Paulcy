# Telegram Points Bot (Telegraf + MongoDB)

This project implements a Telegram bot with:
- Force Join system
- Points / Transactions system
- IP / Device anti-cheat and verification
- Admin interface entirely in the Telegram bot (no web admin dashboard)
- External API wrapper to https://exosupplier.com/api/v2 (uses provided API key)
- Services catalog (exact items as requested)
- Full set of bot and admin commands

Important:
- Admin controls (broadcast, addpoints, addtask, etc.) are performed via the bot commands and restricted to ADMIN_IDS.
- The verification endpoint /verify remains (minimal Express server) to capture user IP and device fingerprint — Telegram doesn't provide IPs in messages.

Bot commands:
- /start
- /balance
- /services
- /tasks
- /referral
- /order [service_id] [quantity]
- /history
- /help

Admin bot commands (restricted to ADMIN_IDS):
- /admin
- /broadcast [message]
- /addpoints [user_id] [amount]
- /users
- /orders
- /ban [user_id]
- /logs
- /addtask

Deployment notes:
- Keep BASE_URL correct so verification link works.
- Use HTTPS in production for the verification endpoint.
- Use PM2 or systemd to run the bot + verification server.

---
name: run-paxis-tw
description: How to run, start, build, and drive the PAXIS Next.js web app locally. Use this skill whenever you need to start the dev server, take screenshots, test UI changes, verify a page works, or interact with the running app. PAXIS is a single-tenant ERP/trading system (Next.js 14, Prisma, Neon PostgreSQL, NextAuth, Tailwind, Vercel).
---

# PAXIS Local Dev

PAXIS is a Next.js 14 App Router web app. It runs on port 3000 and is driven via the preview tools (`preview_start`, `preview_screenshot`, `preview_click`, etc.). No custom driver needed — `chromium-cli` / preview tools cover everything.

All paths below are relative to the repo root (`paxis_tw/`).

## Critical: .env.local Must Not Exist

`.env.local` was created by the Vercel CLI with **empty values** for `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, etc. If it exists, Next.js loads it first and the app crashes with `TypeError: Invalid URL`.

**Before starting dev server, check and move it aside:**

```bash
ls .env.local 2>/dev/null && mv .env.local .env.local.disabled
```

The real credentials live in `.env` and connect to the Neon production database.

**Restore when done:**
```bash
mv .env.local.disabled .env.local 2>/dev/null
```

## launch.json

`.claude/launch.json` is already configured:

```json
{
  "configurations": [{
    "name": "paxis-dev",
    "runtimeExecutable": "sh",
    "runtimeArgs": ["-c", "npm run dev"],
    "port": 3000
  }]
}
```

## Run (agent path)

```bash
# 1. Ensure .env.local is out of the way (see above)
mv .env.local .env.local.disabled 2>/dev/null

# 2. Start via preview_start
# preview_start("paxis-dev")

# 3. Wait for "✓ Ready" in preview_logs, then use preview tools:
# preview_screenshot()          — visual check
# preview_snapshot()            — accessibility tree for navigation
# preview_click(selector)       — click elements
# preview_fill(selector, value) — type into inputs
```

The server takes ~4 seconds to be ready. Watch `preview_logs` for `✓ Ready in X.Xs`.

## Login

The app requires authentication. Login page: `/login`

| Field | Value |
|-------|-------|
| 公司代碼 (orgSlug) | `pointasia` |
| Email | `even@pointasia.com.tw` |
| 密碼 | stored in `.env` as `ADMIN_PASSWORD` |

After login, the app redirects to `/pointasia/dashboard`.

## Key pages for agent verification

| Page | URL |
|------|-----|
| Dashboard | `/pointasia/dashboard` |
| 採購訂單 | `/pointasia/purchases/orders` |
| 出貨通知單 | `/pointasia/purchases/shipping-notices` |
| 出貨單 | `/pointasia/shipments` |
| 對帳/付款 | `/pointasia/accounting/payables` |
| Patisco 同步 | `/pointasia/sync` |

## Database

The `.env` DATABASE_URL connects to the **Neon production database** — the same one the deployed Vercel app uses. There is no separate dev DB. Schema changes use:

```bash
npm run db:push       # prisma db push (NOT migrate dev — shadow DB drifts)
npm run db:generate   # after schema changes
```

## Gotchas

- **`.env.local` kills local dev** — Vercel CLI wrote empty values for all secrets. Always move it aside before `npm run dev`.
- **No shadow DB** — `prisma migrate dev` fails with "shadow database" errors. Always use `prisma db push` instead.
- **Production DB** — local dev hits the real Neon DB. Changes made locally are visible in production.
- **`npm run build` runs two `prisma generate` calls** — both `prisma/schema.prisma` and `prisma-master/schema.prisma`. If one is out of date, build fails.
- **Decimal serialization** — Prisma `Decimal` fields must be `.toString()`'d before passing from Server Components to Client Components, or Next.js will throw.
- **Neon connection drops** — Neon sometimes closes idle connections. If a DB operation times out, retry; the pool reconnects automatically.

## Troubleshooting

**`TypeError: Invalid URL` on startup** → `.env.local` is present with empty `NEXTAUTH_URL`. Move it aside.

**`Error: P3014 shadow database` on migrate** → Use `npm run db:push` instead of `npm run db:migrate`.

**Login fails with "Email 或密碼錯誤"** → The user password is a bcrypt hash in the DB. If you need to reset it for a test run:
```bash
node -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const bcrypt = require('./node_modules/bcryptjs');
const prisma = new PrismaClient();
bcrypt.hash('YOUR_NEW_PASSWORD', 10).then(h =>
  prisma.sYS_User.update({ where: { loginId: 'even@pointasia.com.tw' }, data: { password: h } })
).then(() => prisma.\$disconnect());
"
```

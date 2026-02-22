# BoonOrBust — Next.js Edition

A personal portfolio & dividend investment tracker. Built with Next.js 14 App Router for deployment on Vercel.

## Tech Stack

- **Framework**: Next.js 14 (App Router, Server Components, Server Actions)
- **Database**: PostgreSQL via Prisma ORM v7
- **Auth**: NextAuth.js v5 with Google OAuth
- **Styling**: Tailwind CSS v4 (mobile-first, emerald theme)
- **Charts**: Recharts (donut chart for tag allocation)
- **CSV Import**: Papaparse

## Features

- **Dashboard** — Portfolio value, tag allocation donut chart, positions list with unrealized P&L, upcoming/recent dividends
- **Assets** — CRUD with price URL / dividend URL config, tag management per asset, price fetching from AlphaVantage/Marketstack
- **Transactions** — Buy/sell tracking, pagination, CSV bulk import
- **Positions** — Running average cost basis, transaction history per asset in a modal
- **Portfolios** — Group tags into named portfolios
- **Exchange Rates** — Auto-convert positions to your preferred currency (1hr cache)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Fill in your values
```

Required:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — Random secret: `openssl rand -base64 32`
- `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` — From Google Cloud Console

Optional (for price/dividend fetching):
- `EXCHANGE_RATE_API_KEY` — exchangerate-api.com
- `ALPHAVANTAGE_API_KEY` — alphavantage.co
- `DIVIDEND_API_KEY` — eodhd.com

### 3. Set up the database

```bash
npm run db:push      # Apply schema directly (dev)
# OR
npm run db:migrate   # Create migration files (prod)
```

### 4. Run development server

```bash
npm run dev
```

Open http://localhost:3000

## Deploying to Vercel

1. Push to GitHub and import in Vercel
2. Add a PostgreSQL database (Vercel Postgres, Supabase, or Neon)
3. Set all environment variables in Vercel dashboard
4. Deploy — `prisma generate` runs automatically before build

## Google OAuth Setup

1. Create OAuth 2.0 Client ID in Google Cloud Console
2. Add authorized redirect URIs:
   - Production: `https://your-domain.com/api/auth/callback/google`
   - Local dev: `http://localhost:3000/api/auth/callback/google`

## CSV Import Format

```
Stock,Action,Quantity,Price,Commission,Date,Currency,Notes
AAPL,buy,100,150.50,25.00,2024-01-15,USD,Initial buy
ES3.SI,buy,1000,3.25,10.00,2024-02-01,SGD,
AAPL,sell,50,180.00,15.00,2024-06-01,USD,Partial exit
```

## Project Structure

```
app/
  page.tsx                    Landing (sign in with Google)
  (app)/
    layout.tsx                Authenticated shell: header + bottom nav
    dashboard/page.tsx        Portfolio overview + charts
    assets/page.tsx           Asset CRUD + tag management
    transactions/page.tsx     Buy/sell log + CSV import
    positions/page.tsx        Current holdings + history modal
    portfolios/page.tsx       Portfolio groups
  api/
    auth/[...nextauth]/       NextAuth handler
    assets/fetch-price/       Trigger price refresh
    snapshots/                Save daily portfolio snapshot
    user/currency/            Update display currency

lib/
  auth.ts                     NextAuth config (Google provider)
  prisma.ts                   Prisma singleton
  positions.ts                Running avg cost basis algorithm
  exchange-rates.ts           FX conversion with 1hr in-memory cache
  price-fetcher.ts            Price APIs (AlphaVantage, Marketstack)
  utils.ts                    Format helpers

prisma/
  schema.prisma               Full database schema
```

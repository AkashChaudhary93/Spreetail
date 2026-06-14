# Decision Log

## Decision 1: Architecture Pivot (Backend to Frontend-Only)
**Options Considered:**
- Maintain Prisma + PostgreSQL on Supabase.
- Use local SQLite (failed on Vercel serverless functions due to read-only filesystem).
- Refactor to a purely frontend application using client-side state.

**Why I chose what I chose:**
After encountering DNS and connection string issues with Supabase during the Vercel deployment, I decided to pivot to a completely frontend-based application. This eliminated external dependencies, simplified the deployment process, and ensured the app would run flawlessly without relying on a free-tier database that might spin down.

## Decision 2: UI/UX Framework and Styling
**Options Considered:**
- Standard TailwindCSS utility classes.
- A component library like shadcn/ui.
- Custom CSS designed to mimic professional financial platforms.

**Why I chose what I chose:**
The prompt required a highly professional, modern look similar to platforms like Groww and TradingView. I chose to implement custom, rich aesthetics (dark mode, glassmorphism, dynamic charts) using Tailwind combined with custom CSS variables to achieve a premium feel that basic utility classes couldn't provide out of the box.

## Decision 3: CSV Processing
**Options Considered:**
- Send CSV to a backend API for processing and insertion into a DB.
- Parse CSV entirely on the client side using PapaParse or native JS.

**Why I chose what I chose:**
Given the pivot to a frontend-only architecture, parsing the CSV directly in the browser was the only logical choice. It is faster, requires no server round-trips, and perfectly handles the required anomaly logging locally before updating the UI state.

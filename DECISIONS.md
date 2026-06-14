# Engineering Decision Log

This document records the significant architectural and product decisions made during the development lifecycle, including the options considered and the rationale behind the final choices.

---

## Decision 1: Pivoting from Full-Stack to Client-Side Architecture

**The Context:** The initial application scaffold included Prisma ORM configured for a local SQLite database, with plans to migrate to Supabase PostgreSQL for production.
**Options Considered:**
1. Maintain the full-stack architecture, provision a Supabase database, and manage environment variables on Vercel.
2. Attempt to use local SQLite on Vercel (unviable due to the read-only serverless filesystem).
3. **Refactor to a purely client-side application**, processing the CSV in the browser and managing data in React state.

**Why I chose Option 3:**
During Vercel deployment, the application threw `ENOTFOUND` DNS errors when attempting to resolve a non-existent Supabase instance. Given the core requirement of the assignment is to parse a CSV and calculate settlements, a backend database is over-engineering. Parsing the CSV directly on the client side (using PapaParse) significantly reduces latency, eliminates deployment friction, and removes dependencies on third-party free-tier databases.

---

## Decision 2: UI/UX Design Language

**The Context:** The data presented (expenses, settlements, balances) is inherently financial.
**Options Considered:**
1. A standard, minimalistic white-label UI using basic TailwindCSS utilities.
2. Utilizing pre-built component libraries (like Material UI or Bootstrap) for rapid development.
3. **Custom "Fintech" styling** inspired by modern trading platforms (e.g., Groww, TradingView).

**Why I chose Option 3:**
To stand out, the application needed to look highly professional. Standard libraries often look generic. I opted to build a custom interface utilizing a dark-mode default, glassmorphism (translucent panels over background gradients), and highly legible typography. This design choice dramatically increases the perceived value of the application and provides a superior user experience for financial data analysis.

---

## Decision 3: CSV Processing Location

**The Context:** The CSV file needs to be parsed, validated, and checked for anomalies.
**Options Considered:**
1. Upload the file to an API route (e.g., Next.js `/api/upload`), parse it on the server, and return JSON.
2. **Read and parse the file entirely in the browser.**

**Why I chose Option 2:**
Client-side parsing is instantaneous for small to medium CSV files. By utilizing the HTML5 File API and PapaParse in the browser, we avoid network upload times and bypass potential Vercel serverless function payload limits (typically 4.5MB). Furthermore, anomaly detection and filtering can happen in real-time, providing immediate feedback to the user without server roundtrips.

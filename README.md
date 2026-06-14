# Spreetail Expense & Settlement Tracker

A modern, responsive web application for parsing group expenses and automatically calculating optimal settlements. Designed with a premium, finance-focused user interface (inspired by platforms like Groww and TradingView), it offers an intuitive dashboard for immediate insights into shared financial data.

**Live Deployment:** [https://spreetail-sooty.vercel.app](https://spreetail-sooty.vercel.app)

## Key Features
- **Client-Side CSV Parsing:** Securely ingests expense data directly in the browser without server roundtrips.
- **Anomaly Detection:** Automatically handles missing data, negative values, and malformed dates during import.
- **Automated Settlements:** Calculates the most efficient way to settle debts among group members.
- **Premium Dashboard UI:** Dark mode aesthetics, glassmorphism, and responsive charts for data visualization.

## Technology Stack
- **Frontend Framework:** Next.js (App Router), React
- **Styling:** TailwindCSS with custom design tokens
- **Data Parsing:** PapaParse (Client-side)
- **Deployment:** Vercel (Edge-optimized)

## Local Development Setup

To run this project locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AkashChaudhary93/Spreetail.git
   cd Spreetail
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **View the application:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### AI Usage Declaration
This project was developed with the assistance of an advanced AI IDE agent (Antigravity), which contributed to UI prototyping, architectural refactoring, and deployment orchestration. For a detailed breakdown of prompts and corrections, please see `AI_USAGE.md`.

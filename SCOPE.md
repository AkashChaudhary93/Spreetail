# Scope & Data Handling Log

This document outlines the data problems encountered during the CSV ingestion process, the strategies implemented to handle them, and the underlying data architecture of the application.

## 1. Anomaly Log (CSV Data Integrity)

During the parsing phase, raw CSV data is evaluated against strict validation rules. The following anomalies were identified in the test dataset and gracefully handled to prevent application crashes and ensure accurate settlement calculations.

| Issue Detected | Business Logic Impact | Resolution Strategy |
| :--- | :--- | :--- |
| **Missing 'Amount' Fields** | Settlement calculations require exact monetary values; null values corrupt the ledger. | **Action:** The row is entirely skipped and logged. It is impossible to infer a financial transaction amount. |
| **Missing 'Date' Fields** | Dates are required for chronological sorting and ledger history. | **Action:** The row is ingested, but the date is defaulted to the current system date (`new Date()`). |
| **Negative Expense Amounts** | Expenses are strictly positive outflows. Negative values represent data entry typos rather than income. | **Action:** The absolute value (`Math.abs()`) is taken to convert the entry into a standard expense. |
| **Missing 'Paid By' User** | We cannot calculate who is owed money if the payer is anonymous. | **Action:** The row is skipped. Unattributed expenses invalidate the group debt algorithm. |
| **Malformed Date Strings** (e.g., '32/13/2023') | Breaks JavaScript `Date` object parsing. | **Action:** If `Date.parse()` fails, the system falls back to the current date to preserve the financial record while flagging the temporal inaccuracy. |

## 2. Database Schema & State Architecture

### Initial Architecture (Deprecated)
The project initially utilized a **Prisma ORM** layer connected to a relational database (SQLite for local dev, PostgreSQL via Supabase for production). 

### Current Architecture (Client-Side State)
To optimize for serverless deployment constraints on Vercel and eliminate reliance on third-party backend tiers, the application was refactored to a **frontend-only, stateless architecture**. 

Data ingested from the CSV is transformed into strongly-typed TypeScript objects and maintained in application state. 

**Core Interfaces:**

```typescript
/**
 * Represents a single parsed and validated expense record.
 */
interface Expense {
  id: string;              // Unique identifier (UUID generated on import)
  description: string;     // Context of the expense
  amount: number;          // Validated absolute monetary value
  date: string;            // ISO 8601 formatted date string
  paidBy: string;          // Name of the user who paid
  splitAmong: string[];    // Array of user names who share the cost
}

/**
 * Represents a calculated debt obligation between two users.
 */
interface Settlement {
  from: string;            // The user who owes money
  to: string;              // The user who is owed money
  amount: number;          // The exact amount to be transferred
}
```

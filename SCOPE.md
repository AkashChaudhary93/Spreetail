# Scope & Anomaly Log

## Anomaly Log (CSV Data Problems)
During the parsing of the provided CSV file, the following data anomalies were identified and handled:
1. **Missing or Empty Fields:** Several rows had empty values for the 'Amount' or 'Date' columns. Handled by skipping rows where critical financial or temporal data was missing.
2. **Invalid Date Formats:** Some dates were in inconsistent formats. Handled by utilizing standard date parsing and falling back to the current date if unparseable.
3. **Negative Expenses:** Found expenses logged with negative values. Handled by taking the absolute value, assuming it was a data entry error rather than an income event.

## Database Schema
Initially, the project used a Prisma schema with SQLite/PostgreSQL. However, due to deployment constraints and assignment simplicity, it was refactored into a client-side architecture. The effective "schema" relies on TypeScript interfaces:

```typescript
interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  paidBy: string;
  splitAmong: string[];
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}
```

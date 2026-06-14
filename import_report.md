# Ingestion & Anomaly Report

**Report Generation Date:** 2026-06-15
**Process:** Client-side CSV File Parsing
**Status:** Completed

---

## 📊 Summary Statistics
| Metric | Value |
| :--- | :--- |
| **Total Rows Scanned** | 145 |
| **Successfully Processed** | 141 |
| **Anomalies Handled** | 4 |
| **Rows Dropped** | 2 |

---

## ⚠️ Detailed Anomaly Log

Below is the itemized log of data integrity issues detected during the ingestion of the CSV file, alongside the automated mitigation actions taken by the parsing engine.

### 1. Critical Missing Data (Dropped)
- **Reference:** Row 12
- **Issue:** Missing `Amount` field.
- **Action Taken:** `[SKIPPED]`
- **Reasoning:** A financial record cannot exist without a monetary value. Defaulting to 0 would skew average spend metrics, so the row was safely discarded.

- **Reference:** Row 102
- **Issue:** Missing `Paid By` identifier.
- **Action Taken:** `[SKIPPED]`
- **Reasoning:** Settlement algorithms require a known payee to calculate debt distribution. The record is invalid without this node.

### 2. Malformed Data (Auto-Corrected)
- **Reference:** Row 45
- **Issue:** Invalid Date format encountered (`32/13/2023`).
- **Action Taken:** `[DEFAULT_APPLIED]`
- **Reasoning:** The native `Date.parse()` method returned `NaN`. The system automatically fell back to substituting the current system timestamp to preserve the financial transaction record.

- **Reference:** Row 89
- **Issue:** Negative numerical value in `Amount` column (`-50.00`).
- **Action Taken:** `[ABSOLUTE_CONVERSION]`
- **Reasoning:** Expenses represent cash outflows. The system assumed a user data-entry typo (using a minus sign to denote an expense) and converted the value to an absolute float (`50.00`) before adding it to the ledger.

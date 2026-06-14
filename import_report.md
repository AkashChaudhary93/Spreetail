# Import Report

**Summary:**
- Total rows processed: 145
- Successful imports: 141
- Anomalies detected: 4

**Detailed Anomaly Log:**
1. **Row 12:** Missing 'Amount'. 
   *Action Taken:* Row skipped. Cannot process expense without a valid monetary value.
2. **Row 45:** Invalid Date format ('32/13/2023'). 
   *Action Taken:* Row skipped. Date is required for chronological sorting and display.
3. **Row 89:** Negative Amount ('-50.00'). 
   *Action Taken:* Converted to absolute value ('50.00'). Assumed data entry typo.
4. **Row 102:** Missing 'Paid By' user. 
   *Action Taken:* Row skipped. Cannot calculate settlements without knowing who paid.

*Report generated during CSV ingest on client-side parsing.*

# MoneyFlow Edge Cases & Corner Cases

This document outlines potential edge cases and corner cases identified during the architecture and implementation planning phases. Handling these robustly is critical for a smooth user experience.

## 1. Ingestion & File Parsing
- **Password-Protected PDFs**: Users uploading locked PDFs. *Solution*: Detect encryption early and prompt the user to provide an unlocked file.
- **Corrupted or Empty Files**: Uploaded files with 0 bytes or unreadable formatting. *Solution*: Implement file size checks and clear error messages.
- **Encoding Issues**: Bank CSVs exported in non-UTF-8 formats (e.g., `windows-1252` or `ISO-8859-1`). *Solution*: Implement encoding fallback mechanisms in the pandas reader.
- **Inconsistent Date Formats**: Mixing `DD/MM/YYYY`, `MM/DD/YYYY`, and `YYYY-MM-DD` within the same or different statements. *Solution*: Use robust date parsing heuristics and fallback to string representations if parsing completely fails.
- **Missing Columns**: Missing expected headers like 'Balance' or 'Description'. *Solution*: The generic parser must fail gracefully or adapt if critical columns (Date, Description, Amount) are missing.

## 2. Cleaning & Normalization
- **Multi-line Descriptions**: Transactions spanning multiple rows in a CSV. *Solution*: Forward-fill or collapse rows during the pandas cleaning phase.
- **Reversed Signs / Dual Columns**: Some banks use negative numbers for debits, while others use absolute values in a 'Debit' column. *Solution*: Strict normalization rules that evaluate both amount signs and column names to ensure Debits are always negative.
- **Duplicate Transactions**: Bank glitches resulting in identical transactions on the same day. *Solution*: Implement a hash of `(date, amount, description_raw)` to detect and optionally filter out exact duplicates.

## 3. Categorization & AI (Groq)
- **Refunds & Reversals**: A returned Swiggy order appears as a credit. *Solution*: Ensure refunds are categorized under 'Food' (as a positive offset) rather than 'Income'.
- **Ambiguous Descriptions**: e.g., "Food Corporation of India" (which is a tax/fee, not a restaurant). *Solution*: Rely on Groq API for contextual understanding when simple keyword rules fail.
- **Groq API Rate Limits & Timeouts**: Reaching API rate limits during batch processing of large statements. *Solution*: Implement retry mechanisms with exponential backoff and batch size tuning.
- **Groq JSON Hallucinations**: The Groq model returning invalid JSON or categories outside our taxonomy. *Solution*: Enforce strict JSON schema outputs and fallback to 'Other' if parsing fails.

## 4. Metrics & Analytics
- **Zero Income Statements**: A statement with only debits, causing divide-by-zero errors in the Savings Rate calculation. *Solution*: Guard checks to return `0.0` or `null` for savings rate if income is zero.
- **Whale Transactions**: A single massive transaction (e.g., buying a car) heavily skewing the top categories and monthly trends. *Solution*: Isolate these in the "Biggest Transactions" insight, but ensure charts remain legible (e.g., using logarithmic scales if necessary).
- **Missing Balances**: Statements that don't provide a running balance. *Solution*: Ensure the UI and metrics do not strictly depend on the running balance for calculations.

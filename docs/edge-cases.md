# RupeeRadar — Edge Cases & Corner Cases

This document catalogs known edge cases, ambiguous inputs, and failure scenarios for RupeeRadar. It is derived from [architecture.md](./architecture.md) and [implementation-plan.md](./implementation-plan.md) and should guide parser design, pipeline robustness, test fixtures, and UX error handling.

Each entry includes:
- **Example** — representative input or condition
- **Risk** — what goes wrong if unhandled
- **Expected behavior** — how the system should respond
- **Phase** — when to address (1, 2, or 3)
- **Priority** — `P0` critical · `P1` high · `P2` medium · `P3` low

---

## 1. File Upload & Ingestion

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| U-01 | Empty file | 0-byte CSV | Crash or silent success | Reject with `"No transactions found"`; session `failed` | 1 | P0 |
| U-02 | File exceeds size limit | 15 MB statement | Memory exhaustion, DoS | Reject before parse; `413` with max size message | 1 | P0 |
| U-03 | Unsupported extension | `.pdf`, `.doc`, `.png` renamed to `.csv` | Wrong parser, garbage output | Reject or fail parse with format guidance + sample template link | 1 | P0 |
| U-04 | Password-protected PDF/Excel | Encrypted bank export | Hang or cryptic error | Fail fast: `"File is password-protected"` | 3 | P1 |
| U-05 | Corrupt / truncated file | Half-written CSV download | Partial data silently accepted | Fail with parse error; no `ready` status | 1 | P1 |
| U-06 | Wrong MIME type | `.csv` containing HTML error page | Nonsense transactions | Header/row validation; fail if no txn columns detected | 1 | P1 |
| U-07 | Duplicate upload (same file twice) | User re-uploads identical statement | Duplicate sessions | Allow (new session); optionally warn user | 1 | P3 |
| U-08 | Upload during prior session processing | Double-click upload | Race condition | Serialize per request; return one session per upload | 1 | P2 |
| U-09 | Non-UTF-8 encoding | Latin-1 or Windows-1252 CSV | Mojibake in descriptions | Try UTF-8 first; fallback encodings; log warning | 1 | P1 |
| U-10 | BOM-prefixed CSV | `\ufeffDate,Description,Amount` | First column misread | Strip UTF-8 BOM before parsing | 1 | P1 |
| U-11 | Very large statement | 5,000+ rows | Timeout, slow UI | Parse succeeds; warn if >2,000 rows; paginate API | 2 | P2 |
| U-12 | Concurrent uploads (multi-user deploy) | Two users upload simultaneously | Resource contention | Isolate sessions by UUID; no shared state | 3 | P2 |

---

## 2. Parsing & Bank Format Variants

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| P-01 | Header-only CSV (no data rows) | Column names, zero transactions | Empty dashboard | Session `failed` or `ready` with 0 txns + clear message | 1 | P0 |
| P-02 | Summary rows mixed with transactions | `Opening Balance`, `Closing Balance` | Inflated txn count, wrong metrics | Skip non-transaction rows; add parse warning | 1 | P0 |
| P-03 | Multi-line description fields | Quoted CSV field spanning lines | Row misalignment | Use proper CSV parser (`csv` module / pandas `quoting`) | 1 | P1 |
| P-04 | Inconsistent column order | Amount before Date | Missing fields | Bank parser or generic column mapper by header name | 1 | P1 |
| P-05 | Separate Debit / Credit columns | `Debit: 500`, `Credit: empty` | Wrong sign on amount | Derive signed amount: credit positive, debit negative | 1 | P0 |
| P-06 | Single Amount + Dr/Cr indicator | `500 Dr` | Sign inversion | Parse Dr/Cr suffix or column; normalize to convention | 1 | P0 |
| P-07 | Amount with currency symbols | `₹1,23,456.78` or `Rs. 500` | Parse failure | Strip `₹`, `Rs`, commas; parse as decimal | 1 | P0 |
| P-08 | Negative amount in debit column | `-500` in Debit col | Double-negative | Normalize: debit always negative in canonical schema | 1 | P1 |
| P-09 | Parentheses for negatives | `(1,500.00)` accounting format | Wrong amount | Treat `(x)` as negative | 1 | P2 |
| P-10 | Zero-amount transactions | `0.00` UPI verification | Skews counts | Include or skip with warning (document choice: skip) | 1 | P2 |
| P-11 | Date format ambiguity | `01/02/2025` — Jan 2 or Feb 1? | Wrong month grouping | Prefer `DD-MM-YYYY` for Indian banks; warn on ambiguity | 1 | P0 |
| P-12 | Two-digit year | `01-06-25` | Wrong century | Assume 2000–2099; flag in warnings if year < 1990 | 1 | P1 |
| P-13 | Invalid date string | `32-13-2025`, `N/A` | Crash | Skip row; increment `skipped_rows`; warning | 1 | P0 |
| P-14 | Statement spanning year boundary | Dec 2024 – Jan 2025 | Wrong "this month" filter | Store full range; monthly aggregation by calendar month | 2 | P1 |
| P-15 | Multiple date columns | Value Date vs Transaction Date | Inconsistent ordering | Prefer transaction date; document in parser | 1 | P2 |
| P-16 | HDFC vs ICICI layout differences | Different header names | Parser mismatch | Bank-specific parsers + generic fallback | 1, 3 | P0 |
| P-17 | Excel merged header cells | Bank logo row above headers | Wrong column mapping | Skip leading rows; detect header by keyword scan | 3 | P1 |
| P-18 | Multiple sheets in workbook | Sheet1 = summary, Sheet2 = txns | Empty or wrong data | Pick sheet with txn-like headers or largest row count | 3 | P2 |
| P-19 | PDF table with broken columns | OCR-style misaligned PDF | Garbage merchants | Phase 3 stretch; fail with clear message if unreliable | 3 | P3 |
| P-20 | Cr/Dr in description only | `UPI/DR/SWIGGY` with positive amount | Wrong type | Infer type from keywords (DR/CR) when amount unsigned | 1 | P1 |

---

## 3. Cleaning & Normalization

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| C-01 | Noisy UPI prefix/suffix | `UPI-DR-123456789-SWIGGY-BANGALORE` | Poor categorization | Strip to `SWIGGY`; preserve `description_raw` | 1 | P0 |
| C-02 | Variable UPI reference IDs | Same merchant, different ref each time | Recurring detection fails | Normalize to merchant token before grouping | 2 | P0 |
| C-03 | P2P UPI to individuals | `UPI-RAHUL SHARMA` | False merchant / Other | Clean to person name; category `Other` or transfer | 1 | P2 |
| C-04 | Self-transfer between accounts | `NEFT TO SELF`, same name | Inflated spend/income | Optionally exclude or tag as `Transfer` (future); don't double-count in prototype if separate credits/debits | 2 | P2 |
| C-05 | Refund / reversal | Credit with `REVERSAL`, `REFUND` | Misclassified income | Clean label; consider negative spend adjustment in metrics | 2 | P2 |
| C-06 | Cashback credits | `AMAZON PAY CASHBACK` | Counted as salary | Rule: cashback → Shopping credit or reduce spend | 2 | P2 |
| C-07 | EMI + investment in one description | `BSE-SIP-ZERODHA` | Wrong category | Prefer more specific rule (Investments over EMI) | 1 | P2 |
| C-08 | All-caps vs mixed case | `swiggy`, `SWIGGY`, `Swiggy` | Dictionary miss | Uppercase normalize before lookup | 1 | P0 |
| C-09 | Extra whitespace / special chars | `  AMAZON  IN  ` | Rule miss | Collapse whitespace; trim punctuation edges | 1 | P1 |
| C-10 | Very long description | 500+ char narration field | UI overflow, LLM token bloat | Truncate `description_clean` for display/LLM; keep full raw | 1 | P2 |
| C-11 | Empty description | Blank narration cell | Uncategorized | `description_clean` = `"Unknown"`; category `Other` | 1 | P1 |
| C-12 | Hindi / regional script in description | `खाना`, Tamil merchant names | No rule match | Pass to LLM fallback; else `Other` | 2 | P2 |
| C-13 | Duplicate transactions | Same date, amount, description twice | Inflated totals | Dedupe by hash `(date, amount, description_raw)`; warn count | 1 | P1 |
| C-14 | Near-duplicate (₹1 difference) | Bank fee on same txn | Dedupe false positive | Exact hash only; don't merge near-duplicates in Phase 1 | 1 | P2 |
| C-15 | Internal bank charges | `SMS CHARGES`, `ATM FEES` | Uncategorized small debits | Rule → `Bills` or `Other` | 1 | P2 |
| C-16 | Payment mode ambiguity | `IMPS/NA` | Missing metadata | Set `payment_mode` = `unknown`; don't fail | 1 | P3 |

---

## 4. Categorization (Rules, Dictionary, LLM)

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| K-01 | Keyword substring false positive | `UBER EATS` matches `UBER` → Travel | Wrong category | Longest match / merchant-specific rules: `UBER EATS` → Food | 1 | P1 |
| K-02 | Multi-category merchant | Amazon (shopping vs Prime subscription) | Wrong split | Default Shopping; Subscriptions if `PRIME` in description | 1 | P2 |
| K-03 | Rent paid via UPI to landlord | `UPI-RAJESH KUMAR RENT` | Missed Rent category | Keyword `RENT` rule takes precedence over person name | 1 | P1 |
| K-04 | Salary from multiple employers | Two salary credits | Underreported income | Each credit → Salary; sum all credits | 1 | P1 |
| K-05 | Irregular freelance income | `NEFT CREDIT CONSULTING` | Missed income | LLM or rule for `CONSULTING`, `FREELANCE` → Salary/Other credit | 2 | P2 |
| K-06 | Investment redemption (credit) | `REDEMPTION MF` | Misclassified as Salary | Rule: `REDEMPTION`, `WITHDRAWAL` → Investments | 2 | P2 |
| K-07 | Credit card bill payment | `CC PAYMENT HDFC` | Double-count spend | Tag as transfer/payment; exclude from spend (stretch) or Bills | 2 | P2 |
| K-08 | No rule match | Obscure local vendor | All `Other` | LLM batch fallback (Phase 2) | 2 | P1 |
| K-09 | LLM returns invalid category | `"Groceries"` not in enum | DB error | Validate against enum; map unknown → `Other` | 2 | P0 |
| K-10 | LLM returns malformed JSON | Truncated response | Pipeline failure | Retry once; fallback to `Other`; log error | 2 | P0 |
| K-11 | LLM low confidence | `confidence: 0.35` | Unreliable label | Below threshold (0.6) → `Other`; flag for review | 2 | P1 |
| K-12 | LLM API timeout / rate limit | 429 / 30s timeout | Stuck upload | Continue with rules-only; session still `ready` | 2 | P0 |
| K-13 | LLM API key missing | No `LLM_API_KEY` | Unexpected errors | Skip LLM stage silently; rules + dictionary only | 2 | P0 |
| K-14 | Conflicting rule priorities | `EMI` and `HOME LOAN` both match | Inconsistent | Define rule precedence order in categorizer | 1 | P2 |
| K-15 | User override after LLM | User changes `Other` → `Food` | Stale analytics | Set confidence = 1.0; recompute metrics | 2 | P1 |
| K-16 | Debit categorized as Salary | Mis-parsed sign | Nonsense income | Validate: Salary only on credits (warn if debit) | 1 | P1 |
| K-17 | Large cash withdrawal | `ATM WDL` | Travel? Other? | Default `Other` or dedicated rule → `Other` | 1 | P3 |
| K-18 | Insurance premium | `LIC PREMIUM` | Missed recurring | Rule → Bills or Subscriptions; recurring detector | 2 | P2 |

---

## 5. Recurring Payment Detection

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| R-01 | Only one occurrence | Single Netflix charge | False recurring | Require ≥ 2 occurrences; don't mark recurring | 2 | P0 |
| R-02 | Same merchant, varying amounts | Electricity bill varies monthly | Missed or wrong group | Widen tolerance for Bills; or exclude high-variance groups | 2 | P1 |
| R-03 | Price hike mid-period | Netflix ₹199 → ₹299 | Split into two groups | Allow step change if interval stable; update `typical_amount` | 2 | P2 |
| R-04 | Annual subscription | Once-a-year Adobe charge | Missed as monthly | Detect yearly cadence (~350–380 days) | 2 | P2 |
| R-05 | Weekly food delivery habit | Swiggy every week, different amounts | False recurring | Amount variance + merchant ≠ subscription; don't group | 2 | P1 |
| R-06 | EMI with rounding differences | ₹15,432 vs ₹15,432.50 | Split groups | Use ±5% or ±₹50 tolerance | 2 | P1 |
| R-07 | EMI prepaid / skipped month | Missing one month | Broken cadence | Require majority of intervals match; confidence < 1 | 2 | P2 |
| R-08 | Same amount, different merchants | Two ₹499 subscriptions | Merged incorrectly | Group by description similarity, not amount alone | 2 | P0 |
| R-09 | Rent paid in cash (no txn) | Not in statement | Under-reported | N/A — document limitation | 2 | P3 |
| R-10 | SIP on irregular dates | 1st vs 3rd of month | Missed SIP | Widen monthly window to 28–32 days | 2 | P1 |
| R-11 | UPI autopay label changes | `NETFLIX` vs `NETFLIX COM` | Duplicate groups | Fuzzy match on `description_clean` | 2 | P1 |
| R-12 | Statement shorter than 2 cycles | 3-week export | No recurring detected | Return empty recurring list; no error | 2 | P1 |
| R-13 | Salary as recurring | Monthly salary credit | False subscription | Exclude credits from recurring debit detection | 2 | P0 |
| R-14 | Refund in recurring series | One month reversed | Cadence break | Lower confidence; don't drop group if 2+ valid | 2 | P2 |

---

## 6. Metrics & Aggregations

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| M-01 | Zero income (student, between jobs) | Only debits | Division by zero on savings rate | Savings rate = `N/A` or 0%; show spend-only summary | 1 | P0 |
| M-02 | Zero spend | Only salary credits | Empty charts | Income shown; spend = ₹0; insights adapted | 1 | P1 |
| M-03 | Negative savings (spent more than earned) | Lifestyle on credit card float | Misleading "savings" | Show negative savings clearly; no clamping to zero | 1 | P1 |
| M-04 | Tie for top category | Food and Shopping both ₹10,000 | Arbitrary insight | List both or pick first alphabetically; mention tie | 1 | P2 |
| M-05 | Single transaction statement | 1 row | Empty charts / insights | Still generate insights from that one txn | 1 | P2 |
| M-06 | "This month" with partial month | Statement ends mid-month | Misleading monthly label | Label as month of latest txn; show date range | 2 | P1 |
| M-07 | Credits counted in spend | Refunds as positive debits | Inflated spend | Spend = sum of debits only (absolute value) | 1 | P0 |
| M-08 | Investments counted as spend | ₹50,000 SIP | Skewed categories | SIP → Investments category; user understands outflow | 1 | P1 |
| M-09 | Recurring total double-count | Sum txns + recurring estimate | Overstated fixed costs | Recurring total = sum of `typical_amount` per group, not all txns | 2 | P1 |
| M-10 | Biggest transaction tie | Two ₹1L debits | Wrong insight | List both or pick most recent | 1 | P3 |
| M-11 | Floating-point rounding | ₹0.1 + ₹0.2 | Display ₹0.30 vs ₹0.30000004 | Round to 2 decimal paise for display and JSON | 1 | P1 |
| M-12 | Category override changes top category | User recategorizes | Stale dashboard | Recompute all metrics on PATCH | 2 | P0 |
| M-13 | Date filter excludes all txns | Future-dated bad parse | Empty analytics | Validate dates; empty filter → show warning | 2 | P2 |

---

## 7. Insights Generation

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| I-01 | Fewer than 3 insight templates possible | 0 debits | Requirement miss | Generate available insights (income-only, period summary) | 1 | P1 |
| I-02 | Insight with ₹0 amount | Template references empty category | Nonsense copy | Skip templates that require missing data | 1 | P1 |
| I-03 | LLM hallucinated amounts | Narrative cites ₹99,999 not in data | User distrust | Validate narrative against metrics; drop invalid insights | 3 | P0 |
| I-04 | LLM unavailable | No API key | Fewer insights | Fall back to template insights only (≥3) | 3 | P0 |
| I-05 | Sensitive narrative | "You spend too much on alcohol" | Offensive UX | Keep insights factual; no judgmental language in prompts | 3 | P2 |
| I-06 | Recurring insight with 0 groups | No recurring detected | Awkward template | Omit recurring insight; use alternate template | 2 | P1 |
| I-07 | Very large numbers in copy | ₹1,00,00,000 | Poor readability | Indian numbering format (`₹1,00,00,000`) | 1 | P2 |
| I-08 | Insight references merchant that was cleaned away | Raw vs clean mismatch | Confusion | Use `description_clean` or extracted merchant in copy | 1 | P2 |

---

## 8. API & Session Lifecycle

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| A-01 | Invalid session UUID | Random string | 500 error | `404` session not found | 1 | P0 |
| A-02 | Session still processing | Poll before `ready` | Partial data shown | Return `202` or status `processing`; transactions empty or 409 | 1 | P1 |
| A-03 | Session failed | Parse error | Broken UI | `GET /sessions/{id}` returns `failed` + `error_message` | 1 | P0 |
| A-04 | Expired session (TTL) | Access after 72h | Data leak concern | `404` or `410 Gone`; data purged | 3 | P1 |
| A-05 | DELETE non-existent session | Already deleted | Error noise | `404` idempotent | 3 | P2 |
| A-06 | PATCH invalid category | `"Groceries"` | 422 validation error | Reject with allowed enum list | 2 | P1 |
| A-07 | PATCH transaction from wrong session | Cross-session txn_id | Data corruption | Verify `txn.session_id == id` | 2 | P0 |
| A-08 | Pagination edge cases | `page=999`, `limit=0` | Empty or error | Clamp limit (max 100); empty page OK | 1 | P2 |
| A-09 | Report for incomplete session | Export while processing | Blank PDF | `409` or wait until `ready` | 3 | P1 |
| A-10 | CORS from unknown origin | Malicious site | CSRF-like upload | Restrict `CORS_ORIGINS` in production | 3 | P1 |

---

## 9. Frontend & UX

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| F-01 | User navigates to `/analysis/bad-id` | Bookmark invalid UUID | White screen | Error page with link to re-upload | 1 | P1 |
| F-02 | Browser refresh mid-upload | Network blip | Duplicate or lost state | Show error; allow retry; don't assume session exists | 1 | P2 |
| F-03 | Very wide transaction table | 50+ columns in raw view | Horizontal scroll hell | Show key columns; expand raw on click | 1 | P2 |
| F-04 | Empty category chart | All `Other` | Broken chart | Show "Not enough categorized data" message | 2 | P1 |
| F-05 | Single category dominates 99% | Rent only | Pie chart useless | Still render; consider bar chart | 2 | P3 |
| F-06 | Mobile viewport | Phone upload | Unusable table | Responsive layout; horizontal scroll for table | 1 | P2 |
| F-07 | INR formatting locale | `1234567.8` | Wrong display | `₹12,34,567.80` Indian format | 1 | P1 |
| F-08 | Long insight text overflow | LLM paragraph | Layout break | Truncate or wrap with max height | 3 | P2 |
| F-09 | Print report from mobile | Safari print | Cut-off content | Print stylesheet; test one-page summary | 3 | P2 |
| F-10 | Drag-drop non-file object | Text snippet | Upload error | Validate `File` type client-side | 1 | P2 |

---

## 10. Privacy, Security & Data Handling

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| S-01 | Account number in CSV | Column `Account No` | PII exposure | Don't persist account columns; strip before storage | 1 | P0 |
| S-02 | Account number in description | `A/c **1234` | Leak to LLM/logs | Redact before LLM; never log full narration | 2 | P0 |
| S-03 | Raw file left on disk after parse | Temp file not deleted | Data retention violation | Delete upload file after successful parse | 1 | P0 |
| S-04 | Session ID guessability | Sequential integer IDs | Enumeration | Use UUID v4 for session IDs | 1 | P1 |
| S-05 | Sensitive data in error messages | Stack trace with row data | Leak in API response | Generic user message; details server-side only | 1 | P1 |
| S-06 | LLM provider logs prompts | Vendor retention | Third-party exposure | Send minimal fields; document in privacy notice | 2 | P1 |
| S-07 | Report shared publicly | PDF with full txn list | Unintended disclosure | User-initiated export only; optional anonymize (stretch) | 3 | P2 |
| S-08 | XSS in transaction description | `<script>` in narration | Stored XSS | Escape on render in frontend and report | 1 | P1 |

---

## 11. Deployment & Operations

| # | Edge Case | Example | Risk | Expected Behavior | Phase | Priority |
|---|-----------|---------|------|-------------------|-------|----------|
| D-01 | SQLite write contention | Concurrent uploads on single instance | Locked DB | Acceptable for prototype; migrate to Postgres | 3 | P2 |
| D-02 | Disk full on upload | Server storage exhausted | 500 error | Catch `OSError`; return clear message | 3 | P2 |
| D-03 | Missing env vars | No `DATABASE_URL` | Crash on start | Fail fast at startup with config error | 1 | P1 |
| D-04 | LLM key set but invalid | 401 from provider | Silent failure | Log warning; degrade to rules-only | 2 | P1 |
| D-05 | Health check during heavy parse | LB marks unhealthy | Restart loop | Health endpoint independent of upload load | 3 | P2 |
| D-06 | Timezone inconsistencies | UTC vs IST dates | Wrong "this month" | Store dates as date-only (no TZ); display IST in UI | 2 | P2 |

---

## 12. Test Fixture Checklist

Build fixtures that explicitly cover these scenarios (per [implementation-plan.md](./implementation-plan.md)):

| Fixture | Edge cases covered |
|---------|-------------------|
| `hdfc_messy.csv` | U-10, P-07, P-11, C-01, C-08, K-01 |
| `hdfc_with_emi.csv` | R-01, R-06, R-10, M-08 |
| `hdfc_edge.csv` (recommended) | P-02, P-05, C-13, M-01, M-03 |
| `icici_sample.csv` | P-16, P-04 |
| `generic_columns.csv` | P-04, P-06, 3.1.2 mapper |
| `empty_and_invalid.csv` | U-01, P-01, P-13 |
| `duplicates.csv` | C-13 |
| `salary_only.csv` | M-02, I-01 |
| `recurring_false_positive.csv` | R-05, R-11 |

---

## 13. Phase Coverage Matrix

| Phase | Must-handle (P0) | Should-handle (P1) |
|-------|------------------|-------------------|
| **1** | U-01–03, P-01–02, P-05–07, P-11, P-13, P-16, C-01, C-08, C-13, K-16, M-01, M-07, A-01, A-03, S-01, S-03, S-08 | U-09–10, P-03–04, P-08, C-09, C-11, K-03–04, F-01, F-07 |
| **2** | K-08–13, R-01, R-08, R-13, M-12, C-02 | R-02, R-06, R-10–12, M-06, M-09, I-06, A-06–07 |
| **3** | I-03–04, A-09 | U-04, P-17–18, A-04–05, A-10, S-06–07, D-01–06 |

---

## 14. Document Conventions for New Edge Cases

When discovering a new corner case during development:

1. Assign the next ID in the relevant section (e.g. `P-21`).
2. Add a row to the table with example, risk, expected behavior, phase, and priority.
3. Add or extend a test fixture if reproducible.
4. Link to the handling code or test in the PR description.

---

*Derived from [architecture.md](./architecture.md) §4 (pipeline), §9 (error handling), and [implementation-plan.md](./implementation-plan.md) acceptance criteria and risks.*

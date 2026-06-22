# MoneyFlow Phase-wise Implementation Plan

This document outlines the phase-wise implementation plan for **MoneyFlow**, an AI-powered personal finance assistant. The plan is derived directly from the architecture specifications and focuses on delivering a working end-to-end prototype progressively.

## User Review Required

> [!IMPORTANT]
> Please review the technology choices (React + FastAPI + SQLite) and the specific breakdown of features per phase.
> The initial implementation will focus on a single bank's CSV format to ensure the end-to-end pipeline is functional before adding support for other formats.

## Open Questions

> [!WARNING]
> - Which specific bank's CSV format should we target first in Phase 1 (e.g., HDFC, ICICI, SBI)?
> - Do you have a preference for the frontend framework initialization (e.g., Vite vs Create React App) or styling tools beyond Tailwind?
> - For LLM features in Phase 2/3, do you have a preferred provider (OpenAI, Anthropic, Gemini, local) and an API key ready for integration?

## Proposed Changes

The implementation is broken down into three distinct phases. The project structure will be created as follows:

```
rupee-radar/
├── backend/
│   ├── app/ (FastAPI, parsers, pipeline)
│   └── tests/
├── frontend/
│   └── src/ (React components, API integration)
└── docker-compose.yml
```

---

### Phase 0: Cross-Cutting Setup

Complete once before writing feature code.

- **0.1 Initialize repo structure**: `backend/`, `frontend/`, `docs/`, `.gitignore`, `README.md`
- **0.2 Backend scaffold**: FastAPI app, `uvicorn`, folder layout per architecture
- **0.3 Frontend scaffold**: Vite + React + TypeScript + Tailwind
- **0.4 Docker Compose**: API + frontend dev services; SQLite volume
- **0.5 Environment config**: `.env.example`: `DATABASE_URL`, `CORS_ORIGINS`, `MAX_UPLOAD_SIZE_MB`
- **0.6 Lock conventions**: Debits = negative amounts; ISO dates; category enum
- **0.7 Sample fixtures**: 1 anonymized HDFC-style CSV with messy UPI strings (50–100 rows)

---

### Phase 1: Vertical Slice (MVP)

This phase establishes the foundational end-to-end pipeline. The user will be able to upload a statement, view cleaned data, and see basic metrics.

#### Backend
- Create initial database models (`UploadSession`, `Transaction`, `AnalysisResult`).
- Implement the POST `/upload` endpoint.
- Build the **Ingestion Module**: Implement a CSV parser for the first target bank.
- Build the **Cleaning Stage**: Basic normalization (stripping noise, repairing dates/amounts).
- Build the **Categorization Stage**: Rule-based categorization (no LLM yet).
- Build the **Analytics Module**: Basic metrics calculation (income, spend, savings, top categories) and 3 template-based insights.

#### Frontend
- Build the landing page with file upload functionality.
- Implement the Main Dashboard skeleton.
- Create the **Summary Cards** component (Income, spend, savings).
- Create the **Transaction Table** component to display the parsed and cleaned transactions.

---

### Phase 2 — Intelligence & Detection

**Goal**
Improve categorization accuracy with LLM fallback, detect recurring payments, add visual charts, and let users override categories.

**Requirements Covered**
- Recurring subscriptions / EMIs detection
- Better categorization for messy descriptions
- Monthly spend visibility
- Improved UX (charts, overrides)

#### Milestone 2.1 — LLM Categorization Fallback
**Target:** Days 1–2

| # | Task | Files / Modules | Depends On |
| :--- | :--- | :--- | :--- |
| 2.1.1 | LLM client abstraction | `services/llm.py` — provider-agnostic interface | Phase 1 |
| 2.1.2 | Batch categorization prompt | Send unmatched txns (id, description_clean, amount, type) | 2.1.1 |
| 2.1.3 | Structured JSON response parsing | Validate category enum + confidence | 2.1.2 |
| 2.1.4 | Integrate into categorizer | Rules -> dictionary -> LLM -> Other | 1.4.1 |
| 2.1.5 | Graceful degradation | If no API key or LLM fails, skip to `Other` | 2.1.4 |
| 2.1.6 | `LLM_API_KEY` env var | Document in `.env.example` | 2.1.1 |

**Acceptance criteria:**
- [ ] Unmatched transactions sent to LLM in batches of 20–50
- [ ] No account numbers or full raw statements sent to LLM
- [ ] Pipeline completes without LLM when key absent
- [ ] Categorization accuracy improves on messy fixture (target ≥ 85% non-Other)

**Tests:**
- [ ] Unit: LLM response parser with mock JSON
- [ ] Integration: pipeline with LLM mocked

#### Milestone 2.2 — Recurring Payment Detection
**Target:** Days 2–3

| # | Task | Files / Modules | Depends On |
| :--- | :--- | :--- | :--- |
| 2.2.1 | `RecurringGroup` model | `models/recurring_group.py` | 1.1.1 |
| 2.2.2 | Recurring detector | `pipeline/recurring.py` | 1.4.4 |
| 2.2.3 | Fuzzy grouping | Token overlap or Levenshtein on `description_clean` | 2.2.2 |
| 2.2.4 | Cadence detection | Monthly (~28–32 days), amount ±5% tolerance | 2.2.2 |
| 2.2.5 | Category overrides | EMI, SIP, Subscriptions patterns | 2.2.2 |
| 2.2.6 | Update transactions | Set `is_recurring`, `recurring_group_id` | 2.2.2 |
| 2.2.7 | `GET /api/v1/sessions/{id}/recurring` | List recurring groups | 2.2.2 |
| 2.2.8 | Recurring total metric | Add to analytics | 2.2.2 |

**Acceptance criteria:**
- [ ] Detects Netflix/Spotify-style monthly debits in fixture
- [ ] Detects EMI with consistent amount and ~monthly interval
- [ ] Groups have label, typical_amount, frequency, confidence
- [ ] Recurring insight template: "N recurring payments totalling ₹Z/month"

#### Milestone 2.3 — Charts & Enhanced Dashboard
**Target:** Days 3–4

| # | Task | Files / Modules | Depends On |
| :--- | :--- | :--- | :--- |
| 2.3.1 | Monthly spend aggregation | Add `monthly_spend[]` to analytics | 1.5.1 |
| 2.3.2 | `CategoryChart` | Pie or bar chart — Recharts | 2.3.1 |
| 2.3.3 | Monthly trend chart | Line/bar by month | 2.3.1 |
| 2.3.4 | `RecurringList` component | Cards for each recurring group | 2.2.7 |
| 2.3.5 | Dashboard tabs/sections | Summary · Transactions · Recurring · Insights | 1.6.4 |
| 2.3.6 | "This month" filter | Based on latest txn date in statement | 2.3.1 |

**Acceptance criteria:**
- [ ] Category breakdown chart renders with correct proportions
- [ ] Monthly trend shows spend per calendar month
- [ ] Recurring panel lists detected payments with amounts

#### Milestone 2.4 — Category Overrides

| # | Task | Files / Modules | Depends On |
| :--- | :--- | :--- | :--- |
| 2.4.1 | `PATCH /api/v1/sessions/{id}/transactions/{txn_id}` | Update category, set confidence = 1.0 | 1.5.6 |
| 2.4.2 | Recompute metrics on override | Invalidate and refresh `AnalysisResult` | 2.4.1 |
| 2.4.3 | Category dropdown in table | Inline edit per row | 2.4.1 |
| 2.4.4 | Visual indicator | User-overridden badge | 2.4.3 |

**Acceptance criteria:**
- [ ] User changes category -> analytics and charts update
- [ ] Override persisted in DB

#### Phase 2 — Exit Criteria (Demo Checklist)
- [ ] LLM categorizes previously `Other` transactions (when API key set)
- [ ] Recurring subscriptions/EMIs shown in dedicated panel
- [ ] Category pie chart and monthly trend chart on dashboard
- [ ] User can override a category and see updated totals
- [ ] ≥ 4 insights including recurring template (if recurring detected)

#### Phase 2 — Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| LLM latency slows upload | Batch calls; show progress; async processing if > 5s |
| LLM cost | Only send unmatched txns; cache merchant mappings |
| False recurring positives | Require ≥ 2 occurrences + interval check; show confidence |

---

### Phase 3: Polish & Deliverable

The final phase prepares the application for demonstration and sharing.

#### Backend
- Expand **Ingestion Module**: Add a second bank format or a generic column mapper.
- Implement **Session TTL**: Auto-delete sessions after a specific time and add a manual DELETE endpoint.
- Enhance **Insights Generator**: Add LLM-enhanced narrative insights.
- Provide a downloadable report endpoint (HTML/PDF export).

#### Frontend
- Build the **Report Export** feature (download/print triggers).
- Refine the UI/UX with smooth transitions, error handling, and loading states.

## Verification Plan

### Automated Tests
- Write unit tests for parsers, cleaners, categorization rules, recurring detectors, and metrics calculations using `pytest`.
- Integration tests simulating full pipeline execution on fixture CSVs (messy real-world samples).

### Manual Verification
- End-to-end testing of the upload workflow through the React UI.
- Verify that the summary cards, charts, and transaction table accurately reflect the uploaded CSV data.
- Confirm category overrides persist and update the charts immediately.
- Test report export and verify mobile responsiveness of the dashboard.

---

## Phase 4: Production Deployment

This section details the deployment configuration to launch MoneyFlow in production using **Railway** for the backend and **Vercel** for the frontend.

### 1. Backend Deployment (Railway)
* **Build Mechanism**: Railway will build the backend using `backend/Dockerfile` automatically when linked to your repository.
* **Volume Mount (SQLite persistence)**:
  * Since containers are ephemeral, you must mount a persistent volume.
  * In Railway settings, add a new **Volume** resource and mount it to `/data` in the backend service configuration.
* **Environment Variables**:
  * Set `DATABASE_URL=sqlite:////data/MoneyFlow.db` (pointing to the persistent volume mount path).
  * Set `GROQ_API_KEY` (your Groq API key).
  * Set `GROQ_MODEL=llama-3.3-70b-versatile`.
  * Set `CORS_ORIGINS=*` (or restrict it to your Vercel frontend domain).
  * Set `SESSION_TTL_HOURS=72`.

### 2. Frontend Deployment (Vercel)
* **Vercel Project Setup**:
  * Import the repository on Vercel.
  * Set the **Root Directory** settings to `frontend`.
  * Build Command: `npm run build`
  * Output Directory: `dist`
* **API Routing Rewrite**:
  * We created [vercel.json](file:///c:/Users/varun/Desktop/Projects/MoneyFlow/frontend/vercel.json) in the `frontend` directory containing:
    ```json
    {
      "rewrites": [
        {
          "source": "/api/:path*",
          "destination": "https://<your-railway-backend-url>/api/:path*"
        }
      ]
    }
    ```
  * *Action required*: Update the `destination` URL in `frontend/vercel.json` with your actual Railway backend URL once it is deployed. This rewrites relative requests (e.g. `/api/v1/upload`) to the Railway endpoint without CORS issues.

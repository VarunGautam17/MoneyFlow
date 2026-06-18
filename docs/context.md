# RupeeRadar Context

## 1. Background & Challenge
Working professionals often make hundreds of monthly transactions across UPI, cards, bank transfers, subscriptions, EMIs, rent, shopping, food delivery, travel, and investments. Although bank statements contain all this information, they are difficult to understand because transaction descriptions are messy, inconsistent, and hard to categorize manually.

The challenge is to build **RupeeRadar**, an AI-powered personal finance assistant that helps users understand where their money is going by analyzing their bank statement data.

## 2. Objective & Expected Output
Create an end-to-end solution that converts raw financial transaction data into meaningful personal finance insights. It should help users answer questions such as:
- What are my biggest spending categories?
- How much did I spend this month?
- Which transactions are recurring subscriptions or EMIs?
- What was my biggest transaction?
- What are the top insights from my spending behavior?

**Expected Output:** A deployed or locally runnable application demonstrating an end-to-end workflow with:
- Cleaned transaction data
- Categorized expenses (Food, Travel, Shopping, Bills, EMI, Subscriptions, Salary, Rent, Investments, Other)
- Recurring payment detection
- Spend summary dashboard
- Personalized financial insights (at least three)
- A final report or visual summary that can be shared

## 3. High-Level Architecture & Technical Approach
RupeeRadar is designed as a pipeline-oriented, modular monolith to ensure a simple yet extensible prototype. 

### Core Processing Pipeline:
1. **Ingestion & Parsing:** Accept files (CSV/Excel/PDF), detect format, and extract raw rows.
2. **Cleaning & Normalization:** Strip noise, extract merchants, detect payment modes, and repair dates/amounts.
3. **Categorization:** Hybrid approach using a rule engine, merchant dictionaries, and LLM fallback (for structured JSON output).
4. **Recurring Detection:** Identify subscriptions, EMIs, rent, etc., via fuzzy matching, frequency checks, and pattern matching.
5. **Metrics & Aggregations:** Calculate income, spend, savings, savings rate, and top categories.
6. **Insight Generation:** Produce human-readable observations using templates and optional LLMs, citing actual amounts.
7. **Presentation & Export:** Display data via a responsive dashboard and provide HTML/PDF export options.

### Recommended Stack (Prototype):
- **Frontend:** React + TypeScript + Tailwind
- **Backend:** Python FastAPI
- **Database:** SQLite (local) → PostgreSQL (deployed)
- **Data Processing:** pandas + bank-specific parsers
- **AI Integration:** LLM API with structured output
- **Deployment:** Docker (single container setup)

## 4. Key Constraints & Principles
- **Prototype-First:** Prioritize a working end-to-end prototype over perfect support for every single bank format.
- **Privacy by Design:** Financial data is sensitive. Ensure minimal exposure, use TTLs for session data, do not store third-party statements permanently, and avoid logging full descriptions externally.
- **Inspectable Output:** Users must be able to see cleaned data alongside raw descriptions, and optionally override categories (not just a black-box summary).
- **Messy-Data Tolerance:** Indian bank and UPI descriptions vary widely; robust normalization and fallback mechanisms are critical.

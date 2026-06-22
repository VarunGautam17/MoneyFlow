---
name: model-selection
description: Recommends or applies the optimal AI model tier (High, Mid, or Low) based on the development phase (Context Setup, Execution, or Testing) to optimize tokens and output quality.
---

# Model Selection Skill

This skill enforces a tiered model selection strategy to optimize token consumption, execution cost, and output quality depending on the current phase of the development lifecycle.

## Tiered Selection Strategy

Follow this rule of thumb to choose the appropriate model tier:

1. **Context Setup (Foundational Phase)**
   - **Purpose**: Architecture design, creating core project files, initial codebase analysis, and defining structures.
   - **Recommended Tier**: High-Tier Models (e.g., Gemini Pro, Claude Opus, GPT-5).
   - **Rationale**: Highly complex reasoning and large context comprehension are critical to establishing solid code foundations.

2. **Execution (Implementation & Logic Phase)**
   - **Purpose**: Implementing features, applying logic, code-checking, and ensuring adherence to guardrails.
   - **Recommended Tier**: Mid-Tier Models (e.g., Gemini Flash (Medium), Claude Sonnet).
   - **Rationale**: Balanced speed, reasoning capability, and code accuracy for implementing specific instructions.

3. **Testing & Iteration (Verification Phase)**
   - **Purpose**: Running test suites, fixing minor bugs, executing compilation/build steps, generating test cases, and minor file updates.
   - **Recommended Tier**: Low-Tier Models (e.g., Gemini Flash (Low), Claude Haiku).
   - **Rationale**: Lightweight, fast, and highly cost-effective for repetitive trial-and-error verification runs.

## Usage Guidelines

- **Assess Current Phase**: Before initiating any task, identify whether you are in the *Context Setup*, *Execution*, or *Testing* phase.
- **Advise Model Switching**: Politely advise the user to switch the active model tier in their IDE if the task phase changes (especially when moving from high-overhead setup to low-overhead testing).
- **Adapt to Model Availability**: If specific recommended models are unavailable on the user's platform/IDE (e.g., Cursor, Windsurf, VS Code), select the nearest equivalent fitting the rule of thumb (Best for setup, Intermediate for execution, Low for testing).

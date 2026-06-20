# Project Plan - Grepolis Command Center Blueprint

## Goal
Research, design, and compile a comprehensive blueprint for a Grepolis Command Center, incorporating advanced city manager, manual army tracker, and strategic dashboard, saved at `d:\Dev\Web\Grepolis\docs\command_center_research\command_center_blueprint.md`.

## Work Breakdown

### Milestone 1: Tactical Feature Research
- **Objective**: Extract advanced offensive, defensive, and sniping strategies from tactical guides.
- **Subtask**: Read reference guide URLs (simulated/known strategies if offline), outline how they translate into tracking or planner features (e.g., pure offensive nukes, timing/Recall sniping windows, support/attack alignment).

### Milestone 2: Main Dashboard Design
- **Objective**: Plan a high-level strategic overview interface.
- **Subtask**: Detail strategic KPIs (battle points, active siege alerts, global troop summaries, production status) and user experience layout.

### Milestone 3: City Manager Design
- **Objective**: Design the city manager modules.
- **Subtask**: Specify manual inputs (current building levels, resources, production multipliers), temple management (deity, favor, mythical units), and optimization recommendations (e.g., matching building priorities to city purpose: pure offensive, naval, myth, land defense).

### Milestone 4: Army Tracker & Sniping Design
- **Objective**: Design manual troop tracking and operations timing.
- **Subtask**: Plan army tracker input, transport capacity calculations, and CS sniping helper (calculating launch and recall windows with the +/-10s anti-timer rule).

### Milestone 5: Technical Stack & DB Schema
- **Objective**: Detail Next.js, Prisma, and TailwindCSS implementation path.
- **Subtask**: Define exact Prisma models (adding fields to Town, Player, new models for Operations, ArmyTracker, CityManager), API route list, and component hierarchy.

### Milestone 6: Compile Blueprint & Verify
- **Objective**: Compile and check the markdown file.
- **Subtask**: Synthesize subagent reports into a single, cohesive, highly-detailed blueprint. Review for completeness, guide references, and tech feasibility.

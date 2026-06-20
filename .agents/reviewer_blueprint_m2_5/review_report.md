# Technical Review Report: Grepolis Command Center Blueprint

## Review Summary

**Verdict**: REQUEST_CHANGES

The blueprint is extremely thorough, structurally sound, and covers all required sections. However, we cannot approve it in its current form due to three major technical issues:
1. A logical/mathematical defect in the CS Sniping Recall calculation that makes the timer unusable/extremely high-risk in practice.
2. A database naming mismatch between custom fields in the `Town` model and the seeded `Building` model primary keys, which would cause runtime query failures.
3. Gaps in the API routes specification, specifically missing endpoints to persist status updates and deletions of `SnipeOperation` records.

These must be addressed before the blueprint can be handed off for implementation.

---

## Findings

### [Major] Finding 1: Recall Timing Parameter Logical Defect (Recall Sniping)
- **What**: In the blueprint's `calculateRecallTiming` function (Section 5), the travel time to the dummy target town (`travelTimeSeconds`) is set directly as $D$ (the outward travel duration).
- **Where**: `docs/command_center_research/command_center_blueprint.md`, Lines 285–314.
- **Why**: This logic implies that the cancellation delay $D$ must equal the total travel time to the dummy target town. This is mathematically and tactically incorrect:
  1. It forces the player to cancel at the exact millisecond the troops would land at the dummy target, raising the risk of failing the recall (troops landing instead of returning).
  2. In practice, players select a dummy target that is *further* away than $D$. If a player needs a 5-minute outward travel ($D = 300$ seconds), they can launch towards a dummy target 15 minutes away and cancel after 300 seconds.
- **Suggestion**: Change `calculateRecallTiming` to accept the desired cancel delay `cancelDelaySeconds` ($D \le 600$) as an input parameter. Ensure the UI/API searching for dummy targets filters for towns with `travelTimeSeconds >= cancelDelaySeconds`, but do not equate the two.

### [Major] Finding 2: Database Naming Discrepancies (Town Fields vs Building IDs)
- **What**: The blueprint extends the `Town` model in Prisma with columns: `senateLevel`, `timberLevel`, `quarryLevel`, `silverLevel`, `harborLevel`. However, the `Building` table primary keys (seeded from `globalPSbuildings.txt` via `seed-localstorage.ts`) are: `main` (Senate), `lumber` (Timber Camp), `stoner` (Quarry), `ironer` (Silver Mine), `docks` (Harbor).
- **Where**: `docs/command_center_research/command_center_blueprint.md`, Lines 351–363.
- **Why**: If a developer tries to fetch building metadata from the database (e.g. population consumed, points, or resource factors) using the prefixes from the `Town` model, the queries will fail (e.g., querying `prisma.building.findUnique({ where: { id: "senate" } })` returns null).
- **Suggestion**: Either:
  1. Rename the custom columns on the `Town` model to match the building IDs: `mainLevel`, `lumberLevel`, `stonerLevel`, `ironerLevel`, `docksLevel`.
  2. Document a clear translation mapping layer (e.g., `senate` -> `main`, `timber` -> `lumber`, `quarry` -> `stoner`, `silver` -> `ironer`, `harbor` -> `docks`) in the blueprint's helper code.

### [Major] Finding 3: Missing CRUD/Status Persistence API Routes
- **What**: The API routes list in Section 6 defines only `POST /api/snipe/operations` (create) and `GET /api/towns` (read). It completely omits routes to update or delete `SnipeOperation` records.
- **Where**: `docs/command_center_research/command_center_blueprint.md`, Lines 392–420.
- **Why**: The `SnipeOperation` database model uses a state-machine status (`status: "PENDING" | "SENT" | "RECALLED" | "COMPLETED" | "CANCELLED"`), and the scheduler UI updates these statuses in real-time. Without a `PUT /api/snipe/operations/[id]` or `PATCH /api/snipe/operations` route, these status changes cannot be persisted to the centralized database, defeating the primary goal of migrating sniping operations from local storage.
- **Suggestion**: Add specification and parameters for `PUT /api/snipe/operations/[id]` (to update operation status) and `DELETE /api/snipe/operations/[id]` (to remove operations) to the API route list.

### [Minor] Finding 4: Missing Testing Framework Dependency
- **What**: The blueprint proposes a unit testing strategy using `vitest` or `jest`, but neither is configured in `package.json`'s `devDependencies`.
- **Where**: `docs/command_center_research/command_center_blueprint.md`, Section 7 & `package.json`.
- **Why**: A developer executing the roadmap would attempt to run unit tests and fail due to missing dependencies.
- **Suggestion**: Include installing `vitest` as a devDependency in the Phase 1 setup instructions or update `package.json` dependencies.

### [Minor] Finding 5: Favor Production Formula Modifiers Omission
- **What**: The favor production formula:
  $$\text{FavorPerHour} = \text{WorldSpeed} \times \sqrt{\sum (\text{TempleLevel} + 5 \times \text{hasStatue})}$$
  omits standard game modifiers like the High Priestess premium adviser (+20%), global Temple of Artemis wonder (+5%), and island quest/event buffs (+50%).
- **Where**: `docs/command_center_research/command_center_blueprint.md`, Line 110.
- **Why**: For competitive play, calculations without these modifiers will report incorrect favor rates, leading to inaccurate replenishment planning.
- **Suggestion**: Extend the formula to support active multipliers:
  $$\text{FavorPerHour} = \text{WorldSpeed} \times \sqrt{\sum (\text{TempleLevel} + 5 \times \text{hasStatue})} \times \text{GlobalModifiers}$$

### [Minor] Finding 6: Same-Island Travel Caveat
- **What**: The travel time calculator defaults same-island travel ($d=0$) to a flat 300 seconds (5 minutes).
- **Where**: `docs/command_center_research/command_center_blueprint.md`, Line 263.
- **Why**: While 300 seconds is the hard game minimum for any command, actual travel times on the same island vary by slot distance and unit speed.
- **Suggestion**: Document this simplification as an explicit layout limitation in the blueprint.

### [Minor] Finding 7: Auto-Transport calculation logic omission
- **What**: The blueprint mentions that the Army Tracker computes auto-calculated transport counts, but the formula/logic is missing from Section 5.
- **Where**: `docs/command_center_research/command_center_blueprint.md`, Section 5.
- **Why**: Ground troops must have transport capacity, and calculating the exact transport boats needed is a core requirement.
- **Suggestion**: Add the simple division/ceiling formula:
  $$\text{TransportsNeeded} = \text{Ceil}\left(\frac{\sum (\text{LandTroopCount} \times \text{UnitPopulation})}{\text{TransportCapacityPerShip}}\right)$$

---

## Verified Claims

- **Claim 1**: Incoming movements queue is loaded and saved to local storage in the current code.
  - *Method*: Viewed `src/app/snipe/page.js` lines 15-37.
  - *Result*: **Pass**. The existing page correctly parses and saves `grepo-operations-queue` via `localStorage`.
- **Claim 2**: Recall sniper calculates midpoint return times.
  - *Method*: Viewed `src/app/snipe/recall/page.js` lines 232-258.
  - *Result*: **Pass**. The existing React component correctly calculates the recall epoch as `sendTime + (returnTime - sendTime)/2`.
- **Claim 3**: Existing schema contains `Town`, `Player`, `Conquest`, and `Building` models.
  - *Method*: Viewed `prisma/schema.prisma` lines 10-224.
  - *Result*: **Pass**. Models are present and align with the database.

---

## Coverage Gaps

- **Same-Island Coordinate Resolution**: High Risk — The current travel time calculations rely on `islandX` and `islandY` coordinates. Since slots on the same island share these coordinates, the distance evaluates to 0. Real in-game same-island travel can exceed 5 minutes depending on speed.
  - *Recommendation*: Accept the limitation but explicitly document it as a caveat in the blueprint.
- **Deity Favor Cap**: Low Risk — The favor tracking system calculates hourly favor but does not explicitly detail cap checks (maximum 500 favor).
  - *Recommendation*: Include the favor cap boundary condition in the API/dashboard logic.

---

## Unverified Items

- **High-accuracy clock synchronization logic (Web Workers)**: The blueprint claims to use a Web Worker to achieve $\pm 20$ms server sync accuracy. We did not verify this as no code was implemented; this is accepted as a design suggestion.

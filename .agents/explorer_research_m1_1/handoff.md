# Handoff Report — explorer_research_m1_1

This handoff report documents the read-only investigation of Grepolis tactical reference guides and codebase gaps, leading to a technical design specification for the Command Center.

## 1. Observation

- **Reference Material URLs**: Mentions in `d:\Dev\Web\Grepolis\.agents\ORIGINAL_REQUEST.md` (lines 42-44):
  - `https://grepolisgrepolis.wordpress.com/grepolis-guides-2/becoming-a-grepo-elite-purely-offensive-tactics/`
  - `https://grepolisgrepolis.wordpress.com/grepolis-guides-2/cs-sniping-guide/`
  - `https://grepolis-pro.blogspot.com/`

- **Planner Implementation**: File `src/app/planner/page.js` lines 36-45:
  ```javascript
  const usedPopulation = units.reduce((sum, u) => {
    return sum + (counts[u.id] || 0) * (u.population || 0);
  }, 0);

  const remainingPopulation = maxPopulation - usedPopulation;

  const totalAttack = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.attack || 0), 0);
  const totalDefHack = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_hack || 0), 0);
  const totalDefPierce = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_pierce || 0), 0);
  const totalDefDistance = units.reduce((sum, u) => sum + (counts[u.id] || 0) * (u.def_distance || 0), 0);
  ```

- **Snipe Recall Calculation**: File `src/app/snipe/recall/page.js` lines 232-249:
  ```javascript
  const createPlanFromGap = (gap, minsAway) => {
    const returnTime = gap.returnTime;
    const sendTime = returnTime - (minsAway * 60 * 1000);
    ...
    // Recall time is exactly halfway between send and return
    const recallTime = sendTime + ((returnTime - sendTime) / 2);
  ```

- **Local Storage Reliance**:
  - `src/app/snipe/page.js` lines 16, 36:
    ```javascript
    const saved = localStorage.getItem('grepo-operations-queue');
    ...
    localStorage.setItem('grepo-operations-queue', JSON.stringify(queue));
    ```
  - `src/app/snipe/recall/page.js` lines 77, 91:
    ```javascript
    const saved = localStorage.getItem('grepo-recall-groups');
    ...
    localStorage.setItem('grepo-recall-groups', JSON.stringify(groups));
    ```

- **Database Model (Town)**: File `prisma/schema.prisma` lines 125-136:
  ```prisma
  model Town {
    id         Int     @id
    playerId   Int?
    name       String
    islandX    Int
    islandY    Int
    islandSlot Int
    points     Int
    player     Player? @relation(fields: [playerId], references: [id])

    @@index([islandX, islandY])
  }
  ```

---

## 2. Logic Chain

1. **Guide 1 (wordpress.com/becoming-a-grepo-elite)** teaches pure offensive and defensive specialization, transport capacity calculations, and myth nukes.
2. **Observation** shows `src/app/planner/page.js` is a basic unit counter. It does not classify towns, recommend specialized layouts, or enforce transport capacity limits. Thus, a gap exists for a Specialized Nuke Calculator.
3. **Guide 2 (wordpress.com/cs-sniping-guide)** details the Recall Sniping Method to bypass the Anti-Timer Rule (ATR). The math requires canceling commands halfway to their target return.
4. **Observation** shows `src/app/snipe/recall/page.js` correctly implements this half-travel recall duration logic. However, it requires manual entry of `minsAway` ($D$). It lacks a Travel Time Engine to calculate distances, and there is no Dummy Target Finder to help players identify candidate islands at distance $D$.
5. **Guide 3 (blogspot.com/grepolis-pro)** teaches the Demolition Strategy (Senate 15, mines 20-30, wall 0 in offensive towns) to min-max and save 300-500 population for military units.
6. **Observation** shows that neither the `Town` model in `prisma/schema.prisma` nor the page `src/app/planner/page.js` has any awareness of building levels, research modifiers (Plow, Bunks), or demolition/population tracking.
7. **Observation** shows that operations are saved strictly in client-side `localStorage`, making cooperative alliance planning impossible.
8. Therefore, the codebase requires extensions to `prisma/schema.prisma` (adding building/research fields to `Town` and creating a persisted `SnipeOperation` table), an integrated travel time calculation engine, a dummy target locator API, and presets in the Army Planner.

---

## 3. Caveats

- **No Live Verification of Game API**: The research is based on standard, static game equations and formulas. Exact world speed multipliers and travel rules must be validated against the active world configuration.
- **Client-Side vs. Database Overhead**: Storing large amounts of temporary operations in a database could cause write bloat; a pruning cron-job or clean-up service will be necessary.
- **Senate Level Demolition Bounds**: Reclaiming Senate population below level 24 requires Thermal Baths to be built first, then Senate downgraded. The database constraints must prevent invalid configurations (e.g. demolishing Senate below level 24 if Baths are not built).

---

## 4. Conclusion

The current codebase implements basic calculators but fails to capture the advanced tactical min-maxing strategies from the guides. By adding the proposed Prisma models, a travel time calculator engine, a dummy target finder, and demo presets to the planner, the Command Center can provide a robust, tactical advantage for elite players.

---

## 5. Verification Method

To verify the findings and the proposed changes:
1. Check `d:\Dev\Web\Grepolis\.agents\explorer_research_m1_1\research_report.md` to review the full details.
2. Run `npx prisma validate` after implementing the proposed schema modifications in `prisma/schema.prisma` to verify schema coherence.
3. Review `src/app/planner/page.js` and `src/app/snipe/recall/page.js` to confirm the code blocks referenced in the Observations match the current workspace files.

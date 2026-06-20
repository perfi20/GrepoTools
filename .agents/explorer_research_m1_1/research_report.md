# Grepolis Command Center: Tactical Research & Technical Blueprint

This report establishes the tactical requirements and technical specifications for the Grepolis Command Center, drawing directly from standard elite Grepolis strategies and conducting a detailed gap analysis against the current Next.js/Prisma codebase.

---

## 1. Tactical Concepts Extracted from Reference Guides

### A. Guide 1: becoming-a-grepo-elite-purely-offensive-tactics
*Source: https://grepolisgrepolis.wordpress.com/grepolis-guides-2/becoming-a-grepo-elite-purely-offensive-tactics/*

The core philosophy is **absolute specialization of cities** to avoid "hybrid" cities, which are mathematically inefficient. The guide outlines the following tactical guidelines:
1. **Pure Naval Offensive (Light Ship / LS Nuke)**:
   - Cities dedicated entirely to Light Ships (LS) to clear enemy harbor defense (Biremes).
   - Require keeping barracks, ground troop buildings, and city walls at the lowest level possible to save farm population.
   - Maximize Light Ship counts (target of 300–350+ LS per town, consuming 2,400–2,800 population).
2. **Pure Land Offensive (LO Nuke)**:
   - Dedicated to land attacks containing Slingers (blunt), Horsemen (blunt), Hoplites (sharp), and Catapults.
   - Catapults are mandatory: they demolish enemy city walls. Since the City Wall multiplier drastically increases defender defense values, walls must be broken for land nukes to be effective.
   - Requires Fast Transport Ships (FTS) for optimal troop transit speed.
   - Defensive units (Swordsmen, Archers) should never be mixed into LO nukes.
3. **Myth Nukes**:
   - Dedicated to flying mythical units (Manticores from Zeus or Harpies from Hera).
   - Flying myth units ignore naval defense (Biremes) and bypass the need for transport ships, saving massive amounts of population and eliminating transit capacity bottlenecks.
4. **Tactical Wall Management**:
   - In offensive cities, the City Wall must be kept at level 0. If the town is conquered, the enemy has no defensive wall advantage, allowing the player or their alliance to easily retake the city. This also reclaims 135 population.

---

### B. Guide 2: cs-sniping-guide
*Source: https://grepolisgrepolis.wordpress.com/grepolis-guides-2/cs-sniping-guide/*

This guide deals with defending against Colony Ships (CS) on Conquest (Siege) and Revolt worlds by landing support or attacks within the exact second the CS lands.
1. **The Anti-Timer Rule (ATR)**:
   - The game server applies a random offset of $\pm 10$ seconds to every command upon launch. Direct launching to hit a 1-second window is unreliable due to this variance.
2. **The Recall Sniping Method (Bypassing ATR)**:
   - Allows players to achieve 100% precision by using the 10-minute cancellation rule.
   - The player launches an attack or support from the target city to a dummy target.
   - After a travel duration $D$ (where $D \le 10$ minutes), the player clicks "Cancel/Recall".
   - The troops return to the originating city, taking the *exact same* duration to return as they spent traveling outwards.
   - Since cancellation is instantaneous and has no ATR applied, the return time is completely deterministic and precise to the second.
3. **Mathematical Formulation**:
   - Let $T_{\text{return}}$ be the target return time (e.g., 1s after CS lands in Siege, or 1s before CS lands in Revolt).
   - Let $T_{\text{launch\_actual}}$ be the actual server time when the player clicks the launch button.
   - Let $D$ be the chosen outward travel duration ($D \le 10$ minutes).
   - The player must click cancel/recall at:
     $$T_{\text{recall}} = T_{\text{launch\_actual}} + \frac{T_{\text{return}} - T_{\text{launch\_actual}}}{2}$$
     *(Which is the exact midpoint between the actual launch time and target return time).*
   - Due to the 10-minute cancellation window, the total elapsed time between launch and return ($2D$) cannot exceed 20 minutes.

---

### C. Guide 3: grepolis-pro.blogspot.com
*Source: https://grepolis-pro.blogspot.com/*

Focuses on building layout optimization and min-maxing the farm population to yield larger armies.
1. **Farm Capacity Maximization**:
   - Reaches maximum population by upgrading the Farm to level 40, researching Plow (+200 population), and building Thermal Baths (+10% total population).
2. **Demolition / Min-Maxing Strategy**:
   - Standard players build all buildings to maximum levels, wasting 300–500 population.
   - Elite players demolish or freeze buildings at these levels:
     - **Senate**: Level 15 (saves 77 population compared to level 30; level 24 is only needed to build Thermal Baths, and can be demolished back to 15 once constructed).
     - **Mines (Timber, Quarry, Silver)**: Level 20–30 in active military towns, relying on resource transfers or farming to build troops.
     - **Market**: Level 10 (saves population, sufficient for essential trading).
     - **Temple**: Level 1–5 (global favor pools allow players to have only 1 or 2 high-temple cities, keeping the rest at level 1 to save population).
     - **Barracks**: Level 10 in pure naval towns (saves population, barracks are only used for minor defensive builds).
     - **Harbor**: Level 10–15 in pure land towns (just enough to build transports).
     - **City Wall**: Level 0 in offensive towns (saves 135 population).
   - By downgrading these buildings, players free up 300–500 population, adding 30–50 Light Ships or 300–500 land units to their nukes.

---

## 2. Tactical Feature Specifications & Design Requirements

Based on these guides, the Grepolis Command Center requires the following tactical features:

| Feature | Tactical Influence / Purpose | Reference Guide |
|---|---|---|
| **City Specialization Classifier** | Allows tagging cities as LO, NO, LD, ND, Myth (Manticore/Harpy/Medusa). Guides layout and troop planning. | wordpress.com/purely-offensive-tactics |
| **Nuke Composition Calculator** | Computes optimal ratios (Slingers/Hoplites/Horsemen/Catapults) and auto-calculates transport ship counts based on free population. | wordpress.com/purely-offensive-tactics |
| **Demolition Simulator & Optimizer** | Allows players to input building levels and simulates downgrades, showing reclaimed population and the corresponding increase in army sizes. | blogspot.com/grepolis-pro |
| **Precision Recall Scheduler** | Automates the math for Recall Sniping: given $T_{\text{return}}$ and a launch offset, it displays the exact second to click "Cancel". | wordpress.com/cs-sniping-guide |
| **Dummy Target Finder** | Queries local database towns to find targets that are far enough away to satisfy the necessary travel duration $D$ for recall sniping. | wordpress.com/cs-sniping-guide |
| **Travel Time Calculator Engine** | Calculates travel times between coordinates based on unit speed, world speed, Cartography, Lighthouse, and hero modifiers. | wordpress.com/cs-sniping-guide |
| **Coordinated Operations Database** | Persists planned snipes, attacks, and supports in a shared database for alliance-wide coordination (replacing local storage). | General Alliance Play / CS Sniping |

---

## 3. Codebase Gap Analysis

An analysis of the current codebase (`src/app/snipe`, `src/app/planner`, `src/app/stats`, and `prisma/schema.prisma`) reveals several critical gaps:

### A. Database Schema (`prisma/schema.prisma`)
- **Current State**:
  - `Town` model tracks only basic attributes: `id`, `playerId`, `name`, `islandX`, `islandY`, `islandSlot`, and `points`.
- **Gaps**:
  - **No building tracking**: There are no fields in `Town` (or a related table) to store building levels (Senate, Farm, Barracks, Harbor, Wall, etc.) needed for the Demolition Simulator.
  - **No research or special buildings tracking**: Modifiers like Bunks, Plow, Cartography, and Thermal Baths are not stored.
  - **No specialization tag**: The `Town` model lacks a classification field (LO, NO, LD, ND, etc.).
  - **No operations persistence**: Snipe plans and operations are currently not represented in the database.

### B. City & Army Planner (`src/app/planner/page.js`)
- **Current State**:
  - Renders a simple manual unit counter. The user enters numbers and sees total population and attack/defense statistics.
- **Gaps**:
  - **No specialization presets**: The user cannot select "Land Nuke" or "Light Ship Nuke" to see recommended compositions or max counts.
  - **No transport capacity enforcement**: The page allows the user to add land units without verifying if enough transport ships have been added.
  - **No modifiers**: Does not integrate research like Bunks (which increases transport capacity from 10 to 16 for FTS) or Plow.
  - **No demolition calculator**: It has no interface to model building downgrades or calculate reclaimed population.

### C. Snipe and Recall Timers (`src/app/snipe` & `src/app/snipe/recall`)
- **Current State**:
  - `snipe/page.js` calculates simple launch windows using a local state queue.
  - `snipe/recall/page.js` calculates `sendTime` and `recallTime` based on a user-provided `minsAway` ($D$).
- **Gaps**:
  - **Local Storage Only**: All data is stored in `localStorage` on the client. It is impossible for players to coordinate or share sniping schedules.
  - **No Travel Time Calculations**: The system has no way to calculate travel time between coordinates. The user must manually look up travel times in-game and type them in.
  - **No Dummy Target Finder**: The recall sniper has no tool to search the database for suitable towns that are far enough away to serve as dummy targets for the cancel window.
  - **No speed modifiers**: The page does not support Cartography, Lighthouse, or Atalanta bonuses.

### D. Scoreboard Dashboard (`src/app/stats/page.js`)
- **Current State**:
  - Displays scoreboard trends, alliances, and conquest history.
- **Gaps**:
  - **Disconnected Systems**: The conquest history shows Colony Ships landing, but there is no integration to click "Snipe" on a conquest and automatically create a Recall Snipe Group with the pre-filled target city and CS landing time.

---

## 4. Technical Design & Implementation Recommendations

To bridge these gaps, the following implementation blueprint is recommended for the Next.js/Prisma stack:

### A. Prisma Schema Extensions
Add fields to `Town` and introduce new models for `SnipeOperation` and `TownBuilding`.

```prisma
// Extension of the Town model in prisma/schema.prisma
model Town {
  id                   Int           @id
  playerId             Int?
  name                 String
  islandX              Int
  islandY              Int
  islandSlot           Int
  points               Int
  player               Player?       @relation(fields: [playerId], references: [id])
  
  // Custom command center fields
  specialization       String        @default("NONE") // LO, NO, LD, ND, MYTH, NONE
  bunksResearched      Boolean       @default(false)
  plowResearched       Boolean       @default(false)
  cartographyResearched Boolean      @default(false)
  mathResearched       Boolean       @default(false)
  hasThermalBaths      Boolean       @default(false)
  hasTower             Boolean       @default(false)
  hasLighthouse        Boolean       @default(false)
  
  // Building levels (null means unknown/untracked)
  senateLevel          Int?
  farmLevel            Int?
  barracksLevel        Int?
  harborLevel          Int?
  wallLevel            Int?
  templeLevel          Int?
  timberLevel          Int?
  quarryLevel          Int?
  silverLevel          Int?
  marketLevel          Int?
  academyLevel         Int?
  
  // Relations
  snipeOperations      SnipeOperation[] @relation("TargetTown")
  snipeOrigins         SnipeOperation[] @relation("OriginTown")
}

model SnipeOperation {
  id                String   @id @default(uuid())
  label             String
  type              String   @default("recall") // recall, direct
  worldType         String   @default("siege")  // siege, revolt
  targetTownId      Int
  originTownId      Int
  targetReturnTime  DateTime
  sendTime          DateTime
  recallTime        DateTime?
  status            String   @default("PENDING") // PENDING, SENT, RECALLED, COMPLETED
  createdAt         DateTime @default(now())
  
  targetTown        Town     @relation("TargetTown", fields: [targetTownId], references: [id])
  originTown        Town     @relation("OriginTown", fields: [originTownId], references: [id])
}
```

---

### B. Travel Time Engine (`src/lib/traveltime.js`)
Create a utility function to calculate travel times on the server or client.

```javascript
/**
 * Calculates the travel time in seconds between two sets of island coordinates.
 * @param {number} x1 - Origin X
 * @param {number} y1 - Origin Y
 * @param {number} x2 - Target X
 * @param {number} y2 - Target Y
 * @param {number} unitSpeed - Base speed of the slowest unit
 * @param {number} worldSpeed - Speed multiplier of the world
 * @param {object} modifiers - Cartography, Lighthouse, Hero, etc.
 * @returns {number} Travel time in seconds
 */
export function calculateTravelTime(x1, y1, x2, y2, unitSpeed, worldSpeed, modifiers = {}) {
  // Euclidean distance between island coordinates
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return 300; // Minimum travel time on the same island (5 minutes)
  }

  // Base speed bonus multipliers
  let speedMultiplier = 1;
  if (modifiers.cartography) speedMultiplier += 0.10;
  if (modifiers.lighthouse) speedMultiplier += 0.15;
  if (modifiers.atalantaLevel) speedMultiplier += (0.09 + modifiers.atalantaLevel * 0.01); // Example Hero bonus
  if (modifiers.speedBuff) speedMultiplier += modifiers.speedBuff; // e.g. Sea Storm, items

  // Travel time formula: base delay + (distance * multiplier) / (unitSpeed * worldSpeed * modifiers)
  // Standard Grepolis naval unit travel constant is 500
  const travelConstant = 500;
  const baseDelay = 300; // 5 minutes rules delay for naval/transport units
  
  const calculatedSeconds = baseDelay + (distance * travelConstant) / (unitSpeed * worldSpeed * speedMultiplier);
  
  return Math.round(calculatedSeconds);
}
```

---

### C. Dummy Target Finder API (`src/app/api/snipe/dummy-targets/route.js`)
Create an API route that queries the database to find suitable dummy targets for recall sniping.

```javascript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateTravelTime } from '@/lib/traveltime';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const originId = parseInt(searchParams.get('origin_id'), 10);
  const targetDurationSeconds = parseInt(searchParams.get('duration'), 10); // D in seconds
  const unitSpeed = parseInt(searchParams.get('unit_speed'), 10);
  const worldSpeed = parseFloat(searchParams.get('world_speed') || '1.0');
  
  if (!originId || !targetDurationSeconds || !unitSpeed) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const origin = await prisma.town.findUnique({ where: { id: originId } });
    if (!origin) return NextResponse.json({ error: 'Origin town not found' }, { status: 404 });

    // Fetch all towns in the same ocean/region to limit search scope
    const candidateTowns = await prisma.town.findMany({
      where: {
        id: { not: originId },
        islandX: { gte: origin.islandX - 30, lte: origin.islandX + 30 },
        islandY: { gte: origin.islandY - 30, lte: origin.islandY + 30 },
      },
      take: 100,
    });

    const results = candidateTowns.map(town => {
      const time = calculateTravelTime(
        origin.islandX, origin.islandY,
        town.islandX, town.islandY,
        unitSpeed, worldSpeed
      );
      return { town, travelTimeSeconds: time };
    })
    // Filter towns that are far enough to allow a cancel window of length D
    .filter(res => res.travelTimeSeconds >= targetDurationSeconds)
    .sort((a, b) => a.travelTimeSeconds - b.travelTimeSeconds)
    .slice(0, 10);

    return NextResponse.json({ success: true, dummyTargets: results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

### D. Advanced Demolition Calculator component (`src/app/planner/page.js` extensions)
Enhance the planner to support building inputs and show population savings.

```javascript
// Example structural component layout inside planner/page.js
const buildingBasePop = {
  senate: { base: 1.17, factor: 1.25 }, // example calculations
  timber: { base: 1.0, factor: 1.15 },
  quarry: { base: 1.0, factor: 1.15 },
  silver: { base: 1.0, factor: 1.15 },
  wall: { base: 2.0, factor: 1.20 },
  temple: { base: 5.0, factor: 1.12 }
};

// Calculate population used by a building at a level
function getBuildingPopulation(buildingId, level) {
  if (level <= 0) return 0;
  const config = buildingBasePop[buildingId];
  if (!config) return 0;
  let pop = 0;
  for (let i = 1; i <= level; i++) {
    pop += Math.round(config.base * Math.pow(config.factor, i - 1));
  }
  return pop;
}

// Compare current levels to optimal specialization configurations
const presets = {
  LAND_OFFENSE: { senate: 15, timber: 25, quarry: 25, silver: 25, wall: 0, temple: 1, market: 10 },
  NAVAL_OFFENSE: { senate: 15, timber: 30, quarry: 20, silver: 30, wall: 0, temple: 1, market: 10, barracks: 10 }
};
```

---

### E. Conquest to Sniper Integration
In `src/app/stats/page.js`, add a direct click-to-snipe action next to the conquest list item:

```javascript
// Inside Conquest Row render
<button 
  onClick={() => {
    // Save to local storage or redirect to recall sniper with prepopulated query parameters
    window.location.href = `/snipe/recall?target_name=${encodeURIComponent(conquest.townName)}&target_id=${conquest.townId}&arrival=${new Date(conquest.timestamp).toLocaleTimeString('en-US', { hour12: false })}&type=siege`;
  }}
  className="btn btn-sm flex items-center gap-1 bg-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.4)] text-danger border border-danger/30 rounded px-2 py-1"
>
  <Crosshair size={14} />
  <span>Snipe</span>
</button>
```

This ensures a seamless UX bridge between active tactical intelligence (Scoreboard / Conquest tracker) and precision defensive operations (Recall Sniper).

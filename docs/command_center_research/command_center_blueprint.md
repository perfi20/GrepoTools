# Grepolis Command Center: Technical Architecture & Implementation Blueprint

## 1. Executive Summary

The Grepolis Command Center (GCC) is a highly specialized tactical dashboard and empire management suite designed for competitive, high-performance Grepolis players. In high-speed, high-stakes siege or revolt worlds, victory is determined by fine margins: a difference of 50 farm population or a defensive support landing within a sub-second window. 

Standard Grepolis interfaces fail because they operate on a generic level, forcing players to rely on disconnected spreadsheets, client-side browser timers, and third-party calculators. The GCC unifies real-time intelligence, empire optimization, and precision operations by:
1. **Unifying Alliance Intelligence**: Migrating sniping schedules and coordinated operations from client-side `localStorage` to a centralized database schema.
2. **Min-Maxing Farm Capacity**: Implementing a demolition simulator and city specialization classifier that guides players to reclaim hundreds of population per town, yielding larger armies.
3. **Automating Precision Defense**: Executing the midpoint mathematical calculations and surrounding database scans required to bypass the game's random Anti-Timer Rule (ATR) via precision recall sniping.

---

## 2. Tactical Feature Extraction

This section outlines how three standard elite Grepolis tactical guides directly influenced the architectural and interface designs of the GCC.

### A. Pure Offensive Tactics
*   **Tactical Philosophy**: Complete specialization of cities (avoiding inefficient hybrid land/naval builds) and the reduction of defensive infrastructure in offensive towns. 
*   **Wall Level 0**: Keeping the City Wall at level 0 in Land Offensive (LO) and Naval Offensive (NO) cities. This saves 135 farm population and ensures that if the city is conquered, alliance members can easily retake it without facing a high wall multiplier.
*   **Flying Myth Nukes**: Utilizing flying mythical units (Manticores from Zeus, Harpies from Hera) that ignore naval defense (Biremes) and bypass transport ship requirements, saving massive amounts of population and eliminating naval transit capacity bottlenecks.
*   **GCC Design Influence**:
    *   **City Specialization Tags**: Extended the database `Town` model with a `specialization` classifier field (`NO_LS`, `LO_TS`, `ND_BIR`, `LD_DEF`, `MYTH_MANTICORE`, `MYTH_HARPY`, `NONE`).
    *   **Validation & Warning System**: The UI analyzes the wall level and unit configuration of specialized cities. If a city is tagged as `NO_LS` or `LO_TS` and its wall level is greater than 0, the GCC displays a warning: *"Wall level is {x}. Downgrading to 0 reclaims {pop} population and removes retake disadvantage."*
    *   **Preset Enforcement**: The troop planner provides presets that auto-fill target ratios and raise warnings if defensive units (e.g., Swordsmen, Archers) are added to LO/NO towns.

### B. CS Sniping Guide
*   **Tactical Philosophy**: The game server applies a random Anti-Timer Rule (ATR) of $\pm 10$ seconds to all direct naval/land attacks and support. Direct launching to hit a 1-second window before/after an incoming Colony Ship (CS) is unreliable. The Recall Sniping method bypasses the ATR by launching troops to a dummy city and canceling the command within the 10-minute cancel window. The return journey takes the exact same duration as the outward journey prior to recall, $D$ (the cancel delay), and has 0 ATR variance.
*   **Midpoint Formula**:
    Let $T_{\text{return}}$ be the target return time (e.g., $T_{\text{CS}} + 1\text{s}$ for Siege, or $T_{\text{CS}} - 1\text{s}$ for Revolt).
    Let $T_{\text{launch\_actual}}$ be the actual server epoch time when the player clicks the launch button.
    The player must click cancel/recall at:
    $$T_{\text{recall}} = T_{\text{launch\_actual}} + \frac{T_{\text{return}} - T_{\text{launch\_actual}}}{2}$$
    Because of the 10-minute cancel rule, the cancel delay $D$ (the outward travel duration before recall, or `cancelDelaySeconds`) must satisfy:
    $$D = \frac{T_{\text{return}} - T_{\text{launch\_actual}}}{2} \le 10 \text{ minutes (600 seconds)}$$
    Making the maximum elapsed time between launch and return ($2D$) 20 minutes. Note that $D$ is independent of the travel time to the dummy target town itself; the player can select any dummy target city that has $\text{travelTimeSeconds} \ge D$. The command is recalled after $D$ seconds, and the troops return to the origin city after another $D$ seconds.
*   **GCC Design Influence**:
    *   **CS Recall Scheduler Widget**: Provides a high-precision countdown interface. Once the user clicks "Troops Sent", it captures the actual launch time $T_{\text{launch\_actual}}$ from the server clock and immediately begins countdowns for the exact second of $T_{\text{recall}}$.
    *   **Dummy Target Finder**: An API route `/api/snipe/dummy-targets` queries surrounding coordinates and filters for candidate towns where $\text{travelTimeSeconds} \ge D$ (where $D$ can be up to 600 seconds) for the slowest unit in the snipe, ensuring the target is far enough away to permit the cancel action after $D$ seconds.

### C. Grepolis Pro Building Levels
*   **Tactical Philosophy**: Standard players upgrade all buildings to their maximum levels, wasting 300–500 population. Elite players demolish or freeze buildings at these levels in military cities:
    *   **Senate**: Level 15 (saves 77 population compared to level 30; level 24 is briefly needed for Thermal Baths, then demolished back to 15).
    *   **Temple**: Level 1 (saves population, relying on global favor sharing).
    *   **Market**: Level 10 (saves population, sufficient for essential trading).
    *   **City Wall**: Level 0 in offensive towns (saves 135 population).
    *   **Barracks**: Level 10 in pure naval towns.
    *   **Harbor**: Level 10–15 in pure land towns.
*   **GCC Design Influence**:
    *   **Empire Demolition Simulator**: A calculator comparing the current levels of a town against the optimized "Pro" configurations. It calculates the exact population saved and translates it into equivalent offensive units (e.g. "+34 Light Ships" or "+270 Slingers").
    *   **Global Favor/Temple Planner**: Visualizes the global favor pool across all temples. Enables players to plan which cities hold high-level temples (for favor generation) while locking the rest to Level 1.

---

## 3. Main Dashboard Design

The Main Dashboard is a three-column layout optimized for dark-mode military coordination. It uses a high-performance grid styled with glassmorphism to show real-time metrics and operations.

```
+-------------------------------------------------------------------------------------------------------+
|                                           NAVBAR (GrepoTools)                                         |
+------------------------------------+----------------------------------+-------------------------------+
| COLUMN 1: EMPIRE SUMMARY           | COLUMN 2: OPERATIONS ROOM        | COLUMN 3: QUICK ACTIONS       |
|                                    |                                  |                               |
| +--------------------------------+ | +------------------------------+ | +---------------------------+ |
| | KPI Widgets                    | | | Coordinated CS Snipe Queue   | | | Travel Time Quick Calc    | |
| | - Global Reclaimed Pop: +1,240 | | | Target: Town X (12:34:56)    | | | Origin:  [456, 123]       | |
| | - Total Light Ships: 1,420     | | | Status: [T -01:45] (Launch)  | | | Target:  [458, 125]       | |
| | - Snipe Success Rate: 96.4%    | | | [ Launch Timer ] [ Recall ]  | | | Unit:    [Light Ship]   | |
| +--------------------------------+ | +------------------------------+ | | Duration: 08 mins 45 secs | |
|                                    |                                  | +---------------------------+ |
| +--------------------------------+ | +------------------------------+ |                               |
| | Specialization Chart           | | | Active Snipes List           | | +---------------------------+ |
| | [ NO: 4 | LO: 3 | ND: 2 | LD:1]| | | - Town Y: Cancel in 04:12    | | | Demolition Estimator    | |
| +--------------------------------+ | | - Town Z: Returning in 08:02   | | | Senate: [ 30 ] -> [ 15 ]  | |
|                                    | +------------------------------+ | | Reclaimed Pop: +77         | |
| +--------------------------------+ |                                  | +---------------------------+ |
| | Favor Production Matrix        | | +------------------------------+ |                               |
| | Zeus: 45/hr | Hera: 38/hr      | | | Conquest Alert Stream        | |                               |
| +--------------------------------+ | | - CS landing on Alliance Town  | |                               |
|                                    | |   [ Snipe Now ] button         | |                               |
|                                    | +------------------------------+ |                               |
+------------------------------------+----------------------------------+-------------------------------+
```

### Key Metrics/KPIs
1.  **Global Reclaimed Population**: A running tally showing the total population reclaimed across the empire through structural downgrades.
2.  **Empire Specialization Ratio**: Visual breakdown showing the count of Naval Offense, Land Offense, Naval Defense, Land Defense, Myth, and Hybrid towns.
3.  **Active Snipe Success Rate**: Tracks completed sniping operations to measure accuracy.
4.  **Hourly Favor Yield**: Aggregated favor production rates by deity, displaying current favor levels against the cap of 500.

### Real-Time Widget Configurations
*   **Precision Clock Sync**: The main dashboard queries the Grepolis server time via the API, calculates the local offset, and runs a Web Worker-based timer to ensure that countdown ticks are accurate to within $\pm 20$ milliseconds of the server clock, independent of client main thread load.
*   **Recall Snipe Timer Widget**:
    *   Flashes **Amber** (Warning) 30 seconds before a launch/recall event.
    *   Flashes **Red** (Critical Action) 10 seconds before the event.
    *   Plays an audio chirp at 3, 2, 1, and 0 seconds.
*   **Conquest Alert Stream Widget**: Pulls from the `Conquest` database. If a new conquer is logged on an alliance town, it flashes onto the screen with a "Snipe" button. Clicking this pre-fills the CS landing time and coordinates in the CS Sniping Scheduler.

---

## 4. Advanced City Manager

The Advanced City Manager tracks building levels and calculates population changes due to building upgrades and downgrades.

### Manual Building Level & Modifier Interface
Users modify the building levels of their towns. Modifiers such as researches (Plow, Bunks, Cartography, Mathematics) and special buildings (Thermal Baths, Tower, Lighthouse) are toggled to calculate available population and travel speeds.

### Temple & Favor Tracking
The manager calculates favor generation per hour based on the total temple levels and statues dedicated to each deity, adjusted by global and premium modifiers (High Priestess +20%, Temple of Artemis wonder +5%, island quest buffs, and active events):
$$\text{FavorPerHour} = \text{WorldSpeed} \times \sqrt{\sum (\text{TempleLevel} + 5 \times \text{hasStatue})} \times \text{GlobalModifiers}$$

Where $\text{GlobalModifiers} = (1 + \text{HighPriestess} + \text{TempleOfArtemis} + \text{IslandQuestBuff} + \text{EventBuff})$:
*   $\text{HighPriestess} = 0.20$ (if active, 0 otherwise)
*   $\text{TempleOfArtemis} = 0.05$ (if owned by alliance, 0 otherwise)
*   $\text{IslandQuestBuff}$ (typically up to $+0.50$ from favor production buffs)
*   $\text{EventBuff}$ (active event multipliers)

The system also enforces a boundary cap warning when calculated favor approaches or reaches the maximum limit of 500 favor.

### Demolition Calculator & Population Logic
The population consumed by a building at a specific level $L$ is calculated using:
$$\text{Pop}(L) = \sum_{i=1}^{L} \text{Round}\left(\text{BasePop} \times \text{PopFactor}^{i-1}\right)$$

Below are the base parameters and factors for building population calculations mapped to the database building primary keys:
*   **Senate (main)**: Base = 1.17, Factor = 1.25 (Max Level = 30)
*   **Temple (temple)**: Base = 5.00, Factor = 1.12 (Max Level = 30)
*   **Market (market)**: Base = 2.00, Factor = 1.15 (Max Level = 30)
*   **City Wall (wall)**: Base = 2.00, Factor = 1.20 (Max Level = 25)
*   **Barracks (barracks)**: Base = 1.50, Factor = 1.18 (Max Level = 30)
*   **Harbor (docks)**: Base = 2.00, Factor = 1.18 (Max Level = 30)
*   **Timber Camp (lumber)**: Base = 1.00, Factor = 1.15 (Max Level = 40)
*   **Quarry (stoner)**: Base = 1.00, Factor = 1.15 (Max Level = 40)
*   **Silver Mine (ironer)**: Base = 1.00, Factor = 1.15 (Max Level = 40)
*   **Academy (academy)**: Base = 2.00, Factor = 1.18 (Max Level = 36)

#### Demolition Simulator React Code Block:
```javascript
import React, { useState } from 'react';

const buildingBasePop = {
  main: { base: 1.17, factor: 1.25 },
  temple: { base: 5.00, factor: 1.12 },
  market: { base: 2.00, factor: 1.15 },
  wall: { base: 2.00, factor: 1.20 },
  barracks: { base: 1.50, factor: 1.18 },
  docks: { base: 2.00, factor: 1.18 },
  lumber: { base: 1.00, factor: 1.15 },
  stoner: { base: 1.00, factor: 1.15 },
  ironer: { base: 1.00, factor: 1.15 },
  academy: { base: 2.00, factor: 1.18 }
};

export function getBuildingPopulation(buildingId, level) {
  if (level <= 0) return 0;
  const config = buildingBasePop[buildingId];
  if (!config) return 0;
  let pop = 0;
  for (let i = 1; i <= level; i++) {
    pop += Math.round(config.base * Math.pow(config.factor, i - 1));
  }
  return pop;
}

export default function DemolitionCalculator({ currentLevels, onReclaim }) {
  const targetLevelsPreset = {
    main: 15,
    temple: 1,
    market: 10,
    wall: 0,
    barracks: 10,
    docks: 15,
    lumber: 25,
    stoner: 20,
    ironer: 25,
    academy: 30
  };

  const [targets, setTargets] = useState(targetLevelsPreset);

  const calculateTotalSaved = () => {
    let saved = 0;
    Object.keys(buildingBasePop).forEach(bId => {
      const currentVal = currentLevels[bId] || 0;
      const targetVal = targets[bId] || 0;
      if (currentVal > targetVal) {
        saved += (getBuildingPopulation(bId, currentVal) - getBuildingPopulation(bId, targetVal));
      }
    });
    return saved;
  };

  const populationSaved = calculateTotalSaved();
  const additionalLightShips = Math.floor(populationSaved / 8);
  const additionalSlingers = populationSaved;

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md">
      <h3 className="text-lg font-bold text-accent mb-4">Building Demolition Simulator</h3>
      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        {Object.keys(buildingBasePop).map(bId => (
          <div key={bId} className="flex justify-between items-center bg-slate-950/40 p-2 rounded">
            <span className="capitalize font-medium text-slate-300">{bId}:</span>
            <div className="flex items-center gap-2">
              <span className="text-secondary text-xs">Cur: {currentLevels[bId] || 0}</span>
              <input
                type="number"
                value={targets[bId]}
                onChange={e => setTargets({...targets, [bId]: Math.max(0, parseInt(e.target.value) || 0)})}
                className="w-12 text-center bg-slate-900 border border-slate-700 rounded text-slate-100"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-slate-950/60 rounded-lg text-center">
        <div className="text-xs text-secondary uppercase tracking-wider">Population Reclaimed</div>
        <div className="text-3xl font-mono text-green-400 font-bold mt-1">+{populationSaved}</div>
        <div className="text-xs text-slate-400 mt-2">
          Equivalent to: <span className="text-accent font-bold">+{additionalLightShips} Light Ships</span> or <span className="text-accent font-bold">+{additionalSlingers} Slingers</span>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. Advanced Army Tracker & Sniping

This module provides coordination tools for troop management and precision sniping.

### Manual Troop Tracker & Transport Capacity Verification
The Troop Tracker verifies that the user has added enough transport capacity for the selected land units.
$$\text{TransportCapacity} = (\text{TransportShips} \times C_{\text{TS}}) + (\text{FastTransportShips} \times C_{\text{FTS}})$$
Where:
*   $C_{\text{TS}} = 20$ (standard) or $26$ (if `bunksResearched` is true)
*   $C_{\text{FTS}} = 10$ (standard) or $16$ (if `bunksResearched` is true)

The UI raises an error if:
$$\sum (\text{LandTroopCounts} \times \text{UnitPopulation}) > \text{TransportCapacity}$$

#### Auto-Calculated Transport Ships Needed Formula:
To automatically plan the exact transport capacity required for a land army, the system calculates:
$$\text{TransportsNeeded} = \text{Ceil}\left(\frac{\sum (\text{LandTroopCount} \times \text{UnitPopulation})}{\text{TransportCapacityPerShip}}\right)$$
Where $\text{TransportCapacityPerShip}$ is the capacity ($C_{\text{TS}}$ or $C_{\text{FTS}}$) of the chosen transport ship type.

### Travel Time Calculation Engine
The engine calculates exact travel times between island coordinates.
*   **Coordinate Euclidean Distance**:
    $$d = \sqrt{(x_1 - x_2)^2 + (y_1 - y_2)^2}$$
*   **Travel Time in Seconds**:
    $$t = 300 + \text{Round}\left(\frac{d \times 500}{\text{UnitSpeed} \times \text{WorldSpeed} \times \text{SpeedMultiplier}}\right)$$
    Where:
    *   `300` is the base delay (5 minutes rule for travel).
    *   `500` is the naval travel constant.
    *   `SpeedMultiplier` $= 1 + 0.10 (\text{Cartography}) + 0.15 (\text{Lighthouse}) + \text{AtalantaLevel} \times 0.01 + \text{ItemBuff}$.
*   **Same-Island Travel Caveat (Layout Limitation)**:
    For coordinates on the same island ($d=0$), the engine applies a flat travel time of 300 seconds. While in-game travel times vary based on slot distance and unit speed, the coordinates system in Grepolis maps same-island slots to the same $(x, y)$ coordinate. The 300-second flat duration represents the minimum system command threshold, and this simplification is documented as a known layout coordinate resolution limit.

#### Javascript Engine Implementation:
```javascript
/**
 * Calculates the travel time in seconds between coordinates.
 * @param {number} x1 - Origin X
 * @param {number} y1 - Origin Y
 * @param {number} x2 - Target X
 * @param {number} y2 - Target Y
 * @param {number} unitSpeed - Base speed of the slowest unit in the command
 * @param {number} worldSpeed - Speed multiplier of the world
 * @param {object} modifiers - Research and buff flags
 * @returns {number} Travel time in seconds
 */
export function calculateTravelTime(x1, y1, x2, y2, unitSpeed, worldSpeed, modifiers = {}) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return 300; // Minimum travel time on the same island (5 minutes)
  }

  let speedMultiplier = 1.0;
  if (modifiers.cartographyResearched) speedMultiplier += 0.10;
  if (modifiers.hasLighthouse) speedMultiplier += 0.15;
  if (modifiers.atalantaLevel) speedMultiplier += (0.09 + modifiers.atalantaLevel * 0.01);
  if (modifiers.speedBuff) speedMultiplier += modifiers.speedBuff; // items, spells

  const travelConstant = 500;
  const baseDelay = 300; // Grepolis naval constant delay (5 minutes)

  const calculatedSeconds = baseDelay + (distance * travelConstant) / (unitSpeed * worldSpeed * speedMultiplier);
  return Math.round(calculatedSeconds);
}
```

### CS Sniping Recall Scheduler
The scheduler calculates the precise windows for precision recall sniping.

```javascript
/**
 * Calculates the launch and recall timings.
 * @param {Date} targetReturnTime - The target time to land (e.g. CS arrival +/- 1s)
 * @param {number} cancelDelaySeconds - Outward travel duration before recall (D)
 * @returns {object} Timing details
 */
export function calculateRecallTiming(targetReturnTime, cancelDelaySeconds) {
  const D = cancelDelaySeconds; // outward travel duration before recall
  if (D > 600) {
    throw new Error("Recall sniping requires cancel delay to be <= 10 minutes (600 seconds).");
  }

  const targetReturnEpoch = targetReturnTime.getTime();
  
  // Send time is (2 * D) before the target return time
  const sendEpoch = targetReturnEpoch - (2 * D * 1000);
  const sendTime = new Date(sendEpoch);

  // Recall time is exactly halfway between send and return (D seconds after send)
  const recallEpoch = sendEpoch + (D * 1000);
  const recallTime = new Date(recallEpoch);

  return {
    sendTime,
    recallTime,
    cancelDelaySeconds: D,
    totalElapsedSeconds: 2 * D
  };
}
```

### Dummy Target Search API
The endpoint scans the database to find towns suitable as dummy targets for recall sniping.

*   **Query logic**:
    Given an origin town coordinate, the cancel delay $D$ (in seconds), and the slowest unit speed, the query finds towns within a coordinate bounding box. It filters for dummy towns where the calculated travel time is $\ge D$ to ensure the cancel action can be executed at or before the 10 minutes limit, even if the dummy target town itself is further away.

---

## 6. Technical Architecture & Database Schema

### Complete Prisma Schema Extensions
Add these definitions to `prisma/schema.prisma`.

```prisma
// Extension of the Town model in prisma/schema.prisma
model Town {
  id                   Int              @id
  playerId             Int?
  name                 String
  islandX              Int
  islandY              Int
  islandSlot           Int
  points               Int
  player               Player?          @relation(fields: [playerId], references: [id])

  // Custom command center fields
  specialization       String           @default("NONE")
  bunksResearched      Boolean          @default(false)
  plowResearched       Boolean          @default(false)
  cartographyResearched Boolean         @default(false)
  mathResearched       Boolean          @default(false)
  hasThermalBaths      Boolean          @default(false)
  hasTower             Boolean          @default(false)
  hasLighthouse        Boolean          @default(false)

  // Building levels (null represents untracked)
  mainLevel            Int?
  farmLevel            Int?
  barracksLevel        Int?
  docksLevel           Int?
  wallLevel            Int?
  templeLevel          Int?
  lumberLevel          Int?
  stonerLevel          Int?
  ironerLevel          Int?
  marketLevel          Int?
  academyLevel         Int?

  // Relations
  snipeOperations      SnipeOperation[] @relation("TargetTown")
  snipeOrigins         SnipeOperation[] @relation("OriginTown")

  @@index([islandX, islandY])
}

model SnipeOperation {
  id                String         @id @default(uuid())
  label             String
  type              String         @default("recall")
  worldType         String         @default("siege")
  targetTownId      Int
  originTownId      Int
  targetReturnTime  DateTime
  sendTime          DateTime
  recallTime        DateTime?
  status            String         @default("PENDING")
  createdAt         DateTime       @default(now())

  targetTown        Town           @relation("TargetTown", fields: [targetTownId], references: [id])
  originTown        Town           @relation("OriginTown", fields: [originTownId], references: [id])

  @@index([sendTime])
  @@index([status])
}
```

### Component Structure Tree
```
src/
├── app/
│   ├── api/
│   │   ├── towns/
│   │   │   └── route.js                 # CRUD for town configurations and building levels
│   │   ├── snipe/
│   │   │   ├── operations/
│   │   │   │   ├── route.js             # List and create SnipeOperations
│   │   │   │   └── [id]/
│   │   │   │       └── route.js         # Update and delete SnipeOperation by ID
│   │   │   ├── dummy-targets/
│   │   │   │   └── route.js             # Search database for valid recall dummy targets
│   │   │   └── travel-time/
│   │   │       └── route.js             # API travel calculations
│   ├── planner/
│   │   └── page.js                      # Specialized planner with Demolition Simulator
│   ├── snipe/
│   │   ├── page.js                      # Snipe overview and list of active operations
│   │   └── recall/
│   │       └── page.js                  # Recall scheduler UI with clock sync
├── components/
│   ├── DemolitionSimulator.js           # Pop simulation component
│   ├── RecallScheduler.js               # Precision timer & audio indicators
│   ├── DummyFinder.js                   # Search dummy targets listing
│   └── TroopTracker.js                  # Transport validation & troop counts
├── lib/
│   ├── traveltime.js                    # Core calculations
│   └── prisma.js                        # Singleton prisma client
```

### API Routes List with Parameters

#### 1. `GET /api/towns`
*   **Parameters**: `playerId` (int, query parameter).
*   **Response**: Lists all towns matching the playerId, including custom configurations, specialization tags, and building levels.

#### 2. `PUT /api/towns`
*   **Parameters (JSON Body)**:
    *   `townId` (int, required)
    *   `specialization` (string)
    *   `bunksResearched` (boolean)
    *   `plowResearched` (boolean)
    *   `cartographyResearched` (boolean)
    *   `hasThermalBaths` (boolean)
    *   `hasLighthouse` (boolean)
    *   `buildingLevels` (object: `mainLevel`, `farmLevel`, `barracksLevel`, `docksLevel`, `wallLevel`, `templeLevel`, `lumberLevel`, `stonerLevel`, `ironerLevel`, `marketLevel`, `academyLevel`)
*   **Response**: Updated town object.

#### 3. `GET /api/snipe/dummy-targets`
*   **Parameters**:
    *   `origin_id` (int, required) - Origin town ID.
    *   `duration` (int, required) - Outward travel duration $D$ in seconds.
    *   `unit_speed` (int, required) - Base speed of the slowest unit.
    *   `world_speed` (float, required) - Speed factor of the world.
*   **Response**: Returns the top 10 closest towns (with coordinates) where unit travel time is $\ge D$, limiting the coordinate search bounding box.

#### 4. `POST /api/snipe/operations`
*   **Parameters (JSON Body)**:
    *   `label` (string, required)
    *   `type` (string, `recall` or `direct`)
    *   `worldType` (string, `siege` or `revolt`)
    *   `targetTownId` (int, required)
    *   `originTownId` (int, required)
    *   `targetReturnTime` (string, ISO DateTime)
    *   `sendTime` (string, ISO DateTime)
    *   `recallTime` (string, ISO DateTime)
*   **Response**: Saved `SnipeOperation` entry.

#### 5. `PUT /api/snipe/operations/[id]`
*   **Parameters (Path)**:
    *   `id` (string, UUID, required) - Operation ID.
*   **Parameters (JSON Body)**:
    *   `status` (string, required) - Updated operation status (one of: `PENDING`, `SENT`, `RECALLED`, `COMPLETED`, `CANCELLED`).
*   **Response**: JSON body of the updated `SnipeOperation`:
    ```json
    {
      "id": "7fa88c12-32a5-48b9-8bc3-3b10c598375e",
      "label": "CS Recall Snipe Operation",
      "type": "recall",
      "worldType": "siege",
      "targetTownId": 456,
      "originTownId": 123,
      "targetReturnTime": "2026-06-20T12:00:00.000Z",
      "sendTime": "2026-06-20T11:52:00.000Z",
      "recallTime": "2026-06-20T11:56:00.000Z",
      "status": "SENT",
      "createdAt": "2026-06-20T10:00:00.000Z"
    }
    ```

#### 6. `DELETE /api/snipe/operations/[id]`
*   **Parameters (Path)**:
    *   `id` (string, UUID, required) - Operation ID.
*   **Response**: JSON body indicating success status:
    ```json
    {
      "success": true,
      "message": "Operation deleted successfully",
      "id": "7fa88c12-32a5-48b9-8bc3-3b10c598375e"
    }
    ```

---

## 7. Development Strategy & Roadmap

### Iterative Roadmap Phases

```
+------------------------------------------------------------------------------------+
| PHASE 1: DATABASE & CORE COMPUTATION                                               |
| - Install developer dependency: npm install --save-dev vitest                      |
| - Execute Prisma migrations.                                                       |
| - Implement calculateTravelTime & calculateRecallTiming in src/lib/traveltime.js.  |
| - Set up API endpoints for town configuration and dummy targets.                   |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
| PHASE 2: ADVANCED CITY MANAGER & CALCULATOR                                        |
| - Create the building levels entry form and Bunks/Plow modifiers.                  |
| - Build the DemolitionSimulator component showing population reclaimed.            |
| - Implement troop capacity calculations.                                           |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
| PHASE 3: REAL-TIME RECALL SCHEDULER                                                |
| - Build client-server clock offset synchronization.                                |
| - Implement the audio/visual indicator widget for precision recall.                |
| - Connect the DummyFinder widget to the dummy-targets API.                         |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
| PHASE 4: ALLIANCE DASHBOARD & INTEGRATION                                          |
| - Link database-persisted operations into the Main Dashboard.                      |
| - Implement conquest row integrations allowing instant snipe setup.                |
+------------------------------------------------------------------------------------+
```

### Testing Strategy

#### Unit Testing (`vitest` / `jest`):
*   **Developer Dependency Setup**: Execute `npm install --save-dev vitest` to set up the testing framework before running tests.
*   **Travel Engine Calculations**: Write tests for `calculateTravelTime` using various world speeds, unit profiles (Light Ship vs Bireme vs Colony Ship), and modifiers (Lighthouse, Cartography) to verify alignment with game server output.
*   **Recall Timers**: Verify that `calculateRecallTiming` returns times that match the midpoint formula.
*   **Demolition Calculator**: Validate that `getBuildingPopulation` computes the correct values for Senate (main), Temple (temple), and Wall (wall) levels.

```javascript
// Example Unit Test (src/lib/traveltime.test.js)
import { calculateTravelTime, calculateRecallTiming } from './traveltime';

describe('Travel Time Engine', () => {
  test('returns base delay when coordinates are identical', () => {
    const time = calculateTravelTime(100, 100, 100, 100, 13, 2);
    expect(time).toBe(300); // 5 minutes base delay
  });

  test('calculates correct travel time with speed modifiers', () => {
    // 5 units distance, base speed 13, world speed 2, Cartography (+10%), Lighthouse (+15%)
    const time = calculateTravelTime(100, 100, 103, 104, 13, 2, {
      cartographyResearched: true,
      hasLighthouse: true
    });
    expect(time).toBeGreaterThan(300);
  });
});

describe('Recall Timer Midpoint Logic', () => {
  test('calculates exact send and recall times', () => {
    const target = new Date("2026-06-20T12:00:00.000Z");
    const cancelDelay = 240; // 4 minutes cancel delay
    const timings = calculateRecallTiming(target, cancelDelay);
    
    expect(timings.sendTime.toISOString()).toBe("2026-06-20T11:52:00.000Z");
    expect(timings.recallTime.toISOString()).toBe("2026-06-20T11:56:00.000Z");
  });
});
```

#### End-to-End (E2E) Testing (`Playwright`):
*   **Precision Snipe Creation Flow**: Simulates a user navigating to the scheduler, choosing an origin and target town, searching and selecting a dummy target town, clicking "Launch" at the countdown trigger, and verifying that a new database record is created with the status set to `SENT`.
*   **Demolition Optimization Flow**: Simulates updating building levels in the City Manager, verifying that the reclaimed population calculation changes, and validating that the layout warnings disappear when Wall levels reach 0.

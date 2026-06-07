# Grepolis Development: Comprehensive Codebase Analysis

This report documents the findings from a detailed investigation into the Grepolis Next.js application, covering Functionality, Performance (Client-side and Server/Database-side), UI, and UX.

## 1. Functionality

### 1.1 Snipe Timer Travel Time Input Limitation
- **Location:** `src/app/snipe/page.js` (lines 151-158)
- **Issue:** The travel time input field is defined as `<input type="time">`. This native HTML element restricts maximum input to `23:59:59`. In Grepolis, travel times (especially for Colony Ships on slow worlds) frequently exceed 24 hours.
- **Solution:** Change the input approach. Either split it into three separate numeric fields (`<input type="number">`) for Hours, Minutes, and Seconds, or use a text input with a regex pattern (`pattern="\d+:\d{2}:\d{2}"`) and parse the hours manually in `addToQueue` to allow values like `40:15:00`.

### 1.2 Dangerous Database Sync Transaction
- **Location:** `src/app/api/world/sync/route.js` (lines 263-268)
- **Issue:** The cron/sync script executes a sequential Prisma `$transaction` that performs `deleteMany()` on core tables (`town`, `player`, `alliance`, `island`), followed by massive `createMany` operations. This effectively wipes the database and leaves tables empty during the insertion phase, resulting in severe downtime and API timeouts for active users.
- **Solution:** Adopt an atomic table-swap strategy. Insert the new synchronized data into temporary tables (e.g., `town_temp`), then perform a fast SQL-level table rename/swap, and finally truncate the old tables. Alternatively, use chunked upserts and prune rows based on a `last_seen` timestamp.

### 1.3 Missing Logic: City & Army Planner
- **Location:** `src/app/planner/page.js`
- **Issue:** The page is currently just a "Coming Soon!" placeholder with no implemented logic.
- **Solution:** Implement the army planning logic. Fetch `units.json` data, create forms to accept population and city limits, and calculate optimal unit distributions based on offensive/defensive values per population unit.

### 1.4 Poor Abstractions & Error Handling in Scraper
- **Location:** `src/app/api/scraper/grct/route.js` (lines 31-42)
- **Issue:** The GRCT report scraper relies on a naive regular expression (`messageText.match(/\((.*?)\)/)`) to parse dates and fails silently, defaulting to `new Date()`. It also hardcodes attributes like `attacker: "Unknown Attacker (Parsed)"`.
- **Solution:** Utilize the already installed `cheerio` library to robustly target specific DOM nodes (table cells, spans) rather than blindly running regex against text blocks. Throw explicit HTTP errors when crucial data cannot be parsed to alert the user, rather than saving inaccurate fallback data.

---

## 2. Performance

### 2.1 Server-side / Database Performance

#### 2.1.1 Sequential N+1 Blocking Endpoints
- **Location:** `src/app/api/world/meta/route.js`
- **Issue:** The endpoint makes 5 consecutive blocking database calls (e.g., `await prisma.player.count()`, `await prisma.alliance.count()`, etc.). These operations do not depend on one another, meaning response latency scales linearly.
- **Solution:** Group independent asynchronous Prisma calls into a `Promise.all()` to execute them concurrently, drastically reducing overall endpoint latency.

#### 2.1.2 Missing Database Indexes for History Tables
- **Location:** `prisma/schema.prisma` and related API endpoints (`api/world/island/route.js`, `api/world/momentum/route.js`)
- **Issue:** The `TownHistory`, `PlayerHistory`, `AllianceHistory`, and `Report` tables lack indexes on high-cardinality foreign keys (`townId`, `playerId`, `allianceId`) and ranges (`timestamp`). Queries against these fields currently force expensive sequential table scans.
- **Solution:** Add composite indexes in `schema.prisma`, such as `@@index([townId, timestamp])` to `TownHistory`, to optimize time-series queries. Add indices on `attackerTown` and `defenderTown` for the `Report` table.

#### 2.1.3 Inefficient ILIKE Search Queries & Grouping
- **Location:** `src/app/api/world/search/route.js` and `src/app/api/world/meta/route.js`
- **Issue:** The search endpoints use `{ contains: q, mode: 'insensitive' }`, which results in full table scans in PostgreSQL. Furthermore, the `meta` endpoint executes a `groupBy` on `islandX`, `islandY` iterating the entire `Town` table without a composite index.
- **Solution:** For substring search, enable the `pg_trgm` extension in PostgreSQL and apply GiST/GIN indexes on `name` columns. Add a composite index on `(islandX, islandY)` to speed up the geographic aggregation.

### 2.2 Client-side Performance

#### 2.2.1 Massive Main-Thread Blocking GeoJSON Generation
- **Location:** `src/app/map/page.js`
- **Issue:** The client fetches world data in chunks and uses a `useMemo` block to iteratively build a MapBox-compatible GeoJSON `FeatureCollection` from tens of thousands of points. This happens synchronously on the main thread, heavily freezing the UI three separate times as the chunks load.
- **Solution:** Offload the GeoJSON generation to a Web Worker so it does not block the UI. Even better, leverage the existing backend endpoint `/api/world/geojson`, which serves a pre-calculated, gzipped buffer of the GeoJSON, shifting the computation entirely to the server-side cron job.

#### 2.2.2 Client-side Network Waterfalls (Sequential Fetch)
- **Location:** `src/app/stats/page.js` (lines 118-132)
- **Issue:** `fetchMissingTrends` iterates through missing pinned items using a `for...of` loop with an `await fetch(...)` statement inside. This causes a waterfall of network requests, leading to a linear increase in load times based on the number of pinned items.
- **Solution:** Map the requests into an array of promises and resolve them concurrently with `Promise.all()`, or implement a batch backend endpoint that accepts an array of IDs in a single request.

#### 2.2.3 Unoptimized Filtering
- **Location:** `src/app/map/page.js` and `src/app/stats/page.js`
- **Issue:** Text inputs bound to state variables are triggering synchronous array filtering on tens of thousands of items (`data.conquests`, `rawData.towns`) on every single keystroke.
- **Solution:** Implement a debounced state (e.g., using a `useDebounce` hook) to ensure the heavy array filtering operations only execute when the user pauses typing.

---

## 3. UI (User Interface)

### 3.1 Styling Approach: Excessive Inline Styles
- **Location:** `src/components/IslandModal.js`
- **Issue:** The component bypasses the project's Tailwind CSS configuration by relying heavily on verbose inline style objects (e.g., `style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}`). This causes code bloat, hinders maintainability, and prevents the usage of responsive utility variants.
- **Solution:** Refactor the component to use standard Tailwind utility classes (`className="flex items-center justify-between"`). Restrict the `style` prop to purely dynamic variables like calculated widths or custom colors passed down as props.

---

## 4. UX (User Experience)

### 4.1 Full-Page Reloads Destroys SPA State
- **Location:** `src/app/page.js`
- **Issue:** The main Dashboard navigation uses standard native HTML `<a>` tags (`<a href="/reports">`) for internal app routing instead of Next.js's `<Link>` components. This forces a complete browser reload on every click, degrading performance and discarding any client-side state.
- **Solution:** Import `Link` from `next/link` and replace all internal `<a>` tags with `<Link>`.

### 4.2 Race Conditions in Autocomplete Fetching
- **Location:** `src/app/stats/page.js`
- **Issue:** The autocomplete feature uses a `setTimeout` to debounce search requests but fails to implement an `AbortController`. If a user types quickly and an older, slower query resolves after a newer query, the state will be overwritten with stale autocomplete results.
- **Solution:** Implement an `AbortController` inside the `useEffect` hook. When the effect is cleaned up (on subsequent keystrokes), call `abort()` to cancel the pending HTTP request and avoid state corruption.

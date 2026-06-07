# Codebase Analysis: `src/` Directory

## Overview
This report details the findings from analyzing the `src/` directory, focusing on the Next.js application (`app/`), React components (`components/`), and utility libraries (`lib/`). Several critical functionality bugs, UI/UX issues, and architectural flaws were identified.

## 1. Functionality Analysis

### A. Missing Logic: City & Army Planner
- **Location:** `src/app/planner/page.js`
- **Issue:** The page is currently a placeholder ("Coming Soon!"). There is no implementation to plan nukes or defensive compositions using unit stats.
- **Solution:** Implement the logic by fetching `units.json` data, creating a form to input population limits, and calculating the optimal distribution of units based on offensive/defensive values per population unit.

### B. Bug: Snipe Timer Travel Time Input Limitation
- **Location:** `src/app/snipe/page.js`, lines 151-158
- **Issue:** The `travelTime` input uses `type="time"`, which restricts the maximum input to 23 hours, 59 minutes, and 59 seconds. In Grepolis, Colony Ship travel times can frequently exceed 24 hours (up to 48 hours in slow worlds).
- **Solution:** Change the input mechanism. Either use three separate numeric `<input type="number">` fields for Hours, Minutes, and Seconds, or use a text input with a regex pattern `pattern="\d+:\d{2}:\d{2}"` to allow inputs like `40:15:00`. Parse the string accordingly in `addToQueue`.

### C. Architectural Flaw: World Data Sync Locks Database
- **Location:** `src/app/api/world/sync/route.js`, lines 263-268
- **Issue:** The sync script executes a large sequential Prisma `$transaction` that performs `deleteMany()` on the `town`, `player`, `alliance`, and `island` tables before recreating them using `createMany`. This completely deletes the active data and leaves the tables empty during the potentially long insertion process, causing severe downtime or query timeouts for any users accessing the app during the sync.
- **Solution:** Use an "Upsert" strategy (which might be slow for 50k rows), or more optimally, use temporary tables:
  1. Insert new data into temporary tables (`town_temp`, `player_temp`, etc.).
  2. Perform a fast atomic rename/swap of the tables at the SQL level.
  3. Truncate the old tables. 
  Alternatively, process chunks with `upsert` and delete rows that no longer exist (e.g., using the `last_seen` timestamp).

### D. Poor Abstractions & Error Handling: GRCT Scraper
- **Location:** `src/app/api/scraper/grct/route.js`, lines 31-42
- **Issue:** 
  - The date extraction relies on a very naive regex `messageText.match(/\((.*?)\)/)` and fails silently, defaulting to `new Date()` if it cannot parse the match.
  - The scraper hardcodes fallback values like `attacker: "Unknown Attacker (Parsed)"`, `morale: 100`, and `luck: 0`.
- **Solution:** Enhance the parsing logic with Cheerio to extract specific table cells or spans instead of running a blanket regex on the `.quote_message` text block. Throw a handled error to the user if the date or critical information cannot be parsed, rather than silently defaulting to inaccurate data.

## 2. UI & UX Analysis

### A. Performance Bottleneck: Main-Thread GeoJSON Compilation
- **Location:** `src/app/map/page.js`, lines 99-187
- **Issue:** The massive `RawMapData` (tens of thousands of towns and islands) is processed into a MapBox-compatible GeoJSON FeatureCollection synchronously on the main thread using `useMemo`. This blocks the UI, causing the page to freeze for seconds during map load.
- **Solution:** 
  1. Offload the GeoJSON generation to a Web Worker so it doesn't block the UI thread.
  2. Alternatively, use the already existing pre-calculated, gzipped GeoJSON available at the `/api/world/geojson` route, which instantly serves the compressed binary buffer, shifting the computation entirely to the server-side cron job.

### B. Poor UX: Full-Page Reloads
- **Location:** `src/app/page.js`, lines 10, 16, 22
- **Issue:** The Dashboard page uses native HTML `<a>` tags for internal routing instead of Next.js `<Link>` components. This causes a full page reload when navigating, destroying application state and removing the benefits of a Single Page Application (SPA).
- **Solution:** Import `Link` from `next/link` and replace all `<a href="...">` elements with `<Link href="...">`.

### C. Styling Approach: Excessive Inline Styles
- **Location:** `src/components/IslandModal.js`, lines 50-65, 93, 102-104, etc.
- **Issue:** The component relies heavily on massive inline style objects (e.g., `style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ... }}`) instead of leveraging the project's Tailwind CSS configuration. This makes the code verbose, harder to maintain, and prevents the use of responsive utility variants.
- **Solution:** Refactor the inline styles to use Tailwind utility classes (e.g., `className="flex items-center justify-between ..."`). Keep `style={{}}` only for dynamic values like calculated widths or custom colors passed as props.

## Summary of Solutions to Implement
1. Convert `<a>` to `<Link>` in `app/page.js`.
2. Refactor `IslandModal.js` to use Tailwind CSS.
3. Update `app/snipe/page.js` to allow >24h travel times using numeric inputs.
4. Redesign `api/world/sync/route.js` to use an upsert/temp-table strategy instead of dropping all tables.
5. Improve the Regex and error handling in the `api/scraper/grct/route.js` parser.
6. Offload `map/page.js` GeoJSON compilation to a Web Worker or consume the pre-calculated API endpoint.
7. Implement the `app/planner/page.js` feature.

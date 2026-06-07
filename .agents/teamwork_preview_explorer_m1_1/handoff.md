# Handoff Report

## 1. Observation
- `src/app/page.js`: Navigation to tools uses standard `<a>` tags (`<a href="/reports" ...>`) instead of Next.js `<Link>` components.
- `src/app/snipe/page.js`: The travel time input is defined as `<input type="time" ... />`, restricting values to `HH:MM:SS` up to 23:59:59.
- `src/app/api/world/sync/route.js`: The database update transaction starts by deleting all existing data: `prisma.town.deleteMany()`, `prisma.player.deleteMany()`, etc., followed by `createMany()`.
- `src/app/map/page.js`: Fetches raw data from `/api/world/ocean/[id]` and iterates over tens of thousands of items in a `useMemo` hook to build a GeoJSON FeatureCollection.
- `src/app/api/world/geojson/route.js`: An endpoint exists that returns a cached, pre-computed gzip buffer of the GeoJSON.
- `src/components/IslandModal.js`: Contains numerous verbose inline style objects, e.g., `style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1, minHeight: 0 }}`.
- `src/app/planner/page.js`: Currently only renders a placeholder "Coming Soon!" text with no functionality.
- `src/app/api/scraper/grct/route.js`: Date parsing uses `messageText.match(/\((.*?)\)/)` and if parsing fails, it silently assigns `date = new Date()`. Attributes like attacker/defender are hardcoded to `"Unknown Attacker (Parsed)"`.

## 2. Logic Chain
- Using `<a>` tags in a Next.js application forces a full browser reload, discarding SPA state and degrading performance.
- Grepolis is a slow-paced game where unit travel times frequently exceed 24 hours. A standard `type="time"` input prevents players from planning long-distance snipes.
- The sync script's `deleteMany` strategy creates a window of time during the transaction where tables are empty or heavily locked. This causes downtime and timeouts for active users.
- Generating a massive GeoJSON object with 50,000+ points inside a synchronous `useMemo` hook runs on the main thread, freezing the UI. Fetching the already cached GeoJSON from the available backend endpoint would eliminate this client-side bottleneck entirely.
- Extensive inline styles bypass the benefits of the project's Tailwind setup, causing bloat and making responsive adjustments difficult.
- Silent fallbacks in the GRCT scraper lead to inaccurate database entries without the user being aware that parsing failed.

## 3. Caveats
- I did not test the actual database sync query performance (e.g., how long the transaction takes in production), so the downtime window length is an assumption based on the volume of data (50k+ rows).
- I did not fully map out the DOM structure of a GRCT report to provide a complete robust Cheerio extraction script.
- The exact implementation details of the Planner (e.g., `units.json` format) were not investigated.

## 4. Conclusion
The codebase contains several critical bugs and performance bottlenecks that need addressing. The priority should be fixing the database sync mechanism to prevent downtime, optimizing the Map page by utilizing the pre-computed GeoJSON endpoint, and fixing the Snipe timer input type to support >24h travel times. UI consistency should be improved by transitioning to Tailwind CSS and using Next.js `<Link>` elements.

## 5. Verification Method
- Run `npm run build` to ensure no syntax errors are introduced during refactoring.
- Inspect the network tab on the dashboard to verify that clicking links does not trigger a full page reload.
- Try entering "40:00:00" in the Snipe Timer travel time field to ensure it is accepted.
- Profile the Map page using Chrome DevTools (Performance tab) to verify that the main thread is no longer blocked for seconds during initialization.

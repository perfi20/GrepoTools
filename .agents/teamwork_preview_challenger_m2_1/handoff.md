# Handoff Report

## 1. Observation
- `prisma/schema.prisma` contains definitions for `TownHistory`, `PlayerHistory`, `AllianceHistory`, and `Report` tables, none of which have indexes defined on fields used for queries (`townId`, `playerId`, `allianceId`, `timestamp`, `attackerTown`, `defenderTown`).
- `src/app/api/world/island/route.js` and `src/app/api/world/momentum/route.js` query the aforementioned tables filtering by IDs and `timestamp`.
- `src/app/api/world/meta/route.js` performs five consecutive `await prisma.*` queries (e.g., `count()`, `groupBy()`) on large tables.
- `src/app/api/world/search/route.js` uses `name: { contains: q, mode: 'insensitive' }` for Player and Alliance queries.
- `src/app/map/page.js` parses the entire world dataset (`rawData.towns`, `rawData.islands`) inside a `useMemo` block that executes three times sequentially as chunked fetches complete.
- `src/app/stats/page.js` uses a `for...of` loop with an `await fetch(...)` in `fetchMissingTrends`, executing HTTP requests sequentially. It also executes debounced `fetch` requests without `AbortController` cancellation logic.

## 2. Logic Chain
- Without indexes on high-cardinality foreign keys (`townId`, `playerId`, `allianceId`) and ranges (`timestamp`), the database must perform sequential table scans during reads, dramatically slowing down API responses (`api/world/island` and `api/world/momentum`).
- Using consecutive `await` statements in `api/world/meta/route.js` causes linear time execution for independent queries. Grouping them via `Promise.all()` would reduce the overall request latency.
- Case-insensitive `contains` queries in PostgreSQL result in full table scans unless optimized via `pg_trgm` indexes, creating a severe bottleneck for autocomplete search APIs.
- Rebuilding a 100k+ item GeoJSON `FeatureCollection` synchronously in the React render cycle (`src/app/map/page.js`) will freeze the main browser thread. Doing this 3 times consecutively degrades initial load UX.
- Executing HTTP fetches inside a `for...of` loop (`src/app/stats/page.js`) causes a client-side waterfall delay equivalent to an N+1 query problem, increasing loading times for pinned items linearly based on the number of pins.
- Unaborted fetch requests in React `useEffect` can resolve out-of-order, leading to race conditions where stale data overwrites new search queries.

## 3. Caveats
- Actual performance impact depends heavily on the volume of data in the active world. A small test world may not visibly expose the index or full-table scan issues.
- Client-side MapLibre rendering is inherently heavy; pushing GeoJSON parsing to a Web Worker is ideal but might overcomplicate the current architecture.
- I was not able to build/run the application locally or profile it interactively via `run_command` because the command required user permission which timed out. Findings are based entirely on static code analysis.

## 4. Conclusion
Both server-side and client-side code exhibit critical scaling bottlenecks. The application needs schema-level database optimizations (adding indexes, enabling `pg_trgm`), refactoring of API endpoints to resolve sequential blocking (using `Promise.all()`), and client-side optimizations to offload heavy calculations, batch requests, and implement proper search debouncing and abortion. 

## 5. Verification Method
- **Server/DB**: Inspect `prisma/schema.prisma` and observe the lack of `@index` directives. Review `src/app/api/world/meta/route.js` line 46-52 to see the sequential `await`s. Use `npm run dev` with Prisma logging enabled (`log: ['query']` in Prisma client) to observe query execution times on large datasets.
- **Client**: Review `src/app/stats/page.js` line 118-130 to see the sequential loop. Use Chrome DevTools Performance Tab to record a trace while loading `src/app/map/page.js` to observe the massive Long Task blocking the main thread during GeoJSON generation.

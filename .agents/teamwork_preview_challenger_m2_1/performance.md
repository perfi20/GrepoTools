# Grepolis Next.js Performance Profiling Report

## 1. Server-side and Database Performance

### Missing Database Indexes
Several large history and transactional tables lack appropriate indexes, which will result in expensive sequential scans on large datasets.
- **`TownHistory`**: In `src/app/api/world/island/route.js`, history is queried using `where: { townId: { in: townIds }, timestamp: { gte: ... } }`. There are no indexes on `townId` or `timestamp` in `prisma/schema.prisma`.
- **`PlayerHistory` & `AllianceHistory`**: In `src/app/api/world/momentum/route.js`, queries filter by `playerId`/`allianceId` and `timestamp`. Without indexes, this will cause full table scans.
- **`Report`**: In `src/app/api/world/island/route.js`, it queries `OR: [{ attackerTown: { in: townNames } }, { defenderTown: { in: townNames } }]` and filters by `date`. No indexes exist on these string fields or the date field.

### Sequential Database Queries (N+1-like Endpoint Latency)
- **`src/app/api/world/meta/route.js`**: The endpoint makes 5 separate blocking calls sequentially:
  ```javascript
  const totalPlayers = await prisma.player.count();
  const totalAlliances = await prisma.alliance.count();
  const totalTowns = await prisma.town.count();
  const totalIslands = await prisma.island.count();
  const populatedIslandsCoords = await prisma.town.groupBy({ by: ['islandX', 'islandY'] });
  ```
  These do not depend on each other and should be executed concurrently using `Promise.all()` to drastically reduce the endpoint response time.
- **Inefficient GroupBy**: The `groupBy` operation above iterates the entire `Town` table to find populated islands. Since there is no composite index on `(islandX, islandY)`, this is an expensive full-table aggregation.

### Inefficient ILIKE Search Queries
- **`src/app/api/world/search/route.js` & `api/world/momentum/route.js`**: Searching uses `name: { contains: q, mode: 'insensitive' }`. In PostgreSQL, case-insensitive substring matches require full table scans unless optimized with the `pg_trgm` extension and GiST/GIN indexes.

---

## 2. Client-side Performance

### Massive Main-Thread Blocking GeoJSON Generation
- **`src/app/map/page.js`**: The client fetches world data in multiple chunks (core, inner, outer). When each chunk resolves, `setRawData` updates the state, triggering the `data` `useMemo` block. This block maps over tens of thousands of towns and islands to reconstruct an entirely new GeoJSON FeatureCollection (100k+ features). This synchronous recalculation will severely freeze the main UI thread 3 separate times on load.

### Sequential HTTP Requests (Client-side N+1)
- **`src/app/stats/page.js` (lines 118-132)**: The `fetchMissingTrends` function loops over missing pinned items and awaits a fetch call for each individually:
  ```javascript
  for (const item of missing) {
    const res = await fetch(`/api/world/momentum?q=${encodeURIComponent(item.name)}&type=${type}`);
    // ...
  }
  ```
  If a user pins 10 items, it makes 10 network requests sequentially, causing a massive waterfall delay. This should use `Promise.all()` to fetch them concurrently, or be solved by a batch API endpoint.

### Unoptimized Filtering & Missing Debouncing
- **`src/app/map/page.js`**: `searchQuery` immediately filters the 50,000+ towns array within `useMemo` on every keystroke because the text input is fully controlled without debouncing. This will cause typing lag.
- **`src/app/stats/page.js`**: Similar issue with `conquestFilter`, where typing immediately filters the `data.conquests` array synchronously.

### Race Conditions in Autocomplete Fetching
- **`src/app/stats/page.js`**: The `useEffect` for `allianceSearch` and `playerSearch` implements a basic 400ms `setTimeout` debounce, but it fails to cancel pending HTTP requests using an `AbortController`. If an older, slower search query resolves after a newer query, the state will be overwritten with stale search results.

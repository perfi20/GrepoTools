import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

// Fetches the lastSync epoch time from the database
// We use unstable_cache to keep this in Next.js server memory indefinitely.
// It is invalidated manually by calling revalidateTag('sync-meta') during the hourly sync script.
export const getCachedSyncEpoch = unstable_cache(
  async () => {
    console.log("[CACHE MISS] Fetching fresh SyncMetadata from database...");
    const meta = await prisma.syncMetadata.findUnique({
      where: { id: 1 },
      select: { lastSync: true }
    });
    // Fallback to 0 if no sync has ever occurred
    const epoch = meta ? Math.floor(meta.lastSync.getTime() / 1000) : 0;
    console.log(`[CACHE SET] New cache-buster epoch: ${epoch}`);
    return epoch;
  },
  ['sync-meta'],
  { tags: ['sync-meta'] }
);

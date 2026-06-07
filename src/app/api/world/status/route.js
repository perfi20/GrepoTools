import { NextResponse } from 'next/server';
import { getCachedSyncEpoch } from '@/lib/syncMetadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const epoch = await getCachedSyncEpoch();
    if (epoch === 0) {
      return NextResponse.json({ lastSync: null });
    }
    return NextResponse.json({ lastSync: new Date(epoch * 1000) });
  } catch (error) {
    console.error("World Status API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

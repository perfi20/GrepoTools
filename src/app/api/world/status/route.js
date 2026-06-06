import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    if (!meta) {
      return NextResponse.json({ lastSync: null });
    }
    return NextResponse.json({ lastSync: meta.lastSync });
  } catch (error) {
    console.error("World Status API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

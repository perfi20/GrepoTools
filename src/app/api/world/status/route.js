import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const meta = await prisma.syncMetadata.findUnique({ where: { id: 1 } });
    if (!meta) {
        return NextResponse.json({ success: true, lastSync: null });
    }
    
    return NextResponse.json({ 
        success: true, 
        lastSync: meta.lastSync 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

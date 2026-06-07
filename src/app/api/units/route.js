import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const units = await prisma.unit.findMany();
    return NextResponse.json({ success: true, units });
  } catch (error) {
    console.error('Failed to fetch units:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

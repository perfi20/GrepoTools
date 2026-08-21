import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { password } = await request.json();
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (!password) {
      return NextResponse.json({ success: false, error: 'Invalid admin passcode' }, { status: 401 });
    }

    const p1 = String(password).trim();
    const p2 = String(expectedPassword).trim();

    const b1 = Buffer.from(p1);
    const b2 = Buffer.from(p2);

    let match = true;
    if (b1.length !== b2.length) {
      // Avoid timing attack on length by comparing b2 to itself, but flag as false
      match = false;
      crypto.timingSafeEqual(b2, b2);
    } else {
      match = crypto.timingSafeEqual(b1, b2);
    }

    if (!match) {
      return NextResponse.json({ success: false, error: 'Invalid admin passcode' }, { status: 401 });
    }

    return NextResponse.json({ success: true, message: 'Admin access granted' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

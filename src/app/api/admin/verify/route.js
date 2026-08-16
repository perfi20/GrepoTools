import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { password } = await request.json();
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (!password || password.trim() !== expectedPassword.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid admin passcode' }, { status: 401 });
    }

    return NextResponse.json({ success: true, message: 'Admin access granted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

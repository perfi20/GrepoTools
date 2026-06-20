import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }

    const updatedOp = await prisma.snipeOperation.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json(updatedOp);
  } catch (error) {
    console.error(`PUT /api/snipe/operations/${params.id} error:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    await prisma.snipeOperation.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Operation deleted successfully", id });
  } catch (error) {
    console.error(`DELETE /api/snipe/operations/${params.id} error:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

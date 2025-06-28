import { NextRequest, NextResponse } from 'next/server';
import { sendCustomerConfirmation } from '../../../../../lib/email';

export async function POST(request: NextRequest) {
  try {
    const { reservation } = await request.json();
    if (!reservation) {
      return NextResponse.json({ error: 'Missing reservation data' }, { status: 400 });
    }
    await sendCustomerConfirmation(reservation);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send customer confirmation:', error);
    return NextResponse.json({ error: 'Failed to send confirmation' }, { status: 500 });
  }
} 
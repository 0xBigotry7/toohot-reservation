import { NextRequest, NextResponse } from 'next/server';
import { sendCustomerConfirmation } from '../../../lib/email';

export async function POST(request: NextRequest) {
  try {
    const { reservation } = await request.json();
    if (!reservation) {
      return NextResponse.json({ error: 'Missing reservation data' }, { status: 400 });
    }
    // Add reservation type for dining reservations
    const reservationWithType = { ...reservation, reservation_type: 'dining' };
    await sendCustomerConfirmation(reservationWithType);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send dining confirmation:', error);
    return NextResponse.json({ error: 'Failed to send confirmation' }, { status: 500 });
  }
} 
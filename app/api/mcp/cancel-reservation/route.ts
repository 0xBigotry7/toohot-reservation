import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const {
      confirmation_code,
      reason = 'Cancelled via AI Chatbot',
      customer_email // Optional for verification
    } = await request.json();

    // Validate required fields
    if (!confirmation_code) {
      return NextResponse.json({ 
        error: 'Missing required field: confirmation_code' 
      }, { status: 400 });
    }

    // Search for the reservation in both tables
    const [omakaseResult, diningResult] = await Promise.all([
      supabase
        .from('omakase_reservations')
        .select('*')
        .eq('confirmation_code', confirmation_code.toUpperCase())
        .single(),
      supabase
        .from('dining_reservations')
        .select('*')
        .eq('confirmation_code', confirmation_code.toUpperCase())
        .single()
    ]);

    let reservation = null;
    let tableName = '';
    let reservationType = '';

    if (omakaseResult.data && !omakaseResult.error) {
      reservation = omakaseResult.data;
      tableName = 'omakase_reservations';
      reservationType = 'omakase';
    } else if (diningResult.data && !diningResult.error) {
      reservation = diningResult.data;
      tableName = 'dining_reservations';
      reservationType = 'dining';
    }

    if (!reservation) {
      return NextResponse.json({
        error: 'Reservation not found',
        confirmation_code: confirmation_code.toUpperCase()
      }, { status: 404 });
    }

    // Verify email if provided (additional security)
    if (customer_email && reservation.customer_email.toLowerCase() !== customer_email.toLowerCase()) {
      return NextResponse.json({
        error: 'Email does not match reservation',
        confirmation_code: confirmation_code.toUpperCase()
      }, { status: 403 });
    }

    // Check if reservation is already cancelled
    if (reservation.status === 'cancelled') {
      return NextResponse.json({
        error: 'Reservation is already cancelled',
        reservation: {
          confirmation_code: reservation.confirmation_code,
          status: reservation.status,
          cancellation_reason: reservation.cancellation_reason
        }
      }, { status: 400 });
    }

    // Check if reservation has already been completed
    if (reservation.status === 'completed') {
      return NextResponse.json({
        error: 'Cannot cancel a completed reservation',
        reservation: {
          confirmation_code: reservation.confirmation_code,
          status: reservation.status
        }
      }, { status: 400 });
    }

    // Update reservation status to cancelled
    const { data: updatedReservation, error: updateError } = await supabase
      .from(tableName)
      .update({
        status: 'cancelled',
        cancellation_reason: reason
      })
      .eq('id', reservation.id)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ 
        error: 'Failed to cancel reservation',
        details: updateError.message 
      }, { status: 500 });
    }

    // Log cancellation for monitoring (emails now handled by Supabase)
    console.log(`${reservationType} reservation ${confirmation_code.toUpperCase()} cancelled via MCP (emails handled by Supabase):`, updatedReservation.id);

    return NextResponse.json({
      success: true,
      message: `Reservation ${confirmation_code.toUpperCase()} has been successfully cancelled`,
      reservation: {
        id: updatedReservation.id,
        confirmation_code: updatedReservation.confirmation_code,
        customer_name: updatedReservation.customer_name,
        customer_email: updatedReservation.customer_email,
        reservation_date: updatedReservation.reservation_date,
        reservation_time: updatedReservation.reservation_time,
        party_size: updatedReservation.party_size,
        type: reservationType,
        status: updatedReservation.status,
        cancellation_reason: updatedReservation.cancellation_reason
      },
      cancelled_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cancel reservation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
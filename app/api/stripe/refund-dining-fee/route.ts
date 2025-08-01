import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe only if the key is available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia'
    });
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      reservationId,
      chargeId,
      amount, // Amount in cents to refund
      reason = 'Admin initiated refund'
    } = body;

    // Validate required fields
    if (!reservationId || !chargeId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if Stripe is initialized
    if (!stripe) {
      return NextResponse.json(
        { error: 'Payment processing is not configured. Please check STRIPE_SECRET_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Get reservation to verify it exists and has been charged
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('dining_reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    if (!reservation.no_show_fee_charged) {
      return NextResponse.json(
        { error: 'No no-show fee has been charged for this reservation' },
        { status: 400 }
      );
    }

    // Create the refund in Stripe
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: amount, // Refund amount in cents
      reason: 'requested_by_customer',
      metadata: {
        reservation_id: reservationId,
        admin_reason: reason,
        refund_type: 'dining_no_show_fee'
      }
    });

    // Update reservation to clear the no-show fee charge
    const { error: updateError } = await supabaseAdmin
      .from('dining_reservations')
      .update({ 
        no_show_fee_charged: false,
        no_show_fee_refunded_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (updateError) {
      console.error('Failed to update reservation:', updateError);
      // Continue - refund was successful
    }

    // Log the refund
    try {
      await supabaseAdmin
        .from('dining_payment_logs')
        .insert({
          reservation_id: reservationId,
          stripe_customer_id: reservation.stripe_customer_id,
          stripe_payment_intent_id: refund.payment_intent as string,
          event_type: 'no_show_fee_refunded',
          amount: amount,
          status: 'succeeded',
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log refund:', logError);
      // Continue - refund was successful
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      refundAmount: amount,
      status: refund.status,
      message: `Refund of $${(amount / 100).toFixed(2)} processed successfully`
    });

  } catch (error: any) {
    console.error('Dining refund error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process refund' },
      { status: 500 }
    );
  }
}
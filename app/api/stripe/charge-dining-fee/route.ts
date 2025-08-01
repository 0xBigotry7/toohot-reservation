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
      chargeType, // 'no_show' only for dining
      amount // Amount in cents ($25 per person)
    } = body;

    // Validate required fields
    if (!reservationId || !chargeType || !amount) {
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

    // Get reservation details
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

    // Check if payment method is saved
    if (!reservation.stripe_customer_id || !reservation.stripe_payment_method_id) {
      return NextResponse.json(
        { error: 'No payment method on file for this reservation' },
        { status: 400 }
      );
    }

    // Check if fee has already been charged
    if (reservation.no_show_fee_charged) {
      return NextResponse.json(
        { error: 'No-show fee has already been charged for this reservation' },
        { status: 400 }
      );
    }

    // Create payment intent and charge immediately
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: reservation.stripe_customer_id,
      payment_method: reservation.stripe_payment_method_id,
      confirm: true,
      off_session: true,
      description: `TooHot Dining No-show fee - ${reservation.reservation_date} - ${reservation.customer_name}`,
      metadata: {
        reservation_id: reservationId,
        charge_type: chargeType,
        reservation_date: reservation.reservation_date,
        party_size: reservation.party_size.toString()
      },
      receipt_email: reservation.customer_email,
      statement_descriptor_suffix: 'NOSHOW'
    });

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }

    // Get charge ID for potential refunds
    const charges = await stripe.charges.list({
      payment_intent: paymentIntent.id,
      limit: 1
    });
    
    const chargeId = charges.data[0]?.id;

    // Update reservation with charge info
    const { error: updateError } = await supabaseAdmin
      .from('dining_reservations')
      .update({
        no_show_fee_charged: true,
        no_show_fee_amount: amount,
        no_show_fee_charged_at: new Date().toISOString(),
        stripe_charge_id: chargeId || paymentIntent.id
      })
      .eq('id', reservationId);

    if (updateError) {
      console.error('Failed to update reservation:', updateError);
      // Continue - charge was successful
    }

    // Log the charge
    try {
      await supabaseAdmin
        .from('dining_payment_logs')
        .insert({
          reservation_id: reservationId,
          stripe_customer_id: reservation.stripe_customer_id,
          stripe_payment_intent_id: paymentIntent.id,
          event_type: 'no_show_fee_charged',
          amount,
          status: 'succeeded',
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log charge:', logError);
      // Continue - charge was successful
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      chargeId: chargeId,
      amount,
      message: `No-show fee of $${(amount / 100).toFixed(2)} charged successfully`
    });

  } catch (error: any) {
    console.error('Dining charge error:', error);
    
    // Log failed attempt
    try {
      const { reservationId } = await request.json();
      if (reservationId) {
        await supabaseAdmin
          .from('dining_payment_logs')
          .insert({
            reservation_id: reservationId,
            event_type: 'no_show_fee_charge_failed',
            status: 'failed',
            error_message: error.message || 'Unknown error',
            created_at: new Date().toISOString()
          });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Failed to charge no-show fee' },
      { status: 500 }
    );
  }
}
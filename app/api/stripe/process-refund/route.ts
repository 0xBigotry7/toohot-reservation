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
      amount, // Amount in cents
      reason = 'Admin initiated refund',
      refundPercentage = 100
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

    // Create the refund in Stripe
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: amount, // Partial refund amount in cents
      reason: 'requested_by_customer',
      metadata: {
        reservation_id: reservationId,
        admin_reason: reason,
        refund_percentage: refundPercentage.toString()
      }
    });

    // Get current refund percentage to calculate cumulative
    const { data: currentReservation } = await supabaseAdmin
      .from('omakase_reservations')
      .select('cancellation_refund_percentage')
      .eq('id', reservationId)
      .single();
    
    const currentRefundPercentage = currentReservation?.cancellation_refund_percentage || 0;
    const cumulativeRefundPercentage = currentRefundPercentage + refundPercentage;
    
    // Update reservation payment status in database
    const newPaymentStatus = cumulativeRefundPercentage >= 100 ? 'refunded' : 'partially_refunded';
    
    const { error: updateError } = await supabaseAdmin
      .from('omakase_reservations')
      .update({ 
        payment_status: newPaymentStatus,
        cancellation_refund_percentage: cumulativeRefundPercentage,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (updateError) {
      console.error('Failed to update reservation:', updateError);
      // Continue even if database update fails - refund was successful
    }

    // Try to log the refund in the refund logs table (table might not exist yet)
    try {
      const { error: logError } = await supabaseAdmin
        .from('omakase_refund_logs')
        .insert({
          reservation_id: reservationId,
          stripe_refund_id: refund.id,
          stripe_payment_intent_id: refund.payment_intent as string,
          refund_amount: amount,
          original_amount: refund.charge ? (await stripe.charges.retrieve(refund.charge as string)).amount : amount,
          refund_percentage: refundPercentage,
          reason: reason,
          status: 'succeeded'
        });

      if (logError) {
        console.error('Failed to log refund:', logError);
        // Continue even if logging fails - refund was successful
      }
    } catch (logError) {
      console.error('Failed to log refund (table might not exist):', logError);
      // Continue even if logging fails - refund was successful
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      refundAmount: amount,
      status: refund.status,
      message: `Refund of $${(amount / 100).toFixed(2)} processed successfully`
    });

  } catch (error: any) {
    console.error('Refund processing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process refund' },
      { status: 500 }
    );
  }
}
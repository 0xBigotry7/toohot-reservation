import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export async function POST(request: NextRequest) {
  try {
    const { id, updates, type } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Missing reservation id' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid updates' }, { status: 400 });
    }

    if (!type || (type !== 'omakase' && type !== 'dining')) {
      return NextResponse.json({ error: 'Missing or invalid reservation type' }, { status: 400 });
    }

    // Determine which table to update based on reservation type
    const tableName = type === 'omakase' ? 'omakase_reservations' : 'dining_reservations';

    // Update the reservation using service role key (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if this is an omakase cancellation that requires automatic refund
    if (stripe && type === 'omakase' && updates.status === 'cancelled' && data.payment_status === 'paid' && data.stripe_charge_id) {
      try {
        // Calculate refund based on time until reservation
        const reservationDate = new Date(data.reservation_date);
        const now = new Date();
        const hoursUntilReservation = (reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        let refundPercentage = 0;
        if (hoursUntilReservation > 48) {
          refundPercentage = 100; // Full refund
        } else if (hoursUntilReservation > 24) {
          refundPercentage = 50; // 50% refund
        }
        // else 0% refund

        if (refundPercentage > 0 && data.prepayment_amount) {
          const refundAmount = Math.round((data.prepayment_amount * refundPercentage) / 100);
          
          // Process refund through Stripe
          const refund = await stripe.refunds.create({
            charge: data.stripe_charge_id,
            amount: refundAmount,
            reason: 'requested_by_customer',
            metadata: {
              reservation_id: id,
              auto_refund: 'true',
              refund_percentage: refundPercentage.toString(),
              cancellation_reason: updates.cancellation_reason || 'No reason provided'
            }
          });

          // Update payment status
          await supabaseAdmin
            .from('omakase_reservations')
            .update({ 
              payment_status: refundPercentage === 100 ? 'refunded' : 'partially_refunded',
              cancellation_refund_percentage: refundPercentage
            })
            .eq('id', id);

          // Try to log the refund (table might not exist)
          try {
            await supabaseAdmin
              .from('omakase_refund_logs')
              .insert({
                reservation_id: id,
                stripe_refund_id: refund.id,
                stripe_payment_intent_id: refund.payment_intent as string,
                refund_amount: refundAmount,
                original_amount: data.prepayment_amount,
                refund_percentage: refundPercentage,
                reason: `Auto-refund on cancellation: ${refundPercentage}% based on policy`,
                status: 'succeeded'
              });
          } catch (error) {
            console.error('Failed to log refund (table might not exist):', error);
            // Continue - refund was successful
          }

          // Update response data with new payment status
          data.payment_status = refundPercentage === 100 ? 'refunded' : 'partially_refunded';
          data.cancellation_refund_percentage = refundPercentage;
        }
      } catch (refundError) {
        console.error('Auto-refund failed:', refundError);
        // Continue with the response even if refund fails
        // Admin can manually process refund later
      }
    }

    // Add the type to the returned data for consistency
    const responseData = { ...data, type };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
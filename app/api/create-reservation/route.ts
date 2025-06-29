import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { sendCustomerConfirmation } from '../../../lib/email';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const reservationData = await request.json();
    
    // Validate required fields
    const requiredFields = ['customer_name', 'customer_email', 'customer_phone', 'reservation_date', 'reservation_time', 'party_size'];
    for (const field of requiredFields) {
      if (!reservationData[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Determine reservation type and table
    const reservationType = reservationData.type || 'omakase';
    const tableName = reservationType === 'omakase' ? 'omakase_reservations' : 'dining_reservations';

    // Add default values
    const newReservation = {
      ...reservationData,
      status: reservationData.status || 'confirmed',
      confirmation_code: reservationData.confirmation_code || nanoid(8).toUpperCase()
    };

    // Remove the type field from the reservation data since it's not stored in the table
    delete newReservation.type;

    // Create the reservation using service role key (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .insert([newReservation])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send confirmation email if reservation is confirmed
    if (data.status === 'confirmed' && data.confirmation_code) {
      try {
        await sendCustomerConfirmation({
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          customer_phone: data.customer_phone,
          reservation_date: data.reservation_date,
          reservation_time: data.reservation_time,
          party_size: data.party_size,
          special_requests: data.special_requests || '',
          reservation_type: reservationType
        });
        console.log(`Confirmation email sent successfully for ${reservationType} reservation:`, data.id);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the entire request if email fails, just log it
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
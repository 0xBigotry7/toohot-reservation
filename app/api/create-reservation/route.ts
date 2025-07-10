import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { getInitialReservationStatus, shouldAutoConfirm } from '../../../lib/auto-confirmation';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const reservationData = await request.json();
    
    // Validate required fields
    const requiredFields = ['customer_name', 'reservation_date', 'reservation_time', 'party_size'];
    for (const field of requiredFields) {
      if (!reservationData[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Validate that at least one contact method is provided
    if (!reservationData.customer_email && !reservationData.customer_phone) {
      return NextResponse.json({ error: 'Either customer_email or customer_phone is required' }, { status: 400 });
    }

    // Determine reservation type and table
    const reservationType = reservationData.type || 'omakase';
    const tableName = reservationType === 'omakase' ? 'omakase_reservations' : 'dining_reservations';

    // Determine status based on auto-confirmation settings
    const initialStatus = reservationData.status || await getInitialReservationStatus(reservationType as 'omakase' | 'dining');
    const autoConfirmed = await shouldAutoConfirm(reservationType as 'omakase' | 'dining');

    // Add default values
    const newReservation = {
      ...reservationData,
      status: reservationData.status || initialStatus,
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

    // Log reservation status for monitoring (emails now handled by Supabase)
    if (data.status === 'confirmed' && data.confirmation_code) {
      if (autoConfirmed && !reservationData.status) {
        console.log(`Auto-confirmed ${reservationType} reservation created (emails handled by Supabase):`, data.id);
      } else {
        console.log(`Manual confirmed ${reservationType} reservation created (emails handled by Supabase):`, data.id);
      }
    } else if (data.status === 'pending') {
      console.log(`Pending ${reservationType} reservation created (emails handled by Supabase):`, data.id);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
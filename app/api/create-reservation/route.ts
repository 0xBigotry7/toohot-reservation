import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

    // Add default values
    const newReservation = {
      ...reservationData,
      status: reservationData.status || 'confirmed',
      confirmation_code: reservationData.confirmation_code || nanoid(8).toUpperCase()
    };

    // Create the reservation using service role key (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('omakase_reservations')
      .insert([newReservation])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
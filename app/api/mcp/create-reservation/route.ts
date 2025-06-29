import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { sendCustomerConfirmation } from '../../../../lib/email';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      reservation_date,
      reservation_time,
      party_size,
      type = 'omakase',
      special_requests = '',
      notes = 'Created via AI Chatbot'
    } = await request.json();

    // Validate required fields
    const requiredFields = {
      customer_name,
      customer_email,
      customer_phone,
      reservation_date,
      reservation_time,
      party_size
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        return NextResponse.json({ 
          error: `Missing required field: ${field}` 
        }, { status: 400 });
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer_email)) {
      return NextResponse.json({ 
        error: 'Invalid email format' 
      }, { status: 400 });
    }

    // Validate party size
    if (party_size < 1 || party_size > 15) {
      return NextResponse.json({ 
        error: 'Party size must be between 1 and 15' 
      }, { status: 400 });
    }

    // Validate date format and ensure it's not in the past
    const formattedDate = format(new Date(reservation_date), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');
    if (formattedDate < today) {
      return NextResponse.json({ 
        error: 'Cannot make reservations for past dates' 
      }, { status: 400 });
    }

    // Check availability first
    const availabilityResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/mcp/check-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: formattedDate,
        time: reservation_time,
        party_size,
        type
      })
    });

    const availabilityData = await availabilityResponse.json();
    
    if (!availabilityData.available) {
      return NextResponse.json({
        error: 'Time slot not available',
        availability_info: availabilityData,
        suggested_alternatives: availabilityData.alternative_times
      }, { status: 409 });
    }

    // Determine table and generate confirmation code
    const tableName = type === 'omakase' ? 'omakase_reservations' : 'dining_reservations';
    const confirmation_code = nanoid(8).toUpperCase();
    const status = 'confirmed'; // AI bookings are automatically confirmed

    // Calculate duration for dining reservations
    const duration_minutes = type === 'dining' ? (party_size <= 4 ? 60 : 90) : undefined;

    // Create reservation data
    const reservationData = {
      customer_name,
      customer_email,
      customer_phone,
      reservation_date: formattedDate,
      reservation_time,
      party_size,
      special_requests,
      notes,
      status,
      confirmation_code,
      ...(duration_minutes && { duration_minutes })
    };

    // Insert reservation into appropriate table
    const { data, error } = await supabase
      .from(tableName)
      .insert([reservationData])
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ 
        error: 'Failed to create reservation',
        details: error.message 
      }, { status: 500 });
    }

    // Send confirmation email
    try {
      await sendCustomerConfirmation({
        customer_name,
        customer_email,
        customer_phone,
        reservation_date: formattedDate,
        reservation_time,
        party_size,
        special_requests,
        reservation_type: type
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the reservation if email fails
    }

    return NextResponse.json({
      success: true,
      reservation: {
        id: data.id,
        confirmation_code: data.confirmation_code,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        reservation_date: data.reservation_date,
        reservation_time: data.reservation_time,
        party_size: data.party_size,
        type,
        status: data.status,
        special_requests: data.special_requests
      },
      message: `Reservation confirmed for ${customer_name} on ${formattedDate} at ${reservation_time}`,
      confirmation_email_sent: true
    });

  } catch (error) {
    console.error('Create reservation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { sendCustomerConfirmation } from '../../../../lib/email';
import { format } from 'date-fns';
import { getInitialReservationStatus, shouldAutoConfirm } from '../../../../lib/auto-confirmation';

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
        type,
        partySize: party_size
      })
    });

    const availabilityData = await availabilityResponse.json();
    
    if (!availabilityData.success || !availabilityData.available) {
      return NextResponse.json({
        error: availabilityData.reason || 'Date not available',
        availability_info: availabilityData.details || availabilityData,
        message: `Cannot create reservation: ${availabilityData.reason || 'insufficient capacity'}`
      }, { status: 409 });
    }

    // Determine table and status based on auto-confirmation settings
    const tableName = type === 'omakase' ? 'omakase_reservations' : 'dining_reservations';
    const reservationType = type as 'omakase' | 'dining';
    const status = await getInitialReservationStatus(reservationType);
    const autoConfirmed = await shouldAutoConfirm(reservationType);
    
    // Generate confirmation code if auto-confirmed, or if manually set to confirmed
    const confirmation_code = status === 'confirmed' ? nanoid(8).toUpperCase() : null;

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

    // Handle email notifications based on confirmation status
    let emailSent = false;
    if (status === 'confirmed' && confirmation_code) {
      // Send customer confirmation email for confirmed reservations
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
        emailSent = true;
        
        if (autoConfirmed) {
          console.log(`Auto-confirmed ${type} reservation via MCP - customer confirmation sent:`, data.id);
        } else {
          console.log(`Manual confirmed ${type} reservation via MCP - customer confirmation sent:`, data.id);
        }
      } catch (emailError) {
        console.error('Failed to send customer confirmation email:', emailError);
        // Don't fail the reservation if email fails
      }
    } else if (status === 'pending') {
      // Log that manual confirmation is needed for MCP reservations
      console.log(`Pending ${type} reservation created via MCP - owner notification needed:`, data.id);
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
      message: data.status === 'confirmed' 
        ? `Reservation confirmed for ${customer_name} on ${formattedDate} at ${reservation_time}`
        : `Reservation created for ${customer_name} on ${formattedDate} at ${reservation_time} - pending confirmation`,
      confirmation_email_sent: emailSent,
      auto_confirmed: autoConfirmed && data.status === 'confirmed'
    });

  } catch (error) {
    console.error('Create reservation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
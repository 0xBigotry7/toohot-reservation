import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { confirmation_code, email, phone } = await request.json();

    // Must provide at least one search parameter
    if (!confirmation_code && !email && !phone) {
      return NextResponse.json({ 
        error: 'Must provide at least one of: confirmation_code, email, or phone' 
      }, { status: 400 });
    }

    // Search both omakase and dining reservations
    const searchQueries = [];
    
    // Build search conditions
    if (confirmation_code) {
      searchQueries.push(
        supabase.from('omakase_reservations').select('*, type:reservation_type').eq('confirmation_code', confirmation_code.toUpperCase()),
        supabase.from('dining_reservations').select('*, type:reservation_type').eq('confirmation_code', confirmation_code.toUpperCase())
      );
    }
    
    if (email) {
      searchQueries.push(
        supabase.from('omakase_reservations').select('*, type:reservation_type').eq('customer_email', email.toLowerCase()),
        supabase.from('dining_reservations').select('*, type:reservation_type').eq('customer_email', email.toLowerCase())
      );
    }
    
    if (phone) {
      // Clean phone number for search
      const cleanPhone = phone.replace(/\D/g, '');
      searchQueries.push(
        supabase.from('omakase_reservations').select('*, type:reservation_type').like('customer_phone', `%${cleanPhone}%`),
        supabase.from('dining_reservations').select('*, type:reservation_type').like('customer_phone', `%${cleanPhone}%`)
      );
    }

    // Execute all queries and combine results
    const results = await Promise.all(searchQueries);
    const allReservations = [];
    
    for (const result of results) {
      if (result.data && result.data.length > 0) {
        // Add reservation type based on table
        const reservationsWithType = result.data.map(reservation => ({
          ...reservation,
          type: reservation.type || (searchQueries.indexOf(result) % 2 === 0 ? 'omakase' : 'dining')
        }));
        allReservations.push(...reservationsWithType);
      }
    }

    // Remove duplicates based on ID
    const uniqueReservations = allReservations.filter((reservation, index, self) => 
      index === self.findIndex(r => r.id === reservation.id)
    );

    // Sort by reservation date (most recent first)
    uniqueReservations.sort((a, b) => {
      const dateComparison = new Date(b.reservation_date).getTime() - new Date(a.reservation_date).getTime();
      if (dateComparison !== 0) return dateComparison;
      return b.reservation_time.localeCompare(a.reservation_time);
    });

    if (uniqueReservations.length === 0) {
      return NextResponse.json({
        found: false,
        message: 'No reservations found with the provided information',
        search_criteria: { confirmation_code, email, phone }
      });
    }

    // Format reservations for response
    const formattedReservations = uniqueReservations.map(reservation => ({
      id: reservation.id,
      confirmation_code: reservation.confirmation_code,
      customer_name: reservation.customer_name,
      customer_email: reservation.customer_email,
      customer_phone: reservation.customer_phone,
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
      party_size: reservation.party_size,
      type: reservation.type === 'omakase' ? 'omakase' : 'dining',
      status: reservation.status,
      special_requests: reservation.special_requests || '',
      notes: reservation.notes || '',
      created_at: reservation.created_at,
      cancellation_reason: reservation.cancellation_reason,
      duration_minutes: reservation.duration_minutes
    }));

    return NextResponse.json({
      found: true,
      count: formattedReservations.length,
      reservations: formattedReservations,
      message: `Found ${formattedReservations.length} reservation(s)`,
      search_criteria: { confirmation_code, email, phone }
    });

  } catch (error) {
    console.error('Get reservation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support GET method for simple confirmation code lookups
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirmation_code = searchParams.get('confirmation_code');
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');

    // Convert to POST format and reuse the same logic
    const postRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation_code, email, phone })
    });

    return POST(postRequest as NextRequest);
  } catch (error) {
    console.error('Get reservation (GET) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSeatCapacitySettings, isDateClosed, isReservationTypeAvailable } from '@/lib/server-utils';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, type, partySize } = body;

    // Validate required fields
    if (!date || !type || !partySize) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: date, type, and partySize are required'
      }, { status: 400 });
    }

    // Validate reservation type
    if (type !== 'omakase' && type !== 'dining') {
      return NextResponse.json({
        success: false,
        error: 'Invalid reservation type. Must be "omakase" or "dining"'
      }, { status: 400 });
    }

    // Validate party size
    if (typeof partySize !== 'number' || partySize < 1 || partySize > 20) {
      return NextResponse.json({
        success: false,
        error: 'Invalid party size. Must be a number between 1 and 20'
      }, { status: 400 });
    }

    // Validate date format and ensure it's today or future
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(requestedDate.getTime())) {
      return NextResponse.json({
        success: false,
        error: 'Invalid date format. Please use ISO date format (YYYY-MM-DD)'
      }, { status: 400 });
    }

    if (requestedDate < today) {
      return NextResponse.json({
        success: false,
        available: false,
        reason: 'Cannot make reservations for past dates'
      });
    }

    // Check if the date is manually closed by admin
    const dateIsClosed = await isDateClosed(date);
    if (dateIsClosed) {
      return NextResponse.json({
        success: true,
        available: false,
        reason: 'This date has been closed for reservations by the restaurant'
      });
    }

    // Check if the reservation type is available on this day of the week
    const typeIsAvailable = await isReservationTypeAvailable(type as 'omakase' | 'dining', date);
    if (!typeIsAvailable) {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(date).getDay()];
      return NextResponse.json({
        success: true,
        available: false,
        reason: `${type === 'omakase' ? 'Omakase' : 'Dining'} reservations are not available on ${dayName}s`
      });
    }

    // Get seat capacity settings from database
    const capacitySettings = await getSeatCapacitySettings();
    
    // Determine table capacity based on reservation type
    const tableCapacity = type === 'omakase' ? capacitySettings.omakaseSeats : capacitySettings.diningSeats;
    const tableName = type === 'omakase' ? 'omakase_reservations' : 'dining_reservations';

    console.log(`Checking availability for ${type} on ${date} for ${partySize} people`);
    console.log(`Table capacity: ${tableCapacity} (source: ${capacitySettings.source})`);

    // Check existing reservations for the date (excluding cancelled ones)
    const { data: existingReservations, error } = await supabaseAdmin
      .from(tableName)
      .select('party_size')
      .eq('reservation_date', date)
      .neq('status', 'cancelled');

    if (error) {
      console.error('Error checking existing reservations:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to check availability'
      }, { status: 500 });
    }

    // Calculate total reserved seats
    const totalReservedSeats = existingReservations.reduce((sum, reservation) => {
      return sum + (reservation.party_size || 0);
    }, 0);

    const availableSeats = tableCapacity - totalReservedSeats;
    const isAvailable = availableSeats >= partySize;

    console.log(`Availability check: ${totalReservedSeats}/${tableCapacity} seats taken, ${availableSeats} available`);

    return NextResponse.json({
      success: true,
      available: isAvailable,
      details: {
        requestedDate: date,
        reservationType: type,
        partySize,
        totalCapacity: tableCapacity,
        reservedSeats: totalReservedSeats,
        availableSeats,
        capacitySource: capacitySettings.source
      },
      reason: isAvailable ? 'Table available' : `Not enough seats available (${availableSeats} available, ${partySize} requested)`
    });

  } catch (error) {
    console.error('Error in availability check:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 
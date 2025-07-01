import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { date, time, party_size, type = 'omakase' } = await request.json();
    
    // Validate required fields
    if (!date || !time || !party_size) {
      return NextResponse.json({ 
        error: 'Missing required fields: date, time, party_size' 
      }, { status: 400 });
    }

    // Validate date format
    const reservationDate = format(new Date(date), 'yyyy-MM-dd');
    
    // Check if date is in the past
    const today = format(new Date(), 'yyyy-MM-dd');
    if (reservationDate < today) {
      return NextResponse.json({
        available: false,
        reason: 'Cannot make reservations for past dates',
        alternative_dates: []
      });
    }

    // Get seat capacity settings from database
    const { data: capacitySettings, error: capacityError } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'seat_capacity')
      .single();

    // Use dynamic capacity or fall back to defaults
    let maxCapacity: number;
    if (capacitySettings && !capacityError && capacitySettings.setting_value) {
      maxCapacity = type === 'omakase' 
        ? capacitySettings.setting_value.omakaseCapacity || 12
        : capacitySettings.setting_value.diningCapacity || 40;
    } else {
      // Fall back to default values if no settings found
      maxCapacity = type === 'omakase' ? 12 : 40;
    }

    // Determine table to check based on reservation type
    const tableName = type === 'omakase' ? 'omakase_reservations' : 'dining_reservations';
    
    // Check existing reservations for this date/time
    const { data: existingReservations, error } = await supabase
      .from(tableName)
      .select('party_size, status')
      .eq('reservation_date', reservationDate)
      .eq('reservation_time', time)
      .in('status', ['pending', 'confirmed', 'seated']);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    const currentCapacity = existingReservations?.reduce((sum, r) => sum + r.party_size, 0) || 0;
    const availableCapacity = maxCapacity - currentCapacity;
    
    const isAvailable = availableCapacity >= party_size;
    
    // Get alternative times if current time is not available
    const alternativeTimes = [];
    if (!isAvailable) {
      const timeSlots = ['17:00', '19:00']; // Standard time slots
      for (const slot of timeSlots) {
        if (slot !== time) {
          const { data: slotReservations } = await supabase
            .from(tableName)
            .select('party_size')
            .eq('reservation_date', reservationDate)
            .eq('reservation_time', slot)
            .in('status', ['pending', 'confirmed', 'seated']);
          
          const slotCapacity = slotReservations?.reduce((sum, r) => sum + r.party_size, 0) || 0;
          if (maxCapacity - slotCapacity >= party_size) {
            alternativeTimes.push(slot);
          }
        }
      }
    }

    return NextResponse.json({
      available: isAvailable,
      date: reservationDate,
      time,
      party_size,
      type,
      capacity_info: {
        requested: party_size,
        available: availableCapacity,
        total: maxCapacity
      },
      alternative_times: alternativeTimes,
      message: isAvailable 
        ? `Table available for ${party_size} guests` 
        : `Not enough capacity. ${availableCapacity} seats available.`
    });

  } catch (error) {
    console.error('Check availability error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
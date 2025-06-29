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

    // Auto-confirmation settings - read from database first, then environment variables
    let autoConfirmOmakase = process.env.AUTO_CONFIRM_OMAKASE === 'true';
    let autoConfirmDining = process.env.AUTO_CONFIRM_DINING === 'true';
    
    try {
      // Try to get settings from database first
      const { data: dbSettings, error: dbError } = await supabaseAdmin
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'auto_confirmation')
        .single();

      if (dbSettings && !dbError && dbSettings.setting_value) {
        autoConfirmOmakase = dbSettings.setting_value.autoConfirmOmakase;
        autoConfirmDining = dbSettings.setting_value.autoConfirmDining;
        console.log('Using database auto-confirmation settings:', { autoConfirmOmakase, autoConfirmDining });
      } else {
        console.log('Using environment auto-confirmation settings:', { autoConfirmOmakase, autoConfirmDining });
      }
    } catch (settingsError) {
      console.error('Error fetching auto-confirmation settings, using environment defaults:', settingsError);
    }
    
    // Determine if this reservation type should be auto-confirmed
    const shouldAutoConfirm = reservationType === 'omakase' ? autoConfirmOmakase : autoConfirmDining;
    
    // Set initial status based on auto-confirmation setting
    const initialStatus = shouldAutoConfirm ? 'confirmed' : 'pending';

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

    // Handle email notifications based on confirmation status
    if (data.status === 'confirmed' && data.confirmation_code) {
      // Send customer confirmation email for confirmed reservations
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
        
        if (shouldAutoConfirm) {
          console.log(`Auto-confirmed ${reservationType} reservation - customer confirmation sent:`, data.id);
        } else {
          console.log(`Manual confirmed ${reservationType} reservation - customer confirmation sent:`, data.id);
        }
      } catch (emailError) {
        console.error('Failed to send customer confirmation email:', emailError);
        // Don't fail the entire request if email fails, just log it
      }
    } else if (data.status === 'pending' && !shouldAutoConfirm) {
      // Send action required email to owner for pending reservations that need manual confirmation
      try {
        // TODO: Implement owner notification email for pending reservations
        // This would be a new email template notifying the owner that a reservation needs confirmation
        console.log(`Pending ${reservationType} reservation created - owner notification needed:`, data.id);
      } catch (emailError) {
        console.error('Failed to send owner notification email:', emailError);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
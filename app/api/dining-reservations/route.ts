import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendCustomerConfirmation, sendRestaurantNotification } from '../../../lib/email'
import { nanoid } from 'nanoid'
import { getInitialReservationStatus, shouldAutoConfirm } from '../../../lib/auto-confirmation'

// Create Supabase client with service role for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch all dining reservations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    let query = supabase
      .from('dining_reservations')
      .select('*')
      .order('reservation_date', { ascending: true })
      .order('reservation_time', { ascending: true })
    
    if (startDate) {
      query = query.gte('reservation_date', startDate)
    }
    
    if (endDate) {
      query = query.lte('reservation_date', endDate)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching dining reservations:', error)
      return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 })
    }
    
    return NextResponse.json({ reservations: data || [] })
  } catch (error) {
    console.error('GET dining reservations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new dining reservation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      customer_name,
      customer_email,
      customer_phone,
      reservation_date,
      reservation_time,
      party_size,
      special_requests = '',
      notes = '',
      status: requestedStatus // Allow manual status override if provided
    } = body
    
    // Calculate duration based on party size
    const duration_minutes = party_size <= 4 ? 60 : 90
    
    // Determine status based on auto-confirmation settings (unless manually overridden)
    const finalStatus = requestedStatus || await getInitialReservationStatus('dining')
    const autoConfirmed = await shouldAutoConfirm('dining')
    
    // Generate confirmation code if status is confirmed
    const confirmation_code = finalStatus === 'confirmed' ? nanoid(8).toUpperCase() : null
    
    const { data, error } = await supabase
      .from('dining_reservations')
      .insert({
        customer_name,
        customer_email,
        customer_phone,
        reservation_date,
        reservation_time,
        party_size,
        duration_minutes,
        special_requests,
        notes,
        status: finalStatus,
        confirmation_code
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating dining reservation:', error)
      return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })
    }
    
    // Handle email notifications based on confirmation status
    if (finalStatus === 'confirmed' && confirmation_code) {
      // Send customer confirmation email for confirmed reservations
      try {
        await sendCustomerConfirmation({
          customer_name,
          customer_email,
          customer_phone,
          reservation_date,
          reservation_time,
          party_size,
          special_requests,
          reservation_type: 'dining'
        })
        
        if (autoConfirmed && !requestedStatus) {
          console.log(`Auto-confirmed dining reservation - customer confirmation sent:`, data.id)
        } else {
          console.log(`Manual confirmed dining reservation - customer confirmation sent:`, data.id)
        }
      } catch (emailError) {
        console.error('Failed to send customer confirmation email:', emailError)
        // Don't fail the entire request if email fails, just log it
      }
    } else if (finalStatus === 'pending') {
      // Log that manual confirmation is needed
      console.log(`Pending dining reservation created - owner notification needed:`, data.id)
      // TODO: Implement owner notification email for pending reservations
    }
    
    return NextResponse.json({ reservation: data })
  } catch (error) {
    console.error('POST dining reservation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update dining reservation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      id,
      customer_name,
      customer_email,
      customer_phone,
      reservation_date,
      reservation_time,
      party_size,
      special_requests,
      notes,
      status,
      cancellation_reason
    } = body
    
    // Calculate duration based on party size
    const duration_minutes = party_size <= 4 ? 60 : 90
    
    // Get current reservation to check status change
    const { data: currentReservation } = await supabase
      .from('dining_reservations')
      .select('status, confirmation_code')
      .eq('id', id)
      .single()
    
    let confirmation_code = currentReservation?.confirmation_code
    
    // Generate confirmation code if changing from cancelled to confirmed
    if (currentReservation?.status === 'cancelled' && status === 'confirmed') {
      confirmation_code = nanoid(8).toUpperCase()
    }
    
    // Generate confirmation code if status is confirmed and no code exists
    if (status === 'confirmed' && !confirmation_code) {
      confirmation_code = nanoid(8).toUpperCase()
    }
    
    // Clear cancellation reason if not cancelled
    const updateData: any = {
      customer_name,
      customer_email,
      customer_phone,
      reservation_date,
      reservation_time,
      party_size,
      duration_minutes,
      special_requests,
      notes,
      status,
      confirmation_code
    }
    
    if (status === 'cancelled') {
      updateData.cancellation_reason = cancellation_reason
    } else {
      updateData.cancellation_reason = null
    }
    
    const { data, error } = await supabase
      .from('dining_reservations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating dining reservation:', error)
      return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 })
    }
    
    // Send emails based on status change
    if (currentReservation?.status !== status) {
      try {
        if (status === 'confirmed') {
          // Send confirmation email
          await sendCustomerConfirmation({
            customer_name,
            customer_email,
            customer_phone,
            reservation_date,
            reservation_time,
            party_size,
            special_requests,
            reservation_type: 'dining'
          })
        } else if (status === 'cancelled') {
          // Send cancellation email (implement if needed)
          // await sendCancellationEmail(...)
        }
      } catch (emailError) {
        console.error('Failed to send status change email:', emailError)
      }
    }
    
    return NextResponse.json({ 
      reservation: data,
      emailSent: currentReservation?.status !== status 
    })
  } catch (error) {
    console.error('PUT dining reservation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete dining reservation
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 })
    }
    
    const { error } = await supabase
      .from('dining_reservations')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting dining reservation:', error)
      return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE dining reservation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 
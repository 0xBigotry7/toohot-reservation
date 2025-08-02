import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reservationId = searchParams.get('reservationId')
    const reservationType = searchParams.get('reservationType')

    if (!reservationId || !reservationType) {
      return NextResponse.json(
        { error: 'Missing reservationId or reservationType' },
        { status: 400 }
      )
    }

    // Fetch communication logs from database
    // Only show emails sent to customers (outbound) and exclude pending status
    // Exclude restaurant confirmation emails
    const { data: logs, error } = await supabaseAdmin
      .from('communication_logs')
      .select('*')
      .eq('reservation_id', reservationId)
      .eq('reservation_type', reservationType)
      .eq('channel', 'email')
      .eq('direction', 'outbound')
      .neq('status', 'pending')
      .not('template_used', 'like', '%restaurant%')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching communication logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch communication logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ logs: logs || [] })
  } catch (error) {
    console.error('Error in communication logs API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
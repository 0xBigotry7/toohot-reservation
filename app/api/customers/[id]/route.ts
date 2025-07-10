import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = decodeURIComponent(params.id)
    
    console.log(`🔍 Fetching detailed customer data for: ${customerId}`)

    // Search for reservations by email (primary) or phone (fallback)
    const [omakaseResponse, diningResponse] = await Promise.all([
      supabase
        .from('omakase_reservations')
        .select('*')
        .or(`customer_email.eq.${customerId.toLowerCase()},customer_phone.eq.${customerId}`)
        .order('reservation_date', { ascending: false }),
      supabase
        .from('dining_reservations')
        .select('*')
        .or(`customer_email.eq.${customerId.toLowerCase()},customer_phone.eq.${customerId}`)
        .order('reservation_date', { ascending: false })
    ])

    if (omakaseResponse.error) {
      console.error('Error fetching omakase reservations:', omakaseResponse.error)
      throw omakaseResponse.error
    }

    if (diningResponse.error) {
      console.error('Error fetching dining reservations:', diningResponse.error)
      throw diningResponse.error
    }

    const omakaseReservations = (omakaseResponse.data || []).map(r => ({ ...r, type: 'omakase' as const }))
    const diningReservations = (diningResponse.data || []).map(r => ({ ...r, type: 'dining' as const }))
    const allReservations = [...omakaseReservations, ...diningReservations]

    if (allReservations.length === 0) {
      return NextResponse.json({ 
        error: 'Customer not found',
        customer_id: customerId 
      }, { status: 404 })
    }

    // Get the most recent reservation for primary contact info
    const latestReservation = allReservations.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

    // Calculate detailed statistics
    const totalVisits = allReservations.length
    const totalPartySize = allReservations.reduce((sum, r) => sum + r.party_size, 0)
    const averagePartySize = Math.round((totalPartySize / totalVisits) * 10) / 10

    // Status breakdown
    const statusBreakdown = {
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      pending: 0,
      seated: 0,
      'no-show': 0
    }

    allReservations.forEach(r => {
      const status = r.status as keyof typeof statusBreakdown
      if (statusBreakdown.hasOwnProperty(status)) {
        statusBreakdown[status]++
      }
    })

    // Determine favorite reservation type
    const omakaseCount = allReservations.filter(r => r.type === 'omakase').length
    const diningCount = allReservations.filter(r => r.type === 'dining').length
    const favoriteType = omakaseCount > diningCount ? 'omakase' : 
                        diningCount > omakaseCount ? 'dining' : 'both'

    // Date calculations
    const sortedDates = allReservations
      .map(r => r.reservation_date)
      .sort()
    const firstVisitDate = sortedDates[0]
    const lastVisitDate = sortedDates[sortedDates.length - 1]

    // Customer tier calculation
    let customerTier: 'new' | 'regular' | 'vip' | 'platinum' = 'new'
    if (totalVisits >= 10 || totalPartySize >= 40) customerTier = 'platinum'
    else if (totalVisits >= 5 || totalPartySize >= 20) customerTier = 'vip'
    else if (totalVisits >= 2) customerTier = 'regular'

    // Revenue potential calculation
    const omakaseValue = 200
    const diningValue = 80
    const baseValue = favoriteType === 'omakase' ? omakaseValue : 
                     favoriteType === 'dining' ? diningValue : 
                     (omakaseValue + diningValue) / 2
    const revenuePotential = Math.round(totalVisits * averagePartySize * baseValue)

    // Format reservations for response
    const formattedReservations = allReservations
      .sort((a, b) => new Date(b.reservation_date).getTime() - new Date(a.reservation_date).getTime())
      .map(r => ({
        id: r.id,
        reservation_date: r.reservation_date,
        reservation_time: r.reservation_time,
        party_size: r.party_size,
        type: r.type,
        status: r.status,
        special_requests: r.special_requests,
        notes: r.notes,
        confirmation_code: r.confirmation_code,
        created_at: r.created_at,
        cancellation_reason: r.cancellation_reason
      }))

    const customerData = {
      id: customerId,
      customer_name: latestReservation.customer_name,
      customer_email: latestReservation.customer_email || '',
      customer_phone: latestReservation.customer_phone || '',
      total_visits: totalVisits,
      total_party_size: totalPartySize,
      average_party_size: averagePartySize,
      last_visit_date: lastVisitDate,
      first_visit_date: firstVisitDate,
      favorite_reservation_type: favoriteType,
      status_breakdown: statusBreakdown,
      total_revenue_potential: revenuePotential,
      customer_tier: customerTier,
      reservations: formattedReservations
    }

    console.log(`✅ Successfully fetched customer data for ${customerId}`)

    return NextResponse.json({ customer: customerData })

  } catch (error) {
    console.error('Customer detail API error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch customer details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
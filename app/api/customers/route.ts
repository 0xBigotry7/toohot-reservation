import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format, parseISO } from 'date-fns'

// Create Supabase client with service role for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CustomerData {
  id: string // Unique customer ID (email-based)
  customer_name: string
  customer_email: string
  customer_phone: string
  total_visits: number
  total_party_size: number
  average_party_size: number
  last_visit_date: string
  first_visit_date: string
  favorite_reservation_type: 'omakase' | 'dining' | 'both'
  status_breakdown: {
    confirmed: number
    completed: number
    cancelled: number
    pending: number
    seated: number
    'no-show': number
  }
  total_revenue_potential: number // Based on party size and visit frequency
  customer_tier: 'new' | 'regular' | 'vip' | 'platinum'
  reservations: Array<{
    id: string
    reservation_date: string
    reservation_time: string
    party_size: number
    type: 'omakase' | 'dining'
    status: string
    special_requests?: string
    notes?: string
    confirmation_code?: string
  }>
}

// Customer segmentation based on visit history
function calculateCustomerTier(totalVisits: number, totalPartySize: number): 'new' | 'regular' | 'vip' | 'platinum' {
  if (totalVisits >= 10 || totalPartySize >= 40) return 'platinum'
  if (totalVisits >= 5 || totalPartySize >= 20) return 'vip'
  if (totalVisits >= 2) return 'regular'
  return 'new'
}

// Revenue potential calculation (simplified)
function calculateRevenuePotential(totalVisits: number, averagePartySize: number, favoriteType: string): number {
  const omakaseValue = 200 // Estimated value per person for omakase
  const diningValue = 80   // Estimated value per person for dining
  
  const baseValue = favoriteType === 'omakase' ? omakaseValue : 
                   favoriteType === 'dining' ? diningValue : 
                   (omakaseValue + diningValue) / 2
  
  return Math.round(totalVisits * averagePartySize * baseValue)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sort_by') || 'last_visit_date'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const filterTier = searchParams.get('tier')
    const filterType = searchParams.get('type')
    const searchTerm = searchParams.get('search')

    console.log('🔍 Fetching customer data from reservation tables...')

    // Fetch all reservations from both tables
    const [omakaseResponse, diningResponse] = await Promise.all([
      supabase
        .from('omakase_reservations')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('dining_reservations')
        .select('*')
        .order('created_at', { ascending: false })
    ])

    if (omakaseResponse.error) {
      console.error('Error fetching omakase reservations:', omakaseResponse.error)
      throw omakaseResponse.error
    }

    if (diningResponse.error) {
      console.error('Error fetching dining reservations:', diningResponse.error)
      throw diningResponse.error
    }

    console.log(`📊 Found ${omakaseResponse.data?.length || 0} omakase and ${diningResponse.data?.length || 0} dining reservations`)

    // Combine all reservations with type information
    const omakaseReservations = (omakaseResponse.data || []).map(r => ({ ...r, type: 'omakase' as const }))
    const diningReservations = (diningResponse.data || []).map(r => ({ ...r, type: 'dining' as const }))
    const allReservations = [...omakaseReservations, ...diningReservations]

    // Group reservations by customer email (primary) and phone (fallback)
    const customerMap = new Map<string, any[]>()
    
    for (const reservation of allReservations) {
      if (!reservation.customer_email && !reservation.customer_phone) continue
      
      // Use email as primary identifier, phone as fallback
      const customerId = reservation.customer_email?.toLowerCase() || reservation.customer_phone
      
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, [])
      }
      customerMap.get(customerId)!.push(reservation)
    }

    console.log(`👥 Found ${customerMap.size} unique customers`)

    // Process each customer to create comprehensive profiles
    const customers: CustomerData[] = []

    for (const [customerId, reservations] of Array.from(customerMap.entries())) {
      // Get the most recent reservation for primary contact info
      const latestReservation = reservations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

      // Calculate statistics
      const totalVisits = reservations.length
      const totalPartySize = reservations.reduce((sum, r) => sum + r.party_size, 0)
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

      reservations.forEach(r => {
        const status = r.status as keyof typeof statusBreakdown
        if (statusBreakdown.hasOwnProperty(status)) {
          statusBreakdown[status]++
        }
      })

      // Determine favorite reservation type
      const omakaseCount = reservations.filter(r => r.type === 'omakase').length
      const diningCount = reservations.filter(r => r.type === 'dining').length
      const favoriteType = omakaseCount > diningCount ? 'omakase' : 
                          diningCount > omakaseCount ? 'dining' : 'both'

      // Date calculations
      const sortedDates = reservations
        .map(r => r.reservation_date)
        .sort()
      const firstVisitDate = sortedDates[0]
      const lastVisitDate = sortedDates[sortedDates.length - 1]

      // Customer tier and revenue potential
      const customerTier = calculateCustomerTier(totalVisits, totalPartySize)
      const revenuePotential = calculateRevenuePotential(totalVisits, averagePartySize, favoriteType)

      // Format reservations for response
      const formattedReservations = reservations
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
          confirmation_code: r.confirmation_code
        }))

      const customer: CustomerData = {
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

      customers.push(customer)
    }

    // Apply filters
    let filteredCustomers = customers

    // Apply search filter first (searches across all customers)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      filteredCustomers = filteredCustomers.filter(customer =>
        customer.customer_name.toLowerCase().includes(lowerSearchTerm) ||
        customer.customer_email.toLowerCase().includes(lowerSearchTerm) ||
        customer.customer_phone.includes(searchTerm) // Don't convert phone to lowercase since it's numbers
      )
    }

    if (filterTier) {
      filteredCustomers = filteredCustomers.filter(c => c.customer_tier === filterTier)
    }

    if (filterType) {
      filteredCustomers = filteredCustomers.filter(c => c.favorite_reservation_type === filterType)
    }

    // Sort customers
    filteredCustomers.sort((a, b) => {
      let valueA: any, valueB: any

      switch (sortBy) {
        case 'total_visits':
          valueA = a.total_visits
          valueB = b.total_visits
          break
        case 'total_revenue_potential':
          valueA = a.total_revenue_potential
          valueB = b.total_revenue_potential
          break
        case 'customer_name':
          valueA = a.customer_name.toLowerCase()
          valueB = b.customer_name.toLowerCase()
          break
        case 'last_visit_date':
        default:
          valueA = new Date(a.last_visit_date).getTime()
          valueB = new Date(b.last_visit_date).getTime()
          break
      }

      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0
      }
    })

    // Apply pagination
    const paginatedCustomers = filteredCustomers.slice(offset, offset + limit)

    // Calculate summary statistics
    const summary = {
      total_customers: filteredCustomers.length,
      total_reservations: allReservations.length,
      tier_breakdown: {
        new: filteredCustomers.filter(c => c.customer_tier === 'new').length,
        regular: filteredCustomers.filter(c => c.customer_tier === 'regular').length,
        vip: filteredCustomers.filter(c => c.customer_tier === 'vip').length,
        platinum: filteredCustomers.filter(c => c.customer_tier === 'platinum').length
      },
      type_preference: {
        omakase: filteredCustomers.filter(c => c.favorite_reservation_type === 'omakase').length,
        dining: filteredCustomers.filter(c => c.favorite_reservation_type === 'dining').length,
        both: filteredCustomers.filter(c => c.favorite_reservation_type === 'both').length
      },
      total_revenue_potential: filteredCustomers.reduce((sum, c) => sum + c.total_revenue_potential, 0)
    }

    console.log(`✅ Successfully processed ${paginatedCustomers.length} customers for CRM`)

    return NextResponse.json({
      customers: paginatedCustomers,
      summary,
      pagination: {
        total: filteredCustomers.length,
        limit,
        offset,
        has_more: offset + limit < filteredCustomers.length
      }
    })

  } catch (error) {
    console.error('CRM API error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch customer data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
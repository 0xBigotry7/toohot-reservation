import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, parseISO, getHours, getDay } from 'date-fns'

// Create Supabase client with service role for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AnalyticsData {
  overview: {
    total_reservations: number
    total_revenue_potential: number
    average_party_size: number
    capacity_utilization: number
    period_growth: number
    arpc: number
  }

  trends: {
    daily_reservations: Array<{ date: string; count: number; revenue: number }>
    weekly_revenue: Array<{ week: string; omakase: number; dining: number }>
    monthly_comparison: Array<{ month: string; reservations: number; revenue: number }>
  }
  customer_insights: {
    new_vs_returning: { new: number; returning: number }
    tier_distribution: { new: number; regular: number; vip: number; platinum: number }
    average_booking_window: number
    repeat_customer_rate: number
  }
  operational: {
    peak_hours: Array<{ hour: number; count: number }>
    peak_days: Array<{ day: string; count: number }>
    cancellation_rate: number
    no_show_rate: number
    capacity_by_day: Array<{ date: string; omakase_utilization: number; dining_utilization: number }>
  }
  revenue_breakdown: {
    by_type: { omakase: number; dining: number }
    by_party_size: Array<{ size: number; count: number; revenue: number }>
    by_status: { confirmed: number; completed: number; cancelled: number; pending: number }
  }
  forecasting: {
    next_week_projection: number
    capacity_recommendations: Array<{ date: string; recommended_slots: number; reason: string }>
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d'
    
    console.log(`🔍 Fetching analytics data for timeframe: ${timeframe}...`)

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

    const omakaseReservations = (omakaseResponse.data || []).map(r => ({ ...r, type: 'omakase' as const }))
    const diningReservations = (diningResponse.data || []).map(r => ({ ...r, type: 'dining' as const }))
    const allReservations = [...omakaseReservations, ...diningReservations]

    console.log(`📊 Processing ${allReservations.length} reservations for analytics...`)

    // Calculate date range based on timeframe
    const getDaysFromTimeframe = (tf: string) => {
      switch (tf) {
        case '7d': return 7
        case '30d': return 30
        case '90d': return 90
        default: return 30
      }
    }
    
    const daysBack = getDaysFromTimeframe(timeframe)
    const cutoffDate = subDays(new Date(), daysBack)
    
    // Filter reservations by timeframe
    const filteredReservations = allReservations.filter(r => 
      parseISO(r.reservation_date) >= cutoffDate
    )
    
    console.log(`📊 Filtered to ${filteredReservations.length} reservations in last ${daysBack} days`)

    // Calculate overview metrics from filtered data
    const totalReservations = filteredReservations.length
    const totalPartySize = filteredReservations.reduce((sum, r) => sum + r.party_size, 0)
    const averagePartySize = totalPartySize / totalReservations || 0

    // Revenue calculation (omakase: $200/person, dining: $80/person)
    const totalRevenuePotential = filteredReservations.reduce((sum, r) => {
      const pricePerPerson = r.type === 'omakase' ? 200 : 80
      return sum + (r.party_size * pricePerPerson)
    }, 0)
    
    // Calculate ARPC (Average Revenue Per Customer)
    const arpc = totalReservations > 0 ? totalRevenuePotential / totalReservations : 0

    // Capacity utilization (assuming 12 omakase seats, 40 dining seats)
    const omakaseSeats = 12
    const diningSeats = 40
    
    const omakaseCapacityUsed = filteredReservations
      .filter(r => r.type === 'omakase')
      .reduce((sum, r) => sum + r.party_size, 0)
    const diningCapacityUsed = filteredReservations
      .filter(r => r.type === 'dining')
      .reduce((sum, r) => sum + r.party_size, 0)
    
    const totalCapacityUsed = omakaseCapacityUsed + diningCapacityUsed
    const totalCapacityAvailable = (omakaseSeats + diningSeats) * daysBack
    const capacityUtilization = (totalCapacityUsed / totalCapacityAvailable) * 100

    // Period growth (comparing current period to previous period of same length)
    const previousPeriodStart = subDays(cutoffDate, daysBack)
    const previousPeriodReservations = allReservations.filter(r => {
      const date = parseISO(r.reservation_date)
      return date >= previousPeriodStart && date < cutoffDate
    })
    const growthRate = previousPeriodReservations.length > 0 
      ? ((filteredReservations.length - previousPeriodReservations.length) / previousPeriodReservations.length) * 100
      : 0
      
    // Weekday vs Weekend Analysis
    const weekdayReservations = filteredReservations.filter(r => {
      const dayOfWeek = getDay(parseISO(r.reservation_date))
      return dayOfWeek >= 1 && dayOfWeek <= 5 // Monday = 1, Friday = 5
    })
    const weekendReservations = filteredReservations.filter(r => {
      const dayOfWeek = getDay(parseISO(r.reservation_date))
      return dayOfWeek === 0 || dayOfWeek === 6 // Sunday = 0, Saturday = 6
    })
    
    const weekdayRevenue = weekdayReservations.reduce((sum, r) => {
      const pricePerPerson = r.type === 'omakase' ? 200 : 80
      return sum + (r.party_size * pricePerPerson)
    }, 0)
    const weekendRevenue = weekendReservations.reduce((sum, r) => {
      const pricePerPerson = r.type === 'omakase' ? 200 : 80
      return sum + (r.party_size * pricePerPerson)
    }, 0)
    
    const weekdayAvgPartySize = weekdayReservations.length > 0 
      ? weekdayReservations.reduce((sum, r) => sum + r.party_size, 0) / weekdayReservations.length 
      : 0
    const weekendAvgPartySize = weekendReservations.length > 0 
      ? weekendReservations.reduce((sum, r) => sum + r.party_size, 0) / weekendReservations.length 
      : 0

    // Daily trends (based on selected timeframe)
    const timeframeDaysArray = eachDayOfInterval({ start: cutoffDate, end: new Date() })
    const dailyReservations = timeframeDaysArray.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayReservations = filteredReservations.filter(r => r.reservation_date === dateStr)
      const dayRevenue = dayReservations.reduce((sum, r) => {
        const pricePerPerson = r.type === 'omakase' ? 200 : 80
        return sum + (r.party_size * pricePerPerson)
      }, 0)
      
      return {
        date: dateStr,
        count: dayReservations.length,
        revenue: dayRevenue
      }
    })

    // Weekly revenue breakdown (based on timeframe)
    const weeksToShow = Math.min(Math.ceil(daysBack / 7), 8) // Show up to 8 weeks
    const weeklyRevenue = []
    for (let i = 0; i < weeksToShow; i++) {
      const weekStart = subDays(new Date(), (i + 1) * 7)
      const weekEnd = subDays(new Date(), i * 7)
      const weekReservations = filteredReservations.filter(r => {
        const date = parseISO(r.reservation_date)
        return date >= weekStart && date < weekEnd && date >= cutoffDate
      })
      
      const omakaseRevenue = weekReservations
        .filter(r => r.type === 'omakase')
        .reduce((sum, r) => sum + (r.party_size * 200), 0)
      const diningRevenue = weekReservations
        .filter(r => r.type === 'dining')
        .reduce((sum, r) => sum + (r.party_size * 80), 0)
      
      weeklyRevenue.push({
        week: `Week ${weeksToShow - i}`,
        omakase: omakaseRevenue,
        dining: diningRevenue
      })
    }

    // Customer insights (from filtered timeframe)
    const customerMap = new Map()
    for (const reservation of filteredReservations) {
      if (!reservation.customer_email && !reservation.customer_phone) continue
      const customerId = reservation.customer_email?.toLowerCase() || reservation.customer_phone
      
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, [])
      }
      customerMap.get(customerId).push(reservation)
    }

    const newCustomers = Array.from(customerMap.values()).filter(reservations => reservations.length === 1).length
    const returningCustomers = Array.from(customerMap.values()).filter(reservations => reservations.length > 1).length
    const repeatCustomerRate = (returningCustomers / (newCustomers + returningCustomers)) * 100

    // Calculate tier distribution
    const tierDistribution = { new: 0, regular: 0, vip: 0, platinum: 0 }
    Array.from(customerMap.values()).forEach(reservations => {
      const totalVisits = reservations.length
      const totalPartySize = reservations.reduce((sum, r) => sum + r.party_size, 0)
      
      if (totalVisits >= 10 || totalPartySize >= 40) {
        tierDistribution.platinum++
      } else if (totalVisits >= 5 || totalPartySize >= 20) {
        tierDistribution.vip++
      } else if (totalVisits >= 2) {
        tierDistribution.regular++
      } else {
        tierDistribution.new++
      }
    })

    // Operational insights (from filtered timeframe)
    const peakHours = Array.from({ length: 24 }, (_, hour) => {
      const count = filteredReservations.filter(r => {
        const reservationHour = parseInt(r.reservation_time.split(':')[0])
        return reservationHour === hour
      }).length
      return { hour, count }
    }).filter(h => h.count > 0).sort((a, b) => b.count - a.count)

    const peakDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .map((day, index) => {
        const count = filteredReservations.filter(r => getDay(parseISO(r.reservation_date)) === index).length
        return { day, count }
      }).sort((a, b) => b.count - a.count)

    const cancelledReservations = filteredReservations.filter(r => r.status === 'cancelled').length
    const noShowReservations = filteredReservations.filter(r => r.status === 'no-show').length
    const cancellationRate = totalReservations > 0 ? (cancelledReservations / totalReservations) * 100 : 0
    const noShowRate = totalReservations > 0 ? (noShowReservations / totalReservations) * 100 : 0

    // Revenue breakdown (from filtered timeframe)
    const filteredOmakaseReservations = filteredReservations.filter(r => r.type === 'omakase')
    const filteredDiningReservations = filteredReservations.filter(r => r.type === 'dining')
    const omakaseRevenue = filteredOmakaseReservations.reduce((sum, r) => sum + (r.party_size * 200), 0)
    const diningRevenue = filteredDiningReservations.reduce((sum, r) => sum + (r.party_size * 80), 0)

    const partySizeBreakdown = Array.from({ length: 15 }, (_, size) => {
      const sizeReservations = filteredReservations.filter(r => r.party_size === size + 1)
      const revenue = sizeReservations.reduce((sum, r) => {
        const pricePerPerson = r.type === 'omakase' ? 200 : 80
        return sum + (r.party_size * pricePerPerson)
      }, 0)
      return {
        size: size + 1,
        count: sizeReservations.length,
        revenue
      }
    }).filter(p => p.count > 0)

    const statusBreakdown = {
      confirmed: filteredReservations.filter(r => r.status === 'confirmed').reduce((sum, r) => {
        const pricePerPerson = r.type === 'omakase' ? 200 : 80
        return sum + (r.party_size * pricePerPerson)
      }, 0),
      completed: filteredReservations.filter(r => r.status === 'completed').reduce((sum, r) => {
        const pricePerPerson = r.type === 'omakase' ? 200 : 80
        return sum + (r.party_size * pricePerPerson)
      }, 0),
      cancelled: filteredReservations.filter(r => r.status === 'cancelled').reduce((sum, r) => {
        const pricePerPerson = r.type === 'omakase' ? 200 : 80
        return sum + (r.party_size * pricePerPerson)
      }, 0),
      pending: filteredReservations.filter(r => r.status === 'pending').reduce((sum, r) => {
        const pricePerPerson = r.type === 'omakase' ? 200 : 80
        return sum + (r.party_size * pricePerPerson)
      }, 0)
    }

    // Forecasting (simple projection based on recent trends)
    const recentWeekReservations = filteredReservations.filter(r => 
      parseISO(r.reservation_date) >= subDays(new Date(), Math.min(7, daysBack))
    ).length
    const projectionMultiplier = daysBack >= 14 ? 1.1 : 1.05 // Conservative growth for shorter timeframes
    const nextWeekProjection = Math.round(recentWeekReservations * projectionMultiplier)

    const analytics: AnalyticsData = {
      overview: {
        total_reservations: totalReservations,
        total_revenue_potential: totalRevenuePotential,
        average_party_size: Math.round(averagePartySize * 10) / 10,
        capacity_utilization: Math.round(capacityUtilization * 10) / 10,
        period_growth: Math.round(growthRate * 10) / 10,
        arpc: Math.round(arpc * 100) / 100
      },

      trends: {
        daily_reservations: dailyReservations,
        weekly_revenue: weeklyRevenue.reverse(),
        monthly_comparison: [] // Could be expanded for monthly data
      },
      customer_insights: {
        new_vs_returning: { new: newCustomers, returning: returningCustomers },
        tier_distribution: tierDistribution,
        average_booking_window: 7, // Placeholder - could calculate from created_at vs reservation_date
        repeat_customer_rate: Math.round(repeatCustomerRate * 10) / 10
      },
      operational: {
        peak_hours: peakHours.slice(0, 6),
        peak_days: peakDays,
        cancellation_rate: Math.round(cancellationRate * 10) / 10,
        no_show_rate: Math.round(noShowRate * 10) / 10,
        capacity_by_day: [] // Could be expanded
      },
      revenue_breakdown: {
        by_type: { omakase: omakaseRevenue, dining: diningRevenue },
        by_party_size: partySizeBreakdown,
        by_status: statusBreakdown
      },
      forecasting: {
        next_week_projection: nextWeekProjection,
        capacity_recommendations: [
          { date: format(new Date(), 'yyyy-MM-dd'), recommended_slots: 8, reason: 'High demand period' }
        ]
      }
    }

    console.log(`✅ Successfully processed analytics for ${totalReservations} reservations`)

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
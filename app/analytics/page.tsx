'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useToast } from '../../hooks/use-toast'
import { format, parseISO } from 'date-fns'
import type { AnalyticsData } from '../api/analytics/route'

export default function AnalyticsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d')
  const [isChineseMode, setIsChineseMode] = useState(false)

  // Translations
  const t = isChineseMode ? {
    title: '分析仪表板',
    subtitle: '深入了解您的餐厅业务表现',
    backToHome: '返回首页',
    overview: '概览',
    totalReservations: '总预订数',
    revenuePotential: '潜在收入',
    avgPartySize: '平均聚会人数',
    capacityUtilization: '容量利用率',
    periodGrowth: '增长率',
    trends: '趋势分析',
    dailyReservations: '每日预订趋势',
    weeklyRevenue: '每周收入对比',
    customerInsights: '客户洞察',
    newVsReturning: '新客户 vs 回头客',
    tierDistribution: '客户等级分布',
    repeatCustomerRate: '回头客比例',
    operational: '运营分析',
    peakHours: '高峰时段',
    peakDays: '高峰日期',
    cancellationRate: '取消率',
    noShowRate: '爽约率',
    revenueBreakdown: '收入分析',
    byType: '按类型分析',
    byPartySize: '按聚会人数分析',
    byStatus: '按状态分析',
    forecasting: '预测分析',
    nextWeekProjection: '下周预订预测',
    recommendations: '推荐建议',
    omakase: '怀石料理',
    dining: '普通用餐',
    new: '新客户',
    regular: '常客',
    vip: 'VIP',
    platinum: '白金',
    reservations: '预订',
    revenue: '收入',
    people: '人',
    loading: '加载中...',
    errorLoading: '加载分析数据失败'
  } : {
    title: 'Analytics Dashboard',
    subtitle: 'Deep insights into your restaurant performance',
    backToHome: 'Back to Home',
    overview: 'Overview',
    totalReservations: 'Total Reservations',
    revenuePotential: 'Revenue Potential',
    avgPartySize: 'Avg Party Size',
    capacityUtilization: 'Capacity Utilization',
    periodGrowth: 'Period Growth',
    trends: 'Trends Analysis',
    dailyReservations: 'Daily Reservations Trend',
    weeklyRevenue: 'Weekly Revenue Comparison',
    customerInsights: 'Customer Insights',
    newVsReturning: 'New vs Returning Customers',
    tierDistribution: 'Customer Tier Distribution',
    repeatCustomerRate: 'Repeat Customer Rate',
    operational: 'Operational Analysis',
    peakHours: 'Peak Hours',
    peakDays: 'Peak Days',
    cancellationRate: 'Cancellation Rate',
    noShowRate: 'No-Show Rate',
    revenueBreakdown: 'Revenue Breakdown',
    byType: 'By Reservation Type',
    byPartySize: 'By Party Size',
    byStatus: 'By Status',
    forecasting: 'Forecasting',
    nextWeekProjection: 'Next Week Projection',
    recommendations: 'Recommendations',
    omakase: 'Omakase',
    dining: 'Dining',
    new: 'New',
    regular: 'Regular',
    vip: 'VIP',
    platinum: 'Platinum',
    reservations: 'reservations',
    revenue: 'revenue',
    people: 'people',
    loading: 'Loading...',
    errorLoading: 'Error loading analytics data'
  }

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics?timeframe=${selectedTimeframe}`)
      const data = await response.json()

      if (response.ok) {
        setAnalytics(data)
      } else {
        throw new Error(data.error || 'Failed to fetch analytics')
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast({
        title: "Error",
        description: t.errorLoading,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  // Get trend color
  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // Get trend icon
  const getTrendIcon = (value: number) => {
    if (value > 0) return '↗️'
    if (value < 0) return '↘️'
    return '→'
  }

  useEffect(() => {
    fetchAnalytics()
  }, [selectedTimeframe])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        {/* Background Image */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/background_with_logo.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        />
        {/* Background Overlay */}
        <div className="fixed inset-0 bg-white/30 backdrop-blur-[1px]" />
        
        <div className="text-center relative z-10">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-copper"></div>
          <p className="mt-4 text-charcoal/60">{t.loading}</p>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        {/* Background Image */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/background_with_logo.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        />
        {/* Background Overlay */}
        <div className="fixed inset-0 bg-white/30 backdrop-blur-[1px]" />
        
        <div className="text-center relative z-10">
          <p className="text-charcoal/60">{t.errorLoading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/background_with_logo.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />
      {/* Background Overlay */}
      <div className="fixed inset-0 bg-white/30 backdrop-blur-[1px]" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">

      {/* Header */}
      <header className="liquid-glass shadow py-4 sm:py-6 px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <Image 
              src="/logo_transparent.png" 
              alt="TooHot Restaurant Logo" 
              width={40}
              height={40}
              className="object-contain sm:w-12 sm:h-12"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-playfair text-copper font-semibold">
              {t.title}
            </h1>
            <p className="text-xs sm:text-sm text-charcoal mt-1 hidden sm:block">
              {t.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-2 bg-white/60 rounded-xl border border-copper/20 focus:outline-none focus:ring-2 focus:ring-copper/20 text-sm"
          >
            <option value="7d">{isChineseMode ? '过去7天' : 'Last 7 days'}</option>
            <option value="30d">{isChineseMode ? '过去30天' : 'Last 30 days'}</option>
            <option value="90d">{isChineseMode ? '过去90天' : 'Last 90 days'}</option>
          </select>
          <button
            onClick={() => router.push('/')}
            className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 sm:gap-2"
          >
            <span className="text-sm sm:text-base">{t.backToHome}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          <button
            onClick={() => setIsChineseMode(!isChineseMode)}
            className="group relative bg-gradient-to-r from-copper to-amber-700 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-copper/90 hover:to-amber-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span className="text-sm sm:text-base">{isChineseMode ? 'English' : '中文'}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>
      </header>

      <div className="relative z-10 p-4 sm:p-6 lg:p-8">

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 mb-8">
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-4 lg:p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-charcoal/60 font-medium group-hover:text-charcoal/80 transition-colors duration-300">{t.totalReservations}</p>
                <p className="text-xl lg:text-2xl font-bold text-copper group-hover:text-copper/80 transition-colors duration-300">{analytics.overview.total_reservations.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-copper/20 to-copper/10 rounded-full flex items-center justify-center group-hover:from-copper/30 group-hover:to-copper/20 transition-all duration-300 group-hover:scale-110">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <span className={`text-sm ${getTrendColor(analytics.overview.period_growth)}`}>
                {getTrendIcon(analytics.overview.period_growth)} {formatPercentage(analytics.overview.period_growth)}
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-4 lg:p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-charcoal/60 font-medium group-hover:text-charcoal/80 transition-colors duration-300">{t.revenuePotential}</p>
                <p className="text-xl lg:text-2xl font-bold text-copper group-hover:text-copper/80 transition-colors duration-300">{formatCurrency(analytics.overview.total_revenue_potential)}</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-green-400/20 to-green-600/10 rounded-full flex items-center justify-center group-hover:from-green-400/30 group-hover:to-green-600/20 transition-all duration-300 group-hover:scale-110">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-4 lg:p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-charcoal/60 font-medium group-hover:text-charcoal/80 transition-colors duration-300">ARPC</p>
                <p className="text-xl lg:text-2xl font-bold text-copper group-hover:text-copper/80 transition-colors duration-300">{formatCurrency(analytics.overview.arpc)}</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-amber-400/20 to-amber-600/10 rounded-full flex items-center justify-center group-hover:from-amber-400/30 group-hover:to-amber-600/20 transition-all duration-300 group-hover:scale-110">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-4 lg:p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-charcoal/60 font-medium group-hover:text-charcoal/80 transition-colors duration-300">{t.avgPartySize}</p>
                <p className="text-xl lg:text-2xl font-bold text-copper group-hover:text-copper/80 transition-colors duration-300">{analytics.overview.average_party_size} {t.people}</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-400/20 to-blue-600/10 rounded-full flex items-center justify-center group-hover:from-blue-400/30 group-hover:to-blue-600/20 transition-all duration-300 group-hover:scale-110">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-4 lg:p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-charcoal/60 font-medium group-hover:text-charcoal/80 transition-colors duration-300">{t.capacityUtilization}</p>
                <p className="text-xl lg:text-2xl font-bold text-copper group-hover:text-copper/80 transition-colors duration-300">{analytics.overview.capacity_utilization}%</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-purple-400/20 to-purple-600/10 rounded-full flex items-center justify-center group-hover:from-purple-400/30 group-hover:to-purple-600/20 transition-all duration-300 group-hover:scale-110">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-4 lg:p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-charcoal/60 font-medium group-hover:text-charcoal/80 transition-colors duration-300">{t.nextWeekProjection}</p>
                <p className="text-xl lg:text-2xl font-bold text-copper group-hover:text-copper/80 transition-colors duration-300">{analytics.forecasting.next_week_projection} {t.reservations}</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-orange-400/20 to-orange-600/10 rounded-full flex items-center justify-center group-hover:from-orange-400/30 group-hover:to-orange-600/20 transition-all duration-300 group-hover:scale-110">
                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Daily Reservations Trend */}
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-playfair text-copper font-semibold">{t.dailyReservations}</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"></div>
                  <span className="text-charcoal/60">Weekdays</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"></div>
                  <span className="text-charcoal/60">Weekends</span>
                </div>
              </div>
            </div>
            <div className="h-64 flex items-end gap-2 relative">
              {analytics.trends.daily_reservations.slice(-14).map((day, index) => {
                const maxCount = Math.max(...analytics.trends.daily_reservations.map(d => d.count), 1) // Ensure min of 1
                const height = day.count > 0 ? Math.max((day.count / maxCount) * 100, 5) : 5 // Min height 5% for visibility
                const date = parseISO(day.date)
                const dayOfWeek = date.getDay()
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // Sunday = 0, Saturday = 6
                const weekdayName = format(date, 'EEEE')
                
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full relative flex flex-col justify-end" style={{ height: '200px' }}>
                      <div 
                        className={`w-full ${isWeekend 
                          ? 'bg-gradient-to-t from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700' 
                          : 'bg-gradient-to-t from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700'
                        } rounded-t-lg transition-all duration-300 hover:shadow-lg cursor-pointer min-h-[2px] group-hover:scale-105`}
                        style={{ height: day.count > 0 ? `${height}%` : '2px' }}
                        title={`${weekdayName}, ${format(date, 'MMM dd')}: ${day.count} reservations ${isWeekend ? '(Weekend)' : '(Weekday)'}`}
                      ></div>
                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        <div className="text-center">
                          <div className="font-medium">{weekdayName}</div>
                          <div>{format(date, 'MMM dd')}</div>
                          <div className="text-yellow-300">{day.count} reservations</div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                    <p className={`text-xs mt-2 text-center whitespace-nowrap transition-colors duration-300 ${isWeekend ? 'text-orange-600 font-medium' : 'text-charcoal/60'}`}>
                      {format(date, 'MMM dd')}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Weekly Revenue Comparison */}
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <h3 className="text-lg font-playfair text-copper font-semibold mb-4">{t.weeklyRevenue}</h3>
            <div className="h-64 flex items-end gap-4 relative">
              {analytics.trends.weekly_revenue.map((week, index) => {
                const maxRevenue = Math.max(...analytics.trends.weekly_revenue.map(w => w.omakase + w.dining), 100) // Ensure min of 100
                const totalRevenue = week.omakase + week.dining
                const totalHeight = totalRevenue > 0 ? Math.max((totalRevenue / maxRevenue) * 100, 5) : 5
                const omakaseRatio = totalRevenue > 0 ? (week.omakase / totalRevenue) : 0.5
                const diningRatio = totalRevenue > 0 ? (week.dining / totalRevenue) : 0.5
                
                return (
                  <div key={week.week} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full relative flex flex-col justify-end" style={{ height: '200px' }}>
                      {/* Stacked Bar Chart */}
                      <div className="w-full flex flex-col justify-end transition-all duration-300 group-hover:scale-105" style={{ height: totalRevenue > 0 ? `${totalHeight}%` : '5px' }}>
                        {/* Omakase section (top) */}
                        <div 
                          className="w-full bg-gradient-to-t from-pink-400 to-pink-600 rounded-t-lg hover:from-pink-500 hover:to-pink-700 transition-all duration-300 cursor-pointer"
                          style={{ height: `${omakaseRatio * 100}%`, minHeight: week.omakase > 0 ? '2px' : '0px' }}
                          title={`${week.week} Omakase: ${formatCurrency(week.omakase)}`}
                        ></div>
                        {/* Dining section (bottom) */}
                        <div 
                          className="w-full bg-gradient-to-t from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 transition-all duration-300 cursor-pointer"
                          style={{ height: `${diningRatio * 100}%`, minHeight: week.dining > 0 ? '2px' : '0px' }}
                          title={`${week.week} Dining: ${formatCurrency(week.dining)}`}
                        ></div>
                      </div>
                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        <div className="text-center">
                          <div className="font-medium">{week.week}</div>
                          <div className="text-pink-300">Omakase: {formatCurrency(week.omakase)}</div>
                          <div className="text-blue-300">Dining: {formatCurrency(week.dining)}</div>
                          <div className="text-yellow-300">Total: {formatCurrency(totalRevenue)}</div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                    <p className="text-xs text-charcoal/60 mt-2 text-center whitespace-nowrap group-hover:text-charcoal/80 transition-colors duration-300">{week.week}</p>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-r from-pink-400 to-pink-600 rounded"></div>
                <span className="text-sm text-charcoal/60">{t.omakase}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded"></div>
                <span className="text-sm text-charcoal/60">{t.dining}</span>
              </div>
            </div>
          </div>
        </div>



        {/* Insights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Customer Insights */}
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
            <h3 className="text-lg font-playfair text-copper font-semibold mb-4">{t.customerInsights}</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-charcoal/60 mb-2">{t.newVsReturning}</h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-green-100 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full"
                      style={{ width: `${(analytics.customer_insights.new_vs_returning.new / (analytics.customer_insights.new_vs_returning.new + analytics.customer_insights.new_vs_returning.returning)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-charcoal/60">
                    {analytics.customer_insights.new_vs_returning.new} / {analytics.customer_insights.new_vs_returning.returning}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-charcoal/60 mb-2">{t.tierDistribution}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-copper/10 rounded-lg">
                    <p className="text-lg font-bold text-copper">{analytics.customer_insights.tier_distribution.new}</p>
                    <p className="text-xs text-charcoal/60">{t.new}</p>
                  </div>
                  <div className="text-center p-2 bg-blue-100 rounded-lg">
                    <p className="text-lg font-bold text-blue-600">{analytics.customer_insights.tier_distribution.regular}</p>
                    <p className="text-xs text-charcoal/60">{t.regular}</p>
                  </div>
                  <div className="text-center p-2 bg-yellow-100 rounded-lg">
                    <p className="text-lg font-bold text-yellow-600">{analytics.customer_insights.tier_distribution.vip}</p>
                    <p className="text-xs text-charcoal/60">{t.vip}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-100 rounded-lg">
                    <p className="text-lg font-bold text-gray-600">{analytics.customer_insights.tier_distribution.platinum}</p>
                    <p className="text-xs text-charcoal/60">{t.platinum}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-charcoal/60 mb-2">{t.repeatCustomerRate}</h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-copper to-copper/60 h-3 rounded-full"
                      style={{ width: `${analytics.customer_insights.repeat_customer_rate}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-copper">{analytics.customer_insights.repeat_customer_rate}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Analytics */}
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
            <h3 className="text-lg font-playfair text-copper font-semibold mb-4">{t.operational}</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-charcoal/60 mb-2">{t.peakHours}</h4>
                <div className="space-y-1">
                  {analytics.operational.peak_hours.slice(0, 3).map((hour, index) => (
                    <div key={hour.hour} className="flex items-center justify-between">
                      <span className="text-sm text-charcoal">{hour.hour}:00</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-copper to-copper/60 h-2 rounded-full"
                            style={{ width: `${(hour.count / analytics.operational.peak_hours[0].count) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-charcoal/60">{hour.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-charcoal/60 mb-2">{t.peakDays}</h4>
                <div className="space-y-1">
                  {analytics.operational.peak_days.slice(0, 3).map((day, index) => (
                    <div key={day.day} className="flex items-center justify-between">
                      <span className="text-sm text-charcoal">{day.day}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full"
                            style={{ width: `${(day.count / analytics.operational.peak_days[0].count) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-charcoal/60">{day.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-600">{analytics.operational.cancellation_rate}%</p>
                  <p className="text-xs text-charcoal/60">{t.cancellationRate}</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-lg font-bold text-orange-600">{analytics.operational.no_show_rate}%</p>
                  <p className="text-xs text-charcoal/60">{t.noShowRate}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
            <h3 className="text-lg font-playfair text-copper font-semibold mb-4">{t.revenueBreakdown}</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-charcoal/60 mb-2">{t.byType}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-charcoal">{t.omakase}</span>
                    <span className="text-sm font-medium text-copper">{formatCurrency(analytics.revenue_breakdown.by_type.omakase)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-charcoal">{t.dining}</span>
                    <span className="text-sm font-medium text-copper">{formatCurrency(analytics.revenue_breakdown.by_type.dining)}</span>
                  </div>
                </div>
                
                <div className="mt-2 flex rounded-full overflow-hidden h-3">
                  <div 
                    className="bg-gradient-to-r from-pink-400 to-pink-600"
                    style={{ width: `${(analytics.revenue_breakdown.by_type.omakase / (analytics.revenue_breakdown.by_type.omakase + analytics.revenue_breakdown.by_type.dining)) * 100}%` }}
                  ></div>
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-blue-600"
                    style={{ width: `${(analytics.revenue_breakdown.by_type.dining / (analytics.revenue_breakdown.by_type.omakase + analytics.revenue_breakdown.by_type.dining)) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-charcoal/60 mb-2">{t.byPartySize}</h4>
                <div className="space-y-1">
                  {analytics.revenue_breakdown.by_party_size.slice(0, 4).map((party, index) => (
                    <div key={party.size} className="flex items-center justify-between">
                      <span className="text-sm text-charcoal">{party.size} {t.people}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-charcoal/60">{party.count}</span>
                        <span className="text-sm font-medium text-copper">{formatCurrency(party.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
} 
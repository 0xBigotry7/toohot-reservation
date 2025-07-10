'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useToast } from '../../hooks/use-toast'
import { format, parseISO } from 'date-fns'

interface CustomerData {
  id: string
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
  total_revenue_potential: number
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

interface Summary {
  total_customers: number
  total_reservations: number
  tier_breakdown: {
    new: number
    regular: number
    vip: number
    platinum: number
  }
  type_preference: {
    omakase: number
    dining: number
    both: number
  }
  total_revenue_potential: number
}

export default function CRMPage() {
  const router = useRouter()
  const { toast } = useToast()

  // Data state
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  
  // Filter and sort state
  const [filterTier, setFilterTier] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [sortBy, setSortBy] = useState('last_visit_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // View state
  const [currentView, setCurrentView] = useState<'grid' | 'table' | 'list' | 'card'>('grid')

  // Language toggle state
  const [isChineseMode, setIsChineseMode] = useState(false)

  // Translations
  const t = isChineseMode ? {
    title: '客户关系管理',
    subtitle: '管理客户数据和分析客户行为',
    totalCustomers: '总客户数',
    totalReservations: '总预订数',
    revenuePotential: '收入潜力',
    searchPlaceholder: '搜索客户姓名或邮箱...',
    filterByTier: '按等级筛选',
    filterByType: '按类型筛选',
    sortBy: '排序方式',
    allTiers: '所有等级',
    allTypes: '所有类型',
    new: '新客户',
    regular: '常客',
    vip: 'VIP',
    platinum: '白金',
    omakase: '怀石料理',
    dining: '普通用餐',
    both: '两者都有',
    lastVisit: '最后访问',
    totalVisits: '总访问',
    revenuePot: '收入潜力',
    customerName: '客户姓名',
    visits: '次访问',
    averageParty: '平均聚会规模',
    people: '人',
    tier: '等级',
    viewDetails: '查看详情',
    customerDetails: '客户详情',
    contactInfo: '联系信息',
    statistics: '统计信息',
    reservationHistory: '预订历史',
    close: '关闭',
    email: '邮箱',
    phone: '电话',
    firstVisit: '首次访问',
    favoriteType: '偏好类型',
    statusBreakdown: '状态分布',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
    pending: '待处理',
    seated: '已入座',
    noShow: '未出现',
    date: '日期',
    time: '时间',
    partySize: '聚会规模',
    type: '类型',
    status: '状态',
    specialRequests: '特殊要求',
    notes: '备注',
    noSpecialRequests: '无特殊要求',
    noNotes: '无备注',
    backToHome: '返回首页',
    loading: '加载中...',
    noCustomersFound: '没有找到客户',
    errorLoading: '加载客户数据时出错',
    // View options
    gridView: '网格视图',
    tableView: '表格视图',
    listView: '列表视图',
    cardView: '卡片视图',
    viewOptions: '视图选项'
  } : {
    title: 'Customer Relationship Management',
    subtitle: 'Manage customer data and analyze customer behavior',
    totalCustomers: 'Total Customers',
    totalReservations: 'Total Reservations',
    revenuePotential: 'Revenue Potential',
    searchPlaceholder: 'Search by customer name or email...',
    filterByTier: 'Filter by Tier',
    filterByType: 'Filter by Type',
    sortBy: 'Sort By',
    allTiers: 'All Tiers',
    allTypes: 'All Types',
    new: 'New',
    regular: 'Regular',
    vip: 'VIP',
    platinum: 'Platinum',
    omakase: 'Omakase',
    dining: 'Dining',
    both: 'Both',
    lastVisit: 'Last Visit',
    totalVisits: 'Total Visits',
    revenuePot: 'Revenue Potential',
    customerName: 'Customer Name',
    visits: ' visits',
    averageParty: 'Average Party Size',
    people: ' people',
    tier: 'Tier',
    viewDetails: 'View Details',
    customerDetails: 'Customer Details',
    contactInfo: 'Contact Information',
    statistics: 'Statistics',
    reservationHistory: 'Reservation History',
    close: 'Close',
    email: 'Email',
    phone: 'Phone',
    firstVisit: 'First Visit',
    favoriteType: 'Favorite Type',
    statusBreakdown: 'Status Breakdown',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    pending: 'Pending',
    seated: 'Seated',
    noShow: 'No Show',
    date: 'Date',
    time: 'Time',
    partySize: 'Party Size',
    type: 'Type',
    status: 'Status',
    specialRequests: 'Special Requests',
    notes: 'Notes',
    noSpecialRequests: 'No special requests',
    noNotes: 'No notes',
    backToHome: 'Back to Home',
    loading: 'Loading...',
    noCustomersFound: 'No customers found',
    errorLoading: 'Error loading customer data',
    // View options
    gridView: 'Grid View',
    tableView: 'Table View',
    listView: 'List View',
    cardView: 'Card View',
    viewOptions: 'View Options'
  }

  // Fetch customers data
  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString(),
        sort_by: sortBy,
        sort_order: sortOrder
      })

      if (filterTier) params.append('tier', filterTier)
      if (filterType) params.append('type', filterType)
      if (debouncedSearchTerm.trim()) params.append('search', debouncedSearchTerm.trim())

      const response = await fetch(`/api/customers?${params}`)
      const data = await response.json()

      if (response.ok) {
        setCustomers(data.customers || [])
        setSummary(data.summary || null)
      } else {
        throw new Error(data.error || 'Failed to fetch customers')
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast({
        title: "Error",
        description: t.errorLoading,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Fetch customer details
  const fetchCustomerDetails = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}`)
      const data = await response.json()

      if (response.ok) {
        setSelectedCustomer(data.customer)
        setShowCustomerModal(true)
      } else {
        throw new Error(data.error || 'Failed to fetch customer details')
      }
    } catch (error) {
      console.error('Error fetching customer details:', error)
      toast({
        title: "Error",
        description: "Failed to load customer details",
        variant: "destructive",
      })
    }
  }

  // Search is now handled server-side, so we use customers directly
  const filteredCustomers = customers

  // Get tier color
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-gradient-to-r from-gray-400 to-gray-600'
      case 'vip': return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
      case 'regular': return 'bg-gradient-to-r from-blue-400 to-blue-600'
      default: return 'bg-gradient-to-r from-green-400 to-green-600'
    }
  }

  // Get type badge color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'omakase': return 'bg-pink-100 text-pink-800'
      case 'dining': return 'bg-blue-100 text-blue-800'
      default: return 'bg-purple-100 text-purple-800'
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

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchCustomers()
  }, [currentPage, itemsPerPage, sortBy, sortOrder, filterTier, filterType, debouncedSearchTerm])

  // Reset to page 1 when search term changes
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      setCurrentPage(1)
    }
  }, [debouncedSearchTerm])

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-beige via-white to-sage-green">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] bg-repeat"></div>
      </div>

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

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-charcoal/60 font-medium">{t.totalCustomers}</p>
                  <p className="text-2xl font-bold text-copper">{summary.total_customers.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-copper/20 to-copper/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-charcoal/60 font-medium">{t.totalReservations}</p>
                  <p className="text-2xl font-bold text-copper">{summary.total_reservations.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-copper/20 to-copper/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-charcoal/60 font-medium">{t.revenuePotential}</p>
                  <p className="text-2xl font-bold text-copper">{formatCurrency(summary.total_revenue_potential)}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-copper/20 to-copper/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
              <div>
                <p className="text-sm text-charcoal/60 font-medium mb-3">Customer Tiers</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-charcoal/70">Platinum</span>
                    <span className="font-medium text-charcoal">{summary.tier_breakdown.platinum}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-charcoal/70">VIP</span>
                    <span className="font-medium text-charcoal">{summary.tier_breakdown.vip}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-charcoal/70">Regular</span>
                    <span className="font-medium text-charcoal">{summary.tier_breakdown.regular}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-charcoal/70">New</span>
                    <span className="font-medium text-charcoal">{summary.tier_breakdown.new}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-gradient-to-r from-white/70 to-white/50 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="lg:col-span-2">
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-white/60 rounded-xl border border-copper/20 focus:outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300"
              />
            </div>

            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="px-4 py-3 bg-white/60 rounded-xl border border-copper/20 focus:outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300"
            >
              <option value="">{t.allTiers}</option>
              <option value="platinum">{t.platinum}</option>
              <option value="vip">{t.vip}</option>
              <option value="regular">{t.regular}</option>
              <option value="new">{t.new}</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-3 bg-white/60 rounded-xl border border-copper/20 focus:outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300"
            >
              <option value="">{t.allTypes}</option>
              <option value="omakase">{t.omakase}</option>
              <option value="dining">{t.dining}</option>
              <option value="both">{t.both}</option>
            </select>

            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('_')
                setSortBy(field)
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="px-4 py-3 bg-white/60 rounded-xl border border-copper/20 focus:outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300"
            >
              <option value="last_visit_date_desc">{t.lastVisit} ↓</option>
              <option value="last_visit_date_asc">{t.lastVisit} ↑</option>
              <option value="total_visits_desc">{t.totalVisits} ↓</option>
              <option value="total_visits_asc">{t.totalVisits} ↑</option>
              <option value="total_revenue_potential_desc">{t.revenuePot} ↓</option>
              <option value="total_revenue_potential_asc">{t.revenuePot} ↑</option>
              <option value="customer_name_asc">{t.customerName} A-Z</option>
              <option value="customer_name_desc">{t.customerName} Z-A</option>
            </select>
          </div>
          
          {/* View Selector */}
          <div className="flex items-center justify-between pt-4 border-t border-copper/10">
            <span className="text-sm font-medium text-charcoal/70">{t.viewOptions}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${currentView === 'grid' 
                  ? 'bg-copper text-white shadow-lg' 
                  : 'bg-white/60 text-charcoal/60 hover:bg-white/80 hover:text-copper'
                }`}
                title={t.gridView}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentView('table')}
                className={`p-2 rounded-lg transition-all duration-200 ${currentView === 'table' 
                  ? 'bg-copper text-white shadow-lg' 
                  : 'bg-white/60 text-charcoal/60 hover:bg-white/80 hover:text-copper'
                }`}
                title={t.tableView}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V6a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentView('list')}
                className={`p-2 rounded-lg transition-all duration-200 ${currentView === 'list' 
                  ? 'bg-copper text-white shadow-lg' 
                  : 'bg-white/60 text-charcoal/60 hover:bg-white/80 hover:text-copper'
                }`}
                title={t.listView}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentView('card')}
                className={`p-2 rounded-lg transition-all duration-200 ${currentView === 'card' 
                  ? 'bg-copper text-white shadow-lg' 
                  : 'bg-white/60 text-charcoal/60 hover:bg-white/80 hover:text-copper'
                }`}
                title={t.cardView}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Customer List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-copper"></div>
            <p className="mt-4 text-charcoal/60">{t.loading}</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-charcoal/60">{t.noCustomersFound}</p>
          </div>
        ) : (
          <>
            {/* Grid View */}
            {currentView === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:border-copper/30 group"
                    onClick={() => fetchCustomerDetails(customer.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-charcoal truncate group-hover:text-copper transition-colors duration-200">
                          {customer.customer_name}
                        </h3>
                        <p className="text-sm text-charcoal/60 truncate">{customer.customer_email}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getTierColor(customer.customer_tier)}`}>
                        {isChineseMode ? (
                          customer.customer_tier === 'platinum' ? '白金' :
                          customer.customer_tier === 'vip' ? 'VIP' :
                          customer.customer_tier === 'regular' ? '常客' : '新客'
                        ) : (
                          customer.customer_tier
                        )}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-charcoal/60">{t.totalVisits}</span>
                        <span className="font-medium text-charcoal">{customer.total_visits}{t.visits}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-charcoal/60">{t.averageParty}</span>
                        <span className="font-medium text-charcoal">{customer.average_party_size}{t.people}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-charcoal/60">{t.lastVisit}</span>
                        <span className="font-medium text-charcoal">{format(parseISO(customer.last_visit_date), 'MMM dd')}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(customer.favorite_reservation_type)}`}>
                        {isChineseMode ? (
                          customer.favorite_reservation_type === 'omakase' ? '怀石' :
                          customer.favorite_reservation_type === 'dining' ? '用餐' : '两者'
                        ) : (
                          customer.favorite_reservation_type
                        )}
                      </span>
                      <span className="text-xs font-medium text-copper">
                        {formatCurrency(customer.total_revenue_potential)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {currentView === 'table' && (
              <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl border border-copper/10 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-copper/10 to-copper/5 border-b border-copper/20">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-medium text-charcoal/70">{t.customerName}</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-charcoal/70">{t.email}</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-charcoal/70">{t.tier}</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-charcoal/70">{t.totalVisits}</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-charcoal/70">{t.averageParty}</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-charcoal/70">{t.lastVisit}</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-charcoal/70">{t.type}</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-charcoal/70">{t.revenuePotential}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-copper/10">
                      {filteredCustomers.map((customer) => (
                        <tr 
                          key={customer.id} 
                          className="hover:bg-copper/5 transition-colors duration-200 cursor-pointer"
                          onClick={() => fetchCustomerDetails(customer.id)}
                        >
                          <td className="px-6 py-4 text-sm font-medium text-charcoal">{customer.customer_name}</td>
                          <td className="px-6 py-4 text-sm text-charcoal/60">{customer.customer_email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getTierColor(customer.customer_tier)}`}>
                              {isChineseMode ? (
                                customer.customer_tier === 'platinum' ? '白金' :
                                customer.customer_tier === 'vip' ? 'VIP' :
                                customer.customer_tier === 'regular' ? '常客' : '新客'
                              ) : (
                                customer.customer_tier
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-charcoal">{customer.total_visits}</td>
                          <td className="px-6 py-4 text-sm text-charcoal">{customer.average_party_size}</td>
                          <td className="px-6 py-4 text-sm text-charcoal">{format(parseISO(customer.last_visit_date), 'MMM dd, yyyy')}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(customer.favorite_reservation_type)}`}>
                              {isChineseMode ? (
                                customer.favorite_reservation_type === 'omakase' ? '怀石' :
                                customer.favorite_reservation_type === 'dining' ? '用餐' : '两者'
                              ) : (
                                customer.favorite_reservation_type
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-copper">{formatCurrency(customer.total_revenue_potential)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* List View */}
            {currentView === 'list' && (
              <div className="space-y-4">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="bg-gradient-to-r from-white/80 to-white/40 backdrop-blur-xl rounded-2xl p-4 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:border-copper/30 group"
                    onClick={() => fetchCustomerDetails(customer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-charcoal truncate group-hover:text-copper transition-colors duration-200">
                            {customer.customer_name}
                          </h3>
                          <p className="text-sm text-charcoal/60 truncate">{customer.customer_email}</p>
                        </div>
                        <div className="flex items-center space-x-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getTierColor(customer.customer_tier)}`}>
                            {isChineseMode ? (
                              customer.customer_tier === 'platinum' ? '白金' :
                              customer.customer_tier === 'vip' ? 'VIP' :
                              customer.customer_tier === 'regular' ? '常客' : '新客'
                            ) : (
                              customer.customer_tier
                            )}
                          </span>
                          <span className="text-charcoal/60">{customer.total_visits}{t.visits}</span>
                          <span className="text-charcoal/60">{customer.average_party_size}{t.people}</span>
                          <span className="text-charcoal/60">{format(parseISO(customer.last_visit_date), 'MMM dd')}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(customer.favorite_reservation_type)}`}>
                          {isChineseMode ? (
                            customer.favorite_reservation_type === 'omakase' ? '怀石' :
                            customer.favorite_reservation_type === 'dining' ? '用餐' : '两者'
                          ) : (
                            customer.favorite_reservation_type
                          )}
                        </span>
                        <span className="text-sm font-medium text-copper">
                          {formatCurrency(customer.total_revenue_potential)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Card View */}
            {currentView === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:border-copper/30 group"
                    onClick={() => fetchCustomerDetails(customer.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-charcoal truncate group-hover:text-copper transition-colors duration-200">
                          {customer.customer_name}
                        </h3>
                        <p className="text-sm text-charcoal/60 truncate">{customer.customer_email}</p>
                        {customer.customer_phone && (
                          <p className="text-sm text-charcoal/60 truncate mt-1">{customer.customer_phone}</p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getTierColor(customer.customer_tier)}`}>
                        {isChineseMode ? (
                          customer.customer_tier === 'platinum' ? '白金' :
                          customer.customer_tier === 'vip' ? 'VIP' :
                          customer.customer_tier === 'regular' ? '常客' : '新客'
                        ) : (
                          customer.customer_tier
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-white/40 rounded-xl">
                        <div className="text-xl font-bold text-copper">{customer.total_visits}</div>
                        <div className="text-xs text-charcoal/60">{t.totalVisits}</div>
                      </div>
                      <div className="text-center p-3 bg-white/40 rounded-xl">
                        <div className="text-xl font-bold text-copper">{customer.average_party_size}</div>
                        <div className="text-xs text-charcoal/60">{t.averageParty}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-copper/10">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(customer.favorite_reservation_type)}`}>
                          {isChineseMode ? (
                            customer.favorite_reservation_type === 'omakase' ? '怀石' :
                            customer.favorite_reservation_type === 'dining' ? '用餐' : '两者'
                          ) : (
                            customer.favorite_reservation_type
                          )}
                        </span>
                        <span className="text-sm text-charcoal/60">{format(parseISO(customer.last_visit_date), 'MMM dd')}</span>
                      </div>
                      <span className="text-sm font-medium text-copper">
                        {formatCurrency(customer.total_revenue_potential)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pagination Controls */}
        {!loading && filteredCustomers.length > 0 && summary && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm text-charcoal/60">{isChineseMode ? '每页显示：' : 'Show per page:'}</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1) // Reset to first page when changing page size
                }}
                className="px-3 py-2 bg-white/60 rounded-xl border border-copper/20 focus:outline-none focus:ring-2 focus:ring-copper/20 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={1000}>{isChineseMode ? '全部' : 'All'}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-charcoal/60">
                {isChineseMode ? 
                  `显示 ${((currentPage - 1) * itemsPerPage) + 1}-${Math.min(currentPage * itemsPerPage, summary.total_customers)} 共 ${summary.total_customers} 位客户` :
                  `Showing ${((currentPage - 1) * itemsPerPage) + 1}-${Math.min(currentPage * itemsPerPage, summary.total_customers)} of ${summary.total_customers} customers`
                }
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl bg-white/60 border border-copper/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/80 transition-all duration-200 text-sm"
              >
                {isChineseMode ? '上一页' : 'Previous'}
              </button>

              <span className="px-4 py-2 bg-copper/10 text-copper rounded-xl text-sm font-medium">
                {currentPage}
              </span>

              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage * itemsPerPage >= summary.total_customers}
                className="px-4 py-2 rounded-xl bg-white/60 border border-copper/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/80 transition-all duration-200 text-sm"
              >
                {isChineseMode ? '下一页' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Details Modal */}
      {showCustomerModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-white/90 to-sand-beige/80 backdrop-blur-xl rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border-2 border-copper/20 flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-copper/10 flex-shrink-0 bg-white/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-playfair text-copper font-semibold">{t.customerDetails}</h2>
                  <p className="text-sm text-charcoal/60 mt-1">{selectedCustomer.customer_name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowCustomerModal(false)
                    setSelectedCustomer(null)
                  }}
                  className="p-2 rounded-full bg-white/60 hover:bg-white/80 text-charcoal hover:text-copper transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Contact Information */}
                <div className="bg-white/60 rounded-2xl p-6 border border-copper/10">
                  <h3 className="text-lg font-playfair text-copper font-semibold mb-4">{t.contactInfo}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-charcoal/60 mb-1">{t.email}</label>
                      <p className="text-charcoal">{selectedCustomer.customer_email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-charcoal/60 mb-1">{t.phone}</label>
                      <p className="text-charcoal">{selectedCustomer.customer_phone}</p>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="bg-white/60 rounded-2xl p-6 border border-copper/10">
                  <h3 className="text-lg font-playfair text-copper font-semibold mb-4">{t.statistics}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-copper">{selectedCustomer.total_visits}</p>
                      <p className="text-sm text-charcoal/60">{t.totalVisits}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-copper">{selectedCustomer.average_party_size}</p>
                      <p className="text-sm text-charcoal/60">{t.averageParty}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-copper">{formatCurrency(selectedCustomer.total_revenue_potential)}</p>
                      <p className="text-sm text-charcoal/60">{t.revenuePotential}</p>
                    </div>
                    <div className="text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium text-white ${getTierColor(selectedCustomer.customer_tier)}`}>
                        {isChineseMode ? (
                          selectedCustomer.customer_tier === 'platinum' ? '白金' :
                          selectedCustomer.customer_tier === 'vip' ? 'VIP' :
                          selectedCustomer.customer_tier === 'regular' ? '常客' : '新客'
                        ) : (
                          selectedCustomer.customer_tier
                        )}
                      </span>
                      <p className="text-sm text-charcoal/60 mt-1">{t.tier}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div>
                      <label className="block text-sm font-medium text-charcoal/60 mb-1">{t.firstVisit}</label>
                      <p className="text-charcoal">{format(parseISO(selectedCustomer.first_visit_date), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-charcoal/60 mb-1">{t.lastVisit}</label>
                      <p className="text-charcoal">{format(parseISO(selectedCustomer.last_visit_date), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-charcoal/60 mb-1">{t.favoriteType}</label>
                      <span className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${getTypeColor(selectedCustomer.favorite_reservation_type)}`}>
                        {isChineseMode ? (
                          selectedCustomer.favorite_reservation_type === 'omakase' ? '怀石料理' :
                          selectedCustomer.favorite_reservation_type === 'dining' ? '普通用餐' : '两者都有'
                        ) : (
                          selectedCustomer.favorite_reservation_type
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-white/60 rounded-2xl p-6 border border-copper/10">
                  <h3 className="text-lg font-playfair text-copper font-semibold mb-4">{t.statusBreakdown}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-600">{selectedCustomer.status_breakdown.confirmed}</p>
                      <p className="text-xs text-charcoal/60">{t.confirmed}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-blue-600">{selectedCustomer.status_breakdown.completed}</p>
                      <p className="text-xs text-charcoal/60">{t.completed}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-red-600">{selectedCustomer.status_breakdown.cancelled}</p>
                      <p className="text-xs text-charcoal/60">{t.cancelled}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-yellow-600">{selectedCustomer.status_breakdown.pending}</p>
                      <p className="text-xs text-charcoal/60">{t.pending}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-purple-600">{selectedCustomer.status_breakdown.seated}</p>
                      <p className="text-xs text-charcoal/60">{t.seated}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-orange-600">{selectedCustomer.status_breakdown['no-show']}</p>
                      <p className="text-xs text-charcoal/60">{t.noShow}</p>
                    </div>
                  </div>
                </div>

                {/* Reservation History */}
                <div className="bg-white/60 rounded-2xl p-6 border border-copper/10">
                  <h3 className="text-lg font-playfair text-copper font-semibold mb-4">{t.reservationHistory}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-copper/10">
                          <th className="text-left py-2 text-charcoal/60 font-medium">{t.date}</th>
                          <th className="text-left py-2 text-charcoal/60 font-medium">{t.time}</th>
                          <th className="text-left py-2 text-charcoal/60 font-medium">{t.partySize}</th>
                          <th className="text-left py-2 text-charcoal/60 font-medium">{t.type}</th>
                          <th className="text-left py-2 text-charcoal/60 font-medium">{t.status}</th>
                          <th className="text-left py-2 text-charcoal/60 font-medium">{t.specialRequests}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCustomer.reservations.map((reservation) => (
                          <tr key={reservation.id} className="border-b border-copper/5">
                            <td className="py-2 text-charcoal">{format(parseISO(reservation.reservation_date), 'MMM dd, yyyy')}</td>
                            <td className="py-2 text-charcoal">{reservation.reservation_time}</td>
                            <td className="py-2 text-charcoal">{reservation.party_size}</td>
                            <td className="py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(reservation.type)}`}>
                                {isChineseMode ? (reservation.type === 'omakase' ? '怀石' : '用餐') : reservation.type}
                              </span>
                            </td>
                            <td className="py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                reservation.status === 'completed' ? 'bg-green-100 text-green-800' :
                                reservation.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                reservation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {reservation.status}
                              </span>
                            </td>
                            <td className="py-2 text-charcoal max-w-xs truncate">
                              {reservation.special_requests || t.noSpecialRequests}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-copper/10 flex-shrink-0 bg-white/50">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowCustomerModal(false)
                    setSelectedCustomer(null)
                  }}
                  className="px-6 py-3 rounded-full border border-copper/20 bg-white/60 hover:bg-white/80 transition-all duration-300 font-medium text-charcoal"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 
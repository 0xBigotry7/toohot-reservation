'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useToast } from '../../hooks/use-toast'
import { format, parseISO, isToday, addDays, startOfDay } from 'date-fns'

// Types
interface Table {
  id: string
  table_number: string
  table_name: string
  capacity: number
  table_type: 'omakase' | 'dining' | 'both'
  shape: 'rectangular' | 'round' | 'square'
  status: 'active' | 'inactive' | 'maintenance'
  section: string
  // Floor plan position data (directly on table object from API)
  x_position?: number
  y_position?: number
  width?: number
  height?: number
  rotation?: number
  floor_section?: string
  z_index?: number
  section_display_name?: string
  background_color?: string
  min_party_size?: number
  max_party_size?: number
  notes?: string
  // Legacy structure (keeping for backward compatibility)
  restaurant_floor_plan?: {
    x_position: number
    y_position: number
    width: number
    height: number
    rotation: number
    floor_section: string
  }[]
  currentReservation?: Reservation
}

interface Reservation {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  party_size: number
  duration_minutes: number
  special_requests: string
  notes: string
  status: 'confirmed' | 'pending' | 'cancelled' | 'seated' | 'finished'
  confirmation_code: string
  table_id?: string
  created_at: string
  updated_at: string
}

interface FloorPlanPosition {
  x_position: number
  y_position: number
  width: number
  height: number
  rotation: number
  floor_section: string
}

export default function RestaurantManagementPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // State management
  const [tables, setTables] = useState<Table[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'floor-plan' | 'list'>('floor-plan')
  const [draggedReservation, setDraggedReservation] = useState<Reservation | null>(null)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [showReservationDetails, setShowReservationDetails] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isChineseMode, setIsChineseMode] = useState(false)

  // Translations
  const t = isChineseMode ? {
    title: '餐厅管理系统',
    subtitle: '专业前厅管理',
    backToHome: '返回首页',
    floorPlan: '平面图',
    listView: '列表视图',
    today: '今天',
    tomorrow: '明天',
    selectDate: '选择日期',
    reservations: '预订',
    unassigned: '未分配',
    confirmed: '已确认',
    pending: '待处理',
    seated: '已入座',
    finished: '已完成',
    cancelled: '已取消',
    available: '可用',
    occupied: '已占用',
    maintenance: '维护中',
    inactive: '停用',
    capacity: '容量',
    partySize: '人数',
    time: '时间',
    customerName: '客户姓名',
    phone: '电话',
    email: '邮箱',
    specialRequests: '特殊要求',
    notes: '备注',
    duration: '时长',
    assignTable: '分配餐桌',
    moveTable: '移动餐桌',
    markSeated: '标记已入座',
    markFinished: '标记已完成',
    viewDetails: '查看详情',
    close: '关闭',
    save: '保存',
    cancel: '取消',
    dragToAssign: '拖拽分配餐桌',
    tableAssigned: '餐桌分配成功',
    reservationUpdated: '预订更新成功',
    errorAssigning: '分配餐桌失败',
    errorUpdating: '更新失败',
    loading: '加载中...',
    noReservations: '今日无预订',
    refreshData: '刷新数据',
    lastUpdated: '最后更新',
    autoRefresh: '自动刷新'
  } : {
    title: 'Restaurant Management',
    subtitle: 'Professional Front of House',
    backToHome: 'Back to Home',
    floorPlan: 'Floor Plan',
    listView: 'List View',
    today: 'Today',
    tomorrow: 'Tomorrow',
    selectDate: 'Select Date',
    reservations: 'Reservations',
    unassigned: 'Unassigned',
    confirmed: 'Confirmed',
    pending: 'Pending',
    seated: 'Seated',
    finished: 'Finished',
    cancelled: 'Cancelled',
    available: 'Available',
    occupied: 'Occupied',
    maintenance: 'Maintenance',
    inactive: 'Inactive',
    capacity: 'Capacity',
    partySize: 'Party Size',
    time: 'Time',
    customerName: 'Customer Name',
    phone: 'Phone',
    email: 'Email',
    specialRequests: 'Special Requests',
    notes: 'Notes',
    duration: 'Duration',
    assignTable: 'Assign Table',
    moveTable: 'Move Table',
    markSeated: 'Mark Seated',
    markFinished: 'Mark Finished',
    viewDetails: 'View Details',
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    dragToAssign: 'Drag to assign table',
    tableAssigned: 'Table assigned successfully',
    reservationUpdated: 'Reservation updated successfully',
    errorAssigning: 'Error assigning table',
    errorUpdating: 'Error updating reservation',
    loading: 'Loading...',
    noReservations: 'No reservations today',
    refreshData: 'Refresh Data',
    lastUpdated: 'Last Updated',
    autoRefresh: 'Auto Refresh'
  }

  // Fetch data
  const fetchTables = useCallback(async () => {
    try {
      const response = await fetch('/api/tables/floor-plan?section=main')
      const data = await response.json()
      
      if (data.success) {
        setTables(data.tables || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch tables",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching tables:', error)
      toast({
        title: "Error",
        description: "Failed to fetch tables",
        variant: "destructive"
      })
    }
  }, [toast])

  const fetchReservations = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const response = await fetch(`/api/dining-reservations?start_date=${dateStr}&end_date=${dateStr}`)
      const data = await response.json()
      
      if (data.reservations) {
        setReservations(data.reservations)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch reservations",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching reservations:', error)
      toast({
        title: "Error",
        description: "Failed to fetch reservations",
        variant: "destructive"
      })
    }
  }, [selectedDate, toast])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchTables(), fetchReservations()])
      setLoading(false)
    }
    loadData()
  }, [fetchTables, fetchReservations])

  // Auto-refresh current time
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Merge tables with their current reservations
  const tablesWithReservations = tables.map(table => {
    const currentReservation = reservations.find(r => 
      r.table_id === table.id && 
      ['confirmed', 'seated'].includes(r.status)
    )
    return {
      ...table,
      currentReservation
    }
  })

  // Get unassigned reservations
  const unassignedReservations = reservations.filter(r => 
    !r.table_id && 
    ['confirmed', 'pending'].includes(r.status)
  )

     // Drag and drop handlers
   const handleDragStart = (e: React.DragEvent, reservation: Reservation) => {
     setDraggedReservation(reservation)
     e.dataTransfer.effectAllowed = 'move'
   }

   const handleTableDragStart = (e: React.DragEvent, table: Table) => {
     if (table.currentReservation) {
       setDraggedReservation(table.currentReservation)
       e.dataTransfer.effectAllowed = 'move'
     }
   }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, table: Table) => {
    e.preventDefault()
    
    if (!draggedReservation) return
    
    // Check if table is available
    if (table.currentReservation) {
      toast({
        title: "Error",
        description: "Table is already occupied",
        variant: "destructive"
      })
      setDraggedReservation(null)
      return
    }

    // Check capacity
    if (draggedReservation.party_size > table.capacity) {
      toast({
        title: "Error",
        description: `Party size (${draggedReservation.party_size}) exceeds table capacity (${table.capacity})`,
        variant: "destructive"
      })
      setDraggedReservation(null)
      return
    }

    try {
      const response = await fetch('/api/dining-reservations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...draggedReservation,
          table_id: table.id,
          status: 'confirmed'
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: t.tableAssigned,
        })
        await fetchReservations()
      } else {
        throw new Error('Failed to assign table')
      }
    } catch (error) {
      console.error('Error assigning table:', error)
      toast({
        title: "Error",
        description: t.errorAssigning,
        variant: "destructive"
      })
    }

    setDraggedReservation(null)
  }

     // Quick assign reservation to best available table
   const handleQuickAssign = async (reservation: Reservation) => {
     // Find the best available table for this party size
     const availableTables = tablesWithReservations.filter(table => 
       !table.currentReservation && 
       table.status === 'active' && 
       table.capacity >= reservation.party_size
     )

     if (availableTables.length === 0) {
       toast({
         title: "Error",
         description: "No available tables for this party size",
         variant: "destructive"
       })
       return
     }

     // Sort by capacity (smallest that fits) and then by table number
     const bestTable = availableTables.sort((a, b) => {
       if (a.capacity === b.capacity) {
         return a.table_number.localeCompare(b.table_number)
       }
       return a.capacity - b.capacity
     })[0]

     // Assign the reservation to the best table
     try {
       const response = await fetch('/api/dining-reservations', {
         method: 'PUT',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           ...reservation,
           table_id: bestTable.id,
           status: 'confirmed'
         }),
       })

       if (response.ok) {
         toast({
           title: "Success",
           description: `Assigned to table ${bestTable.table_number}`,
         })
         await fetchReservations()
       } else {
         throw new Error('Failed to assign table')
       }
     } catch (error) {
       console.error('Error assigning table:', error)
       toast({
         title: "Error",
         description: "Failed to assign table",
         variant: "destructive"
       })
     }
   }

   // Move reservation to unassigned
   const handleMoveToUnassigned = async (reservation: Reservation) => {
     try {
       const response = await fetch('/api/dining-reservations', {
         method: 'PUT',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           ...reservation,
           table_id: null
         }),
       })

       if (response.ok) {
         toast({
           title: "Success",
           description: "Reservation moved to unassigned",
         })
         await fetchReservations()
       } else {
         throw new Error('Failed to move reservation')
       }
     } catch (error) {
       console.error('Error moving reservation:', error)
       toast({
         title: "Error",
         description: "Failed to move reservation",
         variant: "destructive"
       })
     }
   }

   // Status update handlers
   const updateReservationStatus = async (reservation: Reservation, newStatus: string) => {
    try {
      const response = await fetch('/api/dining-reservations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...reservation,
          status: newStatus
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: t.reservationUpdated,
        })
        await fetchReservations()
      } else {
        throw new Error('Failed to update reservation')
      }
    } catch (error) {
      console.error('Error updating reservation:', error)
      toast({
        title: "Error",
        description: t.errorUpdating,
        variant: "destructive"
      })
    }
  }

     // Get table status color with occupancy indicators
   const getTableStatusColor = (table: Table) => {
     if (table.status === 'inactive') return 'bg-gray-400'
     if (table.status === 'maintenance') return 'bg-yellow-400'
     if (table.currentReservation) {
       const occupancyRate = table.currentReservation.party_size / table.capacity
       if (table.currentReservation.status === 'seated') {
         if (occupancyRate >= 1) return 'bg-green-600' // Fully occupied
         if (occupancyRate >= 0.75) return 'bg-green-500' // Mostly occupied
         return 'bg-green-400' // Partially occupied
       }
       if (table.currentReservation.status === 'confirmed') {
         if (occupancyRate >= 1) return 'bg-blue-600' // Fully booked
         if (occupancyRate >= 0.75) return 'bg-blue-500' // Mostly booked
         return 'bg-blue-400' // Partially booked
       }
     }
     return 'bg-gray-200' // Available
   }

  // Get reservation status color
  const getReservationStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'seated': return 'bg-green-100 text-green-800 border-green-200'
      case 'finished': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Date navigation
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' 
      ? addDays(selectedDate, -1)
      : addDays(selectedDate, 1)
    setSelectedDate(newDate)
  }

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: 'url(/background_with_logo.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="bg-white/30 backdrop-blur-[1px] min-h-screen w-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">{t.loading}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundImage: 'url(/background_with_logo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="bg-white/30 backdrop-blur-[1px] min-h-screen">
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="liquid-glass shadow py-4 sm:py-6 px-4 sm:px-8 mb-8">
            <div className="flex items-center justify-between">
              {/* Brand Section */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-lg sm:text-xl">🍽️</span>
                  </div>
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

              {/* Navigation */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => router.push('/')}
                  className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 sm:gap-2"
                >
                  <span className="text-sm sm:text-base">{t.backToHome}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <button
                  onClick={() => setIsChineseMode(!isChineseMode)}
                  className="group relative bg-gradient-to-r from-orange-600 to-amber-700 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-orange-700 hover:to-amber-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <span className="text-sm sm:text-base">{isChineseMode ? 'English' : '中文'}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              </div>
            </div>
          </header>

          {/* Page Controls */}
          <div className="mb-6">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Date Navigation */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => navigateDate('prev')}
                    className="group relative bg-gradient-to-r from-orange-600 to-red-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    ←
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                  <div className="text-center">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                      {format(selectedDate, 'MMM d, yyyy')}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {isToday(selectedDate) ? t.today : format(selectedDate, 'EEEE')}
                    </p>
                  </div>
                  <button
                    onClick={() => navigateDate('next')}
                    className="group relative bg-gradient-to-r from-orange-600 to-red-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    →
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>

                {/* View Mode Controls */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setViewMode('floor-plan')}
                    className={`group relative px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 sm:gap-2 ${
                      viewMode === 'floor-plan' 
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700' 
                        : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
                    }`}
                  >
                    <span className="text-sm sm:text-base">{t.floorPlan}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`group relative px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 sm:gap-2 ${
                      viewMode === 'list' 
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700' 
                        : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
                    }`}
                  >
                    <span className="text-sm sm:text-base">{t.listView}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                         {/* Unassigned Reservations Sidebar */}
             <div className="lg:col-span-1">
               <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-6 h-[calc(100vh-200px)] flex flex-col">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {t.unassigned} ({unassignedReservations.length})
                </h3>
                
                                 {unassignedReservations.length === 0 ? (
                   <div className="flex-1 flex items-center justify-center">
                     <p className="text-gray-500 text-center">{t.noReservations}</p>
                   </div>
                 ) : (
                   <div className="flex-1 overflow-y-auto">
                     <div className="space-y-3 pr-2">
                       {unassignedReservations.map((reservation) => (
                         <div
                           key={reservation.id}
                           draggable
                           onDragStart={(e) => handleDragStart(e, reservation)}
                           className={`p-4 rounded-lg border-2 border-dashed cursor-move transition-all hover:shadow-md ${
                             getReservationStatusColor(reservation.status)
                           }`}
                         >
                           <div className="flex items-center justify-between mb-2">
                             <span className="font-medium text-sm">
                               {reservation.customer_name}
                             </span>
                             <span className="text-xs px-2 py-1 bg-white/50 rounded">
                               {reservation.party_size} pax
                             </span>
                           </div>
                           <div className="text-xs text-gray-600">
                             <div>{format(parseISO(`${reservation.reservation_date}T${reservation.reservation_time}`), 'h:mm a')}</div>
                             <div className="truncate">{reservation.customer_phone}</div>
                           </div>
                           <div className="mt-2 text-xs text-gray-500">
                             {t.dragToAssign}
                           </div>
                           <div className="mt-2 flex gap-1">
                             <button
                               onClick={() => handleQuickAssign(reservation)}
                               className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                             >
                               Quick Assign
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
              </div>
            </div>

            {/* Floor Plan / List View */}
            <div className="lg:col-span-3">
              {viewMode === 'floor-plan' ? (
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.floorPlan}</h3>
                  
                                     <div className="relative bg-gray-50 rounded-lg p-4 min-h-[700px] overflow-auto">
                     {/* Floor Plan Canvas */}
                     <div className="relative w-full h-[700px] min-w-[900px]">
                                             {tablesWithReservations.map((table) => {
                         // Check if table has position data (x_position, y_position are directly on table object)
                         if (typeof table.x_position === 'undefined' || typeof table.y_position === 'undefined') {
                           return null
                         }

                         return (
                           <div
                             key={table.id}
                             draggable={!!table.currentReservation}
                             onDragStart={(e) => handleTableDragStart(e, table)}
                             onDragOver={handleDragOver}
                             onDrop={(e) => handleDrop(e, table)}
                             onClick={() => setSelectedTable(table)}
                             className={`absolute cursor-pointer transition-all duration-300 hover:scale-105 ${
                               table.shape === 'round' ? 'rounded-full' : 
                               table.shape === 'square' ? 'rounded-lg' : 'rounded-md'
                             } ${table.currentReservation ? 'cursor-move' : 'cursor-pointer'}`}
                             style={{
                               left: `${table.x_position}px`,
                               top: `${table.y_position}px`,
                               width: `${table.width}px`,
                               height: `${table.height}px`,
                               transform: `rotate(${table.rotation || 0}deg)`,
                             }}
                           >
                             <div className={`w-full h-full border-2 border-gray-300 flex flex-col items-center justify-center text-white font-semibold shadow-lg relative ${
                               getTableStatusColor(table)
                             }`}>
                               <div className="text-lg">{table.table_number}</div>
                               <div className="text-xs">{table.capacity} seats</div>
                               {table.currentReservation && (
                                 <div className="text-xs mt-1 text-center">
                                   <div className="truncate max-w-full">
                                     {table.currentReservation.customer_name}
                                   </div>
                                   <div>{table.currentReservation.party_size}/{table.capacity} pax</div>
                                 </div>
                               )}
                               
                               {/* Seat Utilization Indicator */}
                               {table.currentReservation && (
                                 <div className="absolute top-1 right-1 bg-white/80 rounded-full w-5 h-5 flex items-center justify-center">
                                   <div className="text-xs text-gray-800 font-bold">
                                     {Math.round((table.currentReservation.party_size / table.capacity) * 100)}%
                                   </div>
                                 </div>
                               )}
                               
                               {/* Table Action Buttons */}
                               {table.currentReservation && (
                                 <div className="absolute -top-2 -right-2 flex gap-1">
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       handleMoveToUnassigned(table.currentReservation!)
                                     }}
                                     className="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center"
                                     title="Move to unassigned"
                                   >
                                     ×
                                   </button>
                                 </div>
                               )}
                             </div>
                           </div>
                         )
                       })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.listView}</h3>
                  
                  <div className="space-y-4">
                    {tablesWithReservations.map((table) => (
                      <div
                        key={table.id}
                        className="p-4 bg-gray-50 rounded-lg border hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold ${
                              getTableStatusColor(table)
                            }`}>
                              {table.table_number}
                            </div>
                            <div>
                              <div className="font-medium">{table.table_name}</div>
                              <div className="text-sm text-gray-600">
                                {t.capacity}: {table.capacity} | {table.table_type}
                              </div>
                            </div>
                          </div>
                          
                          {table.currentReservation ? (
                            <div className="text-right">
                              <div className="font-medium">{table.currentReservation.customer_name}</div>
                              <div className="text-sm text-gray-600">
                                {table.currentReservation.party_size} pax - {format(parseISO(`${table.currentReservation.reservation_date}T${table.currentReservation.reservation_time}`), 'h:mm a')}
                              </div>
                              <div className="mt-2 flex gap-2">
                                {table.currentReservation.status === 'confirmed' && (
                                  <button
                                    onClick={() => updateReservationStatus(table.currentReservation!, 'seated')}
                                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                  >
                                    {t.markSeated}
                                  </button>
                                )}
                                {table.currentReservation.status === 'seated' && (
                                  <button
                                    onClick={() => updateReservationStatus(table.currentReservation!, 'finished')}
                                    className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                                  >
                                    {t.markFinished}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm">{t.available}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table Details Modal */}
          {selectedTable && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {selectedTable.table_name} ({selectedTable.table_number})
                  </h3>
                  <button
                    onClick={() => setSelectedTable(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-600">{t.capacity}</div>
                    <div className="font-medium">{selectedTable.capacity} seats</div>
                  </div>
                  
                  {selectedTable.currentReservation ? (
                    <div className="border-t pt-4">
                      <div className="text-sm text-gray-600 mb-2">Current Reservation</div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-sm text-gray-600">{t.customerName}</div>
                          <div className="font-medium">{selectedTable.currentReservation.customer_name}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">{t.phone}</div>
                          <div className="font-medium">{selectedTable.currentReservation.customer_phone}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">{t.partySize}</div>
                          <div className="font-medium">{selectedTable.currentReservation.party_size} people</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">{t.time}</div>
                          <div className="font-medium">
                            {format(parseISO(`${selectedTable.currentReservation.reservation_date}T${selectedTable.currentReservation.reservation_time}`), 'h:mm a')}
                          </div>
                        </div>
                        {selectedTable.currentReservation.special_requests && (
                          <div>
                            <div className="text-sm text-gray-600">{t.specialRequests}</div>
                            <div className="font-medium">{selectedTable.currentReservation.special_requests}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center py-4">
                      {t.available}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
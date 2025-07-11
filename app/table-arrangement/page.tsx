'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useToast } from '../../hooks/use-toast'

interface Table {
  id: string
  table_number: string
  table_name: string
  capacity: number
  table_type: 'omakase' | 'dining' | 'both'
  shape: 'rectangular' | 'round' | 'square'
  status: 'active' | 'inactive' | 'maintenance'
  section: string
  x_position: number
  y_position: number
  width: number
  height: number
  rotation: number
  floor_section: string
  background_color?: string
  section_display_name?: string
}

interface FloorSection {
  id: string
  section_name: string
  section_display_name: string
  background_color: string
  width: number
  height: number
  is_active: boolean
  sort_order: number
}

interface DragState {
  isDragging: boolean
  tableId: string | null
  offset: { x: number; y: number }
  startPosition: { x: number; y: number }
}

export default function TableArrangementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [sections, setSections] = useState<FloorSection[]>([])
  const [loading, setLoading] = useState(true)
  const [isChineseMode, setIsChineseMode] = useState(false)
  const [currentSection, setCurrentSection] = useState('main')
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    tableId: null,
    offset: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 }
  })
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [showProperties, setShowProperties] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [showAddTableModal, setShowAddTableModal] = useState(false)
  const [newTableData, setNewTableData] = useState({
    table_number: '',
    table_name: '',
    capacity: 4,
    table_type: 'dining' as 'omakase' | 'dining' | 'both',
    shape: 'rectangular' as 'rectangular' | 'round' | 'square'
  })

  // Translations
  const t = isChineseMode ? {
    title: '餐桌布局',
    subtitle: '拖拽调整餐桌位置和布局',
    backToHome: '返回首页',
    tableManagement: '餐桌管理',
    section: '区域',
    selectedTable: '选中餐桌',
    tableProperties: '餐桌属性',
    position: '位置',
    size: '大小',
    rotation: '旋转',
    save: '保存',
    cancel: '取消',
    saveChanges: '保存更改',
    discardChanges: '放弃更改',
    loading: '加载中...',
    errorLoading: '加载失败',
    errorSaving: '保存失败',
    changesSaved: '更改已保存',
    noTables: '没有找到餐桌',
    dragToMove: '拖拽移动餐桌',
    clickToSelect: '点击选择餐桌',
    unsavedChanges: '有未保存的更改',
    width: '宽度',
    height: '高度',
    xPosition: 'X 位置',
    yPosition: 'Y 位置',
    degrees: '度',
    addTable: '添加餐桌',
    removeTable: '删除餐桌',
    tableName: '餐桌名称',
    tableNumber: '餐桌编号',
    capacity: '容量',
    tableType: '餐桌类型',
    shape: '形状',
    omakase: '怀石料理',
    dining: '普通用餐',
    both: '两者皆可',
    rectangular: '矩形',
    round: '圆形',
    square: '方形',
    deleteConfirm: '确定要删除这个餐桌吗？',
    tableDeleted: '餐桌已删除',
    tableAdded: '餐桌添加成功',
    tableUpdated: '餐桌更新成功',
    fillAllFields: '请填写所有字段',
    tableExists: '餐桌编号已存在'
  } : {
    title: 'Table Arrangement',
    subtitle: 'Drag and drop tables to adjust layout',
    backToHome: 'Back to Home',
    tableManagement: 'Table Management',
    section: 'Section',
    selectedTable: 'Selected Table',
    tableProperties: 'Table Properties',
    position: 'Position',
    size: 'Size',
    rotation: 'Rotation',
    save: 'Save',
    cancel: 'Cancel',
    saveChanges: 'Save Changes',
    discardChanges: 'Discard Changes',
    loading: 'Loading...',
    errorLoading: 'Error loading',
    errorSaving: 'Error saving',
    changesSaved: 'Changes saved',
    noTables: 'No tables found',
    dragToMove: 'Drag to move tables',
    clickToSelect: 'Click to select table',
    unsavedChanges: 'Unsaved changes',
    width: 'Width',
    height: 'Height',
    xPosition: 'X Position',
    yPosition: 'Y Position',
    degrees: 'degrees',
    addTable: 'Add Table',
    removeTable: 'Remove Table',
    tableName: 'Table Name',
    tableNumber: 'Table Number',
    capacity: 'Capacity',
    tableType: 'Table Type',
    shape: 'Shape',
    omakase: 'Omakase',
    dining: 'Dining',
    both: 'Both',
    rectangular: 'Rectangular',
    round: 'Round',
    square: 'Square',
    deleteConfirm: 'Are you sure you want to delete this table?',
    tableDeleted: 'Table deleted successfully',
    tableAdded: 'Table added successfully',
    tableUpdated: 'Table updated successfully',
    fillAllFields: 'Please fill all fields',
    tableExists: 'Table number already exists'
  }

  const fetchFloorPlan = async () => {
    setLoading(true)
    try {
      // Focus on main dining room only
      const response = await fetch(`/api/tables/floor-plan?section=main`)
      const data = await response.json()

      if (response.ok) {
        setTables(data.tables || [])
        setSections(data.sections || [])
      } else {
        throw new Error(data.error || 'Failed to fetch floor plan')
      }
    } catch (error) {
      console.error('Error fetching floor plan:', error)
      toast({
        title: "Error",
        description: t.errorLoading,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddTable = async () => {
    if (!newTableData.table_number || !newTableData.table_name) {
      toast({
        title: "Error",
        description: t.fillAllFields,
        variant: "destructive",
      })
      return
    }

    // Check if table number already exists
    if (tables.some(table => table.table_number === newTableData.table_number)) {
      toast({
        title: "Error",
        description: t.tableExists,
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newTableData,
          section: 'main-dining',
          min_party_size: 1,
          max_party_size: newTableData.capacity,
          notes: ''
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: t.tableAdded,
        })
        
        // Add table to canvas at center position
        const newTable: Table = {
          id: data.table.id,
          table_number: newTableData.table_number,
          table_name: newTableData.table_name,
          capacity: newTableData.capacity,
          table_type: newTableData.table_type,
          shape: newTableData.shape,
          status: 'active',
          section: 'main-dining',
          x_position: 400, // Center position
          y_position: 300,
          width: newTableData.shape === 'round' ? 80 : 100,
          height: newTableData.shape === 'round' ? 80 : 60,
          rotation: 0,
          floor_section: 'main'
        }
        
        setTables(prev => [...prev, newTable])
        setShowAddTableModal(false)
        setNewTableData({
          table_number: '',
          table_name: '',
          capacity: 4,
          table_type: 'dining',
          shape: 'rectangular'
        })
        setUnsavedChanges(true)
      } else {
        throw new Error(data.error || 'Failed to add table')
      }
    } catch (error) {
      console.error('Error adding table:', error)
      toast({
        title: "Error",
        description: t.errorSaving,
        variant: "destructive",
      })
    }
  }

  const handleRemoveTable = async (tableId: string) => {
    if (!confirm(t.deleteConfirm)) return

    try {
      const response = await fetch(`/api/tables?id=${tableId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setTables(prev => prev.filter(table => table.id !== tableId))
        setSelectedTable(null)
        setShowProperties(false)
        setUnsavedChanges(true)
        toast({
          title: "Success",
          description: t.tableDeleted,
        })
      } else {
        throw new Error('Failed to delete table')
      }
    } catch (error) {
      console.error('Error deleting table:', error)
      toast({
        title: "Error",
        description: t.errorSaving,
        variant: "destructive",
      })
    }
  }

  const handleUpdateTableProperty = async (property: string, value: any) => {
    if (!selectedTable) return

    try {
      const response = await fetch('/api/tables', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedTable.id,
          [property]: value
        }),
      })

      if (response.ok) {
        setTables(prevTables =>
          prevTables.map(table =>
            table.id === selectedTable.id
              ? { ...table, [property]: value }
              : table
          )
        )
        setSelectedTable(prev => prev ? { ...prev, [property]: value } : null)
        
        toast({
          title: "Success",
          description: t.tableUpdated,
        })
      } else {
        throw new Error('Failed to update table')
      }
    } catch (error) {
      console.error('Error updating table:', error)
      toast({
        title: "Error",
        description: t.errorSaving,
        variant: "destructive",
      })
    }
  }

  const handleSaveChanges = async () => {
    try {
      const updates = tables.map(table => ({
        table_id: table.id,
        x_position: table.x_position,
        y_position: table.y_position,
        width: table.width,
        height: table.height,
        rotation: table.rotation,
        floor_section: table.floor_section
      }))

      const response = await fetch('/api/tables/floor-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: t.changesSaved,
        })
        setUnsavedChanges(false)
      } else {
        throw new Error(data.error || 'Failed to save changes')
      }
    } catch (error) {
      console.error('Error saving changes:', error)
      toast({
        title: "Error",
        description: t.errorSaving,
        variant: "destructive",
      })
    }
  }

  const handleMouseDown = (e: React.MouseEvent, table: Table) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const startX = e.clientX - rect.left
    const startY = e.clientY - rect.top

    setDragState({
      isDragging: true,
      tableId: table.id,
      offset: {
        x: startX - table.x_position,
        y: startY - table.y_position
      },
      startPosition: {
        x: table.x_position,
        y: table.y_position
      }
    })
    setSelectedTable(table)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.tableId) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const newX = Math.max(0, Math.min(mouseX - dragState.offset.x, (rect.width - 100)))
    const newY = Math.max(0, Math.min(mouseY - dragState.offset.y, (rect.height - 100)))

    setTables(prevTables => 
      prevTables.map(table => 
        table.id === dragState.tableId 
          ? { ...table, x_position: newX, y_position: newY }
          : table
      )
    )

    if (!unsavedChanges) {
      setUnsavedChanges(true)
    }
  }

  const handleMouseUp = () => {
    setDragState({
      isDragging: false,
      tableId: null,
      offset: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 }
    })
  }

  const handleTableClick = (table: Table) => {
    setSelectedTable(table)
    setShowProperties(true)
  }

  const handlePropertyChange = (property: string, value: number) => {
    if (!selectedTable) return

    setTables(prevTables =>
      prevTables.map(table =>
        table.id === selectedTable.id
          ? { ...table, [property]: value }
          : table
      )
    )

    setSelectedTable(prev => prev ? { ...prev, [property]: value } : null)
    setUnsavedChanges(true)
  }

  const getTableColor = (table: Table) => {
    if (table.table_type === 'omakase') return 'bg-pink-200 border-pink-400'
    if (table.table_type === 'dining') return 'bg-blue-200 border-blue-400'
    return 'bg-purple-200 border-purple-400'
  }

  const getTableShapeClass = (table: Table) => {
    if (table.shape === 'round') return 'rounded-full'
    if (table.shape === 'square') return 'rounded-lg'
    return 'rounded-lg' // rectangular
  }

  const getCurrentSectionData = () => {
    return sections.find(s => s.section_name === currentSection)
  }

  useEffect(() => {
    fetchFloorPlan()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTable(null)
        setShowProperties(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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

  const sectionData = getCurrentSectionData()

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
          {/* Add Table Button */}
          <button
            onClick={() => setShowAddTableModal(true)}
            className="group relative bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <span className="text-lg">➕</span>
            <span className="text-sm sm:text-base">{t.addTable}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          
          {/* Save Changes Button */}
          {unsavedChanges && (
            <button
              onClick={handleSaveChanges}
              className="group relative bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <span className="text-sm sm:text-base">{t.saveChanges}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          )}
          
          <button
            onClick={() => router.push('/table-management')}
            className="group relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span className="text-sm sm:text-base">{t.tableManagement}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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
        <div className="flex gap-8">
          {/* Floor Plan Canvas */}
          <div className="flex-1">
            <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-playfair text-copper font-semibold">
                  Main Dining Room
                </h2>
                <div className="flex items-center gap-2 text-sm text-charcoal/60">
                  <span>{t.dragToMove}</span>
                  <span>•</span>
                  <span>{t.clickToSelect}</span>
                  <span>•</span>
                  <span>{tables.length} tables</span>
                </div>
              </div>

              {/* Canvas */}
              <div 
                ref={canvasRef}
                className="relative border-2 border-dashed border-copper/20 rounded-xl overflow-hidden cursor-crosshair"
                style={{ 
                  width: sectionData?.width || 1000,
                  height: sectionData?.height || 700,
                  backgroundColor: sectionData?.background_color || '#f8f9fa'
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Grid Pattern */}
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #666 1px, transparent 1px),
                      linear-gradient(to bottom, #666 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                  }}
                />

                {/* Tables */}
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className={`absolute cursor-pointer transition-all duration-150 ${getTableColor(table)} ${getTableShapeClass(table)} border-2 flex items-center justify-center text-xs font-medium shadow-lg hover:shadow-xl ${
                      selectedTable?.id === table.id ? 'ring-2 ring-copper ring-opacity-50 ring-offset-2' : ''
                    } ${
                      dragState.isDragging && dragState.tableId === table.id ? 'scale-105 z-20' : 'hover:scale-105'
                    }`}
                    style={{
                      left: table.x_position,
                      top: table.y_position,
                      width: table.width,
                      height: table.height,
                      transform: `rotate(${table.rotation}deg)`,
                      zIndex: selectedTable?.id === table.id ? 10 : 1
                    }}
                    onMouseDown={(e) => handleMouseDown(e, table)}
                    onClick={() => handleTableClick(table)}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-charcoal">{table.table_number}</div>
                      <div className="text-xs text-charcoal/60">{table.capacity} seats</div>
                      {table.table_name && (
                        <div className="text-xs text-charcoal/50 truncate max-w-full">
                          {table.table_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Drop zones for different sections could go here */}
              </div>
            </div>
          </div>

          {/* Properties Panel */}
          {showProperties && selectedTable && (
            <div className="w-80">
              <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-3xl p-6 border border-copper/10 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-playfair text-copper font-semibold">
                    {t.tableProperties}
                  </h3>
                  <button
                    onClick={() => setShowProperties(false)}
                    className="text-charcoal/60 hover:text-charcoal transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Table Basic Info */}
                  <div className="p-3 bg-white/50 rounded-lg">
                    <div className="font-semibold text-copper">{selectedTable.table_number}</div>
                    <div className="text-sm text-charcoal/60">
                      {selectedTable.table_name || 'No name'}
                    </div>
                    <div className="text-sm text-charcoal/60">
                      {selectedTable.capacity} seats • {selectedTable.table_type} • {selectedTable.shape}
                    </div>
                  </div>

                  {/* Table Name */}
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      {t.tableName}
                    </label>
                    <input
                      type="text"
                      value={selectedTable.table_name || ''}
                      onChange={(e) => handleUpdateTableProperty('table_name', e.target.value)}
                      className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                      placeholder="Enter table name"
                    />
                  </div>

                  {/* Capacity */}
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      {t.capacity}
                    </label>
                    <input
                      type="number"
                      value={selectedTable.capacity}
                      onChange={(e) => handleUpdateTableProperty('capacity', parseInt(e.target.value) || 2)}
                      className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                      min="1"
                      max="12"
                    />
                  </div>

                  {/* Table Type */}
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      {t.tableType}
                    </label>
                    <select
                      value={selectedTable.table_type}
                      onChange={(e) => handleUpdateTableProperty('table_type', e.target.value)}
                      className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                    >
                      <option value="dining">{t.dining}</option>
                      <option value="omakase">{t.omakase}</option>
                      <option value="both">{t.both}</option>
                    </select>
                  </div>

                  {/* Shape */}
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      {t.shape}
                    </label>
                    <select
                      value={selectedTable.shape}
                      onChange={(e) => handleUpdateTableProperty('shape', e.target.value)}
                      className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                    >
                      <option value="rectangular">{t.rectangular}</option>
                      <option value="round">{t.round}</option>
                      <option value="square">{t.square}</option>
                    </select>
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      {t.position}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-charcoal/60">{t.xPosition}</label>
                        <input
                          type="number"
                          value={Math.round(selectedTable.x_position)}
                          onChange={(e) => handlePropertyChange('x_position', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-copper/20 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-charcoal/60">{t.yPosition}</label>
                        <input
                          type="number"
                          value={Math.round(selectedTable.y_position)}
                          onChange={(e) => handlePropertyChange('y_position', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-copper/20 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Size */}
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      {t.size}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-charcoal/60">{t.width}</label>
                        <input
                          type="number"
                          value={selectedTable.width}
                          onChange={(e) => handlePropertyChange('width', parseInt(e.target.value) || 80)}
                          className="w-full px-2 py-1 border border-copper/20 rounded text-sm"
                          min="40"
                          max="200"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-charcoal/60">{t.height}</label>
                        <input
                          type="number"
                          value={selectedTable.height}
                          onChange={(e) => handlePropertyChange('height', parseInt(e.target.value) || 60)}
                          className="w-full px-2 py-1 border border-copper/20 rounded text-sm"
                          min="40"
                          max="200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rotation */}
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      {t.rotation}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={selectedTable.rotation}
                        onChange={(e) => handlePropertyChange('rotation', parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm text-charcoal/60 w-12">
                        {selectedTable.rotation}°
                      </span>
                    </div>
                  </div>

                  {/* Remove Table Button */}
                  <div className="pt-4 border-t border-copper/10">
                    <button
                      onClick={() => handleRemoveTable(selectedTable.id)}
                      className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
                    >
                      {t.removeTable}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add Table Modal */}
        {showAddTableModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-playfair text-copper font-semibold">
                  {t.addTable}
                </h3>
                <button
                  onClick={() => setShowAddTableModal(false)}
                  className="text-charcoal/60 hover:text-charcoal transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Table Number */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    {t.tableNumber} *
                  </label>
                  <input
                    type="text"
                    value={newTableData.table_number}
                    onChange={(e) => setNewTableData(prev => ({ ...prev, table_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                    placeholder="e.g., D9, D10"
                  />
                </div>

                {/* Table Name */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    {t.tableName} *
                  </label>
                  <input
                    type="text"
                    value={newTableData.table_name}
                    onChange={(e) => setNewTableData(prev => ({ ...prev, table_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                    placeholder="e.g., Window Table, Corner Booth"
                  />
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    {t.capacity}
                  </label>
                  <input
                    type="number"
                    value={newTableData.capacity}
                    onChange={(e) => setNewTableData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 4 }))}
                    className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                    min="1"
                    max="12"
                  />
                </div>

                {/* Table Type */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    {t.tableType}
                  </label>
                  <select
                    value={newTableData.table_type}
                    onChange={(e) => setNewTableData(prev => ({ ...prev, table_type: e.target.value as 'omakase' | 'dining' | 'both' }))}
                    className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                  >
                    <option value="dining">{t.dining}</option>
                    <option value="omakase">{t.omakase}</option>
                    <option value="both">{t.both}</option>
                  </select>
                </div>

                {/* Shape */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    {t.shape}
                  </label>
                  <select
                    value={newTableData.shape}
                    onChange={(e) => setNewTableData(prev => ({ ...prev, shape: e.target.value as 'rectangular' | 'round' | 'square' }))}
                    className="w-full px-3 py-2 border border-copper/20 rounded-lg text-sm"
                  >
                    <option value="rectangular">{t.rectangular}</option>
                    <option value="round">{t.round}</option>
                    <option value="square">{t.square}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddTableModal(false)}
                  className="flex-1 px-4 py-2 border border-copper/20 rounded-lg text-charcoal hover:bg-copper/5 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleAddTable}
                  className="flex-1 px-4 py-2 bg-copper text-white rounded-lg hover:bg-copper/90 transition-colors"
                >
                  {t.addTable}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unsaved Changes Warning */}
        {unsavedChanges && (
          <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm">{t.unsavedChanges}</span>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
} 
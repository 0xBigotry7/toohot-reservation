'use client'

import { useState, useEffect, useMemo } from 'react'
import { useToast } from '../hooks/use-toast'

interface TimeSlot {
  time: string // e.g., "17:00"
  covers: number // max covers (seats) for this time slot
  parties: number // max parties (reservations) for this time slot
  enabled: boolean // whether this slot is active
}

interface SlotBasedCapacitySettings {
  type: 'slot_based'
  slotDuration: 15 | 30 // minutes between slots
  omakase: TimeSlot[]
  dining: TimeSlot[]
}

interface Props {
  isChineseMode: boolean
  onSettingsSaved?: () => void
}

export default function SlotBasedCapacity({ isChineseMode, onSettingsSaved }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'omakase' | 'dining'>('dining')
  const [slotDuration, setSlotDuration] = useState<15 | 30>(30)
  const [businessHours, setBusinessHours] = useState({
    omakase: [{ start: '17:00', end: '19:00' }], // Fixed slots for omakase
    dining: {
      lunch: { start: '12:00', end: '15:00' },
      dinner: { start: '17:00', end: '22:00' }
    }
  })
  const [settings, setSettings] = useState<SlotBasedCapacitySettings>({
    type: 'slot_based',
    slotDuration: 30,
    omakase: [],
    dining: []
  })

  const t = isChineseMode ? {
    title: '时间段容量设置',
    description: '为每个时间段设置最大容纳人数和最大接待组数',
    omakase: '无菜单料理',
    dining: '单点餐饮',
    timeSlot: '时间',
    covers: '容纳人数',
    parties: '接待组数',
    enabled: '启用',
    perSlot: '每',
    minutes: '分钟',
    hideAllIntervals: '隐藏所有时段',
    showAllIntervals: '显示所有时段',
    businessHours: '营业时间',
    lunch: '午餐',
    dinner: '晚餐',
    to: '至',
    saveSettings: '保存设置',
    saving: '保存中...',
    loading: '加载中...',
    saveSuccess: '时间段容量设置已保存',
    saveError: '保存失败',
    coversHelp: '该时段可接待的最大人数',
    partiesHelp: '该时段可接待的最大组数',
    example: '例如：5:00 PM设置20人表示5点这个时段最多可接待20位客人'
  } : {
    title: 'Seating Capacity',
    description: 'Specify the maximum number of covers and parties accepted every time slot',
    omakase: 'Omakase',
    dining: 'Dining',
    timeSlot: 'Time',
    covers: 'Covers',
    parties: 'Parties',
    enabled: 'Enabled',
    perSlot: 'per',
    minutes: 'minutes',
    hideAllIntervals: 'Hide all intervals',
    showAllIntervals: 'Show all intervals',
    businessHours: 'Business Hours',
    lunch: 'Lunch',
    dinner: 'Dinner',
    to: 'to',
    saveSettings: 'Save Settings',
    saving: 'Saving...',
    loading: 'Loading...',
    saveSuccess: 'Slot-based capacity settings saved successfully',
    saveError: 'Failed to save settings',
    coversHelp: 'Maximum number of guests for this time slot',
    partiesHelp: 'Maximum number of reservations for this time slot',
    example: 'Example: Setting 20 for 5:00 PM means up to 20 guests can be seated at the 5:00 PM slot'
  }

  // Generate all possible time slots based on business hours and reservation type
  const generateTimeSlots = useMemo(() => {
    if (activeTab === 'omakase') {
      // For omakase, use fixed time slots
      return ['17:00', '19:00']
    } else {
      // For dining, generate slots based on business hours
      const slots: string[] = []
      const { lunch, dinner } = businessHours.dining
      
      // Helper to generate slots for a time period
      const generateSlotsForPeriod = (start: string, end: string) => {
        const [startHour, startMin] = start.split(':').map(Number)
        const [endHour, endMin] = end.split(':').map(Number)
        
        let currentMinutes = startHour * 60 + startMin
        const endMinutes = endHour * 60 + endMin
        
        while (currentMinutes < endMinutes) {
          const hour = Math.floor(currentMinutes / 60)
          const min = currentMinutes % 60
          slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
          currentMinutes += slotDuration
        }
      }
      
      // Generate slots for lunch and dinner
      generateSlotsForPeriod(lunch.start, lunch.end)
      generateSlotsForPeriod(dinner.start, dinner.end)
      
      return slots.sort()
    }
  }, [businessHours, slotDuration, activeTab])

  useEffect(() => {
    fetchSettings()
  }, [])

  useEffect(() => {
    // When slot duration or active tab changes, regenerate slots with existing data
    const updatedSettings = { ...settings, slotDuration }
    
    // Update slots for the current type
    const updateSlotsForCurrentType = () => {
      const existingSlots = settings[activeTab]
      const slotMap = new Map(existingSlots.map(s => [s.time, s]))
      
      const newSlots = generateTimeSlots.map(time => {
        const existing = slotMap.get(time)
        return existing || {
          time,
          covers: activeTab === 'omakase' ? 12 : 20,
          parties: activeTab === 'omakase' ? 3 : 5,
          enabled: true
        }
      })
      
      return {
        ...updatedSettings,
        [activeTab]: newSlots
      }
    }
    
    setSettings(updateSlotsForCurrentType())
  }, [slotDuration, generateTimeSlots, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/get-seat-capacity-settings')
      const data = await response.json()
      
      if (data.success && data.settings) {
        if (data.settings.type === 'slot_based') {
          setSettings(data.settings)
          setSlotDuration(data.settings.slotDuration || 30)
        } else {
          // Convert from other formats to slot-based
          const defaultCapacity = {
            omakase: data.settings.omakaseSeats || 12,
            dining: data.settings.diningSeats || 24
          }
          
          // Initialize with default slots
          const initializeSlots = (type: 'omakase' | 'dining') => {
            return generateTimeSlots.map(time => ({
              time,
              covers: defaultCapacity[type],
              parties: Math.ceil(defaultCapacity[type] / 4), // Assume avg 4 people per party
              enabled: true
            }))
          }
          
          setSettings({
            type: 'slot_based',
            slotDuration: 30,
            omakase: initializeSlots('omakase'),
            dining: initializeSlots('dining')
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateSlot = (type: 'omakase' | 'dining', time: string, field: keyof TimeSlot, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [type]: prev[type].map(slot => 
        slot.time === time ? { ...slot, [field]: value } : slot
      )
    }))
  }


  const formatTime = (time: string) => {
    const [hour, min] = time.split(':').map(Number)
    const period = hour >= 12 ? 'pm' : 'am'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${min.toString().padStart(2, '0')} ${period}`
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/save-seat-capacity-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success",
          description: t.saveSuccess
        })
        onSettingsSaved?.()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast({
        title: "Error",
        description: t.saveError,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-copper"></div>
        <span className="ml-3 text-charcoal/60">{t.loading}</span>
      </div>
    )
  }

  const currentSlots = settings[activeTab]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-ink-black mb-2">{t.title}</h3>
        <p className="text-sm text-charcoal/70 mb-1">{t.description}</p>
        <p className="text-xs text-charcoal/60">{t.example}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-white/50 rounded-xl">
        <button
          onClick={() => setActiveTab('dining')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'dining'
              ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
              : 'text-charcoal/70 hover:bg-white/50'
          }`}
        >
          {t.dining}
        </button>
        <button
          onClick={() => setActiveTab('omakase')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'omakase'
              ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
              : 'text-charcoal/70 hover:bg-white/50'
          }`}
        >
          {t.omakase}
        </button>
      </div>

      {/* Controls */}
      {activeTab === 'dining' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">{t.perSlot}:</span>
            <select
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value) as 15 | 30)}
              className="px-3 py-1 border border-copper/20 rounded-lg bg-white"
            >
              <option value={15}>15 {t.minutes}</option>
              <option value={30}>30 {t.minutes}</option>
            </select>
          </div>
        </div>
      )}

      {/* Time Slots */}
      <div className="bg-white/50 rounded-xl border border-copper/10 p-4">
        <div className="grid grid-cols-5 gap-2 mb-2 text-sm font-medium text-charcoal/80">
          <div>{t.enabled}</div>
          <div>{t.timeSlot}</div>
          <div className="text-center" title={t.coversHelp}>{t.covers}</div>
          <div className="text-center" title={t.partiesHelp}>{t.parties}</div>
          <div></div>
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {currentSlots.map((slot) => (
            <div key={slot.time} className="grid grid-cols-5 gap-2 items-center">
              <div className="flex justify-center">
                <input
                  type="checkbox"
                  checked={slot.enabled}
                  onChange={(e) => updateSlot(activeTab, slot.time, 'enabled', e.target.checked)}
                  className="w-4 h-4 text-orange-600 bg-white border-copper/20 rounded focus:ring-orange-500"
                />
              </div>
              
              <div className="text-sm font-medium">
                {formatTime(slot.time)}
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateSlot(activeTab, slot.time, 'covers', Math.max(0, slot.covers - 1))}
                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  disabled={!slot.enabled}
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={slot.covers}
                  onChange={(e) => updateSlot(activeTab, slot.time, 'covers', parseInt(e.target.value) || 0)}
                  className="w-12 text-center px-1 py-1 border border-copper/20 rounded"
                  disabled={!slot.enabled}
                />
                <button
                  onClick={() => updateSlot(activeTab, slot.time, 'covers', slot.covers + 1)}
                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  disabled={!slot.enabled}
                >
                  +
                </button>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateSlot(activeTab, slot.time, 'parties', Math.max(0, slot.parties - 1))}
                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  disabled={!slot.enabled}
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={slot.parties}
                  onChange={(e) => updateSlot(activeTab, slot.time, 'parties', parseInt(e.target.value) || 0)}
                  className="w-12 text-center px-1 py-1 border border-copper/20 rounded"
                  disabled={!slot.enabled}
                />
                <button
                  onClick={() => updateSlot(activeTab, slot.time, 'parties', slot.parties + 1)}
                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  disabled={!slot.enabled}
                >
                  +
                </button>
              </div>
              
              <div className="text-xs text-gray-500">
                {slot.enabled ? (activeTab === 'omakase' ? '2h slot' : `${t.perSlot} ${slotDuration}m`) : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t.saving : t.saveSettings}
        </button>
      </div>
    </div>
  )
}
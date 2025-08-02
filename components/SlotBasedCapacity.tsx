'use client'

import { useState, useEffect, useMemo } from 'react'
import { useToast } from '../hooks/use-toast'

interface TimeSlot {
  time: string // e.g., "17:00"
  covers: number // max covers (seats) for this time slot
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
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false)
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
    enabled: '启用',
    perSlot: '每',
    minutes: '分钟',
    hideUnchecked: '隐藏未启用时段',
    showAll: '显示所有时段',
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
    example: '例如：5:00 PM设置20人表示5点这个时段最多可接待20位客人'
  } : {
    title: 'Seating Capacity',
    description: 'Specify the maximum number of covers and parties accepted every time slot',
    omakase: 'Omakase',
    dining: 'Dining',
    timeSlot: 'Time',
    covers: 'Covers',
    enabled: 'Enabled',
    perSlot: 'per',
    minutes: 'minutes',
    hideUnchecked: 'Hide unchecked slots',
    showAll: 'Show all slots',
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
    example: 'Example: Setting 20 for 5:00 PM means up to 20 guests can be seated at the 5:00 PM slot'
  }

  // Generate all possible time slots from 12pm to 10pm
  const generateTimeSlots = useMemo(() => {
    const slots: string[] = []
    
    // Generate slots from 12:00 to 22:00 (10pm)
    let currentMinutes = 12 * 60 // Start at 12pm
    const endMinutes = 22 * 60 // End at 10pm
    
    while (currentMinutes < endMinutes) {
      const hour = Math.floor(currentMinutes / 60)
      const min = currentMinutes % 60
      slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
      currentMinutes += slotDuration
    }
    
    return slots
  }, [slotDuration])

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
          enabled: activeTab === 'omakase' ? (time === '17:00' || time === '19:00') : false
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
      const response = await fetch('/api/get-seat-capacity-settings-v2')
      const data = await response.json()
      
      if (data.success && data.settings) {
        setSettings(data.settings)
        setSlotDuration(data.settings.slotDuration || 30)
        
        // If empty, initialize with default slots
        if (data.settings.omakase.length === 0 && data.settings.dining.length === 0) {
          // Initialize with default slots
          const initializeSlots = (type: 'omakase' | 'dining') => {
            return generateTimeSlots.map(time => ({
              time,
              covers: type === 'omakase' ? 12 : 20,
              enabled: type === 'omakase' ? (time === '17:00' || time === '19:00') : false
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
      const response = await fetch('/api/save-seat-capacity-settings-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          mode: 'advanced' // Always save mode as advanced when using this component
        })
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

  const currentSlots = settings[activeTab] || []

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
          onClick={() => setActiveTab('omakase')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'omakase'
              ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
              : 'text-charcoal/70 hover:bg-white/50'
          }`}
        >
          {t.omakase}
        </button>
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
      </div>

      {/* Controls */}
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
        <button
          onClick={() => setShowOnlyEnabled(!showOnlyEnabled)}
          className="px-4 py-2 text-sm font-medium text-charcoal/70 hover:text-charcoal bg-white/50 hover:bg-white rounded-lg border border-copper/20 transition-all"
        >
          {showOnlyEnabled ? t.showAll : t.hideUnchecked}
        </button>
      </div>

      {/* Time Slots */}
      <div className="bg-white/50 rounded-xl border border-copper/10 p-4">
        <div className="grid grid-cols-4 gap-2 mb-2 text-sm font-medium text-charcoal/80">
          <div>{t.enabled}</div>
          <div>{t.timeSlot}</div>
          <div className="text-center" title={t.coversHelp}>{t.covers}</div>
          <div></div>
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {currentSlots
            .filter(slot => !showOnlyEnabled || slot.enabled)
            .map((slot) => (
                <div key={slot.time} className="grid grid-cols-4 gap-2 items-center">
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
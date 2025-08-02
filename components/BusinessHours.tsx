'use client'

import { useState, useEffect } from 'react'
import { useToast } from '../hooks/use-toast'

interface DaySchedule {
  isOpen: boolean
  lunch?: {
    start: string
    end: string
  }
  dinner?: {
    start: string
    end: string
  }
}

interface BusinessHoursSettings {
  [key: number]: DaySchedule // 0=Sunday, 1=Monday, etc.
}

interface Props {
  isChineseMode: boolean
  onSettingsSaved?: () => void
}

export default function BusinessHours({ isChineseMode, onSettingsSaved }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [businessHours, setBusinessHours] = useState<BusinessHoursSettings>({
    0: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Sunday
    1: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Monday
    2: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Tuesday
    3: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Wednesday
    4: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Thursday
    5: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Friday
    6: { isOpen: true, lunch: { start: '12:00', end: '15:00' }, dinner: { start: '17:00', end: '22:00' } }, // Saturday
  })

  const dayNames = isChineseMode 
    ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const t = isChineseMode ? {
    title: '营业时间设置',
    description: '设置每天的营业时间，这将影响可预订时段',
    day: '星期',
    closed: '休息',
    open: '营业',
    lunch: '午餐',
    dinner: '晚餐',
    from: '从',
    to: '至',
    saveSettings: '保存设置',
    saving: '保存中...',
    loading: '加载中...',
    saveSuccess: '营业时间设置已保存',
    saveError: '保存失败',
    applyToAll: '应用到所有天',
    copyFrom: '复制自',
  } : {
    title: 'Business Hours',
    description: 'Set opening hours for each day of the week. This affects available booking slots.',
    day: 'Day',
    closed: 'Closed',
    open: 'Open',
    lunch: 'Lunch',
    dinner: 'Dinner',
    from: 'From',
    to: 'To',
    saveSettings: 'Save Settings',
    saving: 'Saving...',
    loading: 'Loading...',
    saveSuccess: 'Business hours saved successfully',
    saveError: 'Failed to save settings',
    applyToAll: 'Apply to all days',
    copyFrom: 'Copy from',
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/get-business-hours')
      const data = await response.json()
      
      if (data.success && data.settings) {
        setBusinessHours(data.settings)
      }
    } catch (error) {
      console.error('Failed to fetch business hours:', error)
      toast({
        title: "Error",
        description: "Failed to load business hours",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateDaySchedule = (day: number, field: keyof DaySchedule | 'lunch.start' | 'lunch.end' | 'dinner.start' | 'dinner.end', value: any) => {
    setBusinessHours(prev => {
      const newHours = { ...prev }
      const daySchedule = { ...newHours[day] }
      
      if (field === 'isOpen') {
        daySchedule.isOpen = value
        if (!value) {
          // If closing the day, clear the hours
          delete daySchedule.lunch
          delete daySchedule.dinner
        } else {
          // If opening the day, set default hours
          daySchedule.lunch = { start: '12:00', end: '15:00' }
          daySchedule.dinner = { start: '17:00', end: '22:00' }
        }
      } else if (field.includes('.')) {
        const [shift, timeField] = field.split('.')
        if (!daySchedule[shift as 'lunch' | 'dinner']) {
          daySchedule[shift as 'lunch' | 'dinner'] = { start: '12:00', end: '15:00' }
        }
        daySchedule[shift as 'lunch' | 'dinner']![timeField as 'start' | 'end'] = value
      }
      
      newHours[day] = daySchedule
      return newHours
    })
  }

  const toggleShift = (day: number, shift: 'lunch' | 'dinner') => {
    setBusinessHours(prev => {
      const newHours = { ...prev }
      const daySchedule = { ...newHours[day] }
      
      if (daySchedule[shift]) {
        delete daySchedule[shift]
      } else {
        daySchedule[shift] = shift === 'lunch' 
          ? { start: '12:00', end: '15:00' }
          : { start: '17:00', end: '22:00' }
      }
      
      newHours[day] = daySchedule
      return newHours
    })
  }

  const applyToAllDays = (sourceDay: number) => {
    const sourceSchedule = businessHours[sourceDay]
    setBusinessHours(prev => {
      const newHours = { ...prev }
      for (let i = 0; i < 7; i++) {
        newHours[i] = JSON.parse(JSON.stringify(sourceSchedule))
      }
      return newHours
    })
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/save-business-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(businessHours)
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
      console.error('Failed to save business hours:', error)
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-ink-black mb-2">{t.title}</h3>
        <p className="text-sm text-charcoal/70">{t.description}</p>
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3, 4, 5, 6].map(day => (
          <div key={day} className="bg-white/50 rounded-xl border border-copper/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-ink-black">{dayNames[day]}</h4>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={businessHours[day].isOpen}
                    onChange={(e) => updateDaySchedule(day, 'isOpen', e.target.checked)}
                    className="w-4 h-4 text-orange-600 bg-white border-copper/20 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium">
                    {businessHours[day].isOpen ? t.open : t.closed}
                  </span>
                </label>
                {day === 0 && ( // Sunday - allow copying to all days
                  <button
                    onClick={() => applyToAllDays(day)}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {t.applyToAll}
                  </button>
                )}
              </div>
            </div>

            {businessHours[day].isOpen && (
              <div className="space-y-3">
                {/* Lunch Hours */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!businessHours[day].lunch}
                    onChange={() => toggleShift(day, 'lunch')}
                    className="w-4 h-4 text-orange-600 bg-white border-copper/20 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium w-16">{t.lunch}</span>
                  {businessHours[day].lunch && (
                    <>
                      <input
                        type="time"
                        value={businessHours[day].lunch!.start}
                        onChange={(e) => updateDaySchedule(day, 'lunch.start', e.target.value)}
                        className="px-3 py-1 border border-copper/20 rounded-lg bg-white text-sm"
                      />
                      <span className="text-sm text-charcoal/60">{t.to}</span>
                      <input
                        type="time"
                        value={businessHours[day].lunch!.end}
                        onChange={(e) => updateDaySchedule(day, 'lunch.end', e.target.value)}
                        className="px-3 py-1 border border-copper/20 rounded-lg bg-white text-sm"
                      />
                    </>
                  )}
                </div>

                {/* Dinner Hours */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!businessHours[day].dinner}
                    onChange={() => toggleShift(day, 'dinner')}
                    className="w-4 h-4 text-orange-600 bg-white border-copper/20 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium w-16">{t.dinner}</span>
                  {businessHours[day].dinner && (
                    <>
                      <input
                        type="time"
                        value={businessHours[day].dinner!.start}
                        onChange={(e) => updateDaySchedule(day, 'dinner.start', e.target.value)}
                        className="px-3 py-1 border border-copper/20 rounded-lg bg-white text-sm"
                      />
                      <span className="text-sm text-charcoal/60">{t.to}</span>
                      <input
                        type="time"
                        value={businessHours[day].dinner!.end}
                        onChange={(e) => updateDaySchedule(day, 'dinner.end', e.target.value)}
                        className="px-3 py-1 border border-copper/20 rounded-lg bg-white text-sm"
                      />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
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
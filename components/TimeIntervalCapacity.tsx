'use client'

import { useState, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { useToast } from '../hooks/use-toast'

interface TimeInterval {
  id: string
  startTime: string
  endTime: string
  capacity: number
}

interface TimeIntervalCapacitySettings {
  type: 'time_interval'
  omakase: {
    intervals: TimeInterval[]
  }
  dining: {
    intervals: TimeInterval[]
  }
}

interface Props {
  isChineseMode: boolean
  onSettingsSaved?: () => void
}

export default function TimeIntervalCapacity({ isChineseMode, onSettingsSaved }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<TimeIntervalCapacitySettings>({
    type: 'time_interval',
    omakase: {
      intervals: [{
        id: nanoid(),
        startTime: '00:00',
        endTime: '23:59',
        capacity: 12
      }]
    },
    dining: {
      intervals: [{
        id: nanoid(),
        startTime: '00:00',
        endTime: '23:59',
        capacity: 24
      }]
    }
  })

  const t = isChineseMode ? {
    title: '时间段容量设置',
    description: '为不同时间段设置座位容量，实现精细化管理',
    omakaseTitle: '无菜单料理时间段',
    diningTitle: '单点餐饮时间段',
    startTime: '开始时间',
    endTime: '结束时间',
    capacity: '容量',
    seats: '座位',
    addInterval: '添加时间段',
    deleteInterval: '删除',
    saveSettings: '保存设置',
    loading: '加载中...',
    saving: '保存中...',
    saveSuccess: '时间段容量设置已保存',
    saveError: '保存失败',
    invalidTime: '无效的时间格式',
    overlappingIntervals: '时间段不能重叠',
    deleteConfirm: '确定要删除这个时间段吗？',
    example: '例如：午餐12:00-15:00设置20座，晚餐17:00-22:00设置30座'
  } : {
    title: 'Time Interval Capacity Settings',
    description: 'Set different seat capacities for different time intervals for better management',
    omakaseTitle: 'Omakase Time Intervals',
    diningTitle: 'Dining Time Intervals',
    startTime: 'Start Time',
    endTime: 'End Time',
    capacity: 'Capacity',
    seats: 'seats',
    addInterval: 'Add Interval',
    deleteInterval: 'Delete',
    saveSettings: 'Save Settings',
    loading: 'Loading...',
    saving: 'Saving...',
    saveSuccess: 'Time interval capacity settings saved successfully',
    saveError: 'Failed to save settings',
    invalidTime: 'Invalid time format',
    overlappingIntervals: 'Time intervals cannot overlap',
    deleteConfirm: 'Are you sure you want to delete this interval?',
    example: 'Example: Set 20 seats for lunch 12:00-15:00, 30 seats for dinner 17:00-22:00'
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/get-seat-capacity-settings')
      const data = await response.json()
      
      if (data.success && data.settings) {
        if (data.settings.type === 'time_interval') {
          setSettings(data.settings)
        } else {
          // Convert legacy format to time interval format
          setSettings({
            type: 'time_interval',
            omakase: {
              intervals: [{
                id: nanoid(),
                startTime: '00:00',
                endTime: '23:59',
                capacity: data.settings.omakaseSeats || 12
              }]
            },
            dining: {
              intervals: [{
                id: nanoid(),
                startTime: '00:00',
                endTime: '23:59',
                capacity: data.settings.diningSeats || 24
              }]
            }
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

  const addInterval = (type: 'omakase' | 'dining') => {
    const newInterval: TimeInterval = {
      id: nanoid(),
      startTime: '12:00',
      endTime: '15:00',
      capacity: type === 'omakase' ? 12 : 24
    }

    setSettings(prev => ({
      ...prev,
      [type]: {
        intervals: [...prev[type].intervals, newInterval]
      }
    }))
  }

  const updateInterval = (type: 'omakase' | 'dining', intervalId: string, field: keyof TimeInterval, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [type]: {
        intervals: prev[type].intervals.map(interval =>
          interval.id === intervalId
            ? { ...interval, [field]: value }
            : interval
        )
      }
    }))
  }

  const deleteInterval = (type: 'omakase' | 'dining', intervalId: string) => {
    if (settings[type].intervals.length === 1) {
      toast({
        title: "Error",
        description: "At least one interval is required",
        variant: "destructive"
      })
      return
    }

    if (window.confirm(t.deleteConfirm)) {
      setSettings(prev => ({
        ...prev,
        [type]: {
          intervals: prev[type].intervals.filter(interval => interval.id !== intervalId)
        }
      }))
    }
  }

  const validateIntervals = (intervals: TimeInterval[]): string | null => {
    // Check for empty intervals
    if (intervals.length === 0) {
      return 'At least one time interval is required'
    }

    // Check each interval individually
    for (const interval of intervals) {
      if (!interval.startTime || !interval.endTime) {
        return 'All intervals must have start and end times'
      }
      
      // Check capacity is valid
      if (interval.capacity < 0 || interval.capacity > 200) {
        return 'Capacity must be between 0 and 200'
      }
      
      // Check if start equals end (invalid interval)
      if (interval.startTime === interval.endTime) {
        return 'Start and end times cannot be the same'
      }
    }

    // Check for overlapping intervals
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const start1 = timeToMinutes(intervals[i].startTime)
        const end1 = timeToMinutes(intervals[i].endTime)
        const start2 = timeToMinutes(intervals[j].startTime)
        const end2 = timeToMinutes(intervals[j].endTime)

        // Handle overnight intervals
        const adjustedEnd1 = end1 <= start1 ? end1 + 24 * 60 : end1
        const adjustedEnd2 = end2 <= start2 ? end2 + 24 * 60 : end2

        // Check for overlap
        if ((start1 < adjustedEnd2 && adjustedEnd1 > start2) ||
            (start2 < adjustedEnd1 && adjustedEnd2 > start1)) {
          return `Time intervals overlap: ${intervals[i].startTime}-${intervals[i].endTime} and ${intervals[j].startTime}-${intervals[j].endTime}`
        }
      }
    }
    return null
  }

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  const saveSettings = async () => {
    // Validate omakase intervals
    const omakaseError = validateIntervals(settings.omakase.intervals)
    if (omakaseError) {
      toast({
        title: "Error",
        description: `Omakase: ${omakaseError}`,
        variant: "destructive"
      })
      return
    }

    // Validate dining intervals
    const diningError = validateIntervals(settings.dining.intervals)
    if (diningError) {
      toast({
        title: "Error",
        description: `Dining: ${diningError}`,
        variant: "destructive"
      })
      return
    }

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-ink-black mb-2">{t.title}</h3>
        <p className="text-sm text-charcoal/70 mb-1">{t.description}</p>
        <p className="text-xs text-charcoal/60">{t.example}</p>
      </div>

      {/* Omakase Intervals */}
      <div className="bg-white/50 rounded-xl border border-copper/10 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-ink-black">{t.omakaseTitle}</h4>
          <button
            onClick={() => addInterval('omakase')}
            className="px-3 py-1 bg-gradient-to-r from-orange-600 to-red-600 text-white text-sm rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-300"
          >
            {t.addInterval}
          </button>
        </div>

        <div className="space-y-3">
          {settings.omakase.intervals.map((interval) => (
            <div key={interval.id} className="flex items-center gap-3 p-3 bg-white/70 rounded-lg">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-charcoal/60">{t.startTime}</label>
                  <input
                    type="time"
                    value={interval.startTime}
                    onChange={(e) => updateInterval('omakase', interval.id, 'startTime', e.target.value)}
                    className="w-full px-2 py-1 border border-copper/20 rounded focus:ring-2 focus:ring-copper/20 focus:border-copper/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-charcoal/60">{t.endTime}</label>
                  <input
                    type="time"
                    value={interval.endTime}
                    onChange={(e) => updateInterval('omakase', interval.id, 'endTime', e.target.value)}
                    className="w-full px-2 py-1 border border-copper/20 rounded focus:ring-2 focus:ring-copper/20 focus:border-copper/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-charcoal/60">{t.capacity}</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={interval.capacity}
                      onChange={(e) => updateInterval('omakase', interval.id, 'capacity', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-copper/20 rounded focus:ring-2 focus:ring-copper/20 focus:border-copper/20"
                    />
                    <span className="text-xs text-charcoal/60">{t.seats}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteInterval('omakase', interval.id)}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                title={t.deleteInterval}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Dining Intervals */}
      <div className="bg-white/50 rounded-xl border border-copper/10 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-ink-black">{t.diningTitle}</h4>
          <button
            onClick={() => addInterval('dining')}
            className="px-3 py-1 bg-gradient-to-r from-orange-600 to-red-600 text-white text-sm rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-300"
          >
            {t.addInterval}
          </button>
        </div>

        <div className="space-y-3">
          {settings.dining.intervals.map((interval) => (
            <div key={interval.id} className="flex items-center gap-3 p-3 bg-white/70 rounded-lg">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-charcoal/60">{t.startTime}</label>
                  <input
                    type="time"
                    value={interval.startTime}
                    onChange={(e) => updateInterval('dining', interval.id, 'startTime', e.target.value)}
                    className="w-full px-2 py-1 border border-copper/20 rounded focus:ring-2 focus:ring-copper/20 focus:border-copper/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-charcoal/60">{t.endTime}</label>
                  <input
                    type="time"
                    value={interval.endTime}
                    onChange={(e) => updateInterval('dining', interval.id, 'endTime', e.target.value)}
                    className="w-full px-2 py-1 border border-copper/20 rounded focus:ring-2 focus:ring-copper/20 focus:border-copper/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-charcoal/60">{t.capacity}</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={interval.capacity}
                      onChange={(e) => updateInterval('dining', interval.id, 'capacity', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-copper/20 rounded focus:ring-2 focus:ring-copper/20 focus:border-copper/20"
                    />
                    <span className="text-xs text-charcoal/60">{t.seats}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteInterval('dining', interval.id)}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                title={t.deleteInterval}
              >
                ×
              </button>
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
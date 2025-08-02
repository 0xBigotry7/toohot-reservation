'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'

interface CommunicationLog {
  id: string
  reservation_id: string
  reservation_type: string
  customer_email?: string
  customer_phone?: string
  customer_name?: string
  channel: 'email' | 'sms' | 'phone' | 'other'
  direction: 'outbound' | 'inbound'
  subject?: string
  content: string
  template_used?: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked'
  sent_at?: string
  delivered_at?: string
  opened_at?: string
  clicked_at?: string
  failed_at?: string
  provider?: string
  provider_message_id?: string
  provider_response?: any
  error_message?: string
  metadata?: any
  created_at: string
  updated_at: string
}

interface CommunicationHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  reservationType: 'omakase' | 'dining'
  customerName: string
  customerEmail: string
  isChineseMode?: boolean
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    bounced: 'bg-orange-100 text-orange-800',
    opened: 'bg-purple-100 text-purple-800',
    clicked: 'bg-indigo-100 text-indigo-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

const getChannelIcon = (channel: string) => {
  const icons: Record<string, string> = {
    email: '✉️',
    sms: '💬',
    phone: '📞',
    other: '📨'
  }
  return icons[channel] || '📨'
}

const formatTemplateUsed = (template?: string) => {
  if (!template) return null
  
  const templateNames: Record<string, string> = {
    'omakase_confirmation': 'Omakase Confirmation',
    'dining_confirmation': 'Dining Confirmation',
    'omakase_cancellation': 'Omakase Cancellation',
    'dining_cancellation': 'Dining Cancellation',
    'reminder': 'Reminder',
    'custom': 'Custom Message'
  }
  
  return templateNames[template] || template
}

export default function CommunicationHistoryModal({
  isOpen,
  onClose,
  reservationId,
  reservationType,
  customerName,
  customerEmail,
  isChineseMode = false
}: CommunicationHistoryModalProps) {
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailContent, setEmailContent] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const t = isChineseMode ? {
    title: '通信历史',
    customerInfo: '客户信息',
    name: '姓名',
    email: '邮箱',
    reservationType: '预订类型',
    omakase: 'Omakase',
    dining: '用餐',
    totalCommunications: '总通信数',
    loading: '加载中...',
    error: '加载通信历史失败',
    noCommunications: '未找到通信记录',
    subject: '主题',
    content: '内容',
    sent: '已发送',
    delivered: '已送达',
    opened: '已打开',
    clicked: '已点击',
    failed: '失败',
    errorMessage: '错误信息',
    provider: '服务提供商',
    close: '关闭',
    sendEmail: '发送邮件',
    sendNewEmail: '发送新邮件',
    sending: '发送中...',
    emailSent: '邮件已发送',
    emailFailed: '邮件发送失败',
    cancel: '取消'
  } : {
    title: 'Communication History',
    customerInfo: 'Customer Information',
    name: 'Name',
    email: 'Email',
    reservationType: 'Reservation Type',
    omakase: 'Omakase',
    dining: 'Dining',
    totalCommunications: 'Total Communications',
    loading: 'Loading...',
    error: 'Failed to load communication history',
    noCommunications: 'No communication history found',
    subject: 'Subject',
    content: 'Content',
    sent: 'Sent',
    delivered: 'Delivered',
    opened: 'Opened',
    clicked: 'Clicked',
    failed: 'Failed',
    errorMessage: 'Error Message',
    provider: 'Provider',
    close: 'Close',
    sendEmail: 'Send Email',
    sendNewEmail: 'Send New Email',
    sending: 'Sending...',
    emailSent: 'Email sent successfully',
    emailFailed: 'Failed to send email',
    cancel: 'Cancel'
  }

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchCommunicationLogs()
    }
  }, [isOpen, reservationId])

  const fetchCommunicationLogs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(
        `/api/communication-logs?reservationId=${reservationId}&reservationType=${reservationType}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch communication logs')
      }
      
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Error fetching communication logs:', error)
      setError(t.error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!emailSubject || !emailContent) return
    
    setSendingEmail(true)
    
    try {
      const response = await fetch('/api/send-custom-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customerEmail,
          subject: emailSubject,
          content: emailContent,
          reservationId,
          reservationType,
          customerName
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to send email')
      }
      
      // Reset form and refresh logs
      setEmailSubject('')
      setEmailContent('')
      setShowEmailForm(false)
      alert(t.emailSent)
      fetchCommunicationLogs()
    } catch (error) {
      console.error('Error sending email:', error)
      alert(t.emailFailed)
    } finally {
      setSendingEmail(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-sand-beige/95 to-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-copper/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-playfair text-copper">{t.title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-sand-beige/60 hover:bg-sand-beige/80 flex items-center justify-center transition-colors duration-200"
          >
            <span className="text-gray-600">✕</span>
          </button>
        </div>

        {/* Customer Info */}
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-copper mb-3">{t.customerInfo}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-charcoal/70">{t.name}:</span> {customerName}
                </div>
                <div>
                  <span className="text-charcoal/70">{t.email}:</span> {customerEmail}
                </div>
                <div>
                  <span className="text-charcoal/70">{t.reservationType}:</span> {reservationType === 'omakase' ? t.omakase : t.dining}
                </div>
                <div>
                  <span className="text-charcoal/70">{t.totalCommunications}:</span> {logs.length}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="px-4 py-2 bg-copper text-white rounded-lg hover:bg-copper/90 transition-colors duration-200 text-sm font-medium"
            >
              {t.sendNewEmail}
            </button>
          </div>
        </div>

        {/* Email Form */}
        {showEmailForm && (
          <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 mb-6 border border-copper/20">
            <h3 className="font-semibold text-copper mb-3">{t.sendEmail}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">{t.subject}</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-copper/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-copper/50"
                  placeholder={isChineseMode ? '输入邮件主题...' : 'Enter email subject...'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">{t.content}</label>
                <textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  className="w-full px-3 py-2 border border-copper/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-copper/50 h-32 resize-none"
                  placeholder={isChineseMode ? '输入邮件内容...' : 'Enter email content...'}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowEmailForm(false)
                    setEmailSubject('')
                    setEmailContent('')
                  }}
                  className="px-4 py-2 border border-copper/20 text-copper rounded-lg hover:bg-sand-beige/50 transition-colors duration-200 text-sm"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailSubject || !emailContent}
                  className="px-4 py-2 bg-copper text-white rounded-lg hover:bg-copper/90 transition-colors duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? t.sending : t.sendEmail}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Communication Logs */}
        <div className="overflow-y-auto max-h-[calc(90vh-300px)] pr-2">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-copper"></div>
              <span className="ml-3 text-charcoal/60">{t.loading}</span>
            </div>
          ) : error ? (
            <div className="text-center text-red-600 py-8">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-charcoal/60 py-8">
              {t.noCommunications}
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-copper/10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getChannelIcon(log.channel)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-charcoal">
                            {log.channel.toUpperCase()} - {log.direction}
                          </span>
                          {formatTemplateUsed(log.template_used) && (
                            <span className="text-xs bg-copper/20 text-copper px-2 py-1 rounded-full">
                              {formatTemplateUsed(log.template_used)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-charcoal/60">
                          {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                      {log.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Content */}
                  {log.channel === 'email' && (
                    <div className="space-y-2 mb-3">
                      {log.subject && (
                        <div>
                          <span className="font-medium text-sm text-charcoal">{t.subject}:</span>
                          <p className="text-sm text-charcoal/80 mt-1">{log.subject}</p>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-sm text-charcoal">{t.content}:</span>
                        <div className="mt-2">
                          {log.template_used === 'custom' ? (
                            <div 
                              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                              style={{ maxHeight: '400px', overflowY: 'auto' }}
                            >
                              <iframe
                                srcDoc={log.content}
                                className="w-full"
                                style={{ minHeight: '300px', border: 'none' }}
                                title="Email Preview"
                                sandbox="allow-same-origin"
                              />
                            </div>
                          ) : (
                            <div 
                              className="text-sm text-charcoal/80 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto"
                              dangerouslySetInnerHTML={{ __html: log.content }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {log.channel !== 'email' && (
                    <div className="text-sm text-charcoal/80 p-3 bg-gray-50 rounded-lg mb-3">
                      {log.content}
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="flex flex-wrap gap-4 text-xs text-charcoal/60">
                    {log.sent_at && (
                      <div>{t.sent}: {format(new Date(log.sent_at), 'MMM d, h:mm a')}</div>
                    )}
                    {log.delivered_at && (
                      <div>{t.delivered}: {format(new Date(log.delivered_at), 'MMM d, h:mm a')}</div>
                    )}
                    {log.opened_at && (
                      <div>{t.opened}: {format(new Date(log.opened_at), 'MMM d, h:mm a')}</div>
                    )}
                    {log.clicked_at && (
                      <div>{t.clicked}: {format(new Date(log.clicked_at), 'MMM d, h:mm a')}</div>
                    )}
                  </div>

                  {/* Error Message */}
                  {log.error_message && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs text-red-700">
                        <strong>{t.errorMessage}:</strong> {log.error_message}
                      </p>
                    </div>
                  )}

                  {/* Provider Info */}
                  {log.provider && (
                    <div className="mt-2 text-xs text-charcoal/40">
                      {t.provider}: {log.provider} {log.provider_message_id && `• ID: ${log.provider_message_id}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-copper text-white rounded-xl hover:bg-copper/90 transition-colors duration-200 font-medium"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
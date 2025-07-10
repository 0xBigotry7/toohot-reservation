'use client'

import { useEffect, useState } from 'react'
import { useToast } from '../../hooks/use-toast'
import Image from 'next/image'

interface EmailTemplate {
  id: string
  key: string
  name: string
  subject: string
  html: string
  active: boolean
  created_at: string
  updated_at: string
}

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [language, setLanguage] = useState<'en' | 'zh'>('en')
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [extractedTexts, setExtractedTexts] = useState<{[key: string]: string}>({})
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit')
  const [editMode, setEditMode] = useState<'simple' | 'advanced'>('simple')
  const [rawHtmlContent, setRawHtmlContent] = useState('')
  
  // Operation states
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { toast } = useToast()

  // Extract text content from HTML
  const extractTextFromHTML = (html: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    // Find all text nodes and create an editable structure
    const textNodes: {[key: string]: string} = {}
    let counter = 0
    
    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim()
        if (text && text.length > 0 && text !== '\n' && text !== '\r\n') {
          const key = `text_${counter++}`
          textNodes[key] = text
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        const tagName = element.tagName.toLowerCase()
        
        // Skip script, style, and meta tags but process everything else
        if (tagName !== 'script' && tagName !== 'style' && tagName !== 'meta' && tagName !== 'link') {
          // For elements that might contain direct text content
          if (tagName === 'p' || tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || 
              tagName === 'h4' || tagName === 'h5' || tagName === 'h6' || tagName === 'div' || 
              tagName === 'span' || tagName === 'a' || tagName === 'strong' || tagName === 'b' || 
              tagName === 'em' || tagName === 'i' || tagName === 'td' || tagName === 'th' || 
              tagName === 'li' || tagName === 'ul' || tagName === 'ol') {
            node.childNodes.forEach(processNode)
          } else {
            // For other elements, still process their children
            node.childNodes.forEach(processNode)
          }
        }
      }
    }
    
    // Process both head and body to catch all content
    if (doc.head) doc.head.childNodes.forEach(processNode)
    if (doc.body) doc.body.childNodes.forEach(processNode)
    
    return textNodes
  }
  
  // Replace text content back into HTML
  const replaceTextInHTML = (html: string, newTexts: {[key: string]: string}) => {
    let updatedHTML = html
    let counter = 0
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim()
        if (text && text.length > 0 && text !== '\n' && text !== '\r\n') {
          const key = `text_${counter++}`
          if (newTexts[key] && newTexts[key] !== text) {
            // Use a more robust replacement that handles special characters
            const escapedOriginal = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(escapedOriginal, 'g')
            updatedHTML = updatedHTML.replace(regex, newTexts[key])
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        const tagName = element.tagName.toLowerCase()
        
        // Skip script, style, and meta tags but process everything else
        if (tagName !== 'script' && tagName !== 'style' && tagName !== 'meta' && tagName !== 'link') {
          // For elements that might contain direct text content
          if (tagName === 'p' || tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || 
              tagName === 'h4' || tagName === 'h5' || tagName === 'h6' || tagName === 'div' || 
              tagName === 'span' || tagName === 'a' || tagName === 'strong' || tagName === 'b' || 
              tagName === 'em' || tagName === 'i' || tagName === 'td' || tagName === 'th' || 
              tagName === 'li' || tagName === 'ul' || tagName === 'ol') {
            node.childNodes.forEach(processNode)
          } else {
            // For other elements, still process their children
            node.childNodes.forEach(processNode)
          }
        }
      }
    }
    
    // Process both head and body to catch all content
    if (doc.head) doc.head.childNodes.forEach(processNode)
    if (doc.body) doc.body.childNodes.forEach(processNode)
    
    return updatedHTML
  }

  // Load language preference from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('toohot-language') as 'en' | 'zh'
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'zh')) {
      setLanguage(savedLanguage)
    }
  }, [])

  // Translations
  const t = language === 'zh' ? {
    title: '邮件模板',
    templatesCount: '个模板',
    backToDashboard: '← 返回控制台',
    logout: '退出登录',
    loading: '加载邮件模板中...',
    authRequired: '需要身份验证',
    authMessage: '请提供管理员密码以访问邮件模板。',
    searchPlaceholder: '搜索模板...',
    allTemplates: '所有模板',
    activeOnly: '仅活跃',
    inactiveOnly: '仅停用',
    contactForms: '联系表单',
    omakaseReservations: '怀石料理预订',
    diningReservations: '餐厅预订',
    active: '活跃',
    inactive: '停用',
    key: '键',
    htmlPreview: 'HTML预览',
    created: '创建时间',
    updated: '更新时间',
    noTemplates: '没有找到符合条件的模板。',
    noTemplatesFound: '没有找到邮件模板。',
    managementSystem: '邮件模板管理系统',
    editTemplate: '编辑内容',
    editContent: '编辑',
    preview: '预览',
    edit: '编辑',
    cancel: '取消',
    save: '保存',
    subject: '主题',
    textContent: '文本内容',
    updateSuccess: '邮件模板更新成功！',
    error: '错误',
    success: '成功',
    updating: '更新中...',
    templateInfo: '模板信息',
    editMode: '编辑模式',
    previewMode: '预览模式',
    lastUpdated: '最后更新',
    simpleMode: '简单模式',
    advancedMode: '高级模式',
    htmlCode: 'HTML代码'
  } : {
    title: 'Email Templates',
    templatesCount: 'templates',
    backToDashboard: '← Back to Dashboard',
    logout: 'Logout',
    loading: 'Loading email templates...',
    authRequired: 'Authentication Required',
    authMessage: 'Please provide the admin password to access email templates.',
    searchPlaceholder: 'Search templates...',
    allTemplates: 'All Templates',
    activeOnly: 'Active Only',
    inactiveOnly: 'Inactive Only',
    contactForms: 'Contact & Form Submissions',
    omakaseReservations: 'Omakase Reservations',
    diningReservations: 'Dining Reservations',
    active: 'Active',
    inactive: 'Inactive',
    key: 'Key',
    htmlPreview: 'HTML Preview',
    created: 'Created',
    updated: 'Updated',
    noTemplates: 'No templates match your search criteria.',
    noTemplatesFound: 'No email templates found.',
    managementSystem: 'Email Template Management System',
    editTemplate: 'Edit Content',
    editContent: 'Edit',
    preview: 'Preview',
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Save',
    subject: 'Subject',
    textContent: 'Text Content',
    updateSuccess: 'Email template updated successfully!',
    error: 'Error',
    success: 'Success',
    updating: 'Updating...',
    templateInfo: 'Template Information',
    editMode: 'Edit Mode',
    previewMode: 'Preview Mode',
    lastUpdated: 'Last Updated',
    simpleMode: 'Simple Mode',
    advancedMode: 'Advanced Mode',
    htmlCode: 'HTML Code'
  }

  // Authentication check
  useEffect(() => {
    if (!ADMIN_PASSWORD) {
      setAuthenticated(true)
      return
    }

    function promptPassword() {
      const password = prompt('Enter admin password:')
      if (password === ADMIN_PASSWORD) {
        setAuthenticated(true)
        localStorage.setItem('admin-authenticated', 'true')
      } else if (password !== null) {
        alert('Invalid password')
        promptPassword()
      }
    }

    const storedAuth = localStorage.getItem('admin-authenticated')
    if (storedAuth === 'true') {
      setAuthenticated(true)
    } else {
      promptPassword()
    }
  }, [])

  // Load templates
  useEffect(() => {
    if (authenticated) {
      fetchTemplates()
    }
  }, [authenticated])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/email-templates')
      const data = await response.json()
      
      if (response.ok) {
        setTemplates(data.templates)
      } else {
        console.error('Failed to fetch templates:', data.error)
        toast({
          title: t.error,
          description: data.error || 'Failed to load email templates',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast({
        title: t.error,
        description: 'Failed to load email templates',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Edit template
  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    const texts = extractTextFromHTML(template.html)
    console.log('Extracted texts:', texts) // Debug log
    console.log('Original HTML:', template.html) // Debug log
    setExtractedTexts(texts)
    setRawHtmlContent(template.html)
    
    // Auto-switch to advanced mode if no text content found
    if (Object.keys(texts).length === 0) {
      setEditMode('advanced')
    } else {
      setEditMode('simple')
    }
    
    setPreviewMode('edit')
    setShowEditModal(true)
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return

    // Use different HTML based on edit mode
    const updatedHTML = editMode === 'simple' 
      ? replaceTextInHTML(editingTemplate.html, extractedTexts)
      : rawHtmlContent

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/email-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: editingTemplate.key,
          name: editingTemplate.name,
          subject: editingTemplate.subject,
          html: updatedHTML,
          active: editingTemplate.active
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: t.success,
          description: t.updateSuccess,
        })
        setShowEditModal(false)
        setEditingTemplate(null)
        setExtractedTexts({})
        setRawHtmlContent('')
        setEditMode('simple')
        fetchTemplates()
      } else {
        toast({
          title: t.error,
          description: data.error || 'Failed to update email template',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error updating template:', error)
      toast({
        title: t.error,
        description: 'Failed to update email template',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Categorize templates
  const categorizeTemplates = (templates: EmailTemplate[]) => {
    const categories = {
      contact: templates.filter(t => t.key.includes('contact') || t.key.includes('form')),
      omakase: templates.filter(t => t.key.includes('omakase')),
      dining: templates.filter(t => t.key.includes('dining'))
    }
    return categories
  }

  // Filter templates based on search and filters
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.subject.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesActive = activeFilter === 'all' || 
                         (activeFilter === 'active' && template.active) ||
                         (activeFilter === 'inactive' && !template.active)
    
    return matchesSearch && matchesActive
  })

  const categorizedTemplates = categorizeTemplates(filteredTemplates)

  const logout = () => {
    localStorage.removeItem('admin-authenticated')
    window.location.href = '/'
  }

  // Get preview text from HTML
  const getPreviewText = (html: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return doc.body.textContent?.substring(0, 100) || ''
  }

  // Template Card Component - Redesigned
  const TemplateCard = ({ template }: { template: EmailTemplate }) => (
    <div className="group relative bg-gradient-to-br from-white/80 to-sand-beige/20 backdrop-blur-sm rounded-2xl shadow-sm p-5 hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-copper/20 cursor-pointer"
         onClick={() => handleEditTemplate(template)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-playfair text-lg text-copper font-medium mb-1 truncate">{template.name}</h3>
          <p className="text-xs text-charcoal/60 font-mono bg-white/50 px-2 py-1 rounded inline-block">{template.key}</p>
        </div>
        <span className={`ml-3 flex-shrink-0 w-3 h-3 rounded-full ${
          template.active ? 'bg-emerald-400' : 'bg-gray-300'
        }`} title={template.active ? t.active : t.inactive} />
      </div>
      
      {/* Subject */}
      <div className="mb-3">
        <p className="text-sm text-charcoal font-medium line-clamp-1">{template.subject}</p>
      </div>
      
      {/* Content Preview */}
      <div className="mb-4">
        <p className="text-xs text-charcoal/70 line-clamp-2">{getPreviewText(template.html)}...</p>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-copper/10">
        <span className="text-xs text-charcoal/60">
          {t.lastUpdated}: {new Date(template.updated_at).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleEditTemplate(template)
          }}
          className="ml-3 inline-flex items-center gap-1.5 bg-copper/10 hover:bg-copper/20 text-copper px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {t.editContent}
        </button>
      </div>
    </div>
  )

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-sand-beige flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-copper mx-auto"></div>
          <p className="mt-4 text-copper elegant-subtitle">{t.authRequired}</p>
          <p className="mt-2 text-charcoal/60">{t.authMessage}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sand-beige flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-copper mx-auto"></div>
          <p className="mt-4 text-copper elegant-subtitle">{t.loading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-beige to-white flex flex-col">
      {/* Header */}
      <header className="liquid-glass shadow py-4 sm:py-6 px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
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
              {t.managementSystem} ({templates.length} {t.templatesCount})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => window.location.href = '/'}
            className="group relative bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-1 sm:gap-2"
          >
            <span className="text-sm sm:text-base">{t.backToDashboard}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          <button
            onClick={logout}
            className="group relative bg-gradient-to-r from-copper to-amber-700 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-copper/90 hover:to-amber-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span className="text-sm sm:text-base">{t.logout}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto py-4 sm:py-8 px-4">
        {/* Search and Filter Controls */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-copper/60 text-lg">🔍</span>
            </div>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 w-full rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 placeholder:text-charcoal/40 text-sm sm:text-base"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="px-4 py-3 rounded-xl border border-white/20 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 text-sm sm:text-base"
            >
              <option value="all">{t.allTemplates}</option>
              <option value="active">{t.activeOnly}</option>
              <option value="inactive">{t.inactiveOnly}</option>
            </select>
          </div>
        </div>

        {/* Template Categories */}
        <div className="space-y-8">
          {/* Contact & Form Submissions */}
          {categorizedTemplates.contact.length > 0 && (
            <div className="bg-white/30 backdrop-blur-sm rounded-3xl shadow-md p-6 sm:p-8 border border-copper/10">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">📧</span>
                <h2 className="text-xl sm:text-2xl font-playfair text-copper font-semibold">
                  {t.contactForms}
                </h2>
                <span className="text-sm text-charcoal/60 bg-white/50 px-2 py-1 rounded-full">
                  {categorizedTemplates.contact.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categorizedTemplates.contact.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </div>
          )}

          {/* Omakase Reservations */}
          {categorizedTemplates.omakase.length > 0 && (
            <div className="bg-white/30 backdrop-blur-sm rounded-3xl shadow-md p-6 sm:p-8 border border-copper/10">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">🍣</span>
                <h2 className="text-xl sm:text-2xl font-playfair text-copper font-semibold">
                  {t.omakaseReservations}
                </h2>
                <span className="text-sm text-charcoal/60 bg-white/50 px-2 py-1 rounded-full">
                  {categorizedTemplates.omakase.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categorizedTemplates.omakase.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </div>
          )}

          {/* Dining Reservations */}
          {categorizedTemplates.dining.length > 0 && (
            <div className="bg-white/30 backdrop-blur-sm rounded-3xl shadow-md p-6 sm:p-8 border border-copper/10">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">🍽️</span>
                <h2 className="text-xl sm:text-2xl font-playfair text-copper font-semibold">
                  {t.diningReservations}
                </h2>
                <span className="text-sm text-charcoal/60 bg-white/50 px-2 py-1 rounded-full">
                  {categorizedTemplates.dining.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categorizedTemplates.dining.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* No Templates Found */}
        {filteredTemplates.length === 0 && (
          <div className="bg-white/40 backdrop-blur-sm rounded-3xl shadow-md p-12 border border-copper/10 text-center">
            <div className="text-copper/60 text-4xl mb-4">📧</div>
            <h3 className="text-xl font-playfair text-copper font-medium mb-2">
              {searchTerm || activeFilter !== 'all' ? t.noTemplates : t.noTemplatesFound}
            </h3>
            <p className="text-charcoal/60">
              {searchTerm || activeFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'No email templates are currently available.'}
            </p>
          </div>
        )}
      </main>

             {/* Edit Template Modal - Wabi Sabi Style */}
       {showEditModal && editingTemplate && (
         <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-gradient-to-br from-white/90 to-sand-beige/80 backdrop-blur-xl rounded-3xl shadow-2xl max-w-6xl w-full h-[90vh] max-h-[90vh] overflow-hidden border-2 border-copper/20 flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-copper/10 flex-shrink-0 bg-white/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-playfair text-copper font-semibold">{t.editTemplate}</h2>
                  <p className="text-sm text-charcoal/60 mt-1">{editingTemplate.name}</p>
                </div>
                <div className="flex gap-2">
                  {/* Edit Mode Switcher */}
                  <div className="flex gap-1 bg-white/40 rounded-full p-1 mr-2">
                    <button
                      onClick={() => setEditMode('simple')}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                        editMode === 'simple'
                          ? 'bg-copper/80 text-white shadow-sm'
                          : 'text-charcoal/60 hover:text-charcoal hover:bg-white/60'
                      }`}
                    >
                      {t.simpleMode}
                    </button>
                    <button
                      onClick={() => setEditMode('advanced')}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                        editMode === 'advanced'
                          ? 'bg-copper/80 text-white shadow-sm'
                          : 'text-charcoal/60 hover:text-charcoal hover:bg-white/60'
                      }`}
                    >
                      {t.advancedMode}
                    </button>
                  </div>
                  
                  {/* View Mode Switcher */}
                  <button
                    onClick={() => setPreviewMode('edit')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      previewMode === 'edit'
                        ? 'bg-copper text-white shadow-md'
                        : 'bg-white/60 text-charcoal hover:bg-white/80'
                    }`}
                  >
                    {t.editMode}
                  </button>
                  <button
                    onClick={() => setPreviewMode('preview')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      previewMode === 'preview'
                        ? 'bg-copper text-white shadow-md'
                        : 'bg-white/60 text-charcoal hover:bg-white/80'
                    }`}
                  >
                    {t.previewMode}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Template Info Sidebar */}
              <div className="w-full lg:w-80 p-6 border-b lg:border-b-0 lg:border-r border-copper/10 bg-white/30 flex-shrink-0">
                <h3 className="text-lg font-playfair text-copper font-medium mb-4">{t.templateInfo}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-charcoal/60 mb-1">{t.key}</label>
                    <div className="px-3 py-2 bg-white/60 rounded-lg text-sm text-charcoal font-mono">
                      {editingTemplate.key}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal/60 mb-1">Name</label>
                    <div className="px-3 py-2 bg-white/60 rounded-lg text-sm text-charcoal">
                      {editingTemplate.name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal/60 mb-1">{t.subject}</label>
                    <div className="px-3 py-2 bg-white/60 rounded-lg text-sm text-charcoal">
                      {editingTemplate.subject}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal/60 mb-1">Status</label>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                      editingTemplate.active 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {editingTemplate.active ? t.active : t.inactive}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content Editor/Preview */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {previewMode === 'edit' ? (
                  <div className="flex-1 p-6 flex flex-col min-h-0">
                    <label className="block text-sm font-medium text-charcoal mb-3 flex-shrink-0">
                      {editMode === 'simple' ? t.textContent : t.htmlCode}
                    </label>
                    <div className="flex-1 bg-white/60 rounded-2xl p-1 border border-copper/10 min-h-0">
                      <div className="h-full bg-white rounded-xl p-4 overflow-y-auto">
                        {editMode === 'simple' ? (
                          <div className="space-y-4">
                            {Object.entries(extractedTexts).length === 0 ? (
                              <div className="text-center py-8 text-charcoal/60">
                                <p>No editable text content found in this template.</p>
                                <p className="text-xs mt-2">Switch to Advanced Mode to edit the raw HTML.</p>
                                <button
                                  onClick={() => setEditMode('advanced')}
                                  className="mt-4 px-4 py-2 bg-copper/10 hover:bg-copper/20 text-copper rounded-lg text-sm font-medium transition-all duration-200"
                                >
                                  Switch to Advanced Mode
                                </button>
                              </div>
                            ) : (
                              Object.entries(extractedTexts).map(([key, text]) => (
                                <div key={key} className="bg-sand-beige/20 p-3 rounded-lg border border-copper/10">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-medium text-charcoal/60">
                                      Text Section {parseInt(key.replace('text_', '')) + 1}
                                    </label>
                                    <span className="text-xs text-charcoal/40">
                                      {text.length} characters
                                    </span>
                                  </div>
                                  <textarea
                                    value={text}
                                    onChange={(e) => setExtractedTexts(prev => ({...prev, [key]: e.target.value}))}
                                    className="w-full p-3 bg-white rounded-lg border border-copper/20 focus:ring-2 focus:ring-copper/20 focus:border-copper/20 transition-all duration-300 resize-none text-sm leading-relaxed"
                                    rows={Math.max(2, Math.min(6, Math.ceil(text.length / 50)))}
                                    placeholder="Enter text content..."
                                  />
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                          <div className="h-full">
                            <textarea
                              value={rawHtmlContent}
                              onChange={(e) => setRawHtmlContent(e.target.value)}
                              className="w-full h-full p-4 bg-transparent font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-copper/20 border-0"
                              placeholder="Enter your HTML email content here..."
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-6 flex flex-col min-h-0">
                    <label className="block text-sm font-medium text-charcoal mb-3 flex-shrink-0">{t.preview}</label>
                    <div className="flex-1 bg-white/60 rounded-2xl p-1 border border-copper/10 min-h-0">
                      <div className="h-full bg-white rounded-xl overflow-y-auto">
                        <div className="p-4">
                          <div 
                            className="prose prose-sm max-w-none [&>*]:max-w-none [&_img]:max-w-full [&_table]:w-full"
                            dangerouslySetInnerHTML={{ 
                              __html: editMode === 'simple' 
                                ? (Object.keys(extractedTexts).length > 0 
                                    ? replaceTextInHTML(editingTemplate.html, extractedTexts) 
                                    : editingTemplate.html)
                                : rawHtmlContent
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-copper/10 flex justify-end gap-3 flex-shrink-0 bg-white/50">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingTemplate(null)
                  setExtractedTexts({})
                  setRawHtmlContent('')
                  setEditMode('simple')
                }}
                className="px-6 py-3 rounded-full border border-copper/20 bg-white/60 hover:bg-white/80 transition-all duration-300 font-medium text-charcoal"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleUpdateTemplate}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-full bg-copper hover:bg-copper/90 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? t.updating : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch single email template by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }
    
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching email template:', error)
      return NextResponse.json({ error: 'Failed to fetch email template' }, { status: 500 })
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 })
    }
    
    return NextResponse.json({ template: data })
  } catch (error) {
    console.error('GET email template by ID error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update email template by ID
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    
    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }
    
    const {
      key,
      name,
      subject,
      html,
      active
    } = body
    
    // Validate required fields
    if (!name || !subject || !html) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, subject, html' 
      }, { status: 400 })
    }
    
    // If key is being updated, validate it
    if (key) {
      const keyRegex = /^[a-zA-Z0-9_]+$/
      if (!keyRegex.test(key)) {
        return NextResponse.json({ 
          error: 'key must contain only alphanumeric characters and underscores' 
        }, { status: 400 })
      }
      
      // Check if key already exists (exclude current template)
      const { data: existingTemplate } = await supabaseAdmin
        .from('email_templates')
        .select('id')
        .eq('key', key)
        .neq('id', id)
        .single()
      
      if (existingTemplate) {
        return NextResponse.json({ 
          error: 'Template key already exists. Please use a unique key.' 
        }, { status: 400 })
      }
    }
    
    // Build update object
    const updateData: any = {
      name,
      subject,
      html,
      active: active ?? true
    }
    
    // Only update key if provided
    if (key) {
      updateData.key = key
    }
    
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating email template:', error)
      return NextResponse.json({ error: 'Failed to update email template' }, { status: 500 })
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 })
    }
    
    return NextResponse.json({ 
      success: true, 
      template: data,
      message: 'Email template updated successfully' 
    })
  } catch (error) {
    console.error('PUT email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete email template by ID
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }
    
    // First, check if template exists
    const { data: existingTemplate } = await supabaseAdmin
      .from('email_templates')
      .select('id, key, name')
      .eq('id', id)
      .single()
    
    if (!existingTemplate) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 })
    }
    
    // Delete the template
    const { error } = await supabaseAdmin
      .from('email_templates')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting email template:', error)
      return NextResponse.json({ error: 'Failed to delete email template' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Email template "${existingTemplate.name}" deleted successfully` 
    })
  } catch (error) {
    console.error('DELETE email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 
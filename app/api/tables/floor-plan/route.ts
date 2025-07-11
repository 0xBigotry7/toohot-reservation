import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch complete floor plan layout
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || 'main'
    const includeReservations = searchParams.get('include_reservations') === 'true'
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Get tables with their floor plan positions
    const { data: tables, error } = await supabaseAdmin
      .from('table_layout_view')
      .select('*')
      .eq('floor_section', section)
      .order('table_number', { ascending: true })

    if (error) {
      console.error('Error fetching floor plan:', error)
      return NextResponse.json({ error: 'Failed to fetch floor plan' }, { status: 500 })
    }

    // Get floor sections
    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from('restaurant_floor_sections')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError)
      return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
    }

    let reservationData = null
    if (includeReservations) {
      // Get table reservations for the specified date
      const { data: reservations, error: reservationError } = await supabaseAdmin
        .from('table_reservations')
        .select(`
          *,
          restaurant_tables(table_number, table_name)
        `)
        .eq('reservation_date', date)
        .in('status', ['assigned', 'seated'])

      if (reservationError) {
        console.error('Error fetching reservations:', reservationError)
      } else {
        reservationData = reservations
      }
    }

    return NextResponse.json({
      success: true,
      section,
      tables: tables || [],
      sections: sections || [],
      reservations: reservationData,
      date: includeReservations ? date : null
    })
  } catch (error) {
    console.error('GET floor plan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Bulk update table positions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { updates } = body

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ 
        error: 'Updates array is required' 
      }, { status: 400 })
    }

    const results = []
    const errors = []

    // Process each update
    for (const update of updates) {
      const { table_id, x_position, y_position, width, height, rotation, floor_section } = update

      if (!table_id) {
        errors.push({ update, error: 'table_id is required' })
        continue
      }

      const updateData: any = {}
      if (x_position !== undefined) updateData.x_position = x_position
      if (y_position !== undefined) updateData.y_position = y_position
      if (width !== undefined) updateData.width = width
      if (height !== undefined) updateData.height = height
      if (rotation !== undefined) updateData.rotation = rotation
      if (floor_section !== undefined) updateData.floor_section = floor_section

      if (Object.keys(updateData).length === 0) {
        errors.push({ update, error: 'No valid update fields provided' })
        continue
      }

      const { data, error } = await supabaseAdmin
        .from('restaurant_floor_plan')
        .update(updateData)
        .eq('table_id', table_id)
        .select()

      if (error) {
        errors.push({ update, error: error.message })
      } else {
        results.push({ table_id, updated: data })
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      errorCount: errors.length,
      results,
      errors
    })
  } catch (error) {
    console.error('POST floor plan bulk update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update single table position
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      table_id,
      x_position,
      y_position,
      width,
      height,
      rotation,
      floor_section 
    } = body

    if (!table_id) {
      return NextResponse.json({ 
        error: 'table_id is required' 
      }, { status: 400 })
    }

    const updateData: any = {}
    if (x_position !== undefined) updateData.x_position = x_position
    if (y_position !== undefined) updateData.y_position = y_position
    if (width !== undefined) updateData.width = width
    if (height !== undefined) updateData.height = height
    if (rotation !== undefined) updateData.rotation = rotation
    if (floor_section !== undefined) updateData.floor_section = floor_section

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ 
        error: 'No valid update fields provided' 
      }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('restaurant_floor_plan')
      .update(updateData)
      .eq('table_id', table_id)
      .select(`
        *,
        restaurant_tables(*)
      `)
      .single()

    if (error) {
      console.error('Error updating table position:', error)
      return NextResponse.json({ 
        error: 'Failed to update table position' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      table: data
    })
  } catch (error) {
    console.error('PUT floor plan update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 
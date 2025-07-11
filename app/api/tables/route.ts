import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch all tables with their floor plan positions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section')
    const tableType = searchParams.get('type')
    const status = searchParams.get('status') || 'active'
    const includeLayout = searchParams.get('include_layout') === 'true'

    let query = supabaseAdmin
      .from('restaurant_tables')
      .select(includeLayout ? 
        `*, restaurant_floor_plan!inner(*)` : 
        '*'
      )
      .order('table_number', { ascending: true })

    if (status) {
      query = query.eq('status', status)
    }

    if (section) {
      query = query.eq('section', section)
    }

    if (tableType) {
      query = query.eq('table_type', tableType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching tables:', error)
      return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      tables: data || [] 
    })
  } catch (error) {
    console.error('GET tables error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      table_number,
      table_name,
      capacity,
      table_type,
      shape = 'rectangular',
      section = 'main-dining',
      min_party_size = 1,
      max_party_size,
      notes,
      // Floor plan position data
      x_position = 100,
      y_position = 100,
      width,
      height,
      rotation = 0,
      floor_section = 'main'
    } = body

    // Validate required fields
    if (!table_number || !capacity || !table_type) {
      return NextResponse.json({ 
        error: 'Missing required fields: table_number, capacity, table_type' 
      }, { status: 400 })
    }

    // Validate table type
    if (!['omakase', 'dining', 'both'].includes(table_type)) {
      return NextResponse.json({ 
        error: 'Invalid table_type. Must be omakase, dining, or both' 
      }, { status: 400 })
    }

    // Validate capacity
    if (capacity < 1 || capacity > 20) {
      return NextResponse.json({ 
        error: 'Capacity must be between 1 and 20' 
      }, { status: 400 })
    }

    // Set default max_party_size if not provided
    const finalMaxPartySize = max_party_size || capacity

    // Set default dimensions based on capacity
    const defaultWidth = width || (capacity <= 2 ? 80 : capacity <= 4 ? 100 : capacity <= 6 ? 120 : 140)
    const defaultHeight = height || (capacity <= 2 ? 60 : capacity <= 4 ? 80 : capacity <= 6 ? 100 : 120)

    // Start transaction
    const { data: newTable, error: tableError } = await supabaseAdmin
      .from('restaurant_tables')
      .insert([{
        table_number,
        table_name,
        capacity,
        table_type,
        shape,
        section,
        min_party_size,
        max_party_size: finalMaxPartySize,
        notes,
        status: 'active'
      }])
      .select()
      .single()

    if (tableError) {
      console.error('Error creating table:', tableError)
      return NextResponse.json({ 
        error: tableError.message.includes('duplicate') ? 
          'Table number already exists' : 
          'Failed to create table' 
      }, { status: 500 })
    }

    // Create floor plan entry
    const { error: floorPlanError } = await supabaseAdmin
      .from('restaurant_floor_plan')
      .insert([{
        table_id: newTable.id,
        x_position,
        y_position,
        width: defaultWidth,
        height: defaultHeight,
        rotation,
        floor_section
      }])

    if (floorPlanError) {
      console.error('Error creating floor plan entry:', floorPlanError)
      // Clean up the table if floor plan creation fails
      await supabaseAdmin.from('restaurant_tables').delete().eq('id', newTable.id)
      return NextResponse.json({ 
        error: 'Failed to create floor plan entry' 
      }, { status: 500 })
    }

    // Fetch the complete table with floor plan data
    const { data: completeTable, error: fetchError } = await supabaseAdmin
      .from('restaurant_tables')
      .select(`
        *,
        restaurant_floor_plan(*)
      `)
      .eq('id', newTable.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete table:', fetchError)
      return NextResponse.json({ 
        error: 'Table created but failed to fetch complete data' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      table: completeTable 
    })
  } catch (error) {
    console.error('POST tables error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update table
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      id,
      table_number,
      table_name,
      capacity,
      table_type,
      shape,
      section,
      min_party_size,
      max_party_size,
      notes,
      status,
      // Floor plan updates
      x_position,
      y_position,
      width,
      height,
      rotation,
      floor_section
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Table ID is required' }, { status: 400 })
    }

    // Prepare table updates
    const tableUpdates: any = {}
    if (table_number !== undefined) tableUpdates.table_number = table_number
    if (table_name !== undefined) tableUpdates.table_name = table_name
    if (capacity !== undefined) tableUpdates.capacity = capacity
    if (table_type !== undefined) tableUpdates.table_type = table_type
    if (shape !== undefined) tableUpdates.shape = shape
    if (section !== undefined) tableUpdates.section = section
    if (min_party_size !== undefined) tableUpdates.min_party_size = min_party_size
    if (max_party_size !== undefined) tableUpdates.max_party_size = max_party_size
    if (notes !== undefined) tableUpdates.notes = notes
    if (status !== undefined) tableUpdates.status = status

    // Update table if there are table updates
    if (Object.keys(tableUpdates).length > 0) {
      const { error: tableError } = await supabaseAdmin
        .from('restaurant_tables')
        .update(tableUpdates)
        .eq('id', id)

      if (tableError) {
        console.error('Error updating table:', tableError)
        return NextResponse.json({ 
          error: tableError.message.includes('duplicate') ? 
            'Table number already exists' : 
            'Failed to update table' 
        }, { status: 500 })
      }
    }

    // Prepare floor plan updates
    const floorPlanUpdates: any = {}
    if (x_position !== undefined) floorPlanUpdates.x_position = x_position
    if (y_position !== undefined) floorPlanUpdates.y_position = y_position
    if (width !== undefined) floorPlanUpdates.width = width
    if (height !== undefined) floorPlanUpdates.height = height
    if (rotation !== undefined) floorPlanUpdates.rotation = rotation
    if (floor_section !== undefined) floorPlanUpdates.floor_section = floor_section

    // Update floor plan if there are floor plan updates
    if (Object.keys(floorPlanUpdates).length > 0) {
      const { error: floorPlanError } = await supabaseAdmin
        .from('restaurant_floor_plan')
        .update(floorPlanUpdates)
        .eq('table_id', id)

      if (floorPlanError) {
        console.error('Error updating floor plan:', floorPlanError)
        return NextResponse.json({ 
          error: 'Failed to update floor plan' 
        }, { status: 500 })
      }
    }

    // Fetch updated table
    const { data: updatedTable, error: fetchError } = await supabaseAdmin
      .from('restaurant_tables')
      .select(`
        *,
        restaurant_floor_plan(*)
      `)
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching updated table:', fetchError)
      return NextResponse.json({ 
        error: 'Table updated but failed to fetch updated data' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      table: updatedTable 
    })
  } catch (error) {
    console.error('PUT tables error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete table
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Table ID is required' }, { status: 400 })
    }

    // Check if table has active reservations
    const { data: activeReservations, error: reservationError } = await supabaseAdmin
      .from('table_reservations')
      .select('id')
      .eq('table_id', id)
      .in('status', ['assigned', 'seated'])
      .gte('reservation_date', new Date().toISOString().split('T')[0])

    if (reservationError) {
      console.error('Error checking reservations:', reservationError)
      return NextResponse.json({ 
        error: 'Failed to check table reservations' 
      }, { status: 500 })
    }

    if (activeReservations && activeReservations.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete table with active reservations' 
      }, { status: 400 })
    }

    // Delete table (cascade will handle floor plan)
    const { error: deleteError } = await supabaseAdmin
      .from('restaurant_tables')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting table:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete table' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Table deleted successfully' 
    })
  } catch (error) {
    console.error('DELETE tables error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { id, updates, type } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Missing reservation id' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid updates' }, { status: 400 });
    }

    if (!type || (type !== 'omakase' && type !== 'dining')) {
      return NextResponse.json({ error: 'Missing or invalid reservation type' }, { status: 400 });
    }

    // Determine which table to update based on reservation type
    const tableName = type === 'omakase' ? 'omakase_reservations' : 'dining_reservations';

    // Update the reservation using service role key (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add the type to the returned data for consistency
    const responseData = { ...data, type };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
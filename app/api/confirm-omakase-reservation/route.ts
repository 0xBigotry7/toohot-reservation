import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { id, confirmation_code } = await request.json();
    if (!id || !confirmation_code) {
      return NextResponse.json({ error: 'Missing id or confirmation_code' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('omakase_reservations')
      .update({ status: 'confirmed', confirmation_code })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
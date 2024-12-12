import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('prompts')
      .select('id, filename, content, created_at, prompt')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching prompts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prompts' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Error processing request:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
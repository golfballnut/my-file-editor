import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const filename = searchParams.get('filename');

    if (!id && !filename) {
      return NextResponse.json(
        { error: 'Either ID or filename is required' },
        { status: 400 }
      );
    }

    const query = supabaseServer
      .from('prompts')
      .select('id, filename, content, created_at');

    if (id) {
      query.eq('id', id);
    } else {
      query.eq('filename', filename);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Error fetching prompt:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prompt' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
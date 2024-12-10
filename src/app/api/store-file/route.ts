import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type StoreFileRequest = {
  path: string;
  content: string;
};

export async function POST(request: Request) {
  try {
    const { path, content } = await request.json() as StoreFileRequest;

    if (!path || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'path and content are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('files')
      .upsert({ path, content })
      .select()
      .single();

    if (error) {
      console.error('Error storing file:', error);
      return NextResponse.json(
        { error: 'Failed to store file' },
        { status: 500 }
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
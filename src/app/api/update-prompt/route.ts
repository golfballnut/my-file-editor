import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

type UpdatePromptRequest = {
  id: string;
  filename?: string;
  content?: string;
};

export async function POST(request: Request) {
  try {
    const { id, filename, content } = await request.json() as UpdatePromptRequest;

    if (!id || (!filename && !content)) {
      return NextResponse.json(
        { error: 'ID and at least one field (filename or content) are required' },
        { status: 400 }
      );
    }

    // Check if filename already exists (if changing filename)
    if (filename) {
      const { data: existing } = await supabaseServer
        .from('prompts')
        .select('id')
        .eq('filename', filename)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A prompt with this filename already exists' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseServer
      .from('prompts')
      .update({ 
        ...(filename && { filename }),
        ...(content && { content })
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating prompt:', error);
      return NextResponse.json(
        { error: 'Failed to update prompt' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing update request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
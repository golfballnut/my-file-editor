import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type UploadPromptRequest = {
  filename: string;
  content: string;
};

export async function POST(request: Request) {
  try {
    const { filename, content } = await request.json() as UploadPromptRequest;

    if (!filename || !content) {
      return NextResponse.json(
        { error: 'Filename and content are required' },
        { status: 400 }
      );
    }

    // Check if file already exists
    const { data: existing } = await supabase
      .from('prompts')
      .select('id')
      .eq('filename', filename)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A file with this name already exists' },
        { status: 400 }
      );
    }

    // Insert new prompt
    const { data, error } = await supabase
      .from('prompts')
      .insert([{ filename, content }])
      .select()
      .single();

    if (error) {
      console.error('Error uploading prompt:', error);
      return NextResponse.json(
        { error: 'Failed to upload prompt' },
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
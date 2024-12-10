import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type UploadPromptRequest = {
  filename: string;
  content: string;
};

export async function POST(request: Request) {
  try {
    console.log('Starting upload-prompt request...');
    
    const { filename, content } = await request.json() as UploadPromptRequest;
    console.log('Request payload:', { filename, contentLength: content?.length });

    // Validate input
    if (typeof filename !== 'string' || typeof content !== 'string') {
      console.log('Invalid input types:', { 
        filenameType: typeof filename, 
        contentType: typeof content 
      });
      return NextResponse.json(
        { error: 'Invalid input types' },
        { status: 400 }
      );
    }

    if (!filename || !content) {
      console.log('Missing required fields');
      return NextResponse.json(
        { error: 'Filename and content are required' },
        { status: 400 }
      );
    }

    // Check Supabase connection
    console.log('Checking Supabase connection...');
    const { count, error: healthError } = await supabase
      .from('prompts')
      .select('*', { count: 'exact', head: true });

    if (healthError) {
      console.error('Supabase connection error:', healthError);
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }
    console.log('Supabase connection OK, row count:', count);

    // Check for existing file
    console.log('Checking for existing file:', filename);
    const { data: existing, error: checkError } = await supabase
      .from('prompts')
      .select('id')
      .eq('filename', filename)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing prompt:', checkError);
      return NextResponse.json(
        { error: 'Failed to check for existing file' },
        { status: 500 }
      );
    }

    if (existing) {
      console.log('File already exists:', filename);
      return NextResponse.json(
        { error: 'A file with this name already exists' },
        { status: 400 }
      );
    }

    // Insert new prompt
    console.log('Inserting new prompt:', filename);
    const { data: insertData, error: insertError } = await supabase
      .from('prompts')
      .insert([{ filename, content }])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting prompt:', {
        error: insertError,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      });
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    console.log('Successfully created prompt:', insertData);
    return NextResponse.json(insertData);
  } catch (error) {
    console.error('Unhandled error in upload-prompt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 
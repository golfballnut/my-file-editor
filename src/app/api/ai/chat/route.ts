import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: Request) {
  console.log('AI Chat route handler called');
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    const { prompt, files } = body;

    if (!prompt || !files || !Array.isArray(files)) {
      console.log('Validation failed:', { prompt, files });
      return NextResponse.json(
        { error: 'Prompt and files array are required' },
        { status: 400 }
      );
    }

    console.log('Processing files:', files.length);
    const response = {
      message: "This is a placeholder response. AI chat functionality will be implemented here.",
      files: files.map(file => ({
        path: file.path,
        content: file.content,
        tokens: file.tokens
      }))
    };

    console.log('Sending response');
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in AI chat route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
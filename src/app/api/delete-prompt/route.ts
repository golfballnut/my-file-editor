import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const { id } = await request.json() as { id: string };
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('prompts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prompt:', error);
      return NextResponse.json(
        { error: 'Failed to delete prompt' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing delete request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
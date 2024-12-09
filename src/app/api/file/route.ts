import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return Response.json(
        { error: 'Missing path parameter' },
        { status: 400 }
      );
    }

    // Ensure path is within project directory to prevent directory traversal
    const fullPath = join(process.cwd(), filePath);
    if (!fullPath.startsWith(process.cwd())) {
      return Response.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    // Read file contents
    const content = await readFile(fullPath, 'utf-8');
    
    return Response.json({ content });

  } catch (error) {
    console.error('Error reading file:', error);
    return Response.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
} 
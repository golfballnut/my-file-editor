import { writeFile } from 'fs/promises';
import { join } from 'path';

type SaveFileRequest = {
  path: string;
  content: string;
};

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json() as SaveFileRequest;
    const { path: filePath, content } = body;

    if (!filePath) {
      return Response.json(
        { error: 'Missing path parameter' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string') {
      return Response.json(
        { error: 'Content must be a string' },
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

    // Write file contents
    await writeFile(fullPath, content, 'utf-8');
    
    return Response.json({ success: true });

  } catch (error) {
    console.error('Error saving file:', error);
    return Response.json(
      { error: 'Failed to save file' },
      { status: 500 }
    );
  }
} 
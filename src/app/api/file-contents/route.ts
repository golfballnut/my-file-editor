import { NextResponse } from 'next/server';
import { isExtraFile, getExtraFileContent } from '@/lib/extra-files';
import { supabaseServer } from '@/lib/supabase-server';

type RequestBody = {
  paths: string[];
  owner?: string;
  repo?: string;
  branch?: string;
};

async function fetchPromptContent(path: string): Promise<string> {
  const filename = path.replace(/^prompts\//, '');
  const { data, error } = await supabaseServer
    .from('prompts')
    .select('content')
    .eq('filename', filename)
    .single();

  if (error) {
    console.error(`Failed to fetch prompt ${path}:`, error);
    return '';
  }

  return data?.content || '';
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<string> {
  console.log('Fetching content for:', path);

  // Handle prompts from Supabase
  if (path.startsWith('prompts/')) {
    return fetchPromptContent(path);
  }

  // Handle extra files
  if (isExtraFile(path)) {
    return getExtraFileContent(path);
  }

  // Handle GitHub files
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3.raw',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    console.error(`Failed to fetch ${path}: ${response.statusText}`);
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }

  return response.text();
}

export async function POST(request: Request) {
  try {
    const { paths, owner: repoOwner, repo: repoName } = await request.json();
    
    if (!Array.isArray(paths)) {
      return NextResponse.json(
        { error: 'Paths must be an array' },
        { status: 400 }
      );
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const contents: Record<string, string> = {};
    const errors: string[] = [];

    await Promise.all(
      paths.map(async (path) => {
        try {
          contents[path] = await fetchFileContent(repoOwner, repoName, path, token);
        } catch (error) {
          errors.push(`Failed to fetch ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      })
    );

    if (errors.length > 0) {
      console.error('Errors fetching files:', errors);
      return NextResponse.json(
        { error: 'Some files failed to fetch', errors },
        { status: 500 }
      );
    }

    return NextResponse.json(contents);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
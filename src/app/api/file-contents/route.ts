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
  branch: string = 'main'
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
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'NextJS-File-Editor'
  };
  
  if (process.env.NEXT_PUBLIC_GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    console.error(`Failed to fetch ${path}: ${response.statusText}`);
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }

  return response.text();
}

export async function POST(request: Request) {
  try {
    const { paths, owner: repoOwner, repo: repoName, branch: repoBranch } = 
      await request.json() as RequestBody;

    if (!paths || !Array.isArray(paths)) {
      return NextResponse.json(
        { error: 'Paths array is required' },
        { status: 400 }
      );
    }

    const contents: Record<string, string> = {};

    // Use Promise.all but handle individual file failures
    const results = await Promise.allSettled(
      paths.map(async (path) => {
        try {
          const content = await fetchFileContent(
            repoOwner || process.env.GITHUB_OWNER!,
            repoName || process.env.GITHUB_REPO!,
            path,
            repoBranch
          );
          console.log(`Successfully fetched content for ${path}`);
          return { path, content };
        } catch (error) {
          console.error(`Error fetching ${path}:`, error);
          throw error;
        }
      })
    );

    // Process results and collect any errors
    const errors: string[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        contents[result.value.path] = result.value.content;
      } else {
        errors.push(`Failed to fetch ${result.reason}`);
      }
    });

    if (errors.length > 0) {
      console.error('Errors fetching files:', errors);
      return NextResponse.json(
        { error: 'Failed to fetch some files', errors },
        { status: 500 }
      );
    }

    return NextResponse.json(contents);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file contents' },
      { status: 500 }
    );
  }
} 
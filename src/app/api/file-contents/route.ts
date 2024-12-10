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
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    console.error(`Failed to fetch ${path}: ${response.statusText}`);
    return '';
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

    await Promise.all(
      paths.map(async (path) => {
        try {
          contents[path] = await fetchFileContent(
            repoOwner || process.env.GITHUB_OWNER!,
            repoName || process.env.GITHUB_REPO!,
            path,
            repoBranch
          );
        } catch (error) {
          console.error(`Error fetching ${path}:`, error);
          contents[path] = '';
        }
      })
    );

    return NextResponse.json(contents);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file contents' },
      { status: 500 }
    );
  }
} 
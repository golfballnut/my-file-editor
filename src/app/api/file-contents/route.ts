import { NextResponse } from 'next/server';
import { isExtraFile, getExtraFileContent } from '@/lib/extra-files';

type RequestBody = {
  paths: string[];
  owner?: string;
  repo?: string;
  branch?: string;
};

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<string> {
  // Check for extra files first
  if (isExtraFile(path)) {
    return getExtraFileContent(path);
  }

  // Otherwise fetch from GitHub
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error(`Failed to fetch ${path}: ${response.statusText}`);
    return '';
  }

  return response.text();
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as RequestBody;
    const { paths, owner, repo, branch } = body;

    const repoOwner = owner || process.env.GITHUB_OWNER;
    const repoName = repo || process.env.GITHUB_REPO;
    const repoBranch = branch || 'main';

    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: 'Missing repository information' },
        { status: 400 }
      );
    }

    const contents: Record<string, string> = {};
    
    await Promise.all(
      paths.map(async (path) => {
        try {
          contents[path] = await fetchFileContent(repoOwner, repoName, path, repoBranch);
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
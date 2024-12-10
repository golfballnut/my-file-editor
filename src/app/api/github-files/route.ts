import { readFile } from 'fs/promises';
import { join } from 'path';
import { NextResponse } from 'next/server';

// GitHub API response type
type GitHubApiFile = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  url: string;
};

// Our normalized file type that matches the frontend expectations
type FileEntry = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
  tokens?: number;
};

function countTokens(text: string): number {
  return text.split(/\s+/).filter(token => token.length > 0).length;
}

async function fetchFileContentAndCountTokens(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<number> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file content: ${response.statusText}`);
  }

  const content = await response.text();
  return countTokens(content);
}

// Function to get local extra files
async function getExtraFiles(): Promise<FileEntry[]> {
  const extraFiles = [
    {
      path: 'src/config/settings.json',
      content: JSON.stringify({
        theme: "dark",
        autosave: true
      }, null, 2)
    },
    {
      path: 'src/docs/README.md',
      content: `# Project Documentation

This is the project's documentation for extra configurations.`
    }
  ];

  return extraFiles.map(file => ({
    name: file.path.split('/').pop() || '',
    path: file.path,
    type: 'file' as const,
    tokens: countTokens(file.content)
  }));
}

async function fetchGitHubContents(
  owner: string,
  repo: string,
  path: string = '',
  branch: string = 'main'
): Promise<FileEntry[]> {
  console.log(`Fetching contents for: ${path || 'root'}`);
  
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'NextJS-File-Editor'
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data: GitHubApiFile[] = await response.json();

  // Process all entries with recursive directory handling
  const entries: FileEntry[] = await Promise.all(
    data.map(async (file) => {
      console.log(`Processing ${file.type}: ${file.path}`);
      
      const entry: FileEntry = {
        name: file.name,
        path: file.path,
        type: file.type === 'dir' ? 'directory' : 'file',
      };

      if (file.type === 'dir') {
        // Always fetch directory contents
        console.log(`Fetching children for directory: ${file.path}`);
        entry.children = await fetchGitHubContents(owner, repo, file.path, branch);
        // Sum up tokens from children
        entry.tokens = entry.children.reduce((sum, child) => sum + (child.tokens || 0), 0);
      } else {
        try {
          entry.tokens = await fetchFileContentAndCountTokens(owner, repo, file.path, branch);
          console.log(`Counted ${entry.tokens} tokens in ${file.path}`);
        } catch (error) {
          console.error(`Failed to count tokens for ${file.path}:`, error);
          entry.tokens = 0;
        }
      }

      return entry;
    })
  );

  // Add extra files at the root level
  if (path === '') {
    const extraFiles = await getExtraFiles();
    entries.push(...extraFiles);
  }

  return entries;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner') || process.env.GITHUB_OWNER;
    const repo = searchParams.get('repo') || process.env.GITHUB_REPO;
    const path = searchParams.get('path') || '';
    const branch = searchParams.get('branch') || 'main';

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing repository information' },
        { status: 400 }
      );
    }

    console.log(`Starting fetch for ${owner}/${repo}, path: ${path || 'root'}`);
    const files = await fetchGitHubContents(owner, repo, path, branch);
    console.log('Fetch complete');
    
    return NextResponse.json(files);

  } catch (error) {
    console.error('Error fetching GitHub files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repository contents' },
      { status: 500 }
    );
  }
} 
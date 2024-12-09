import { readdir } from 'fs/promises';
import { join } from 'path';

type FileEntry = {
  name: string;
  type: 'file';
  path: string;
};

type DirectoryEntry = {
  name: string;
  type: 'directory';
  path: string;
  children: (FileEntry | DirectoryEntry)[];
};

type FileSystemEntry = FileEntry | DirectoryEntry;

async function scanDirectory(path: string): Promise<FileSystemEntry[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(path, entry.name);
        const relativePath = fullPath.replace(process.cwd(), '');

        // Skip node_modules and .git directories
        if (entry.name === 'node_modules' || entry.name === '.git') {
          return null;
        }

        if (entry.isDirectory()) {
          const children = await scanDirectory(fullPath);
          return {
            name: entry.name,
            type: 'directory' as const,
            path: relativePath,
            children: children.filter((child): child is FileSystemEntry => child !== null),
          };
        } else {
          return {
            name: entry.name,
            type: 'file' as const,
            path: relativePath,
          };
        }
      })
    );

    return results.filter((result): result is FileSystemEntry => result !== null);
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const rootPath = process.cwd();
    const fileStructure = await scanDirectory(rootPath);

    return Response.json(fileStructure);
  } catch (error) {
    console.error('Error in GET handler:', error);
    return Response.json(
      { error: 'Failed to scan directory structure' },
      { status: 500 }
    );
  }
} 
export type ExtraFile = {
  path: string;
  content: string;
};

type ExtraFilesMap = {
  [key: string]: {
    content: string;
  }
};

// Static map of extra files
const extraFilesMap: ExtraFilesMap = {
  'src/config/settings.json': {
    content: JSON.stringify({
      theme: "dark",
      autosave: true
    }, null, 2)
  },
  'src/docs/README.md': {
    content: `# Project Documentation

This is the project's documentation for extra configurations.`
  }
};

export async function getExtraFiles(): Promise<ExtraFile[]> {
  return Object.entries(extraFilesMap).map(([path, file]) => ({
    path,
    content: file.content
  }));
}

export function isExtraFile(path: string): boolean {
  return path in extraFilesMap;
}

export function getExtraFileContent(path: string): string {
  return extraFilesMap[path]?.content || '';
} 
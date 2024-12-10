type ExtraFileMap = {
  [path: string]: {
    content: string;
    type: 'file';
  }
};

export const extraFiles: ExtraFileMap = {
  'src/config/settings.json': {
    content: JSON.stringify({
      theme: "dark",
      autosave: true
    }, null, 2),
    type: 'file'
  },
  'src/docs/README.md': {
    content: `# Project Documentation

This is the project's documentation for extra configurations.`,
    type: 'file'
  }
};

export function isExtraFile(path: string): boolean {
  return path in extraFiles;
}

export function getExtraFileContent(path: string): string | null {
  return extraFiles[path]?.content || null;
} 
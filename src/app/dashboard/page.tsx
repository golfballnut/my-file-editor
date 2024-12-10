'use client';

import React, { useCallback, useEffect, useState } from 'react';

type FileEntry = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
  tokens?: number;
};

type FileTreeProps = {
  items: FileEntry[];
  onToggleSelect: (path: string, selected: boolean, entry: FileEntry) => void;
  selectedPaths: Set<string>;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  level?: number;
};

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'tsx';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    default:
      return '';
  }
}

function generateMarkdown(
  selectedPaths: Set<string>,
  files: FileEntry[],
  findEntry: (path: string, items: FileEntry[]) => FileEntry | null,
  totalTokens: number,
  fileContents?: Record<string, string>
): string {
  const now = new Date().toLocaleString();
  const lines: string[] = [
    `# Selected Files (${now})`,
    '',
    `Total files: ${selectedPaths.size}  `,
    `Total tokens: ${totalTokens.toLocaleString()}`,
    '',
    '| File Path | Type | Tokens |',
    '|-----------|------|--------|',
  ];

  Array.from(selectedPaths).forEach(path => {
    const entry = findEntry(path, files);
    if (entry) {
      const type = entry.type === 'directory' ? 'Directory' : 'File';
      const tokens = entry.tokens?.toLocaleString() || '0';
      lines.push(`| ${path} | ${type} | ${tokens} |`);
    }
  });

  if (fileContents) {
    lines.push('', '## File Contents', '');
    Object.entries(fileContents).forEach(([path, content]) => {
      if (content) {
        const lang = getLanguageFromPath(path);
        lines.push(
          `### ${path}`,
          '',
          '```' + (lang ? lang : ''),
          content.trim(),
          '```',
          ''
        );
      }
    });
  }

  return lines.join('\n');
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [totalTokens, setTotalTokens] = useState(0);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');
  const [includeContents, setIncludeContents] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  useEffect(() => {
    async function fetchFiles() {
      try {
        const response = await fetch('/api/github-files');
        if (!response.ok) throw new Error('Failed to fetch files');
        const data = await response.json();
        setFiles(data);
      } catch (err) {
        setError('Failed to load file structure');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchFiles();
  }, []);

  // Calculate total tokens for a directory and its children
  const calculateDirectoryTokens = useCallback((entry: FileEntry): number => {
    if (entry.type === 'file') {
      return entry.tokens || 0;
    }
    if (entry.children) {
      return entry.children.reduce((sum, child) => sum + calculateDirectoryTokens(child), 0);
    }
    return 0;
  }, []);

  // Find entry by path in the file tree
  const findEntry = useCallback((path: string, items: FileEntry[]): FileEntry | null => {
    for (const item of items) {
      if (item.path === path) return item;
      if (item.children) {
        const found = findEntry(path, item.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const handleToggleSelect = useCallback((path: string, selected: boolean, entry: FileEntry) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });

    // Update total tokens
    setTotalTokens(prev => {
      if (selected) {
        return prev + (entry.type === 'file' ? (entry.tokens || 0) : calculateDirectoryTokens(entry));
      } else {
        return prev - (entry.type === 'file' ? (entry.tokens || 0) : calculateDirectoryTokens(entry));
      }
    });
  }, [calculateDirectoryTokens]);

  // Handle selecting all files in a directory
  const handleSelectDirectory = useCallback((item: FileEntry, selected: boolean) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      
      function addPaths(entry: FileEntry) {
        if (selected) {
          next.add(entry.path);
        } else {
          next.delete(entry.path);
        }
        
        if (entry.children) {
          entry.children.forEach(addPaths);
        }
      }
      
      addPaths(item);
      return next;
    });

    // Update total tokens for the directory
    const directoryTokens = calculateDirectoryTokens(item);
    setTotalTokens(prev => selected ? prev + directoryTokens : prev - directoryTokens);
  }, [calculateDirectoryTokens]);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleExport = async (download = false) => {
    setIsExporting(true);
    try {
      let md: string;
      
      if (includeContents) {
        // Get only file paths (not directories)
        const filePaths = Array.from(selectedPaths).filter(path => {
          const entry = findEntry(path, files);
          return entry?.type === 'file';
        });

        // Fetch contents
        const response = await fetch('/api/file-contents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: filePaths }),
        });

        if (!response.ok) throw new Error('Failed to fetch file contents');
        const contents = await response.json();

        md = generateMarkdown(selectedPaths, files, findEntry, totalTokens, contents);
      } else {
        md = generateMarkdown(selectedPaths, files, findEntry, totalTokens);
      }

      if (download) {
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `files-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        await navigator.clipboard.writeText(md);
        alert('Markdown copied to clipboard!');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export files');
    } finally {
      setIsExporting(false);
    }
  };

  async function handleCreateFile() {
    if (!newFilePath.trim()) {
      alert('File path cannot be empty');
      return;
    }

    try {
      // If it's a prompt file, use the prompt API
      if (newFilePath.endsWith('_prompt.md')) {
        const response = await fetch('/api/upload-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: newFilePath,
            content: newFileContent
          })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create prompt');
        }

        const data = await response.json();
        alert(`Prompt ${data.filename} created successfully!`);
      } else {
        // Use regular file storage for non-prompts
        const response = await fetch('/api/store-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: newFilePath.trim(),
            content: newFileContent
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create file');
        }

        const data = await response.json();
        alert(`File ${data.path} created successfully!`);
      }
      
      // Reset form
      setNewFilePath('');
      setNewFileContent('');
      setShowCreateForm(false);
      
      // Refresh files
      await fetchFiles();
    } catch (error) {
      console.error('Error creating file:', error);
      alert(error instanceof Error ? error.message : 'Failed to create file');
    }
  }

  const FileTree = useCallback(({ 
    items, 
    onToggleSelect, 
    selectedPaths, 
    expandedPaths,
    onToggleExpand,
    level = 0 
  }: FileTreeProps) => {
    return (
      <ul className={`${level === 0 ? 'pl-0' : 'pl-4'} space-y-0.5`}>
        {items.map((item) => (
          <li key={item.path} className="py-0.5">
            <div className="group flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5">
              {item.type === 'directory' && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(item.path);
                  }}
                  className="p-0.5 hover:bg-gray-200 rounded focus:outline-none"
                >
                  <svg 
                    className={`w-3 h-3 text-gray-500 transform transition-transform ${
                      expandedPaths.has(item.path) ? 'rotate-90' : ''
                    }`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              <input
                type="checkbox"
                checked={selectedPaths.has(item.path)}
                onChange={(e) => {
                  if (item.type === 'directory') {
                    handleSelectDirectory(item, e.target.checked);
                  } else {
                    onToggleSelect(item.path, e.target.checked, item);
                  }
                }}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {item.type === 'directory' ? (
                <div className="flex-1">
                  <span className="flex items-center gap-1.5 text-sm">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-gray-700">{item.name}</span>
                    {item.tokens !== undefined && (
                      <span className="text-xs text-gray-400 ml-auto">
                        {item.tokens.toLocaleString()} tokens
                      </span>
                    )}
                  </span>
                  {expandedPaths.has(item.path) && item.children && (
                    <FileTree
                      items={item.children}
                      onToggleSelect={onToggleSelect}
                      selectedPaths={selectedPaths}
                      expandedPaths={expandedPaths}
                      onToggleExpand={onToggleExpand}
                      level={level + 1}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm flex-1">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-gray-700">{item.name}</span>
                  {item.tokens !== undefined && (
                    <span className="text-xs text-gray-400 ml-auto">
                      {item.tokens.toLocaleString()} tokens
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }, []);

  if (loading) return (
    <div className="min-h-screen flex bg-gray-100">
      <div className="w-14 bg-gray-900" />
      <div className="flex-1 animate-pulse p-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  );
  
  if (error) return (
    <div className="min-h-screen flex bg-gray-100">
      <div className="w-14 bg-gray-900" />
      <div className="flex-1 p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Activity Bar */}
      <div className="w-14 bg-gray-900 text-gray-300 flex flex-col items-center py-4 space-y-4">
        <button className="p-2 hover:bg-gray-700 rounded">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
        <button className="p-2 hover:bg-gray-700 rounded">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <button className="p-2 hover:bg-gray-700 rounded">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Title Bar */}
        <div className="h-10 bg-gray-200 border-b border-gray-300 flex items-center px-4 text-sm text-gray-800 shadow-sm">
          <span>File Explorer</span>
          <div className="flex-1" />
          <button className="p-1 hover:bg-gray-300 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Explorer */}
          <div className="w-64 bg-gray-50 border-r border-gray-300 overflow-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Explorer
                </h2>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="p-1 hover:bg-gray-200 rounded text-gray-600"
                  title="New File"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              
              {/* Create File Form */}
              {showCreateForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-6 w-96 space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Create New File</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">File Path</label>
                        <input
                          type="text"
                          value={newFilePath}
                          onChange={(e) => setNewFilePath(e.target.value)}
                          placeholder="e.g., src/prompts/new-prompt.txt"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Content</label>
                        <textarea
                          value={newFileContent}
                          onChange={(e) => setNewFileContent(e.target.value)}
                          rows={6}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex justify-end gap-3">
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateFile}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                      >
                        Create File
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <FileTree
                items={files}
                onToggleSelect={handleToggleSelect}
                selectedPaths={selectedPaths}
                expandedPaths={expandedPaths}
                onToggleExpand={handleToggleExpand}
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Prompt Area */}
            <div className="border-b border-gray-300 p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-700">Prompt</h2>
                <button 
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
                  disabled={selectedPaths.size === 0}
                >
                  Generate
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm text-gray-800 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Write your prompt here..."
              />
            </div>

            {/* Selected Files */}
            <div className="flex-1 overflow-auto">
              {selectedPaths.size > 0 && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">Selected Files</h3>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={includeContents}
                          onChange={(e) => setIncludeContents(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Include file contents
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleExport(false)}
                          disabled={isExporting}
                          className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2 disabled:opacity-50"
                        >
                          {isExporting ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          )}
                          Copy Markdown
                        </button>
                        <button
                          onClick={() => handleExport(true)}
                          disabled={isExporting}
                          className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-2 disabled:opacity-50"
                        >
                          {isExporting ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          )}
                          Download .md
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedPaths).map(path => {
                      const entry = findEntry(path, files);
                      return (
                        <div key={path} className="bg-white border rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm group">
                          <span className="text-sm text-gray-700 truncate max-w-xs">{path}</span>
                          {entry?.tokens !== undefined && (
                            <span className="text-xs text-gray-400 shrink-0">
                              {entry.tokens.toLocaleString()} tokens
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Token Counter */}
      <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur border border-gray-300 rounded-lg shadow-lg p-3 text-sm space-y-1.5 z-50">
        <div className="flex items-center gap-2 text-gray-700">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span>Selected files:</span>
              <span className="font-medium">{selectedPaths.size}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Total tokens:</span>
              <span className="font-medium">{totalTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

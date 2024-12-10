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
  level?: number;
};

export default function DashboardPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [totalTokens, setTotalTokens] = useState(0);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');

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

  const toggleExpand = useCallback((path: string) => {
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

  const FileTree = useCallback(({ items, onToggleSelect, selectedPaths, level = 0 }: FileTreeProps) => {
    return (
      <ul className={`${level === 0 ? 'pl-0' : 'pl-4'} space-y-0.5`}>
        {items.map((item) => (
          <li key={item.path} className="py-0.5">
            <div className="group flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5">
              {item.type === 'directory' && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(item.path);
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
  }, [handleSelectDirectory, toggleExpand]);

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
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Explorer</h2>
                <div className="flex space-x-2">
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <FileTree
                items={files}
                onToggleSelect={handleToggleSelect}
                selectedPaths={selectedPaths}
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
                  <h3 className="text-sm font-medium text-gray-500">Selected Files</h3>
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
    </div>
  );
}

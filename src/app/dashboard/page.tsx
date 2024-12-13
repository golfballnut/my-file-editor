'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';

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

type Prompt = {
  id: string;
  filename: string;
  content: string;
  created_at: string;
  prompt?: 'prompt' | 'prd' | 'instructions' | 'example';
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
  fileContents?: Record<string, string>,
  userPrompt?: string
): string {
  const now = new Date().toLocaleString();
  let markdown = `# Code Review - ${now}\n\n`;

  if (userPrompt) {
    markdown += `## User Prompt\n${userPrompt}\n\n`;
  }

  markdown += `## Files Selected\n`;
  markdown += `Total tokens: ${totalTokens.toLocaleString()}\n\n`;

  const sortedPaths = Array.from(selectedPaths).sort();

  for (const path of sortedPaths) {
    const displayPath = path.replace(/^src\//, '').replace(/\.(tsx|ts|js|jsx)$/, '');
    const entry = findEntry(path, files);
    
    if (entry) {
      markdown += `### ${displayPath}\n`;
      if (fileContents?.[path]) {
        const extension = path.split('.').pop() || '';
        markdown += `\`\`\`${extension}\n${fileContents[path]}\n\`\`\`\n\n`;
      }
    }
  }

  return markdown;
}

// Update XML generation function with CDATA sections
function generateXMLPrompt(
  selectedPaths: Set<string>,
  files: FileEntry[],
  fileContents: Record<string, string>,
  promptsList: Prompt[],
  userPrompt: string
): string {
  // Create a map of filenames to their prompt types
  const promptMap = new Map<string, string>();
  promptsList.forEach(p => {
    if (p.prompt) {
      promptMap.set(p.filename, p.prompt);
    }
  });

  // Generate XML for files in a section
  function filesToXML(paths: string[]): string {
    if (paths.length === 0) return '';
    
    return paths.map(path => {
      const content = fileContents[path] || '';
      const ext = path.split('.').pop() || '';
      return `    <file name="${path}" type="${ext}">
      ${content}
    </file>`;
    }).join('\n');
  }

  // Sort files into sections
  const sections = {
    prompt: [] as string[],
    prd: [] as string[],
    instructions: [] as string[],
    example: [] as string[],
    codebase: [] as string[]
  };

  Array.from(selectedPaths).forEach(path => {
    const filename = path.split('/').pop() || path;
    const category = promptMap.get(filename);
    if (category && category in sections) {
      sections[category as keyof typeof sections].push(path);
    } else {
      sections.codebase.push(path);
    }
  });

  return `<prompt>
  <purpose>${userPrompt.trim()}</purpose>
  <instructions>
${filesToXML(sections.instructions)}
  </instructions>
  <prd>
${filesToXML(sections.prd)}
  </prd>
  <codebase>
${filesToXML(sections.codebase)}
  </codebase>
  <examples>
${filesToXML(sections.example)}
  </examples>
</prompt>`;
}

// Add a function to count tokens in the prompt text
function countPromptTokens(text: string): number {
  if (!text) return 0;
  // Simple word-based token counting for now
  return text.trim().split(/\s+/).filter(token => token.length > 0).length;
}

// 1. First define the FileTreeItem props type
type FileTreeItemProps = {
  item: FileEntry;
  level: number;
  selectedPaths: Set<string>;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
};

// 2. Define the FileTreeItem component
function FileTreeItem({ 
  item, 
  level = 0, 
  selectedPaths, 
  expandedPaths,
  onSelect,
  onToggleExpand 
}: FileTreeItemProps) {
  const isDirectory = 'children' in item;
  const isExpanded = expandedPaths.has(item.path);
  const isSelected = selectedPaths.has(item.path);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (isDirectory) {
      // If it's a directory, select/deselect all children
      const allChildPaths = getAllChildPaths(item);
      allChildPaths.forEach(path => {
        onSelect(path);
      });
    } else {
      onSelect(item.path);
    }
  };

  // Helper function to get all child file paths in a directory
  const getAllChildPaths = (item: FileEntry): string[] => {
    if (!('children' in item)) {
      return [item.path];
    }
    return [
      item.path,
      ...(item.children?.flatMap(child => getAllChildPaths(child)) || [])
    ];
  };

  return (
    <div>
      <div
        className={`flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer text-sm
          ${isSelected ? 'bg-blue-50' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
      >
        <div className="flex items-center gap-2">
          {isDirectory ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(item.path);
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <svg
                className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <span className="w-6" />
          )}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="flex items-center gap-1">
            {isDirectory ? (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {item.name}
          </span>
          {item.tokens && (
            <span className="ml-2 text-xs text-gray-500">{item.tokens}</span>
          )}
        </div>
      </div>
      {isDirectory && isExpanded && item.children?.map((child) => (
        <FileTreeItem
          key={child.path}
          item={child}
          level={level + 1}
          selectedPaths={selectedPaths}
          expandedPaths={expandedPaths}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
}

// 3. Then define the FileTree component
function FileTree({ 
  items, 
  onToggleSelect, 
  selectedPaths, 
  expandedPaths, 
  onToggleExpand, 
  level = 0 
}: FileTreeProps) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <FileTreeItem
          key={item.path}
          item={item}
          level={level}
          selectedPaths={selectedPaths}
          expandedPaths={expandedPaths}
          onSelect={(path) => onToggleSelect(path, !selectedPaths.has(path), item)}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  console.log('DashboardPage is rendering...');

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [promptsList, setPromptsList] = useState<Prompt[]>([]);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [repoOwner, setRepoOwner] = useState('golfballnut');
  const [repoName, setRepoName] = useState(process.env.NEXT_PUBLIC_GITHUB_REPO || '');
  const [isLoadingRepo, setIsLoadingRepo] = useState(false);
  const [publicRepos, setPublicRepos] = useState<Array<{name: string, description: string}>>([]);
  const [isRepoLoading, setIsRepoLoading] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Add resize effect
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isResizingRef.current) return;
      const dx = e.clientX - startXRef.current;
      startXRef.current = e.clientX;
      setSidebarWidth((prev) => Math.max(200, Math.min(600, prev + dx)));
    }

    function handleMouseUp() {
      isResizingRef.current = false;
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Add resize handler
  function handleMouseDownResize(e: React.MouseEvent) {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
  }

  // Define handleLoadRepository first
  const handleLoadRepository = useCallback(async () => {
    if (!repoOwner.trim() || !repoName.trim()) {
      setError('Repository owner and name are required');
      return;
    }

    setLoading(true);
    setIsLoadingRepo(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/github-files?owner=${encodeURIComponent(repoOwner.trim())}&repo=${encodeURIComponent(repoName.trim())}`
      );
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch repository');
      }
      
      const data = await response.json();
      setFiles(data);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load repository');
    } finally {
      setIsLoadingRepo(false);
      setLoading(false);
    }
  }, [repoOwner, repoName]);

  // Then use it in useEffect
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_GITHUB_OWNER && process.env.NEXT_PUBLIC_GITHUB_REPO) {
      setRepoOwner(process.env.NEXT_PUBLIC_GITHUB_OWNER);
      setRepoName(process.env.NEXT_PUBLIC_GITHUB_REPO);
      handleLoadRepository();
    }
  }, [handleLoadRepository]);

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

  // Add helper function for token calculation
  function calculateTokens(paths: Set<string>, files: FileEntry[], findEntry: (path: string, items: FileEntry[]) => FileEntry | null): number {
    let sum = 0;
    paths.forEach(path => {
      const entry = findEntry(path, files);
      if (entry?.type === 'file') {
        sum += entry.tokens ?? 0;
      }
    });
    return sum;
  }

  // Add useEffect for token calculation
  useEffect(() => {
    // Recalculate tokens whenever selectedPaths changes
    let sum = 0;
    selectedPaths.forEach(path => {
      const entry = findEntry(path, files);
      // Only count tokens for files
      if (entry?.type === 'file') {
        sum += entry.tokens ?? 0;
      }
    });
    setTotalTokens(sum);
  }, [selectedPaths, files, findEntry]);

  // Update handleSelectDirectory to remove manual token calculation
  const handleSelectDirectory = useCallback((item: FileEntry, selected: boolean) => {
    // First expand the directory
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(item.path);
        // Also expand all subdirectories
        function expandSubdirs(entry: FileEntry) {
          if (entry.type === 'directory' && entry.children) {
            next.add(entry.path);
            entry.children.forEach(expandSubdirs);
          }
        }
        expandSubdirs(item);
      }
      return next;
    });

    // Then update selections
    setSelectedPaths(prev => {
      const next = new Set(prev);
      
      function processEntry(entry: FileEntry) {
        if (entry.type === 'directory') {
          // Add/remove directory itself for visual tracking
          if (selected) {
            next.add(entry.path);
          } else {
            next.delete(entry.path);
          }
          
          // Process children
          if (entry.children) {
            entry.children.forEach(processEntry);
          }
        } else if (entry.type === 'file') {
          // Skip excluded file types
          const ext = entry.name.split('.').pop()?.toLowerCase();
          const excludedExtensions = ['.ico', '.woff', '.woff2', '.ttf', '.png', '.svg', '.eot'];
          if (ext && excludedExtensions.includes(`.${ext}`)) {
            return;
          }
          
          if (selected) {
            next.add(entry.path);
          } else {
            next.delete(entry.path);
          }
        }
      }

      processEntry(item);
      return next;
    });
  }, [files, findEntry]);

  // Update the selected files display to only show files
  const selectedFilePaths = Array.from(selectedPaths).filter(path => {
    const entry = findEntry(path, files);
    return entry?.type === 'file';
  });

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

  // Update handleExport to use XML
  const handleExport = useCallback(async (download: boolean) => {
    setIsExporting(true);
    try {
      let contents: Record<string, string> = {};
      
      if (includeContents) {
        const response = await fetch('/api/file-contents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: Array.from(selectedPaths) })
        });
        
        if (!response.ok) throw new Error('Failed to fetch file contents');
        contents = await response.json();
      }

      const xml = generateXMLPrompt(
        selectedPaths,
        files,
        contents,
        promptsList,
        prompt
      );

      if (download) {
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompt-${new Date().toISOString().split('T')[0]}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        await navigator.clipboard.writeText(xml);
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  }, [selectedPaths, files, includeContents, promptsList, prompt]);

  const handleCreateFile = async () => {
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
      
      // Refresh files using handleLoadRepository
      await handleLoadRepository();
      
      // Reset form
      setShowCreateForm(false);
      setNewFilePath('');
      setNewFileContent('');
    } catch (error) {
      console.error('Error creating file:', error);
      alert(error instanceof Error ? error.message : 'Failed to create file');
    }
  };

  async function handleCreatePrompt() {
    if (!newPromptName.trim() || !newPromptContent.trim()) {
      alert('Filename and content are required.');
      return;
    }

    try {
      const filename = newPromptName.endsWith('.md') ? newPromptName : `${newPromptName}.md`;
      console.log('Creating prompt:', filename);

      const response = await fetch('/api/upload-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          content: newPromptContent
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create prompt');
      }

      console.log('Prompt created successfully:', data);
      alert('Prompt created successfully!');
      setShowPromptModal(false);
      setNewPromptName('');
      setNewPromptContent('');
      await fetchPrompts();
    } catch (error) {
      console.error('Error creating prompt:', error);
      alert(error instanceof Error ? error.message : 'Failed to create prompt');
    }
  }

  // Add fetchPrompts function
  const fetchPrompts = useCallback(async () => {
    try {
      const response = await fetch('/api/prompts');
      if (!response.ok) {
        throw new Error('Failed to fetch prompts');
      }
      const data = await response.json();
      setPromptsList(data || []);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      setPromptsError(error instanceof Error ? error.message : 'Failed to fetch prompts');
    }
  }, []);

  // Add useEffect to fetch prompts
  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Add fetchPublicRepos function
  const fetchPublicRepos = useCallback(async (username: string) => {
    setIsRepoLoading(true);
    setError(null);
    
    try {
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
      };

      // Add GitHub token if available
      if (process.env.NEXT_PUBLIC_GITHUB_TOKEN) {
        headers.Authorization = `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`;
      }

      const response = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=100`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`GitHub API responded with status ${response.status}`);
      }

      const repos = await response.json();
      setPublicRepos(repos.map((repo: any) => ({
        name: repo.name,
        description: repo.description
      })));
    } catch (error) {
      console.error('Error fetching repos:', error);
      setError(`Failed to fetch repositories for ${username}`);
    } finally {
      setIsRepoLoading(false);
    }
  }, []);

  // Add handleGenerate function
  const handleGenerate = async () => {
    if (!prompt.trim() || selectedPaths.size === 0) return;

    try {
      // First fetch contents for selected files
      const response = await fetch('/api/file-contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paths: Array.from(selectedPaths),
          owner: repoOwner,
          repo: repoName
        })
      });

      const fileContents = await response.json();

      // Then send to AI chat with contents included
      const selectedFiles = Array.from(selectedPaths).map(path => ({
        path,
        content: fileContents[path] || '',
        tokens: files.find(f => f.path === path)?.tokens || 0
      }));

      const aiResponse = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, files: selectedFiles })
      });

      if (!aiResponse.ok) throw new Error('Failed to generate response');
      const data = await aiResponse.json();
      console.log('AI Response:', data);
    } catch (error) {
      console.error('Error generating response:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate response');
    }
  };

  // Add handler for prompt selection
  const handlePromptSelect = useCallback(async (promptId: string) => {
    try {
      const response = await fetch(`/api/get-prompt?id=${promptId}`);
      if (!response.ok) throw new Error('Failed to fetch prompt');
      
      const prompt = await response.json();
      setPrompt(prompt.content);
      setSelectedPromptId(promptId);
    } catch (error) {
      console.error('Error selecting prompt:', error);
    }
  }, []);

  // Add section rendering component
  const PromptSection = ({ 
    title, 
    prompts, 
    selectedId, 
    onSelect,
    onNewPrompt 
  }: { 
    title: string;
    prompts: Prompt[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onNewPrompt?: () => void;
  }) => (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </h2>
        {onNewPrompt && (
          <button
            onClick={onNewPrompt}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
            title={`New ${title}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
      {prompts.length === 0 ? (
        <div className="text-sm text-gray-500 italic">
          No {title.toLowerCase()} created yet
        </div>
      ) : (
        <ul className="space-y-1">
          {prompts.map((prompt) => (
            <li 
              key={prompt.id}
              onClick={() => onSelect(prompt.id)}
              className={`group flex items-center gap-2 text-sm p-2 rounded cursor-pointer
                ${selectedId === prompt.id ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
              <span className={`text-gray-700 ${selectedId === prompt.id ? 'font-medium' : ''}`}>
                {prompt.filename}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {new Date(prompt.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Update the copy to clipboard handler
  const handleCopyToClipboard = useCallback(async () => {
    const addLog = (msg: string) => {
      console.log(msg);
      setDebugLogs(prev => [...prev, msg]);
    };

    try {
      setIsExporting(true);
      const selectedPathsArray = Array.from(selectedPaths);
      addLog(`Starting copy process with ${selectedPathsArray.length} files`);

      // Get repo info from state or props
      const currentRepoOwner = repoOwner || 'golfballnut';
      const currentRepoName = repoName || 'agenthub';

      addLog(`Using repo: ${currentRepoOwner}/${currentRepoName}`);

      // First fetch contents for selected files
      const requestBody = {
        paths: selectedPathsArray,
        owner: currentRepoOwner,
        repo: currentRepoName,
        branch: 'main'
      };

      addLog('Sending API request...');
      const response = await fetch('/api/file-contents', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      addLog(`API response status: ${response.status}`);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `API error: ${response.status}`);
      }

      const fileContents = responseData as Record<string, string>;
      addLog(`Received contents for ${Object.keys(fileContents).length} files`);

      // Generate XML with the fetched contents
      const xmlContent = generateXMLPrompt(
        selectedPaths,
        files,
        fileContents,
        promptsList,
        prompt || ''
      );

      await navigator.clipboard.writeText(xmlContent);
      addLog('Content copied to clipboard successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [selectedPaths, files, promptsList, prompt, repoOwner, repoName]);

  if (loading) {
    console.log('Loading is true, showing loading state...');
    return (
      <div className="min-h-screen flex bg-gray-100">
        <div className="w-14 bg-gray-900" />
        <div className="flex-1 animate-pulse p-4">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    );
  }
  
  if (error) {
    console.log('Error encountered:', error);
    return (
      <div className="min-h-screen flex bg-gray-100">
        <div className="w-14 bg-gray-900" />
        <div className="flex-1 p-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  console.log('Rendering main dashboard UI...');
  console.log('Current state:', {
    filesCount: files.length,
    selectedCount: selectedPaths.size,
    totalTokens,
    loading,
    error
  });

  // Debug UI - uncomment to test basic rendering
  // return (
  //   <div className="min-h-screen flex bg-gray-100 p-4">
  //     <h1 className="text-2xl font-bold">Dashboard Debug View</h1>
  //     <div className="mt-4 space-y-2">
  //       <p>Files loaded: {files.length}</p>
  //       <p>Selected files: {selectedPaths.size}</p>
  //       <p>Total tokens: {totalTokens}</p>
  //     </div>
  //   </div>
  // );

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

      {/* Main flex container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with dynamic width */}
        <div 
          style={{ width: sidebarWidth }} 
          className="bg-gray-50 border-r border-gray-300 overflow-auto flex-shrink-0"
        >
          {/* Repository Selector */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="space-y-4">
              {/* Owner input and repo loader */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Repository Owner
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.target.value)}
                      placeholder="e.g., golfballnut"
                      className="flex-1 px-3 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => fetchPublicRepos(repoOwner.trim())}
                      disabled={isRepoLoading || !repoOwner.trim()}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2
                        ${isRepoLoading || !repoOwner.trim()
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                    >
                      {isRepoLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Loading...
                        </>
                      ) : 'Load Repos'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Repository selector */}
              {publicRepos.length > 0 && (
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Repository
                    </label>
                    <select
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select a repository</option>
                      {publicRepos.map((repo) => (
                        <option key={repo.name} value={repo.name}>
                          {repo.name} {repo.description ? `- ${repo.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleLoadRepository}
                    disabled={isLoadingRepo || !repoOwner.trim() || !repoName.trim()}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2
                      ${isLoadingRepo || !repoOwner.trim() || !repoName.trim()
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                  >
                    {isLoadingRepo ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Load Repository
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Existing sidebar content */}
          <div className="p-4">
            {/* Explorer Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Explorer
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPromptModal(true)}
                  className="p-1 hover:bg-gray-200 rounded text-gray-600"
                  title="New Prompt"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
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
            </div>

            {/* FileTree Component */}
            <FileTree
              items={files}
              onToggleSelect={handleToggleSelect}
              selectedPaths={selectedPaths}
              expandedPaths={expandedPaths}
              onToggleExpand={handleToggleExpand}
            />

            {/* Prompts List */}
            <div className="mt-8">
              {promptsError ? (
                <div className="text-sm text-red-500">
                  Error loading prompts: {promptsError}
                </div>
              ) : (
                <>
                  <PromptSection
                    title="Prompts"
                    prompts={promptsList.filter(p => !p.prompt || p.prompt === 'prompt')}
                    selectedId={selectedPromptId}
                    onSelect={handlePromptSelect}
                    onNewPrompt={() => setShowPromptModal(true)}
                  />
                  <PromptSection
                    title="PRD"
                    prompts={promptsList.filter(p => p.prompt === 'prd')}
                    selectedId={selectedPromptId}
                    onSelect={handlePromptSelect}
                  />
                  <PromptSection
                    title="Instructions"
                    prompts={promptsList.filter(p => p.prompt === 'instructions')}
                    selectedId={selectedPromptId}
                    onSelect={handlePromptSelect}
                  />
                  <PromptSection
                    title="Examples"
                    prompts={promptsList.filter(p => p.prompt === 'example')}
                    selectedId={selectedPromptId}
                    onSelect={handlePromptSelect}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDownResize}
          className="w-1 hover:w-2 bg-transparent hover:bg-blue-500/10 cursor-col-resize flex-shrink-0 transition-all"
          title="Drag to resize"
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Prompt Area */}
          <div className="border-b border-gray-300 p-4 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-700">Prompt</h2>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                  {countPromptTokens(prompt)} tokens
                </span>
                <button 
                  onClick={handleGenerate}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
                  disabled={selectedPaths.size === 0 || !prompt.trim()}
                >
                  Generate
                </button>
              </div>
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
                        onClick={handleCopyToClipboard}
                        disabled={isExporting}
                        className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isExporting ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
                  {selectedFilePaths.map(path => {
                    const entry = findEntry(path, files);
                    return (
                      <div key={path} className="bg-white border rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
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

      {/* Prompt Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Create New Prompt</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Prompt Name
                </label>
                <input
                  type="text"
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  placeholder="e.g., o1_prompt"
                  className="mt-1 block w-full rounded-md 
                           bg-white text-gray-900 
                           border border-gray-300
                           shadow-sm focus:border-blue-500 focus:ring-blue-500
                           placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Content
                </label>
                <textarea
                  value={newPromptContent}
                  onChange={(e) => setNewPromptContent(e.target.value)}
                  rows={8}
                  className="mt-1 block w-full rounded-md 
                           bg-white text-gray-900 
                           border border-gray-300
                           shadow-sm focus:border-blue-500 focus:ring-blue-500
                           font-mono placeholder-gray-400"
                  placeholder="# Prompt Content

Write your markdown here..."
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 
                         bg-white border border-gray-300 rounded-md 
                         hover:bg-gray-50 focus:outline-none focus:ring-2 
                         focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePrompt}
                className="px-4 py-2 text-sm font-medium text-white 
                         bg-blue-600 rounded-md hover:bg-blue-700 
                         focus:outline-none focus:ring-2 focus:ring-offset-2 
                         focus:ring-blue-500"
              >
                Create Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 max-w-md bg-white p-4 rounded-lg shadow-lg border border-gray-200 overflow-auto max-h-60">
          <h4 className="font-medium text-sm mb-2">Debug Logs</h4>
          <div className="space-y-1 text-xs">
            {debugLogs.map((log, i) => (
              <div key={i} className="text-gray-600">{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

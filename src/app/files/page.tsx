'use client';

import React, { useCallback, useEffect, useState } from 'react';

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

export default function FilesPage() {
  const [files, setFiles] = useState<FileSystemEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch directory structure
  useEffect(() => {
    async function fetchFiles() {
      try {
        const response = await fetch('/api/files');
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

  // Fetch file content when a file is selected
  useEffect(() => {
    async function fetchFileContent() {
      if (!selectedFile) return;
      
      try {
        const response = await fetch(`/api/file?path=${encodeURIComponent(selectedFile)}`);
        if (!response.ok) throw new Error('Failed to fetch file content');
        const data = await response.json();
        setFileContent(data.content);
      } catch (err) {
        setError('Failed to load file content');
        console.error(err);
      }
    }
    fetchFileContent();
  }, [selectedFile]);

  // Save file content
  const handleSave = async () => {
    if (!selectedFile) return;

    try {
      const response = await fetch('/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedFile,
          content: fileContent,
        }),
      });

      if (!response.ok) throw new Error('Failed to save file');
      alert('File saved successfully!');
    } catch (err) {
      setError('Failed to save file');
      console.error(err);
    }
  };

  // Recursive component for rendering directory tree
  const FileTree = useCallback(({ items }: { items: FileSystemEntry[] }) => {
    return (
      <ul className="pl-4">
        {items.map((item) => (
          <li key={item.path} className="py-1">
            {item.type === 'directory' ? (
              <div>
                <span className="font-medium">{item.name}/</span>
                <FileTree items={item.children} />
              </div>
            ) : (
              <button
                onClick={() => setSelectedFile(item.path)}
                className={`text-left hover:text-blue-500 ${
                  selectedFile === item.path ? 'text-blue-500 font-medium' : ''
                }`}
              >
                {item.name}
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }, [selectedFile]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-1/4 border-r p-4 overflow-auto">
        <h2 className="text-lg font-bold mb-4">Files</h2>
        <FileTree items={files} />
      </div>

      {/* Editor */}
      <div className="flex-1 p-4 flex flex-col">
        {selectedFile ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">{selectedFile}</h2>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-sm border rounded"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="text-gray-500 text-center mt-20">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
} 
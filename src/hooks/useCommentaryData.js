import { useState } from 'react';

export const useCommentaryData = () => {
  const [commentaryData, setCommentaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('unknown');

  // Check server status
  const checkServerStatus = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setServerStatus(data.env.apiKeySet ? 'online' : 'no-api-key');
        return data.env.apiKeySet;
      } else {
        setServerStatus('offline');
        return false;
      }
    } catch (err) {
      console.error('Server health check failed:', err);
      setServerStatus('offline');
      return false;
    }
  };

  // Fetch commentary data
  const fetchCommentary = async (book, chapter) => {
    setIsLoading(true);
    setError('');
    
    // Check server status first
    const isServerOnline = await checkServerStatus();
    if (!isServerOnline) {
      setError(serverStatus === 'no-api-key' 
        ? 'OpenAI API key is not configured on the server' 
        : 'Cannot connect to the server');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/tools/bible-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book, chapter })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to get commentary');
      }

      const data = await response.json();
      
      // Process the data into a structured format
      setCommentaryData({
        book,
        chapter,
        content: data.commentary,
        sections: extractSections(data.commentary),
        keyVerses: extractKeyVerses(data.commentary),
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      console.error('Error fetching commentary:', err);
      setError(err.message || 'An unexpected error occurred');
      setCommentaryData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to extract sections from markdown
  const extractSections = (markdown) => {
    const sections = [];
    const lines = markdown.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        sections.push({
          title: line.replace('## ', ''),
          level: 2
        });
      } else if (line.startsWith('### ')) {
        sections.push({
          title: line.replace('### ', ''),
          level: 3
        });
      }
    }
    
    return sections;
  };

  // Helper function to extract key verses (looking for verse references)
  const extractKeyVerses = (markdown) => {
    const verses = [];
    const verseRegex = /([1-9][0-9]?):([1-9][0-9]?(?:-[1-9][0-9]?)?)/g;
    let match;
    
    while ((match = verseRegex.exec(markdown)) !== null) {
      verses.push(match[0]);
    }
    
    return [...new Set(verses)]; // Remove duplicates
  };

  return {
    commentaryData,
    isLoading,
    error,
    serverStatus,
    fetchCommentary,
    checkServerStatus
  };
}; 
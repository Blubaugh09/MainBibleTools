import { useState } from 'react';

export const useVerseAnalysis = () => {
  const [analysisData, setAnalysisData] = useState(null);
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

  // Analyze verse
  const analyzeVerse = async (verse) => {
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
      const response = await fetch('/api/tools/verse-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verse })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to analyze verse');
      }

      const data = await response.json();
      
      // Process the data into a structured format
      setAnalysisData({
        verse,
        content: data.analysis,
        sections: extractSections(data.analysis),
        relatedVerses: extractRelatedVerses(data.analysis),
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      console.error('Error analyzing verse:', err);
      setError(err.message || 'An unexpected error occurred');
      setAnalysisData(null);
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

  // Helper function to extract related verse references
  const extractRelatedVerses = (markdown) => {
    const verses = [];
    // Look for common Bible reference patterns like "Matthew 5:3-10" or "John 3:16"
    const verseRegex = /([1-3]?(?:\s?[A-Za-z]+))\s+(\d+):(\d+(?:-\d+)?)/g;
    let match;
    
    while ((match = verseRegex.exec(markdown)) !== null) {
      verses.push(match[0]);
    }
    
    return [...new Set(verses)]; // Remove duplicates
  };

  return {
    analysisData,
    isLoading,
    error,
    serverStatus,
    analyzeVerse,
    checkServerStatus
  };
}; 
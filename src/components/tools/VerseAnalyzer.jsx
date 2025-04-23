import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const VerseAnalyzer = () => {
  const [verseInput, setVerseInput] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const analysisRef = useRef(null);

  // Check if the server is running when the component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          console.log('Server health check for Verse Analyzer:', data);
          setServerStatus('online');
          
          if (!data.env.apiKeySet) {
            setError('OpenAI API key is not configured on the server');
          }
        } else {
          setServerStatus('offline');
          setError('Cannot connect to the server');
        }
      } catch (err) {
        console.error('Server health check failed:', err);
        setServerStatus('offline');
        setError('Cannot connect to the server. Make sure to run "npm run server"');
      }
    };

    checkServerHealth();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!verseInput.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot analyze verse: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setAnalysis('');

    try {
      console.log(`Analyzing verse: ${verseInput}`);
      const response = await fetch('/api/tools/verse-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verse: verseInput
        }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to analyze verse');
      }

      const data = await response.json();
      console.log('Received analysis:', data);
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Error analyzing verse:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Status indicators */}
      {error && (
        <div className="px-4 py-2 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}
      
      {serverStatus === 'checking' && (
        <div className="px-4 py-2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 text-sm">
          <span className="font-bold">Connecting...</span> Checking server status
        </div>
      )}
      
      {serverStatus === 'offline' && !error && (
        <div className="px-4 py-2 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm">
          <span className="font-bold">Offline:</span> Server is not running
        </div>
      )}
      
      {/* Input area */}
      <div className="p-4 bg-gray-50 border-b">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="verse-input" className="block text-sm font-medium text-gray-700 mb-1">Enter Bible Verse or Reference</label>
            <textarea
              id="verse-input"
              value={verseInput}
              onChange={(e) => setVerseInput(e.target.value)}
              placeholder="Enter a Bible verse (e.g., 'For God so loved the world...') or a reference (e.g., 'John 3:16')"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-24"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              You can enter the full verse text or just the reference (e.g., "John 3:16").
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !verseInput.trim() || serverStatus !== 'online'}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Verse'}
          </button>
        </form>
      </div>
      
      {/* Analysis content area */}
      <div className="flex-1 p-4 h-[400px] overflow-y-auto" ref={analysisRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
          </div>
        ) : analysis ? (
          <div className="prose max-w-none">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Verse Analysis</h2>
            <div className="bg-purple-50 p-3 rounded border border-purple-100 mb-4">
              <p className="font-medium text-purple-800">{verseInput}</p>
            </div>
            <div className="markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-md font-bold mb-1" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1" {...props} />,
                  a: ({node, ...props}) => <a className="text-purple-600 hover:underline" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />,
                  code: ({node, inline, ...props}) => 
                    inline 
                      ? <code className="bg-gray-100 text-sm rounded px-1 py-0.5" {...props} />
                      : <pre className="bg-gray-100 p-2 rounded my-2 overflow-x-auto"><code {...props} /></pre>
                }}
              >
                {analysis}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-500">Enter a Bible verse or reference to analyze</p>
            <p className="text-gray-400 text-sm mt-2">Get detailed insights on meanings, context, and applications</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerseAnalyzer; 
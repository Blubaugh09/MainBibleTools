import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const VerseAnalyzer = ({
  currentVerse = '',
  analysisData = null,
  isLoading = false,
  error = '',
  serverStatus = 'checking',
  onVerseChange,
  onSubmit
}) => {
  const analysisRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentVerse.trim()) return;
    await onSubmit(currentVerse);
  };

  // Render related verses if available
  const renderRelatedVerses = () => {
    if (!analysisData || !analysisData.relatedVerses || analysisData.relatedVerses.length === 0) {
      return null;
    }

    return (
      <div className="mt-4 p-3 bg-purple-50 rounded border border-purple-100">
        <h3 className="text-md font-medium text-purple-800 mb-2">Related Verses</h3>
        <div className="flex flex-wrap gap-2">
          {analysisData.relatedVerses.map((verse, index) => (
            <span 
              key={index} 
              className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm cursor-pointer hover:bg-purple-200"
            >
              {verse}
            </span>
          ))}
        </div>
      </div>
    );
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
              value={currentVerse}
              onChange={(e) => onVerseChange(e.target.value)}
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
            disabled={isLoading || !currentVerse.trim() || serverStatus !== 'online'}
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
        ) : analysisData ? (
          <div className="prose max-w-none">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Verse Analysis</h2>
            <div className="bg-purple-50 p-3 rounded border border-purple-100 mb-4">
              <p className="font-medium text-purple-800">{analysisData.verse}</p>
            </div>
            
            {renderRelatedVerses()}
            
            <div className="markdown-content mt-4">
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
                {analysisData.content}
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
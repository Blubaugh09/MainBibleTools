import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';

const VerseAnalyzer = () => {
  const [verseInput, setVerseInput] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const analysisRef = useRef(null);
  const { currentUser } = useAuth();

  // Auto-scroll to bottom when analysis or conversation history changes
  useEffect(() => {
    analysisRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analysis, conversationHistory]);

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

  // Save conversation to Firestore
  const saveConversationToFirestore = async (updatedHistory) => {
    try {
      if (!currentUser) {
        console.log('User not logged in, cannot save conversation history');
        return;
      }

      // Format messages for storing
      const formattedMessages = updatedHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date().toISOString()
      }));

      // If this is a new conversation
      if (!currentConversationId) {
        // Create a title from the verse reference or the first part of the verse
        const newTitle = verseInput.length > 50 
          ? verseInput.substring(0, 47) + '...' 
          : verseInput;
        
        // Create a new conversation document
        const docRef = await addDoc(collection(db, 'mainBibleTools_verseAnalyzer'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          title: newTitle,
          verse: verseInput,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          messages: formattedMessages
        });
        
        setCurrentConversationId(docRef.id);
        console.log('Created new verse analysis conversation with ID:', docRef.id);
      } else {
        // Get the existing conversation document
        const conversationRef = doc(db, 'mainBibleTools_verseAnalyzer', currentConversationId);
        const conversationSnap = await getDoc(conversationRef);
        
        if (conversationSnap.exists()) {
          // Update the existing conversation with new messages
          await updateDoc(conversationRef, {
            messages: formattedMessages,
            updatedAt: serverTimestamp()
          });
          
          console.log('Updated verse analysis conversation:', currentConversationId);
        } else {
          console.error('Conversation document not found');
          // If the conversation was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_verseAnalyzer'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            title: verseInput.length > 50 ? verseInput.substring(0, 47) + '...' : verseInput,
            verse: verseInput,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            messages: formattedMessages
          });
          
          setCurrentConversationId(docRef.id);
          console.log('Created replacement conversation with ID:', docRef.id);
        }
      }
    } catch (err) {
      console.error('Error saving verse analysis to Firestore:', err);
      // Don't show this error to user as it's not critical to functionality
    }
  };

  // Reset conversation - use when analyzing a new verse
  const resetConversation = () => {
    setConversationHistory([]);
    setAnalysis('');
    setCurrentConversationId(null);
  };

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
    
    // Clear any previous conversation when analyzing a new verse
    resetConversation();

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
      
      // Add the initial request to conversation history
      const newHistory = [
        { role: 'user', content: `Analyze this verse: ${verseInput}` },
        { role: 'assistant', content: data.analysis }
      ];
      setConversationHistory(newHistory);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        saveConversationToFirestore(newHistory);
      }
    } catch (error) {
      console.error('Error analyzing verse:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowupSubmit = async (e) => {
    e.preventDefault();
    if (!followupQuestion.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot send follow-up: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    
    // Add user question to conversation history
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: followupQuestion }
    ];
    setConversationHistory(updatedHistory);
    setFollowupQuestion('');

    try {
      console.log(`Sending follow-up question about verse: ${verseInput}...`);
      const response = await fetch('/api/chat/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a Bible scholar specializing in detailed verse analysis. The user has asked about this verse: "${verseInput}".
              Provide helpful, insightful answers to follow-up questions about this verse, its meaning, context, and applications.
              Use markdown formatting for clear sections. Your responses should be educational, insightful, and respectful of various 
              interpretations.`
            },
            ...updatedHistory
          ]
        }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to get response');
      }

      const data = await response.json();
      console.log('Received follow-up response:', data);
      
      // Add the assistant's response to conversation history
      const finalHistory = [
        ...updatedHistory,
        { role: 'assistant', content: data.message }
      ];
      setConversationHistory(finalHistory);
      
      // Save updated conversation to Firestore
      if (currentUser) {
        saveConversationToFirestore(finalHistory);
      }
    } catch (error) {
      console.error('Error getting follow-up response:', error);
      setError(error.message || 'An unexpected error occurred');
      
      // Add error message to conversation
      const finalHistory = [
        ...updatedHistory,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ];
      setConversationHistory(finalHistory);
      
      // Still save the conversation with the error message
      if (currentUser) {
        saveConversationToFirestore(finalHistory);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Determine if we're showing initial analysis or follow-up conversation
  const hasConversation = conversationHistory.length > 0;

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
      
      {/* User authentication notice */}
      {!currentUser && (
        <div className="px-4 py-2 bg-blue-100 border-l-4 border-blue-500 text-blue-700 text-sm">
          <span className="font-bold">Note:</span> Analysis history will not be saved since you're not logged in
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
        {isLoading && !hasConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
          </div>
        ) : hasConversation ? (
          <div className="prose max-w-none mb-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Verse Analysis</h2>
            <div className="bg-purple-50 p-3 rounded border border-purple-100 mb-4">
              <p className="font-medium text-purple-800">{verseInput}</p>
            </div>
            
            <div className="space-y-6">
              {conversationHistory.map((msg, index) => (
                <div key={index} className={`${msg.role === 'user' ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100'} border rounded-lg p-4`}>
                  <p className="text-xs text-gray-500 mb-1">
                    {msg.role === 'user' ? 'You asked:' : 'Response:'}
                  </p>
                  {msg.role === 'assistant' ? (
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
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Response:</p>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                    <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Follow-up question input */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <form onSubmit={handleFollowupSubmit} className="flex space-x-2">
                <input
                  type="text"
                  value={followupQuestion}
                  onChange={(e) => setFollowupQuestion(e.target.value)}
                  placeholder="Ask a follow-up question about this verse..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isLoading || serverStatus !== 'online'}
                />
                <button
                  type="submit"
                  disabled={isLoading || !followupQuestion.trim() || serverStatus !== 'online'}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : "Ask"}
                </button>
              </form>
            </div>
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
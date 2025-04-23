import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function VerseAnalyzer() {
  const [verseInput, setVerseInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [followUpInput, setFollowUpInput] = useState('');
  const messagesEndRef = useRef(null);

  // Initialize or reset a conversation
  const startNewConversation = () => {
    const newConversation = {
      id: Date.now(),
      verse: '',
      messages: []
    };
    setConversations([...conversations, newConversation]);
    setActiveConversation(newConversation.id);
    setVerseInput('');
    setFollowUpInput('');
  };

  // Handle selecting a past conversation
  const selectConversation = (id) => {
    setActiveConversation(id);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations]);

  // Start with a new conversation if none exists
  useEffect(() => {
    if (conversations.length === 0) {
      startNewConversation();
    }
  }, []);

  const handleSubmitVerse = async (e) => {
    e.preventDefault();
    if (!verseInput.trim()) return;

    // Get the current conversation
    const currentConversation = conversations.find(c => c.id === activeConversation);
    if (!currentConversation) return;

    // Update the verse in the current conversation
    const updatedConversation = {
      ...currentConversation,
      verse: verseInput,
      messages: [
        ...currentConversation.messages,
        { role: 'user', content: `Analyze this verse: ${verseInput}` }
      ]
    };

    // Update the conversations state
    const updatedConversations = conversations.map(c => 
      c.id === activeConversation ? updatedConversation : c
    );
    setConversations(updatedConversations);
    
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/tools/verse-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verse: verseInput })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error analyzing verse');
      }

      const data = await response.json();
      
      // Add the assistant's response to the conversation
      const conversationWithResponse = {
        ...updatedConversation,
        messages: [
          ...updatedConversation.messages,
          { role: 'assistant', content: data.analysis }
        ]
      };

      // Update conversations state with the response
      const conversationsWithResponse = conversations.map(c => 
        c.id === activeConversation ? conversationWithResponse : c
      );
      setConversations(conversationsWithResponse);
      setVerseInput('');
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpInput.trim()) return;

    // Get the current conversation
    const currentConversation = conversations.find(c => c.id === activeConversation);
    if (!currentConversation || !currentConversation.verse) {
      setError('Please submit a verse first');
      return;
    }

    // Add the follow-up question to the conversation
    const updatedConversation = {
      ...currentConversation,
      messages: [
        ...currentConversation.messages,
        { role: 'user', content: followUpInput }
      ]
    };

    // Update the conversations state
    const updatedConversations = conversations.map(c => 
      c.id === activeConversation ? updatedConversation : c
    );
    setConversations(updatedConversations);
    
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/tools/verse-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          verse: currentConversation.verse,
          conversationHistory: currentConversation.messages
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error processing follow-up question');
      }

      const data = await response.json();
      
      // Add the assistant's response to the conversation
      const conversationWithResponse = {
        ...updatedConversation,
        messages: [
          ...updatedConversation.messages,
          { role: 'assistant', content: data.analysis }
        ]
      };

      // Update conversations state with the response
      const conversationsWithResponse = conversations.map(c => 
        c.id === activeConversation ? conversationWithResponse : c
      );
      setConversations(conversationsWithResponse);
      setFollowUpInput('');
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get current conversation
  const currentConversation = conversations.find(c => c.id === activeConversation) || { messages: [] };

  return (
    <div className="verse-analyzer bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Verse Analyzer</h2>
        <button 
          onClick={startNewConversation}
          className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
        >
          New Analysis
        </button>
      </div>
      
      {/* Conversation selector */}
      {conversations.length > 1 && (
        <div className="mb-4 flex overflow-x-auto gap-2 pb-2">
          {conversations.map((convo) => (
            <button 
              key={convo.id}
              onClick={() => selectConversation(convo.id)}
              className={`whitespace-nowrap px-3 py-1 rounded text-sm border ${
                activeConversation === convo.id 
                  ? 'bg-indigo-100 border-indigo-500 text-indigo-800' 
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {convo.verse ? convo.verse.substring(0, 20) + (convo.verse.length > 20 ? '...' : '') : 'New Analysis'}
            </button>
          ))}
        </div>
      )}
      
      {/* Verse input form */}
      <form onSubmit={handleSubmitVerse} className="mb-4">
        <div className="flex">
          <input
            type="text"
            value={verseInput}
            onChange={(e) => setVerseInput(e.target.value)}
            placeholder="Enter Bible verse or reference (e.g., 'John 3:16' or 'Romans 8:28')"
            className="flex-grow border rounded-l p-2 text-sm"
            disabled={isLoading || (currentConversation.messages.length > 0 && currentConversation.verse)}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700 disabled:bg-gray-400"
            disabled={isLoading || !verseInput.trim() || (currentConversation.messages.length > 0 && currentConversation.verse)}
          >
            Analyze
          </button>
        </div>
      </form>
      
      {/* Messages display */}
      <div className="flex-grow overflow-y-auto mb-4 border rounded p-3 bg-gray-50">
        {currentConversation.messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Enter a Bible verse or reference above to get a detailed analysis.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentConversation.messages.map((message, index) => (
              <div key={index} className={`p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-indigo-100 text-indigo-900 ml-8' 
                  : 'bg-white border border-gray-200 mr-8 shadow-sm'
              }`}>
                <p className="text-xs text-gray-500 mb-1">
                  {message.role === 'user' ? 'You' : 'Bible Scholar'}
                </p>
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {isLoading && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mt-4">
            <p>Error: {error}</p>
          </div>
        )}
      </div>
      
      {/* Follow-up question input */}
      {currentConversation.messages.length > 0 && currentConversation.verse && (
        <form onSubmit={handleSubmitFollowUp} className="mt-2">
          <div className="flex">
            <input
              type="text"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              placeholder="Ask a follow-up question about this verse..."
              className="flex-grow border rounded-l p-2 text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-r hover:bg-green-700 disabled:bg-gray-400"
              disabled={isLoading || !followUpInput.trim()}
            >
              {isLoading ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </form>
      )}
      
      <div className="text-xs text-gray-500 mt-2">
        <p>Powered by GPT-4o-mini. Analysis may vary in accuracy.</p>
      </div>
    </div>
  );
} 
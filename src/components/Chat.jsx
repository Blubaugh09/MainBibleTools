import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Chat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Check server health on component mount
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'ok') {
          setServerStatus('online');
          
          // Check if API key is configured
          if (!data.apiKeyConfigured) {
            setError('OpenAI API key is not configured. The chat will not work.');
          }
        } else {
          setServerStatus('offline');
          setError('Server is experiencing issues. Please try again later.');
        }
      } catch (err) {
        console.error('Error checking server health:', err);
        setServerStatus('offline');
        setError('Cannot connect to server. Please ensure the server is running.');
      }
    };

    checkServerHealth();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || serverStatus !== 'online') return;
    
    const userMessage = input;
    setInput('');
    
    // Add user message to chat
    setMessages(prevMessages => [...prevMessages, { type: 'user', text: userMessage }]);
    
    // Set loading state
    setLoading(true);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, history: messages.map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.text
        })) }),
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Add assistant response to chat
      setMessages(prevMessages => [...prevMessages, { type: 'assistant', text: data.message }]);
      
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prevMessages => [...prevMessages, { type: 'error', text: 'Error: Failed to get response. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container bg-white rounded-lg shadow-md p-4 w-full max-w-3xl mx-auto overflow-hidden flex flex-col h-full" style={{ minHeight: '450px' }}>
      {/* Server status */}
      <div className="mb-4">
        {serverStatus === 'checking' && <p className="text-yellow-500">Checking server status...</p>}
        {serverStatus === 'offline' && <p className="text-red-500">Server is offline. Chat functionality is unavailable.</p>}
        {error && <p className="text-red-500">{error}</p>}
      </div>

      {/* Chat messages area */}
      <div className="flex-grow overflow-y-auto p-2 mb-4">
        {messages.map((message, index) => (
          <div key={index} className={`mb-4 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block max-w-md p-3 rounded-lg ${message.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              {message.type === 'user' ? (
                <p>{message.text}</p>
              ) : message.type === 'assistant' ? (
                <div className="bg-gray-200 p-3 rounded-lg">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">
                    {message.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-red-500">{message.text}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-left mb-4">
            <div className="inline-block max-w-md p-3 rounded-lg bg-gray-200">
              <div className="flex items-center">
                <div className="loader mr-2"></div>
                <p>Thinking...</p>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="mt-auto">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            disabled={serverStatus !== 'online' || loading}
            className="flex-grow p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={serverStatus !== 'online' || loading}
            className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {loading ? (
              <span className="flex items-center">
                <span className="loader mr-1"></span>
                <span>...</span>
              </span>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat; 
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AdvancedChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if the server is running when the component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          console.log('Server health check for advanced chat:', data);
          setServerStatus('online');
          
          if (!data.env.apiKeySet) {
            setError('OpenAI API key is not configured on the server');
          }
        } else {
          setServerStatus('offline');
          setError('Cannot connect to the chat server');
        }
      } catch (err) {
        console.error('Server health check failed:', err);
        setServerStatus('offline');
        setError('Cannot connect to the chat server. Make sure to run "npm run server"');
      }
    };

    checkServerHealth();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot send message: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    
    // Add user message to chat
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');

    try {
      console.log('Sending advanced chat request...');
      const response = await fetch('/api/chat/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to get response');
      }

      const data = await response.json();
      console.log('Received advanced response:', data);
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Error in advanced chat:', error);
      setError(error.message || 'An unexpected error occurred');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again later.' 
      }]);
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
          <span className="font-bold">Offline:</span> Chat server is not running
        </div>
      )}
      
      {/* Chat messages area */}
      <div className="flex-1 p-4 h-[400px] overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-gray-500">Ask me anything using GPT-4o-mini</p>
            <p className="text-gray-400 text-sm mt-2">Try: "How can I apply biblical principles to my daily life?"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] px-4 py-3 rounded-lg 
                  ${msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}
                >
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
                          a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
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
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-500 rounded-lg px-4 py-3 rounded-bl-none max-w-[80%]">
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                    <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-grow px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Ask your Bible question..."
            disabled={isLoading || serverStatus !== 'online'}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || serverStatus !== 'online'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isLoading ? (
              <span className="flex items-center space-x-1">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            ) : (
              <span>Send</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdvancedChat; 
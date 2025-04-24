import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../firebase/AuthContext';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';

const AdvancedChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [chatTitle, setChatTitle] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const { currentUser } = useAuth();

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
          console.log('Server health check:', data);
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

  // Save message to Firestore
  const saveMessageToFirestore = async (userMessage, assistantMessage) => {
    try {
      if (!currentUser) {
        console.log('User not logged in, cannot save chat history');
        return;
      }

      // Format messages for storing
      const newMessages = [
        {
          role: 'user',
          content: userMessage.content,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: new Date().toISOString()
        }
      ];

      // If this is the first message in a new conversation
      if (!currentConversationId) {
        // Create a title from the first user message
        const newTitle = userMessage.content.length > 50 
          ? userMessage.content.substring(0, 47) + '...' 
          : userMessage.content;
        
        setChatTitle(newTitle);
        
        // Create a new conversation document
        const docRef = await addDoc(collection(db, 'mainBibleTools_advancedChat'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          title: newTitle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          model: 'gpt-4o-mini',
          messages: newMessages
        });
        
        setCurrentConversationId(docRef.id);
        console.log('Created new conversation with ID:', docRef.id);
      } else {
        // Get the existing conversation document
        const conversationRef = doc(db, 'mainBibleTools_advancedChat', currentConversationId);
        const conversationSnap = await getDoc(conversationRef);
        
        if (conversationSnap.exists()) {
          // Update the existing conversation with new messages
          const existingData = conversationSnap.data();
          const updatedMessages = [...(existingData.messages || []), ...newMessages];
          
          await updateDoc(conversationRef, {
            messages: updatedMessages,
            updatedAt: serverTimestamp()
          });
          
          console.log('Updated conversation:', currentConversationId);
        } else {
          console.error('Conversation document not found');
          // If the conversation was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_advancedChat'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            title: chatTitle || 'Continued conversation',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            model: 'gpt-4o-mini',
            messages: [...messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date().toISOString()
            })), ...newMessages]
          });
          
          setCurrentConversationId(docRef.id);
          console.log('Created replacement conversation with ID:', docRef.id);
        }
      }
    } catch (err) {
      console.error('Error saving chat to Firestore:', err);
      // Don't show this error to user as it's not critical to chat function
    }
  };

  // Reset conversation - use when starting a new chat
  const resetConversation = () => {
    setMessages([]);
    setChatTitle('');
    setCurrentConversationId(null);
  };

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
      console.log('Sending chat request...');
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
      console.log('Received response:', data);
      const assistantMessage = { role: 'assistant', content: data.message };
      setMessages(prev => [...prev, assistantMessage]);

      // Save chat history to Firestore
      if (currentUser) {
        saveMessageToFirestore(userMessage, assistantMessage);
      }
      
    } catch (error) {
      console.error('Error in chat:', error);
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
    <div className="w-full h-full flex flex-col bg-white rounded-xl shadow-lg overflow-hidden">
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

      {/* User authentication notice */}
      {!currentUser && (
        <div className="px-4 py-2 bg-blue-100 border-l-4 border-blue-500 text-blue-700 text-sm">
          <span className="font-bold">Note:</span> Chat history will not be saved since you're not logged in
        </div>
      )}
      
      {/* Chat header with reset button */}
      {messages.length > 0 && (
        <div className="px-4 py-2 bg-indigo-50 border-b border-gray-200 flex justify-between items-center">
          <div className="text-sm text-indigo-800 font-medium truncate">
            {chatTitle || 'Current conversation'}
          </div>
          <button 
            onClick={resetConversation}
            className="text-xs text-indigo-600 hover:text-indigo-800 bg-white px-2 py-1 rounded border border-indigo-200 transition-colors"
          >
            New Chat
          </button>
        </div>
      )}
      
      {/* Chat messages area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-gray-500">Welcome to Advanced Bible Chat</p>
            <p className="text-gray-400 text-sm mt-2">Try asking about theology, Bible history, or scripture analysis</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-lg 
                    ${msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-blue-100 text-gray-800 rounded-bl-none'}`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="markdown-content">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
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
                <div className="bg-blue-100 text-gray-500 rounded-lg px-4 py-3 rounded-bl-none max-w-[80%]">
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                    <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
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
            placeholder="Ask a more complex Bible question..."
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
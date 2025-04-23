import { useState, useEffect } from 'react';

export const useChatMessages = (chatType = 'regular') => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('unknown');

  // Determine API endpoint based on chat type
  const endpoint = chatType === 'advanced' ? '/api/chat/advanced' : '/api/chat';

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

  // Check server status on mount
  useEffect(() => {
    checkServerStatus();
  }, []);

  // Send message
  const sendMessage = async (messageText) => {
    setIsLoading(true);
    setError('');
    
    // Check server status first if unknown
    if (serverStatus === 'unknown') {
      await checkServerStatus();
    }
    
    if (serverStatus !== 'online') {
      setError(serverStatus === 'no-api-key' 
        ? 'OpenAI API key is not configured on the server' 
        : 'Cannot connect to the server');
      setIsLoading(false);
      return;
    }

    // Add user message to the chat
    const userMessage = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to get response');
      }

      const data = await response.json();
      
      // Add assistant's response to messages
      const assistantMessage = { 
        role: 'assistant', 
        content: data.message,
        metadata: {
          timestamp: new Date().toISOString(),
          model: chatType === 'advanced' ? 'gpt-4o-mini' : 'gpt-3.5-turbo'
        }
      };
      
      setMessages([...updatedMessages, assistantMessage]);
      
    } catch (err) {
      console.error('Error in chat:', err);
      setError(err.message || 'An unexpected error occurred');
      
      // Add error message from assistant
      setMessages([
        ...updatedMessages, 
        { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again later.',
          error: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear chat messages
  const clearMessages = () => {
    setMessages([]);
    setError('');
  };

  return {
    messages,
    isLoading,
    error,
    serverStatus,
    sendMessage,
    clearMessages,
    checkServerStatus
  };
}; 
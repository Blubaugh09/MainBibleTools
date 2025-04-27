import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../firebase/AuthContext';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import axios from 'axios';
import BibleVerseModal from './common/BibleVerseModal';
import { extractVerseReferences, containsVerseReferences } from './common/VerseReferenceParser';

// API base URL - use environment variable if available or default to relative path
// In Vite, environment variables are accessed via import.meta.env instead of process.env
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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
  
  // Bible verse modal state
  const [isVerseModalOpen, setIsVerseModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check server health when component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await axios.get(`${API_BASE_URL}/api/health`);
        
        // Axios response handling - data is directly available
        console.log('Server health check:', response.data);
        setServerStatus('online');
        
        if (!response.data.env.apiKeySet) {
          setError('OpenAI API key is not configured on the server');
        }
      } catch (err) {
        console.error('Server health check failed:', err);
        setServerStatus('offline');
        setError('Cannot connect to the chat server. Please verify the server is running.');
      }
    };

    checkServerHealth();
  }, [currentUser]);

  // Add a global style to ensure all verse references have consistent styling
  useEffect(() => {
    // Add a global click handler for verse references
    const handleGlobalVerseClick = (e) => {
      const target = e.target.closest('.verse-reference');
      if (target && target.dataset && target.dataset.verse) {
        handleVerseClick(target.dataset.verse);
      }
    };

    // Add a custom event handler for verse clicks
    const handleCustomVerseClick = (e) => {
      if (e.detail && e.detail.verse) {
        handleVerseClick(e.detail.verse);
      }
    };

    // Add event listeners
    document.addEventListener('click', handleGlobalVerseClick);
    document.addEventListener('verse-click', handleCustomVerseClick);
    
    // Cleanup
    return () => {
      document.removeEventListener('click', handleGlobalVerseClick);
      document.removeEventListener('verse-click', handleCustomVerseClick);
    };
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

  // Handle verse reference click
  const handleVerseClick = (verseRef) => {
    setSelectedVerse(verseRef);
    setIsVerseModalOpen(true);
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
      const response = await axios.post(`${API_BASE_URL}/api/chat/advanced`, {
        messages: [...messages, userMessage]
      });

      console.log('Response received:', response.data);
      
      // With axios, response.data is already parsed JSON
      const assistantMessage = { role: 'assistant', content: response.data.message };
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

  // Process content to identify all verse references
  const processContentWithVerseReferences = (content) => {
    if (!content || typeof content !== 'string') return content;
    
    if (!containsVerseReferences(content)) {
      return content;
    }

    const references = extractVerseReferences(content);
    
    // Sort references by length (descending) to handle overlapping references
    const sortedReferences = [...references].sort((a, b) => b.length - a.length);

    // Store the matches for each reference to avoid double-processing
    const matches = {};

    // First identify all references in the content 
    sortedReferences.forEach(ref => {
      // Escape special regex characters in the reference
      const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Use more precise regex that requires word boundaries to avoid capturing preceding words
      // This ensures we match "Genesis 3" but not include words like "in" before it
      const regex = new RegExp(`(^|\\s|[;:.,>"'])(${escapedRef})\\b`, 'g');
      
      // Find all matches in the content
      let match;
      matches[ref] = [];
      while ((match = regex.exec(content)) !== null) {
        // The actual reference is in the second capturing group
        const actualRef = match[2];
        const startIndex = match.index + match[1].length; // Skip the preceding character/space
        
        matches[ref].push({
          index: startIndex,
          length: actualRef.length,
          text: actualRef,
          fullMatch: match[0],
          beforeText: match[1]
        });
      }
    });
    
    // No references found in the actual content
    if (Object.values(matches).every(arr => arr.length === 0)) {
      return content;
    }
    
    // Process the content to replace references with clickable spans
    // We'll build a new string character by character
    let result = '';
    let skipTo = 0;
    
    for (let i = 0; i < content.length; i++) {
      // Skip if we've already processed this part
      if (i < skipTo) continue;
      
      // Check if any reference starts at this position
      let matched = false;
      
      for (const ref of sortedReferences) {
        for (const match of matches[ref]) {
          if (match.index === i) {
            // Create a clickable span for this reference
            const span = `<span class="verse-reference" data-verse="${ref}" onclick="(function(e) { var event = new CustomEvent('verse-click', { detail: { verse: '${ref}' } }); document.dispatchEvent(event); })(event)" style="color: #4f46e5; cursor: pointer; text-decoration: underline; font-weight: 500;">${match.text}</span>`;
            result += span;
            
            // Skip the length of the reference
            skipTo = i + match.length;
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      
      // If no reference matched at this position, just add the character
      if (!matched && i >= skipTo) {
        result += content[i];
      }
    }
    
    return result;
  };

  // Replace the original renderMessageWithClickableVerses with the more robust processor
  const renderMessageWithClickableVerses = processContentWithVerseReferences;

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
                        components={{
                          // Pre-process all text content to add verse reference markup
                          p: ({node, ...props}) => {
                            const rawContent = node.children
                              .map(n => n.type === 'text' ? n.value : '')
                              .join('');
                            
                            const processedContent = renderMessageWithClickableVerses(rawContent);
                            return <p dangerouslySetInnerHTML={{ __html: processedContent }} />;
                          },
                          li: ({node, ...props}) => {
                            const rawContent = node.children
                              .map(n => {
                                if (n.type === 'text') return n.value;
                                if (n.children) {
                                  return n.children.map(child => child.type === 'text' ? child.value : '').join('');
                                }
                                return '';
                              })
                              .join('');
                            
                            const processedContent = renderMessageWithClickableVerses(rawContent);
                            return <li dangerouslySetInnerHTML={{ __html: processedContent }} />;
                          },
                          a: ({node, href, children, ...props}) => {
                            // Check if children or href contain verse references
                            const rawContent = typeof children === 'string' 
                              ? children 
                              : Array.isArray(children) 
                                ? children.map(child => typeof child === 'string' ? child : '').join('')
                                : '';
                            
                            // Process either the content or href for verse references
                            const hasReferences = containsVerseReferences(rawContent) || containsVerseReferences(href);
                            
                            if (hasReferences) {
                              const processedContent = renderMessageWithClickableVerses(rawContent || href);
                              return <span dangerouslySetInnerHTML={{ __html: processedContent }} />;
                            }
                            
                            // Special case for hrefs that are verse references
                            if (href && containsVerseReferences(href)) {
                              const verseRef = extractVerseReferences(href)[0];
                              return (
                                <a 
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleVerseClick(verseRef);
                                  }}
                                  className="verse-reference"
                                  data-verse={verseRef}
                                >
                                  {children}
                                </a>
                              );
                            }
                            
                            return <a href={href} {...props}>{children}</a>;
                          },
                          strong: ({node, children, ...props}) => {
                            const rawContent = typeof children === 'string' 
                              ? children 
                              : Array.isArray(children) 
                                ? children.map(child => typeof child === 'string' ? child : '').join('')
                                : '';
                            
                            if (containsVerseReferences(rawContent)) {
                              const processedContent = renderMessageWithClickableVerses(rawContent);
                              return <strong dangerouslySetInnerHTML={{ __html: processedContent }} />;
                            }
                            return <strong {...props}>{children}</strong>;
                          },
                          em: ({node, children, ...props}) => {
                            const rawContent = typeof children === 'string' 
                              ? children 
                              : Array.isArray(children) 
                                ? children.map(child => typeof child === 'string' ? child : '').join('')
                                : '';
                            
                            if (containsVerseReferences(rawContent)) {
                              const processedContent = renderMessageWithClickableVerses(rawContent);
                              return <em dangerouslySetInnerHTML={{ __html: processedContent }} />;
                            }
                            return <em {...props}>{children}</em>;
                          },
                          // Process all text nodes for verse references
                          text: ({node, ...props}) => {
                            const rawContent = node.value;
                            if (containsVerseReferences(rawContent)) {
                              const processedContent = renderMessageWithClickableVerses(rawContent);
                              return <span dangerouslySetInnerHTML={{ __html: processedContent }} />;
                            }
                            return <span {...props} />;
                          }
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
      
      {/* Bible Verse Modal */}
      <BibleVerseModal 
        isOpen={isVerseModalOpen}
        onClose={() => setIsVerseModalOpen(false)}
        verseReference={selectedVerse}
      />
    </div>
  );
};

export default AdvancedChat; 
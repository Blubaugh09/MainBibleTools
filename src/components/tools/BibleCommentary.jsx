import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import BibleVerseModal from '../common/BibleVerseModal';
import { extractVerseReferences, containsVerseReferences } from '../common/VerseReferenceParser';

const BibleCommentary = () => {
  const [book, setBook] = useState('Genesis');
  const [chapter, setChapter] = useState('1');
  const [commentary, setCommentary] = useState('');
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const commentaryRef = useRef(null);
  const { currentUser } = useAuth();
  
  // Bible verse modal state
  const [isVerseModalOpen, setIsVerseModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');

  // Bible books array for dropdown
  const bibleBooks = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
    "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
  ];

  // Setup global verse click handler
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

  // Auto-scroll to bottom when commentary or conversation history changes
  useEffect(() => {
    commentaryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commentary, conversationHistory]);

  // Process content to identify and make verse references clickable
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
      
      // Use a simple regex that directly matches the reference
      const regex = new RegExp(`\\b${escapedRef}\\b`, 'g');
      
      // Find all matches in the content
      let match;
      matches[ref] = [];
      while ((match = regex.exec(content)) !== null) {
        matches[ref].push({
          index: match.index,
          length: match[0].length,
          text: match[0]
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

  // Handle verse reference click
  const handleVerseClick = (verseRef) => {
    setSelectedVerse(verseRef);
    setIsVerseModalOpen(true);
  };

  // Check if the server is running when the component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          console.log('Server health check for 2:', data);
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

  // Check if there's an existing commentary for this book/chapter in Firestore
  const findExistingCommentary = async (book, chapter) => {
    if (!currentUser) return null;
    
    try {
      // Create a query against the collection
      const q = query(
        collection(db, 'mainBibleTools_bibleCommentary'), 
        where('userId', '==', currentUser.uid),
        where('book', '==', book),
        where('chapter', '==', chapter)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Get the first matching document
        const doc = querySnapshot.docs[0];
        console.log('Found existing commentary for', book, chapter);
        return {
          id: doc.id,
          ...doc.data()
        };
      }
      
      return null;
    } catch (err) {
      console.error('Error finding existing commentary:', err);
      return null;
    }
  };

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
        // Create a title from the book and chapter
        const newTitle = `${book} ${chapter} Commentary`;
        
        // Create a new conversation document
        const docRef = await addDoc(collection(db, 'mainBibleTools_bibleCommentary'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          title: newTitle,
          book,
          chapter,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          messages: formattedMessages
        });
        
        setCurrentConversationId(docRef.id);
        console.log('Created new commentary conversation with ID:', docRef.id);
      } else {
        // Get the existing conversation document
        const conversationRef = doc(db, 'mainBibleTools_bibleCommentary', currentConversationId);
        const conversationSnap = await getDoc(conversationRef);
        
        if (conversationSnap.exists()) {
          // Update the existing conversation with new messages
          await updateDoc(conversationRef, {
            messages: formattedMessages,
            updatedAt: serverTimestamp()
          });
          
          console.log('Updated commentary conversation:', currentConversationId);
        } else {
          console.error('Conversation document not found');
          // If the conversation was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_bibleCommentary'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            title: `${book} ${chapter} Commentary`,
            book,
            chapter,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            messages: formattedMessages
          });
          
          setCurrentConversationId(docRef.id);
          console.log('Created replacement conversation with ID:', docRef.id);
        }
      }
    } catch (err) {
      console.error('Error saving commentary to Firestore:', err);
      // Don't show this error to user as it's not critical to functionality
    }
  };

  // Reset conversation - use when selecting a new book/chapter
  const resetConversation = () => {
    setConversationHistory([]);
    setCommentary('');
    setCurrentConversationId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot fetch commentary: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setCommentary('');
    
    // Reset conversation when selecting a new chapter
    resetConversation();

    try {
      // First check if we have an existing commentary for this book/chapter
      if (currentUser) {
        const existingCommentary = await findExistingCommentary(book, chapter);
        
        if (existingCommentary && existingCommentary.messages && existingCommentary.messages.length >= 2) {
          console.log('Loading existing commentary from Firestore');
          
          // Set the conversation ID
          setCurrentConversationId(existingCommentary.id);
          
          // Extract the commentary from the second message (assistant's response)
          const commentaryContent = existingCommentary.messages[1].content;
          setCommentary(commentaryContent);
          
          // Set the conversation history
          setConversationHistory(existingCommentary.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })));
          
          setIsLoading(false);
          return;
        }
      }
      
      // If no existing commentary is found, proceed with API request
      console.log(`Fetching commentary for ${book} ${chapter}...`);
      const response = await fetch('/api/tools/bible-commentary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book,
          chapter,
          conversationHistory: [] // Empty for initial request
        }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to get commentary');
      }

      const data = await response.json();
      console.log('Received commentary:', data);
      setCommentary(data.commentary);
      
      // Add the initial request to conversation history
      const initialQuery = `Commentary on ${book} chapter ${chapter}`;
      const newHistory = [
        { role: 'user', content: initialQuery },
        { role: 'assistant', content: data.commentary }
      ];
      setConversationHistory(newHistory);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        saveConversationToFirestore(newHistory);
      }
    } catch (error) {
      console.error('Error fetching commentary:', error);
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
      console.log(`Sending follow-up question about ${book} ${chapter}...`);
      const response = await fetch('/api/chat/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a Bible scholar and theological expert responding to questions about ${book} chapter ${chapter}. 
              Provide helpful, insightful answers based on scripture and theological understanding. Use markdown formatting for clear sections.
              Your responses should be educational, respectful of diverse interpretations, and spiritually insightful.`
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

  // Generate an array of chapter numbers based on the selected book
  const getChapterCount = (book) => {
    const chapterCounts = {
      "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
      "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24, 
      "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36, 
      "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150, 
      "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66, 
      "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12, 
      "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7, 
      "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, 
      "Malachi": 4, "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, 
      "Acts": 28, "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, 
      "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4, 
      "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, 
      "Titus": 3, "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, 
      "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
    };
    
    return Array.from({ length: chapterCounts[book] || 1 }, (_, i) => (i + 1).toString());
  };

  const chapters = getChapterCount(book);

  // Determine if we're showing initial commentary or follow-up conversation
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
          <span className="font-bold">Note:</span> Commentary history will not be saved since you're not logged in
        </div>
      )}
      
      {/* Selection controls */}
      <div className="p-4 bg-gray-50 border-b">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="book-select" className="block text-sm font-medium text-gray-700 mb-1">Book</label>
            <select
              id="book-select"
              value={book}
              onChange={(e) => {
                setBook(e.target.value);
                setChapter('1'); // Reset chapter when book changes
              }}
              className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              {bibleBooks.map((bookName) => (
                <option key={bookName} value={bookName}>
                  {bookName}
                </option>
              ))}
            </select>
          </div>
          
          <div className="w-full sm:w-auto">
            <label htmlFor="chapter-select" className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
            <select
              id="chapter-select"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              {chapters.map((chapterNum) => (
                <option key={chapterNum} value={chapterNum}>
                  {chapterNum}
                </option>
              ))}
            </select>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || serverStatus !== 'online'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Get Commentary'}
          </button>
        </form>
      </div>
      
      {/* Commentary content area */}
      <div className="flex-1 p-4 h-[400px] overflow-y-auto" ref={commentaryRef}>
        {isLoading && !hasConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-700"></div>
          </div>
        ) : hasConversation ? (
          <div className="prose max-w-none mb-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{book} {chapter}</h2>
            
            <div className="space-y-6">
              {conversationHistory.map((msg, index) => (
                <div key={index} className={`${msg.role === 'user' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'} border rounded-lg p-4`}>
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
                          p: ({node, ...props}) => {
                            const rawContent = node.children
                              .map(n => n.type === 'text' ? n.value : '')
                              .join('');
                            
                            const processedContent = processContentWithVerseReferences(rawContent);
                            return <p dangerouslySetInnerHTML={{ __html: processedContent }} className="mb-2" />;
                          },
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
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
                            
                            const processedContent = processContentWithVerseReferences(rawContent);
                            return <li dangerouslySetInnerHTML={{ __html: processedContent }} className="mb-1" />;
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
                              const processedContent = processContentWithVerseReferences(rawContent || href);
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
                                  className="verse-reference text-blue-600 hover:underline"
                                  data-verse={verseRef}
                                >
                                  {children}
                                </a>
                              );
                            }
                            
                            return <a className="text-blue-600 hover:underline" href={href} {...props}>{children}</a>;
                          },
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />,
                          code: ({node, inline, ...props}) => 
                            inline 
                              ? <code className="bg-gray-100 text-sm rounded px-1 py-0.5" {...props} />
                              : <pre className="bg-gray-100 p-2 rounded my-2 overflow-x-auto"><code {...props} /></pre>,
                          // Add support for strong and em with verse references
                          strong: ({node, children, ...props}) => {
                            const rawContent = typeof children === 'string' 
                              ? children 
                              : Array.isArray(children) 
                                ? children.map(child => typeof child === 'string' ? child : '').join('')
                                : '';
                            
                            if (containsVerseReferences(rawContent)) {
                              const processedContent = processContentWithVerseReferences(rawContent);
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
                              const processedContent = processContentWithVerseReferences(rawContent);
                              return <em dangerouslySetInnerHTML={{ __html: processedContent }} />;
                            }
                            return <em {...props}>{children}</em>;
                          },
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
                  placeholder="Ask a follow-up question about this chapter..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={isLoading || serverStatus !== 'online'}
                />
                <button
                  type="submit"
                  disabled={isLoading || !followupQuestion.trim() || serverStatus !== 'online'}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
        ) : commentary ? (
          <div className="prose max-w-none">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{book} {chapter}</h2>
            <div className="markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-md font-bold mb-1" {...props} />,
                  p: ({node, ...props}) => {
                    const rawContent = node.children
                      .map(n => n.type === 'text' ? n.value : '')
                      .join('');
                    
                    const processedContent = processContentWithVerseReferences(rawContent);
                    return <p dangerouslySetInnerHTML={{ __html: processedContent }} className="mb-2" />;
                  },
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
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
                    
                    const processedContent = processContentWithVerseReferences(rawContent);
                    return <li dangerouslySetInnerHTML={{ __html: processedContent }} className="mb-1" />;
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
                      const processedContent = processContentWithVerseReferences(rawContent || href);
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
                          className="verse-reference text-blue-600 hover:underline"
                          data-verse={verseRef}
                        >
                          {children}
                        </a>
                      );
                    }
                    
                    return <a className="text-blue-600 hover:underline" href={href} {...props}>{children}</a>;
                  },
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />,
                  code: ({node, inline, ...props}) => 
                    inline 
                      ? <code className="bg-gray-100 text-sm rounded px-1 py-0.5" {...props} />
                      : <pre className="bg-gray-100 p-2 rounded my-2 overflow-x-auto"><code {...props} /></pre>,
                  // Add support for strong and em with verse references
                  strong: ({node, children, ...props}) => {
                    const rawContent = typeof children === 'string' 
                      ? children 
                      : Array.isArray(children) 
                        ? children.map(child => typeof child === 'string' ? child : '').join('')
                        : '';
                    
                    if (containsVerseReferences(rawContent)) {
                      const processedContent = processContentWithVerseReferences(rawContent);
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
                      const processedContent = processContentWithVerseReferences(rawContent);
                      return <em dangerouslySetInnerHTML={{ __html: processedContent }} />;
                    }
                    return <em {...props}>{children}</em>;
                  },
                }}
              >
                {commentary}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-gray-500">Select a book and chapter and click "Get Commentary"</p>
            <p className="text-gray-400 text-sm mt-2">You'll receive AI-generated insights and commentary</p>
          </div>
        )}
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

export default BibleCommentary; 
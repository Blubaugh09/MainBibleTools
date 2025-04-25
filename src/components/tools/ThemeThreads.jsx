import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BsSearch, 
  BsBookmark, 
  BsBookmarkFill, 
  BsTrash,
  BsArrowClockwise,
  BsShare
} from 'react-icons/bs';
import { RiQuestionLine } from 'react-icons/ri';
import { useAuth } from '../../firebase/AuthContext';

// Timeline component for visualizing theme progression
const Timeline = ({ events }) => {
  if (!events || events.length === 0) return null;
  
  return (
    <div className="my-8 relative">
      <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-blue-200"></div>
      {events.map((event, index) => (
        <div key={index} className={`flex items-center mb-8 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
              <h4 className="font-bold text-blue-600">{event.reference}</h4>
              <p className="text-gray-700">{event.description}</p>
            </div>
          </div>
          <div className="z-10 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 border-4 border-white">
            <span className="text-white font-bold text-sm">{index + 1}</span>
          </div>
          <div className={`w-1/2 ${index % 2 === 0 ? 'pl-8' : 'pr-8'}`}></div>
        </div>
      ))}
    </div>
  );
};

const ThemeThreads = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [result, setResult] = useState(null);
  const [savedThreads, setSavedThreads] = useState([]);
  const [threadTitle, setThreadTitle] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const { currentUser } = useAuth();
  const resultRef = useRef(null);
  
  // Check server health on component mount
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        if (data.status === 'ok') {
          setServerStatus('online');
          if (!data.openai_api_key) {
            setError('OpenAI API key not configured.');
          }
        } else {
          setServerStatus('offline');
          setError('Server is offline. Please try again later.');
        }
      } catch (error) {
        setServerStatus('offline');
        setError('Unable to connect to server.');
      }
    };

    checkServerHealth();
    
    if (currentUser) {
      fetchSavedThreads();
    }
  }, [currentUser]);

  // Scroll to results when they change
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [result]);

  const fetchSavedThreads = async () => {
    if (!currentUser) return;
    
    try {
      const threadsQuery = query(
        collection(db, 'users', currentUser.uid, 'themeThreads'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(threadsQuery);
      const threads = [];
      querySnapshot.forEach((doc) => {
        threads.push({ id: doc.id, ...doc.data() });
      });
      
      setSavedThreads(threads);
    } catch (error) {
      console.error('Error fetching saved threads:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!prompt.trim() || loading || serverStatus !== 'online') {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/tools/theme-threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate theme threads');
      }
      
      const data = await response.json();
      setResult(data.result);
      
      // Generate title from first sentence of prompt or first 40 chars
      const newTitle = prompt.split('.')[0].trim().substring(0, 40) + (prompt.length > 40 ? '...' : '');
      setThreadTitle(newTitle);
      setIsSaved(false);
      setCurrentThreadId(null);
    } catch (error) {
      setError(error.message);
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveThread = async () => {
    if (!currentUser || !result) return;
    
    try {
      setLoading(true);
      
      if (currentThreadId) {
        // Update existing thread
        await updateDoc(doc(db, 'users', currentUser.uid, 'themeThreads', currentThreadId), {
          title: threadTitle,
          prompt,
          result,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new thread
        const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'themeThreads'), {
          userId: currentUser.uid,
          title: threadTitle,
          prompt,
          result,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        setCurrentThreadId(docRef.id);
      }
      
      setIsSaved(true);
      await fetchSavedThreads();
    } catch (error) {
      console.error('Error saving thread:', error);
      setError('Failed to save thread. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedThread = (thread) => {
    setPrompt(thread.prompt);
    setResult(thread.result);
    setThreadTitle(thread.title);
    setCurrentThreadId(thread.id);
    setIsSaved(true);
    
    if (resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const resetForm = () => {
    setPrompt('');
    setResult(null);
    setThreadTitle('');
    setIsSaved(false);
    setCurrentThreadId(null);
    setError('');
  };

  const updateTitle = (newTitle) => {
    setThreadTitle(newTitle);
    setIsSaved(false);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Left column - Input form & saved threads */}
      <div className="md:w-1/3">
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="mb-4">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
              Enter a biblical theme, topic, or question
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., What does the Bible teach about forgiveness?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              rows={5}
              disabled={loading || serverStatus !== 'online'}
            />
          </div>
          
          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={!prompt.trim() || loading || serverStatus !== 'online'}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                !prompt.trim() || loading || serverStatus !== 'online'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? 'Generating...' : 'Generate Threads'}
            </button>
            
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-red-600">
              {error}
            </div>
          )}
          
          {serverStatus !== 'online' && serverStatus !== 'checking' && (
            <div className="mt-2 text-sm text-red-600">
              Server is offline. Please try again later.
            </div>
          )}
        </form>
        
        {currentUser && (
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Saved Threads</h3>
            {savedThreads.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {savedThreads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => loadSavedThread(thread)}
                    className={`p-3 border rounded-md cursor-pointer hover:bg-gray-50 ${
                      currentThreadId === thread.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}
                  >
                    <h4 className="font-medium text-gray-800 line-clamp-1">{thread.title}</h4>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{thread.prompt}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No saved threads yet.</p>
            )}
          </div>
        )}
        
        {!currentUser && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <RiQuestionLine className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Login to save</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Sign in to save your theme threads for future reference.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Right column - Results */}
      <div className="md:w-2/3" ref={resultRef}>
        {result && (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <div className="flex-grow">
                <input
                  type="text"
                  value={threadTitle}
                  onChange={(e) => updateTitle(e.target.value)}
                  className="w-full font-medium text-lg border-0 focus:ring-0 p-0"
                  placeholder="Thread title"
                  disabled={!currentUser}
                />
              </div>
              
              {currentUser && (
                <div className="flex space-x-2">
                  <button
                    onClick={saveThread}
                    disabled={loading}
                    className="text-gray-600 hover:text-indigo-600 flex items-center"
                    title={isSaved ? "Thread saved" : "Save thread"}
                  >
                    {isSaved ? (
                      <BsBookmarkFill className="h-5 w-5 text-indigo-600" />
                    ) : (
                      <BsBookmark className="h-5 w-5" />
                    )}
                  </button>
                  
                  <button
                    className="text-gray-600 hover:text-indigo-600"
                    title="Share thread"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      alert('Link copied to clipboard');
                    }}
                  >
                    <BsShare className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-4">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                className="prose max-w-none text-gray-800"
              >
                {result}
              </ReactMarkdown>
            </div>
          </div>
        )}
        
        {!result && !loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Explore Biblical Themes</h3>
            <p className="text-gray-600 mb-4">
              Enter a biblical theme, topic, or question to discover interconnected threads, verses, and teachings throughout Scripture.
            </p>
            <div className="text-sm text-gray-500">
              <p>Try questions like:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>"How does the Bible connect grace and works?"</li>
                <li>"What are the different types of love in Scripture?"</li>
                <li>"Trace the theme of redemption through the Bible"</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeThreads; 
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { auth, db } from '../../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';

const ThemeThreads = () => {
  const [themeQuery, setThemeQuery] = useState('');
  const [themeResults, setThemeResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [savedThemes, setSavedThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const resultsRef = useRef(null);
  const user = auth.currentUser;

  // Check server health when component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const response = await axios.get('/api/health');
        if (response.data.status === 'ok') {
          setServerStatus('online');
          if (response.data.openaiApiKey === false) {
            setError('OpenAI API key is not configured on the server. Please set up your API key.');
          } else {
            setError('');
          }
        } else {
          setServerStatus('offline');
          setError('Server is online but reporting issues.');
        }
      } catch (err) {
        setServerStatus('offline');
        setError('Could not connect to server. Please check if the server is running.');
      }
    };

    checkServerHealth();
    fetchSavedThemes();
  }, []);

  // Fetch saved themes from Firestore
  const fetchSavedThemes = async () => {
    if (!user) return;
    
    try {
      const themesQuery = query(
        collection(db, 'users', user.uid, 'savedThemes'),
        orderBy('createdAt', 'desc')
      );
      
      const themesSnapshot = await getDocs(themesQuery);
      const themesList = themesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSavedThemes(themesList);
    } catch (err) {
      console.error('Error fetching saved themes:', err);
    }
  };

  // Save theme analysis to Firestore
  const saveTheme = async () => {
    if (!user) {
      setError('You must be logged in to save themes');
      return;
    }

    if (!themeResults) {
      setError('No theme analysis to save');
      return;
    }

    try {
      const themeData = {
        query: themeQuery,
        results: themeResults,
        createdAt: serverTimestamp()
      };

      await addDoc(
        collection(db, 'users', user.uid, 'savedThemes'),
        themeData
      );

      setError('');
      fetchSavedThemes();
    } catch (err) {
      console.error('Error saving theme:', err);
      setError('Failed to save theme analysis');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (serverStatus !== 'online') {
      setError('Server is offline. Please try again later.');
      return;
    }
    
    // Improved validation with better error messages
    if (!themeQuery.trim()) {
      setError('Please enter a biblical theme to analyze');
      return;
    }
    
    // Check if query is too long for the model
    if (themeQuery.length > 500) {
      setError('Your query is too long. Please limit to 500 characters.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setThemeResults(null);
    setSelectedTheme(null);
    
    try {
      const response = await axios.post('/api/tools/theme-threads', {
        prompt: themeQuery.trim()
      });
      
      // Verify response data structure
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format received from server');
      }
      
      setThemeResults(response.data);
      
      // Scroll to results
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Theme analysis error:', err);
      
      // Enhanced error handling with more specific messages
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (err.response.status === 400) {
          setError('Invalid request: ' + (err.response.data.error || 'Please check your input and try again'));
        } else if (err.response.status === 429) {
          setError('Too many requests: Please wait a moment and try again');
        } else if (err.response.status === 500) {
          setError('Server error: ' + (err.response.data.error || 'The theme analysis could not be completed'));
        } else {
          setError(err.response.data.error || 'Failed to process theme analysis request');
        }
      } else if (err.request) {
        // The request was made but no response was received
        setError('No response from server. Please check your connection and try again.');
      } else {
        // Something happened in setting up the request that triggered an Error
        setError('Error preparing request: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // View a saved theme
  const viewSavedTheme = (theme) => {
    setSelectedTheme(theme);
    setThemeResults(theme.results);
    setThemeQuery(theme.query);
    
    // Scroll to results
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Delete a saved theme
  const deleteTheme = async (id) => {
    if (!user) return;
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedThemes', id));
      fetchSavedThemes();
      
      if (selectedTheme && selectedTheme.id === id) {
        setSelectedTheme(null);
      }
    } catch (err) {
      console.error('Error deleting theme:', err);
      setError('Failed to delete theme');
    }
  };

  // Reset the form
  const handleReset = () => {
    setThemeQuery('');
    setThemeResults(null);
    setSelectedTheme(null);
    setError('');
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full">
      {/* Main Content */}
      <div className="w-full md:w-3/4 bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4 text-indigo-700">Biblical Theme Analysis</h2>
        
        {/* Error messages with better display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
          </div>
        )}
        
        {/* Server status */}
        <div className="mb-4">
          <span className="text-sm text-gray-600 mr-2">Server status:</span>
          {serverStatus === 'checking' && <span className="text-yellow-500">Checking...</span>}
          {serverStatus === 'online' && <span className="text-green-500">Online</span>}
          {serverStatus === 'offline' && <span className="text-red-500">Offline</span>}
        </div>
        
        {/* Input form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="mb-4">
            <label htmlFor="theme-query" className="block text-gray-700 text-sm font-bold mb-2">
              Enter Biblical Theme or Concept
            </label>
            <input
              id="theme-query"
              type="text"
              value={themeQuery}
              onChange={(e) => setThemeQuery(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="e.g., Redemption, Covenant, Grace, Faith, etc."
              disabled={isLoading}
              maxLength={500}
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter a biblical theme, concept, or theological term to analyze its significance across Scripture.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Character count: {themeQuery.length}/500
            </p>
          </div>
          
          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={isLoading || serverStatus !== 'online'}
              className={`px-4 py-2 rounded font-bold text-white ${
                isLoading || serverStatus !== 'online'
                  ? 'bg-indigo-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isLoading ? (
                <>
                  <span className="inline-block animate-spin mr-2">↻</span>
                  Analyzing...
                </>
              ) : (
                'Analyze Theme'
              )}
            </button>
            
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded font-bold"
            >
              Reset
            </button>
            
            {themeResults && (
              <button
                type="button"
                onClick={saveTheme}
                disabled={!user}
                className={`px-4 py-2 rounded font-bold text-white ${
                  !user ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Save Analysis
              </button>
            )}
          </div>
        </form>
        
        {/* Results section with improved rendering for potential null values */}
        {themeResults && (
          <div ref={resultsRef} className="theme-analysis border-t pt-6">
            <h3 className="text-xl font-bold mb-4 text-indigo-700">
              {selectedTheme ? `Saved Analysis: ${selectedTheme.query}` : `Analysis: ${themeQuery}`}
            </h3>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Introduction</h4>
              <div className="text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {themeResults.introduction || 'No introduction provided'}
                </ReactMarkdown>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Key Occurrences</h4>
              {themeResults.occurrences && themeResults.occurrences.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {themeResults.occurrences.map((occurrence, index) => (
                    <div key={index} className="bg-blue-50 p-3 rounded border border-blue-100">
                      <p className="font-bold text-blue-700">{occurrence.reference || 'Unknown reference'}</p>
                      <p className="text-sm text-gray-700">{occurrence.description || 'No description provided'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No key occurrences found</p>
              )}
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Thematic Development</h4>
              <div className="text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {themeResults.development || 'No thematic development information provided'}
                </ReactMarkdown>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Related Themes</h4>
              {themeResults.connections && themeResults.connections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {themeResults.connections.map((connection, index) => (
                    <div key={index} className="bg-indigo-50 p-3 rounded border border-indigo-100">
                      <p className="font-bold text-indigo-700">{connection.theme || 'Unknown theme'}</p>
                      <p className="text-sm text-gray-700">{connection.relationship || 'No relationship description'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No related themes found</p>
              )}
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Modern Application</h4>
              <div className="text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {themeResults.application || 'No application information provided'}
                </ReactMarkdown>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Additional References</h4>
              {themeResults.references && themeResults.references.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {themeResults.references.map((reference, index) => (
                    <span key={index} className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-700">
                      {reference}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No additional references found</p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Saved Themes Sidebar */}
      <div className="w-full md:w-1/4 bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4 text-indigo-700">Saved Themes</h3>
        
        {!user ? (
          <p className="text-gray-500 text-sm">Sign in to save and view your theme analyses</p>
        ) : savedThemes.length === 0 ? (
          <p className="text-gray-500 text-sm">No saved themes yet. Analyze and save themes to see them here.</p>
        ) : (
          <div className="space-y-3">
            {savedThemes.map((theme) => (
              <div 
                key={theme.id} 
                className={`border rounded p-3 cursor-pointer hover:bg-indigo-50 ${
                  selectedTheme && selectedTheme.id === theme.id ? 'bg-indigo-100 border-indigo-300' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <h4 
                    className="font-medium text-indigo-700 hover:underline"
                    onClick={() => viewSavedTheme(theme)}
                  >
                    {theme.query}
                  </h4>
                  <button
                    onClick={() => deleteTheme(theme.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    title="Delete this theme"
                  >
                    ×
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {theme.createdAt?.toDate 
                    ? theme.createdAt.toDate().toLocaleDateString() 
                    : 'Recently added'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeThreads; 
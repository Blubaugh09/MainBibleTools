import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { auth, db } from '../../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

const ThemeThreads = () => {
  const [themeQuery, setThemeQuery] = useState('');
  const [themeAnalysis, setThemeAnalysis] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [savedThemes, setSavedThemes] = useState([]);
  const resultRef = useRef(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        console.log('Checking server health for ThemeThreads component');
        const response = await fetch('/api/health');
        if (response.ok) {
          console.log('Server health check passed');
          setServerStatus('online');
          if (currentUser) {
            fetchSavedThemes();
          }
        } else {
          console.error('Server health check failed:', response.status);
          setServerStatus('offline');
          setError('Server is currently unavailable. Please try again later.');
        }
      } catch (error) {
        console.error('Server health check error:', error);
        setServerStatus('offline');
        setError('Cannot connect to server. Please check your internet connection.');
      }
    };

    checkServerHealth();
  }, [currentUser]);

  const fetchSavedThemes = async () => {
    if (!currentUser) {
      console.log('No user logged in, skipping saved themes fetch');
      return;
    }
    
    try {
      console.log('Fetching saved themes for user:', currentUser.uid);
      const themesQuery = query(
        collection(db, 'themeThreads'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(themesQuery);
      const themes = [];
      
      querySnapshot.forEach((doc) => {
        themes.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`Found ${themes.length} saved themes`);
      setSavedThemes(themes);
    } catch (error) {
      console.error('Error fetching saved themes:', error);
      setError('Failed to load your saved themes.');
    }
  };

  const handleThemeAnalysis = async (e) => {
    e.preventDefault();
    
    // Reset any previous errors
    setError(null);
    
    // Basic client-side validation
    if (!themeQuery.trim()) {
      setError('Please enter a biblical theme to analyze');
      return;
    }
    
    if (themeQuery.length > 500) {
      setError('Theme query exceeds maximum length of 500 characters');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      console.log(`ThemeThreads: Sending request to server with prompt: "${themeQuery}"`);
      const payload = { prompt: themeQuery.trim() };
      console.log('Request payload:', payload);
      
      const response = await fetch('/api/tools/theme-threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      console.log('ThemeThreads: Received server response', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });
      
      // Handle specific HTTP status codes
      if (!response.ok) {
        const errorText = await response.text();
        console.error('ThemeThreads API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        let errorMessage = 'An error occurred while analyzing the theme';
        
        try {
          // Try to parse the error response as JSON
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
          console.error('Parsed error details:', errorJson);
        } catch (parseError) {
          console.error('Error response was not valid JSON:', parseError, 'Raw response:', errorText);
        }
        
        // Provide specific messages for common status codes
        switch (response.status) {
          case 400:
            setError(`Bad request: ${errorMessage}`);
            console.error('400 Bad Request Details:', errorText);
            break;
          case 401:
            setError('Authentication required. Please log in again.');
            break;
          case 403:
            setError('You do not have permission to use this feature.');
            break;
          case 404:
            setError('Theme analysis service not found.');
            break;
          case 429:
            setError('Too many requests. Please try again later.');
            break;
          case 500:
            setError(`Server error: ${errorMessage}`);
            break;
          default:
            setError(`Error (${response.status}): ${errorMessage}`);
        }
        
        setIsGenerating(false);
        return;
      }
      
      // Handle successful response
      console.log('ThemeThreads: Reading response data...');
      const responseData = await response.json();
      console.log('ThemeThreads: Theme analysis response received:', responseData);
      
      // Validate response has the expected structure
      if (!responseData || typeof responseData !== 'object') {
        console.error('ThemeThreads: Invalid response format', responseData);
        setError('Received invalid response format from server');
        setIsGenerating(false);
        return;
      }
      
      // Set the theme analysis results
      setThemeAnalysis(responseData);
      
      // Auto-save if user is authenticated
      if (auth.currentUser) {
        saveThemeAnalysis(responseData);
      }
      
      // Scroll to results
      if (resultRef.current) {
        resultRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error('ThemeThreads: Error during theme analysis:', error);
      setError(`Failed to analyze theme: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveThemeAnalysis = async (analysisData) => {
    if (!currentUser) {
      setError('You must be logged in to save themes.');
      return;
    }

    if (!analysisData) {
      analysisData = themeAnalysis;
    }

    if (!analysisData) {
      setError('No theme analysis to save.');
      return;
    }

    try {
      console.log('Saving theme analysis to Firestore:', analysisData);
      
      // Check if this theme already exists for this user
      const existingTheme = await findExistingTheme(analysisData.title);
      
      if (existingTheme) {
        setError('You have already saved this theme analysis.');
        return;
      }
      
      // Map the new response format to Firestore document
      await addDoc(collection(db, 'themeThreads'), {
        userId: currentUser.uid,
        theme: analysisData.title, // Using title from new format
        summary: analysisData.summary,
        keyVerses: analysisData.keyVerses || [],
        theologicalSignificance: analysisData.theologicalSignificance || '',
        connections: analysisData.connections || [],
        applications: analysisData.applications || [],
        createdAt: serverTimestamp(),
        query: themeQuery
      });
      
      console.log('Theme analysis saved successfully');
      fetchSavedThemes();
      setError('');
    } catch (error) {
      console.error('Error saving theme analysis:', error);
      setError('Failed to save theme analysis: ' + error.message);
    }
  };

  const findExistingTheme = async (theme) => {
    if (!currentUser) return null;
    
    try {
      const themesQuery = query(
        collection(db, 'themeThreads'),
        where('userId', '==', currentUser.uid),
        where('theme', '==', theme)
      );
      
      const querySnapshot = await getDocs(themesQuery);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking for existing theme:', error);
      return null;
    }
  };

  const deleteTheme = async (themeId) => {
    if (!currentUser) {
      setError('You must be logged in to delete themes.');
      return;
    }

    try {
      console.log(`Deleting theme with ID: ${themeId}`);
      await deleteDoc(doc(db, 'themeThreads', themeId));
      console.log('Theme deleted successfully');
      fetchSavedThemes();
      setError('');
    } catch (error) {
      console.error('Error deleting theme:', error);
      setError('Failed to delete theme.');
    }
  };

  const loadTheme = (theme) => {
    console.log('Loading saved theme:', theme);
    
    // Convert the saved theme to match the expected response format
    setThemeAnalysis({
      title: theme.theme,
      summary: theme.summary,
      keyVerses: theme.keyVerses || [],
      theologicalSignificance: theme.theologicalSignificance || '',
      connections: theme.connections || [],
      applications: theme.applications || []
    });
    
    setThemeQuery(theme.query || theme.theme);
    
    // Scroll to results
    if (resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
    }
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
        <form onSubmit={handleThemeAnalysis} className="mb-8">
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
              disabled={isGenerating}
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
              disabled={isGenerating || serverStatus !== 'online'}
              className={`px-4 py-2 rounded font-bold text-white ${
                isGenerating || serverStatus !== 'online'
                  ? 'bg-indigo-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isGenerating ? (
                <>
                  <span className="inline-block animate-spin mr-2">↻</span>
                  Analyzing...
                </>
              ) : (
                'Analyze Theme'
              )}
            </button>
            
            {themeAnalysis && (
              <button
                type="button"
                onClick={() => saveThemeAnalysis(themeAnalysis)}
                disabled={!currentUser}
                className={`px-4 py-2 rounded font-bold text-white ${
                  !currentUser ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Save Analysis
              </button>
            )}
          </div>
        </form>
        
        {/* Results section with improved rendering for the new response format */}
        {themeAnalysis && (
          <div ref={resultRef} className="theme-analysis border-t pt-6">
            <h3 className="text-xl font-bold mb-4 text-indigo-700">
              Analysis: {themeAnalysis.title || themeQuery}
            </h3>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Summary</h4>
              <div className="text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {themeAnalysis.summary || 'No summary provided'}
                </ReactMarkdown>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Key Verses</h4>
              {themeAnalysis.keyVerses && themeAnalysis.keyVerses.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {themeAnalysis.keyVerses.map((verse, index) => (
                    <div key={index} className="bg-blue-50 p-3 rounded border border-blue-100">
                      <p className="font-bold text-blue-700">{verse.reference || 'Unknown reference'}</p>
                      <p className="text-sm text-gray-700">{verse.text || 'No text provided'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No key verses found</p>
              )}
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Theological Significance</h4>
              <div className="text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {themeAnalysis.theologicalSignificance || 'No theological significance information provided'}
                </ReactMarkdown>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Related Themes</h4>
              {themeAnalysis.connections && themeAnalysis.connections.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {themeAnalysis.connections.map((connection, index) => (
                    <span key={index} className="bg-indigo-50 px-3 py-1 rounded text-sm text-indigo-700 border border-indigo-100">
                      {typeof connection === 'string' ? connection : connection.theme || 'Unknown theme'}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No related themes found</p>
              )}
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-indigo-600 mb-2">Practical Applications</h4>
              {themeAnalysis.applications && themeAnalysis.applications.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {themeAnalysis.applications.map((application, index) => (
                    <li key={index} className="text-gray-700">
                      {typeof application === 'string' ? application : application.description || 'No description'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No applications provided</p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Saved Themes Sidebar */}
      <div className="w-full md:w-1/4 bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4 text-indigo-700">Saved Themes</h3>
        
        {!currentUser ? (
          <p className="text-gray-500 text-sm">Sign in to save and view your theme analyses</p>
        ) : savedThemes.length === 0 ? (
          <p className="text-gray-500 text-sm">No saved themes yet. Analyze and save themes to see them here.</p>
        ) : (
          <div className="space-y-3">
            {savedThemes.map((theme) => (
              <div 
                key={theme.id} 
                className={`border rounded p-3 cursor-pointer hover:bg-indigo-50 ${
                  themeAnalysis && themeAnalysis.theme === theme.theme ? 'bg-indigo-100 border-indigo-300' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <h4 
                    className="font-medium text-indigo-700 hover:underline"
                    onClick={() => loadTheme(theme)}
                  >
                    {theme.theme}
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
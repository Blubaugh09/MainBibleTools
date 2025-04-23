import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query, where, getDocs } from 'firebase/firestore';

const VisualParallels = () => {
  const [queryInput, setQueryInput] = useState('');
  const [parallelData, setParallelData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentParallelId, setCurrentParallelId] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();

  // Auto-scroll to results when they change
  useEffect(() => {
    if (parallelData) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [parallelData]);

  // Check if the server is running when the component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          console.log('Server health check for Visual Parallels:', data);
          setServerStatus('online');
          
          if (!data.env.apiKeySet) {
            setError('OpenAI API key is not configured on the server');
          }
        } else {
          setServerStatus('offline');
          setError('Cannot connect to the server');
        }
      } catch (err) {
        console.error('Server health check failed:', err);
        setServerStatus('offline');
        setError('Cannot connect to the server. Make sure to run "npm run server"');
      }
    };

    checkServerHealth();
  }, []);

  // Find existing parallels in Firestore
  const findExistingParallel = async (query) => {
    if (!currentUser) return null;
    
    try {
      // Create a query against the collection
      const q = query(
        collection(db, 'mainBibleTools_visualParallels'), 
        where('userId', '==', currentUser.uid),
        where('query', '==', query)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Get the first matching document
        const doc = querySnapshot.docs[0];
        console.log('Found existing visual parallel for query:', query);
        return {
          id: doc.id,
          ...doc.data()
        };
      }
      
      return null;
    } catch (err) {
      console.error('Error finding existing parallel:', err);
      return null;
    }
  };

  // Save results to Firestore
  const saveParallelToFirestore = async (data, query, imageData = null) => {
    try {
      if (!currentUser) {
        console.log('User not logged in, cannot save parallel');
        return;
      }

      // If this is a new parallel
      if (!currentParallelId) {
        // Create a new document
        const docRef = await addDoc(collection(db, 'mainBibleTools_visualParallels'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          query: query,
          title: data.title,
          parallelData: data,
          generatedImage: imageData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        setCurrentParallelId(docRef.id);
        console.log('Created new visual parallel with ID:', docRef.id);
      } else {
        // Get the existing document
        const parallelRef = doc(db, 'mainBibleTools_visualParallels', currentParallelId);
        const parallelSnap = await getDoc(parallelRef);
        
        if (parallelSnap.exists()) {
          // Update the existing document
          const updateData = {
            parallelData: data,
            updatedAt: serverTimestamp()
          };
          
          // Only add image data if it exists
          if (imageData) {
            updateData.generatedImage = imageData;
          }
          
          await updateDoc(parallelRef, updateData);
          
          console.log('Updated visual parallel:', currentParallelId);
        } else {
          console.error('Parallel document not found');
          // If the document was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_visualParallels'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            query: query,
            title: data.title,
            parallelData: data,
            generatedImage: imageData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          setCurrentParallelId(docRef.id);
          console.log('Created replacement parallel with ID:', docRef.id);
        }
      }
    } catch (err) {
      console.error('Error saving visual parallel to Firestore:', err);
      // Don't show this error to user as it's not critical
    }
  };

  // Generate an image for the parallel
  const generateImage = async () => {
    if (!parallelData) return;
    
    setIsGeneratingImage(true);
    setError('');
    
    try {
      const response = await fetch('/api/tools/generate-parallel-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parallelData: parallelData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate image');
      }
      
      const data = await response.json();
      console.log('Image generated successfully');
      
      setGeneratedImage(data.image);
      setImagePrompt(data.prompt);
      
      // Update Firestore with the image
      if (currentUser && currentParallelId) {
        saveParallelToFirestore(parallelData, queryInput, data.image);
      }
      
    } catch (error) {
      console.error('Error generating image:', error);
      setError(`Image generation failed: ${error.message}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Reset current parallel
  const resetParallel = () => {
    setParallelData(null);
    setCurrentParallelId(null);
    setGeneratedImage(null);
    setImagePrompt('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!queryInput.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot generate visual parallel: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setParallelData(null);
    setGeneratedImage(null);
    setImagePrompt('');
    
    // Reset current parallel
    resetParallel();

    try {
      // First check if we have an existing parallel for this query
      if (currentUser) {
        const existingParallel = await findExistingParallel(queryInput);
        
        if (existingParallel && existingParallel.parallelData) {
          console.log('Loading existing parallel from Firestore');
          
          // Set the parallel ID
          setCurrentParallelId(existingParallel.id);
          
          // Set the parallel data
          setParallelData(existingParallel.parallelData);
          
          // Set the image if it exists
          if (existingParallel.generatedImage) {
            setGeneratedImage(existingParallel.generatedImage);
          }
          
          setIsLoading(false);
          return;
        }
      }
      
      // If no existing parallel is found, proceed with API request
      console.log(`Generating visual parallel for: ${queryInput}`);
      const response = await fetch('/api/tools/visual-parallels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: queryInput
        }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to generate visual parallel');
      }

      const data = await response.json();
      console.log('Received visual parallel data:', data);
      setParallelData(data);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        saveParallelToFirestore(data, queryInput);
      }
    } catch (error) {
      console.error('Error generating visual parallel:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to render markdown content
  const renderMarkdown = (content) => {
    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({node, ...props}) => <p className="mb-2" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          a: ({node, ...props}) => <a className="text-indigo-600 hover:underline" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  // Render key verses as list items
  const renderKeyVerses = (verses) => {
    return verses.map((verse, index) => (
      <li key={index} className="mb-1">{verse}</li>
    ));
  };

  // Render keywords as tags
  const renderKeywords = (keywords) => {
    return keywords.map((keyword, index) => (
      <span key={index} className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
        {keyword}
      </span>
    ));
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
          <span className="font-bold">Offline:</span> Server is not running
        </div>
      )}
      
      {/* User authentication notice */}
      {!currentUser && (
        <div className="px-4 py-2 bg-blue-100 border-l-4 border-blue-500 text-blue-700 text-sm">
          <span className="font-bold">Note:</span> Visual parallels will not be saved since you're not logged in
        </div>
      )}
      
      {/* Input area */}
      <div className="p-4 bg-gray-50 border-b">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="query-input" className="block text-sm font-medium text-gray-700 mb-1">
              Enter your query about Biblical parallels
            </label>
            <textarea
              id="query-input"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Example: How does Moses compare to Jesus? Or: Compare the flood and baptism. Or: Temple and church parallel."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-24"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              You can ask about specific parallels or enter a general theme to explore connections between Old and New Testament.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !queryInput.trim() || serverStatus !== 'online'}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating Parallel...' : 'Generate Visual Parallel'}
          </button>
        </form>
      </div>
      
      {/* Results area */}
      <div className="flex-1 p-4 overflow-y-auto" ref={resultsRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-700"></div>
          </div>
        ) : parallelData ? (
          <div className="prose max-w-none">
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">{parallelData.title}</h1>
            <p className="text-center text-gray-600 mb-8">{parallelData.summary}</p>
            
            {/* Image Generation Section */}
            <div className="mb-8 text-center">
              {generatedImage ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h2 className="text-xl font-bold text-center text-gray-800 mb-4">Visual Representation</h2>
                  <img 
                    src={generatedImage} 
                    alt={`Visual representation of ${parallelData.title}`}
                    className="mx-auto max-w-full h-auto rounded-lg shadow-lg mb-4"
                  />
                  <div className="text-xs text-gray-500 italic mt-2">
                    <p>Prompt: {imagePrompt}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={generateImage}
                  disabled={isGeneratingImage || !parallelData}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
                >
                  {isGeneratingImage ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating Image...
                    </span>
                  ) : (
                    'Generate Visual Representation'
                  )}
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Old Testament Panel */}
              <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
                <h2 className="text-xl font-bold text-amber-800 mb-2">Old Testament</h2>
                <h3 className="text-lg font-semibold mb-2">{parallelData.oldTestament.name}</h3>
                <p className="text-sm text-amber-800 mb-4">{parallelData.oldTestament.reference}</p>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-amber-700">Description</h4>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.oldTestament.description)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-amber-700">Significance</h4>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.oldTestament.significance)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-amber-700">Key Verses</h4>
                  <ul className="list-disc pl-5 text-gray-700">
                    {renderKeyVerses(parallelData.oldTestament.keyVerses)}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-amber-700 mb-2">Keywords</h4>
                  <div className="flex flex-wrap">
                    {renderKeywords(parallelData.oldTestament.keywords)}
                  </div>
                </div>
              </div>
              
              {/* New Testament Panel */}
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                <h2 className="text-xl font-bold text-blue-800 mb-2">New Testament</h2>
                <h3 className="text-lg font-semibold mb-2">{parallelData.newTestament.name}</h3>
                <p className="text-sm text-blue-800 mb-4">{parallelData.newTestament.reference}</p>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-blue-700">Description</h4>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.newTestament.description)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-blue-700">Significance</h4>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.newTestament.significance)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-blue-700">Key Verses</h4>
                  <ul className="list-disc pl-5 text-gray-700">
                    {renderKeyVerses(parallelData.newTestament.keyVerses)}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">Keywords</h4>
                  <div className="flex flex-wrap">
                    {renderKeywords(parallelData.newTestament.keywords)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Connections Section */}
            <div className="bg-purple-50 rounded-lg p-6 border border-purple-200 mb-8">
              <h2 className="text-xl font-bold text-purple-800 mb-4">Connections</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-purple-700 mb-2">Symbolic</h3>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.connections.symbolic)}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-purple-700 mb-2">Thematic</h3>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.connections.thematic)}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-purple-700 mb-2">Prophetic</h3>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.connections.prophetic)}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-purple-700 mb-2">Theological</h3>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.connections.theological)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Visual Elements */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Visual Elements</h2>
              
              <div className="mb-4">
                <span className="font-semibold mr-2">Color Theme:</span>
                <span className="text-gray-700">{parallelData.visualElements.color}</span>
              </div>
              
              <div className="mb-4">
                <span className="font-semibold mr-2">Symbol:</span>
                <span className="text-gray-700">{parallelData.visualElements.symbol}</span>
              </div>
              
              <div>
                <span className="font-semibold mr-2">Visual Description:</span>
                <div className="text-gray-700">
                  {renderMarkdown(parallelData.visualElements.visualDescription)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">🔄</div>
            <p className="text-gray-500">Enter a query to generate a visual parallel</p>
            <p className="text-gray-400 text-sm mt-2">Compare Old and New Testament themes, symbols, and concepts</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualParallels; 
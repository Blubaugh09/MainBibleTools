import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db, storage } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query as firestoreQuery, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import BibleVerseModal from '../common/BibleVerseModal';
import { extractVerseReferences, containsVerseReferences } from '../common/VerseReferenceParser';

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
  const [storedImageUrl, setStoredImageUrl] = useState(null);
  // Bible verse modal state
  const [isVerseModalOpen, setIsVerseModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();

  // Auto-scroll to results when they change
  useEffect(() => {
    if (parallelData) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [parallelData]);

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
      
      // Use more precise regex that requires word boundaries to avoid capturing preceding words
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

  // Handle verse reference click
  const handleVerseClick = (verseRef) => {
    setSelectedVerse(verseRef);
    setIsVerseModalOpen(true);
  };

  // Check server health when component mounts
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

  // Handle receiving data in the old format (oldTestament/newTestament)
  useEffect(() => {
    if (parallelData) {
      // Check if data is in the old format and convert it to the new format
      if (parallelData.oldTestament && parallelData.newTestament && !parallelData.elementA && !parallelData.elementB) {
        console.log('Converting old parallel data format to new format');
        
        // Create a copy of the data with the new structure
        const updatedData = {
          ...parallelData,
          elementA: {
            ...parallelData.oldTestament,
            testament: 'Old'
          },
          elementB: {
            ...parallelData.newTestament,
            testament: 'New'
          }
        };
        
        // Update the state with the converted data
        setParallelData(updatedData);
      }
    }
  }, [parallelData]);

  // Find existing parallels in Firestore
  const findExistingParallel = async (searchQuery) => {
    if (!currentUser) return null;
    
    try {
      // Create a query against the collection
      const q = firestoreQuery(
        collection(db, 'mainBibleTools_visualParallels'), 
        where('userId', '==', currentUser.uid),
        where('query', '==', searchQuery)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Get the first matching document
        const doc = querySnapshot.docs[0];
        console.log('Found existing visual parallel for query:', searchQuery);
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

  // Helper function to create a clean filename from the query
  const createSafeFilename = (query) => {
    // Replace spaces and special characters with underscores
    return query
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50); // Limit filename length
  };

  // Save image to Firebase Storage
  const saveImageToStorage = async (imageUrl, query) => {
    if (!currentUser) {
      console.log('User not logged in, cannot save image');
      return null;
    }

    try {
      // Create a safe filename from the query
      const filename = createSafeFilename(query);
      
      // Reference to the image location in Firebase Storage
      const imagePath = `mainBibleTools/visualParallels/${filename}.jpg`;
      const storageRef = ref(storage, imagePath);
      
      console.log('Attempting to save image:', imageUrl);
      
      // For DALL-E images, we'll directly use the URL without fetch
      // This approach works because the image is already in our state
      // and we don't need to download it separately
      
      // Extract image data from URL or use a proxy if needed
      if (imageUrl.startsWith('data:')) {
        // It's already a data URL, use it directly
        const base64Content = imageUrl.split(',')[1];
        await uploadString(storageRef, base64Content, 'base64', {
          contentType: 'image/jpeg'
        });
      } else {
        // For URLs, we'll use the server as a proxy to avoid CORS issues
        const response = await fetch('/api/proxy-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to proxy image: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Upload the base64 data returned from our proxy
        await uploadString(storageRef, data.imageData, 'base64', {
          contentType: 'image/jpeg'
        });
      }
      
      // Get the download URL
      const downloadUrl = await getDownloadURL(storageRef);
      console.log('Image saved to Firebase Storage:', imagePath);
      return downloadUrl;
    } catch (error) {
      console.error('Error saving image to storage:', error);
      // Return null but don't fail the whole process
      return null;
    }
  };

  // Save results to Firestore
  const saveParallelToFirestore = async (data, query, imageData = null, imageFormat = null) => {
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
          storedImageUrl: storedImageUrl,
          imageFormat: imageFormat,
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
            if (imageFormat) {
              updateData.imageFormat = imageFormat;
            }
          }
          
          // Add stored image URL if it exists
          if (storedImageUrl) {
            updateData.storedImageUrl = storedImageUrl;
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
            storedImageUrl: storedImageUrl,
            imageFormat: imageFormat,
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
      console.log('Image generated successfully:', data.format);
      
      // Set the generated image
      setGeneratedImage(data.image);
      setImagePrompt(data.prompt);
      
      // If user is logged in, save the image to Firebase Storage
      if (currentUser) {
        try {
          console.log('Attempting to save image to Firebase Storage');
          // Save the image to Firebase Storage
          const imageUrl = await saveImageToStorage(data.image, queryInput);
          
          if (imageUrl) {
            setStoredImageUrl(imageUrl);
            console.log('Image stored with URL:', imageUrl);
            
            // Update Firestore with the stored image URL
            if (currentParallelId) {
              const parallelRef = doc(db, 'mainBibleTools_visualParallels', currentParallelId);
              await updateDoc(parallelRef, {
                generatedImage: data.image,
                storedImageUrl: imageUrl,
                imageFormat: data.format || 'unknown',
                updatedAt: serverTimestamp()
              });
              console.log('Updated Firestore with image URL');
            }
          }
        } catch (storageError) {
          console.error('Error saving image to storage:', storageError);
          // Don't fail the whole process if storage fails
        }
      }
      
      // Update Firestore with the image even if storage failed
      if (currentUser && currentParallelId) {
        saveParallelToFirestore(parallelData, queryInput, data.image, data.format);
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
    setStoredImageUrl(null);
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
    setStoredImageUrl(null);
    
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
          
          // Set the stored image URL if it exists
          if (existingParallel.storedImageUrl) {
            setStoredImageUrl(existingParallel.storedImageUrl);
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
    if (!content || typeof content !== 'string') return null;

    // Process content for verse references
    const processedContent = processContentWithVerseReferences(content);
    
    return (
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
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
                    {storedImageUrl && (
                      <p className="mt-1 text-green-600">
                        ✓ Image saved to Firebase Storage
                      </p>
                    )}
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
              {/* Element A Panel */}
              <div className={`rounded-lg p-6 border ${parallelData.elementA.testament === "Old" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                <h2 className={`text-xl font-bold mb-2 ${parallelData.elementA.testament === "Old" ? "text-amber-800" : "text-blue-800"}`}>
                  {parallelData.elementA.testament ? `${parallelData.elementA.testament} Testament` : 'Biblical Element A'}
                </h2>
                <h3 className="text-lg font-semibold mb-2">{parallelData.elementA.name}</h3>
                <p className={`text-sm mb-4 ${parallelData.elementA.testament === "Old" ? "text-amber-800" : "text-blue-800"}`}>
                  {parallelData.elementA.reference}
                </p>
                
                <div className="mb-4">
                  <h4 className={`font-semibold ${parallelData.elementA.testament === "Old" ? "text-amber-700" : "text-blue-700"}`}>
                    Description
                  </h4>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.elementA.description)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className={`font-semibold ${parallelData.elementA.testament === "Old" ? "text-amber-700" : "text-blue-700"}`}>
                    Significance
                  </h4>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.elementA.significance)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className={`font-semibold ${parallelData.elementA.testament === "Old" ? "text-amber-700" : "text-blue-700"}`}>
                    Key Verses
                  </h4>
                  <ul className="list-disc pl-5 text-gray-700">
                    {parallelData.elementA.keyVerses.map((verse, index) => (
                      <li key={index} className="mb-1">
                        {containsVerseReferences(verse) ? (
                          <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(verse) }} />
                        ) : (
                          verse
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className={`font-semibold mb-2 ${parallelData.elementA.testament === "Old" ? "text-amber-700" : "text-blue-700"}`}>
                    Keywords
                  </h4>
                  <div className="flex flex-wrap">
                    {parallelData.elementA.keywords.map((keyword, index) => (
                      <span key={index} className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Element B Panel */}
              <div className={`rounded-lg p-6 border ${parallelData.elementB.testament === "Old" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                <h2 className={`text-xl font-bold mb-2 ${parallelData.elementB.testament === "Old" ? "text-amber-800" : "text-blue-800"}`}>
                  {parallelData.elementB.testament ? `${parallelData.elementB.testament} Testament` : 'Biblical Element B'}
                </h2>
                <h3 className="text-lg font-semibold mb-2">{parallelData.elementB.name}</h3>
                <p className={`text-sm mb-4 ${parallelData.elementB.testament === "Old" ? "text-amber-800" : "text-blue-800"}`}>
                  {parallelData.elementB.reference}
                </p>
                
                <div className="mb-4">
                  <h4 className={`font-semibold ${parallelData.elementB.testament === "Old" ? "text-amber-700" : "text-blue-700"}`}>
                    Description
                  </h4>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.elementB.description)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className={`font-semibold ${parallelData.elementB.testament === "Old" ? "text-amber-700" : "text-blue-700"}`}>
                    Significance
                  </h4>
                  <div className="text-gray-700">
                    {renderMarkdown(parallelData.elementB.significance)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className={`font-semibold ${parallelData.elementB.testament === "Old" ? "text-amber-700" : "text-blue-700"}`}>
                    Key Verses
                  </h4>
                  <ul className="list-disc pl-5 text-gray-700">
                    {parallelData.elementB.keyVerses.map((verse, index) => (
                      <li key={index} className="mb-1">
                        {containsVerseReferences(verse) ? (
                          <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(verse) }} />
                        ) : (
                          verse
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className={`font-semibold mb-2 ${parallelData.elementB.testament === "Old" ? "text-amber-700" : "text-blue-700"}`}>
                    Keywords
                  </h4>
                  <div className="flex flex-wrap">
                    {parallelData.elementB.keywords.map((keyword, index) => (
                      <span key={index} className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
                        {keyword}
                      </span>
                    ))}
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
      
      {/* Bible Verse Modal */}
      <BibleVerseModal 
        isOpen={isVerseModalOpen}
        onClose={() => setIsVerseModalOpen(false)}
        verseReference={selectedVerse}
      />
    </div>
  );
};

export default VisualParallels; 
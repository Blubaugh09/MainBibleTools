import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db, storage } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query as firestoreQuery, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import axios from 'axios';

const Images = () => {
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentImageId, setCurrentImageId] = useState(null);
  const [savedImages, setSavedImages] = useState([]);
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();

  // Auto-scroll to results when they change
  useEffect(() => {
    if (generatedImage) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generatedImage]);

  // Check if the server is running when the component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await axios.get('/api/health');
        if (response.data.status === 'ok') {
          console.log('Server health check for Images:', response.data);
          setServerStatus('online');
          
          if (!response.data.env.apiKeySet) {
            setError('The OpenAI API key is not configured. Please check the server settings.');
          }
        } else {
          setServerStatus('offline');
          setError('Cannot connect to the server');
        }
      } catch (err) {
        console.error('Server health check failed:', err);
        setServerStatus('offline');
        setError('Cannot connect to the server. Please try again later.');
      }
    };

    checkServerHealth();
    
    // Fetch saved images if user is logged in
    if (currentUser) {
      fetchSavedImages();
    }
  }, [currentUser]);

  // Helper function to create a clean filename from the prompt
  const createSafeFilename = (prompt) => {
    // Replace spaces and special characters with underscores
    return prompt
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50); // Limit filename length
  };

  // Save image to Firebase Storage
  const saveImageToStorage = async (imageUrl, prompt) => {
    if (!currentUser) {
      console.log('User not logged in, cannot save image');
      return null;
    }

    try {
      // Create a safe filename from the prompt
      const filename = createSafeFilename(prompt);
      
      // Reference to the image location in Firebase Storage
      const imagePath = `mainBibleTools/biblicalImages/${filename}.jpg`;
      const storageRef = ref(storage, imagePath);
      
      console.log('Attempting to save image:', imageUrl);
      
      // For DALL-E images, we'll directly use the URL without fetch
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
  const saveImageToFirestore = async (imageUrl, prompt) => {
    try {
      if (!currentUser) {
        console.log('User not logged in, cannot save image');
        return;
      }

      // If this is a new image
      if (!currentImageId) {
        // Create a new document
        const docRef = await addDoc(collection(db, 'mainBibleTools_images'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          prompt: prompt,
          imageUrl: imageUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        setCurrentImageId(docRef.id);
        console.log('Created new image with ID:', docRef.id);
      } else {
        // Get the existing document
        const imageRef = doc(db, 'mainBibleTools_images', currentImageId);
        const imageSnap = await getDoc(imageRef);
        
        if (imageSnap.exists()) {
          // Update the existing document
          await updateDoc(imageRef, {
            imageUrl: imageUrl,
            updatedAt: serverTimestamp()
          });
          
          console.log('Updated image:', currentImageId);
        } else {
          console.error('Image document not found');
          // If the document was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_images'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            prompt: prompt,
            imageUrl: imageUrl,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          setCurrentImageId(docRef.id);
          console.log('Created replacement image with ID:', docRef.id);
        }
      }
      
      // Refresh the saved images list
      fetchSavedImages();
      
    } catch (err) {
      console.error('Error saving image to Firestore:', err);
      // Don't show this error to user as it's not critical
    }
  };

  // Fetch saved images from Firestore
  const fetchSavedImages = async () => {
    if (!currentUser) return;
    
    try {
      const q = firestoreQuery(
        collection(db, 'mainBibleTools_images'),
        where('userId', '==', currentUser.uid),
        where('imageUrl', '!=', null)
      );
      
      const querySnapshot = await getDocs(q);
      const images = [];
      
      querySnapshot.forEach((doc) => {
        images.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort by created date (newest first)
      images.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.seconds - a.createdAt.seconds;
      });
      
      setSavedImages(images);
    } catch (error) {
      console.error('Error fetching saved images:', error);
    }
  };

  // Reset current image
  const resetImage = () => {
    setGeneratedImage(null);
    setCurrentImageId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imagePrompt.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot generate image: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setGeneratedImage(null);
    
    // Reset current image
    resetImage();

    try {
      console.log(`Generating image for prompt: "${imagePrompt}"`);
      const response = await axios.post('/api/tools/biblical-image', {
        prompt: imagePrompt
      });
      
      console.log('Response received:', response.status, response.statusText);
      
      if (!response.data || !response.data.image) {
        throw new Error('Invalid response format from server');
      }
      
      setGeneratedImage(response.data.image);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        const storedImageUrl = await saveImageToStorage(response.data.image, imagePrompt);
        if (storedImageUrl) {
          saveImageToFirestore(storedImageUrl, imagePrompt);
        }
      }
    } catch (error) {
      console.error('Image generation error:', error);
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data);
        setError(error.response.data?.message || 'Failed to generate image. Server error.');
      } else if (error.request) {
        console.error('No response received:', error.request);
        setError('Failed to reach the server. Please try again later.');
      } else {
        setError(error.message || 'Failed to generate image. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedImage = (image) => {
    setImagePrompt(image.prompt || '');
    setGeneratedImage(image.imageUrl);
    setCurrentImageId(image.id);
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
          <span className="font-bold">Note:</span> Images will not be saved since you're not logged in
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row">
        {/* Input area */}
        <div className="p-4 bg-gray-50 lg:w-1/3">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="image-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                Describe the biblical image you'd like to create
              </label>
              <textarea
                id="image-prompt"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Example: Noah's ark with animals entering two by two, or The Sermon on the Mount with Jesus teaching a crowd on a hillside"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-32"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Be specific about what biblical scene, character, or concept you want to visualize.
              </p>
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !imagePrompt.trim() || serverStatus !== 'online'}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Image...
                </div>
              ) : 'Generate Biblical Image'}
            </button>
            
            {generatedImage && (
              <button
                type="button"
                onClick={resetImage}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Reset
              </button>
            )}
          </form>
          
          {/* Saved images */}
          {currentUser && savedImages.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-700 mb-2">Your Saved Images</h3>
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {savedImages.map(image => (
                  <div 
                    key={image.id} 
                    className={`cursor-pointer rounded border p-1 hover:border-purple-500 ${currentImageId === image.id ? 'border-purple-500' : 'border-gray-200'}`}
                    onClick={() => loadSavedImage(image)}
                  >
                    <img 
                      src={image.imageUrl} 
                      alt={image.prompt || 'Saved biblical image'} 
                      className="w-full h-24 object-cover rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1 truncate">{image.prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Results area */}
        <div className="flex-1 p-4 overflow-y-auto bg-white" ref={resultsRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
            </div>
          ) : generatedImage ? (
            <div className="prose max-w-none">
              <h2 className="text-xl font-bold text-center text-gray-800 mb-4">Generated Biblical Image</h2>
              <div className="flex justify-center">
                <div className="relative max-w-lg">
                  <img 
                    src={generatedImage} 
                    alt={`Biblical image based on: ${imagePrompt}`} 
                    className="mx-auto rounded-lg shadow-lg"
                  />
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-700">Prompt Used:</h3>
                    <p className="text-gray-600 italic">"{imagePrompt}"</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-5xl mb-3">🖼️</div>
              <p className="text-gray-500">Enter a prompt to generate a biblical image</p>
              <p className="text-gray-400 text-sm mt-2">Visualize scenes, characters, or concepts from Scripture</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Images; 
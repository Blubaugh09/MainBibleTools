import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db, storage } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query as firestoreQuery, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import axios from 'axios';

const Images = () => {
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' or 'edit'
  const [imagePrompt, setImagePrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [editedImage, setEditedImage] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedMask, setUploadedMask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentImageId, setCurrentImageId] = useState(null);
  const [savedImages, setSavedImages] = useState([]);
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);
  const maskInputRef = useRef(null);

  // Auto-scroll to results when they change
  useEffect(() => {
    if (generatedImage || editedImage) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generatedImage, editedImage]);

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

  // Handle tab switching
  const handleTabChange = (tab) => {
    if (tab === 'edit' && activeTab === 'generate' && generatedImage) {
      // Transfer the generated image to the edit tab
      setUploadedImage(generatedImage);
      setEditPrompt('');
      setEditedImage(null);
    }
    setActiveTab(tab);
  };

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
    if (activeTab === 'generate') {
      setGeneratedImage(null);
    } else {
      setEditedImage(null);
    }
    setCurrentImageId(null);
  };

  // Handle image generation
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

  // Handle image file selection
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle mask file selection
  const handleMaskUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedMask(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle image editing submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editPrompt.trim() || !uploadedImage) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot edit image: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setEditedImage(null);

    try {
      console.log(`Editing image with prompt: "${editPrompt}"`);
      
      // Check if the image is a URL (not a data URL) and fetch it first
      let processedImageData = uploadedImage;
      if (uploadedImage && uploadedImage.startsWith('http')) {
        try {
          console.log('Converting URL to data URL for editing');
          const proxyResponse = await axios.post('/api/proxy-image', {
            imageUrl: uploadedImage
          });
          
          if (proxyResponse.data && proxyResponse.data.imageData && proxyResponse.data.contentType) {
            processedImageData = `data:${proxyResponse.data.contentType};base64,${proxyResponse.data.imageData}`;
            console.log('Successfully converted image URL to data URL');
          }
        } catch (proxyError) {
          console.error('Error converting image URL:', proxyError);
          setError('Failed to process the image. Please try uploading it directly.');
          setIsLoading(false);
          return;
        }
      }
      
      const response = await axios.post('/api/tools/edit-biblical-image', {
        prompt: editPrompt,
        imageData: processedImageData,
        maskData: uploadedMask
      });
      
      console.log('Response received:', response.status, response.statusText);
      
      if (!response.data || !response.data.image) {
        throw new Error('Invalid response format from server');
      }
      
      setEditedImage(response.data.image);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        const storedImageUrl = await saveImageToStorage(response.data.image, editPrompt);
        if (storedImageUrl) {
          saveImageToFirestore(storedImageUrl, `Edited: ${editPrompt}`);
        }
      }
    } catch (error) {
      console.error('Image edit error:', error);
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data);
        setError(error.response.data?.message || 'Failed to edit image. Server error.');
      } else if (error.request) {
        console.error('No response received:', error.request);
        setError('Failed to reach the server. Please try again later.');
      } else {
        setError(error.message || 'Failed to edit image. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Use saved image
  const loadSavedImage = (image) => {
    if (activeTab === 'generate') {
      setImagePrompt(image.prompt || '');
      setGeneratedImage(image.imageUrl);
    } else {
      setEditPrompt('');
      setUploadedImage(image.imageUrl);
      setUploadedMask(null);
    }
    setCurrentImageId(image.id);
  };

  // Add a helper function to handle image downloads
  const handleDownloadImage = (imageUrl, prompt) => {
    // Create a safe filename from the prompt
    const filename = createSafeFilename(prompt || 'biblical-image') + '.png';
    
    // For URLs from DALL-E, we need to fetch them first
    if (imageUrl.startsWith('http')) {
      // Show a temporary loading state
      setIsLoading(true);
      
      // Use our proxy to get the image data
      fetch('/api/proxy-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl })
      })
      .then(response => response.json())
      .then(data => {
        // Create a link with the data URL and trigger a download
        const link = document.createElement('a');
        link.href = `data:${data.contentType};base64,${data.imageData}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error downloading image:', error);
        setError('Failed to download image');
        setIsLoading(false);
      });
    } else if (imageUrl.startsWith('data:')) {
      // For data URLs, we can download directly
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
      
      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            className={`py-4 px-6 font-medium text-sm border-b-2 focus:outline-none ${
              activeTab === 'generate'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => handleTabChange('generate')}
          >
            Generate Image
          </button>
          <button
            className={`py-4 px-6 font-medium text-sm border-b-2 focus:outline-none ${
              activeTab === 'edit'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => handleTabChange('edit')}
          >
            Edit Image
          </button>
        </nav>
      </div>
      
      <div className="flex flex-col lg:flex-row">
        {/* Input area */}
        <div className="p-4 bg-gray-50 lg:w-1/3">
          {activeTab === 'generate' ? (
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
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={resetImage}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Reset
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleTabChange('edit')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Edit This Image
                  </button>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="upload-image" className="block text-sm font-medium text-gray-700 mb-1">
                  Upload an image to edit
                </label>
                <div className="mt-1 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isLoading}
                  >
                    Choose Image
                  </button>
                  <span className="text-sm text-gray-500">
                    {uploadedImage ? 'Image selected' : 'No image selected'}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="upload-image"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isLoading}
                />
              </div>
              
              {uploadedImage && (
                <div className="mt-4">
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded image to edit" 
                    className="max-h-40 rounded border border-gray-200"
                  />
                </div>
              )}
              
              <div className="border-t border-gray-200 pt-4">
                <label htmlFor="upload-mask" className="block text-sm font-medium text-gray-700 mb-1">
                  Upload a mask (optional)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  The mask should be a transparent PNG where areas to edit are transparent and areas to keep are black.
                </p>
                <div className="mt-1 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => maskInputRef.current.click()}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isLoading || !uploadedImage}
                  >
                    Choose Mask
                  </button>
                  <span className="text-sm text-gray-500">
                    {uploadedMask ? 'Mask selected' : 'No mask selected'}
                  </span>
                </div>
                <input
                  ref={maskInputRef}
                  type="file"
                  id="upload-mask"
                  accept="image/png"
                  className="hidden"
                  onChange={handleMaskUpload}
                  disabled={isLoading || !uploadedImage}
                />
              </div>
              
              {uploadedMask && (
                <div className="mt-4">
                  <img 
                    src={uploadedMask} 
                    alt="Uploaded mask" 
                    className="max-h-40 rounded border border-gray-200"
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="edit-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                  Describe what you want to change
                </label>
                <textarea
                  id="edit-prompt"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Example: Add a rainbow over the ark, or Change the hillside to be more lush and green"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-32"
                  disabled={isLoading || !uploadedImage}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Be specific about what you want to change in the image.
                </p>
              </div>
              
              <button
                type="submit"
                disabled={isLoading || !editPrompt.trim() || !uploadedImage || serverStatus !== 'online'}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Editing Image...
                  </div>
                ) : 'Edit Biblical Image'}
              </button>
              
              {editedImage && (
                <button
                  type="button"
                  onClick={resetImage}
                  className="w-full mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Reset
                </button>
              )}
            </form>
          )}
          
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
          ) : activeTab === 'generate' && generatedImage ? (
            <div className="prose max-w-none">
              <h2 className="text-xl font-bold text-center text-gray-800 mb-4">Generated Biblical Image</h2>
              <div className="flex justify-center">
                <div className="relative max-w-lg">
                  <img 
                    src={generatedImage} 
                    alt={`Biblical image based on: ${imagePrompt}`} 
                    className="mx-auto rounded-lg shadow-lg"
                  />
                  
                  {/* Download button for generated image */}
                  <button
                    onClick={() => handleDownloadImage(generatedImage, imagePrompt)}
                    className="absolute bottom-2 left-2 bg-purple-600 text-white px-3 py-1 rounded-md shadow hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 text-sm flex items-center"
                    title="Download image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-700">Prompt Used:</h3>
                    <p className="text-gray-600 italic">"{imagePrompt}"</p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'edit' && editedImage ? (
            <div className="prose max-w-none">
              <h2 className="text-xl font-bold text-center text-gray-800 mb-4">Edited Biblical Image</h2>
              <div className="flex justify-center">
                <div className="relative max-w-lg">
                  <img 
                    src={editedImage} 
                    alt={`Edited biblical image based on: ${editPrompt}`} 
                    className="mx-auto rounded-lg shadow-lg"
                  />
                  
                  {/* Download button for edited image */}
                  <button
                    onClick={() => handleDownloadImage(editedImage, `Edited: ${editPrompt}`)}
                    className="absolute bottom-2 left-2 bg-purple-600 text-white px-3 py-1 rounded-md shadow hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 text-sm flex items-center"
                    title="Download image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-700">Prompt Used:</h3>
                    <p className="text-gray-600 italic">"{editPrompt}"</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              {activeTab === 'generate' ? (
                <>
                  <div className="text-5xl mb-3">🖼️</div>
                  <p className="text-gray-500">Enter a prompt to generate a biblical image</p>
                  <p className="text-gray-400 text-sm mt-2">Visualize scenes, characters, or concepts from Scripture</p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-3">✏️</div>
                  <p className="text-gray-500">Upload an image to edit</p>
                  <p className="text-gray-400 text-sm mt-2">Modify existing images or add details to them</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Images; 
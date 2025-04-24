import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { FaSave, FaRedo, FaSyncAlt } from 'react-icons/fa';

const Images = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [savedImages, setSavedImages] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  
  // Fetch saved images on component mount
  useEffect(() => {
    checkServerHealth();
    if (auth.currentUser) {
      fetchSavedImages();
    }
  }, []);
  
  const checkServerHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      if (data.status === 'ok') {
        setServerStatus('online');
        setErrorMessage(data.openaiApiKey ? '' : 'OpenAI API key not configured. Image generation will not work.');
      } else {
        setServerStatus('offline');
        setErrorMessage('Server is offline. Please try again later.');
      }
    } catch (error) {
      setServerStatus('offline');
      setErrorMessage('Could not connect to the server.');
    }
  };
  
  const fetchSavedImages = async () => {
    if (!auth.currentUser) return;
    
    try {
      const imagesQuery = query(
        collection(db, 'users', auth.currentUser.uid, 'biblicalImages'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(imagesQuery);
      const images = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSavedImages(images);
    } catch (error) {
      console.error('Error fetching saved images:', error);
    }
  };
  
  const saveImageToFirestore = async () => {
    if (!auth.currentUser || !generatedImage) return;
    
    try {
      await addDoc(
        collection(db, 'users', auth.currentUser.uid, 'biblicalImages'),
        {
          prompt,
          imageUrl: generatedImage,
          createdAt: serverTimestamp()
        }
      );
      
      fetchSavedImages();
      return true;
    } catch (error) {
      console.error('Error saving image:', error);
      setErrorMessage('Failed to save image to your library.');
      return false;
    }
  };
  
  const generateImage = async () => {
    if (!prompt.trim()) {
      setErrorMessage('Please enter a description of the biblical scene.');
      return;
    }
    
    setIsGenerating(true);
    setErrorMessage('');
    setGeneratedImage(null);
    
    try {
      const response = await fetch('/api/tools/generate-biblical-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: prompt.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setGeneratedImage(data.imageUrl);
      } else {
        setErrorMessage(data.details || data.error || 'Failed to generate image. Please try again.');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    generateImage();
  };
  
  const handleReset = () => {
    setPrompt('');
    setGeneratedImage(null);
    setErrorMessage('');
  };
  
  const toggleSavedImages = () => {
    setShowSaved(!showSaved);
    if (!showSaved && savedImages.length === 0) {
      fetchSavedImages();
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Biblical Scene Generator</h2>
        <p className="text-gray-600">
          Describe a biblical scene, character, or story and see it brought to life using AI image generation.
        </p>
      </div>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {errorMessage}
        </div>
      )}
      
      {serverStatus === 'offline' && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4">
          Server is offline. Image generation may not work.
          <button 
            onClick={checkServerHealth}
            className="ml-2 bg-yellow-200 p-1 rounded"
          >
            <FaSyncAlt />
          </button>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="prompt" className="block text-gray-700 text-sm font-bold mb-2">
            Describe a Biblical Scene
          </label>
          <textarea
            id="prompt"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            rows="3"
            placeholder="e.g., Moses parting the Red Sea, Jesus feeding the 5000, David facing Goliath..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating || serverStatus === 'offline'}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
            disabled={isGenerating || !prompt.trim() || serverStatus === 'offline'}
          >
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={isGenerating || (!prompt.trim() && !generatedImage)}
          >
            Reset
          </button>
          
          <button
            type="button"
            onClick={toggleSavedImages}
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {showSaved ? 'Hide Saved' : 'Show Saved'}
          </button>
        </div>
      </form>
      
      {isGenerating && (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {generatedImage && !isGenerating && (
        <div className="mb-6">
          <div className="border rounded-lg overflow-hidden shadow-lg">
            <img 
              src={generatedImage} 
              alt={prompt} 
              className="w-full object-contain" 
              style={{ maxHeight: '600px' }}
            />
            <div className="p-4 bg-gray-50">
              <p className="text-sm text-gray-700 italic mb-2">"{prompt}"</p>
              <button
                onClick={saveImageToFirestore}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline flex items-center"
                disabled={!auth.currentUser}
              >
                <FaSave className="mr-2" /> Save to Library
              </button>
              {!auth.currentUser && (
                <p className="text-xs text-red-600 mt-1">Log in to save images</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {showSaved && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">Your Saved Biblical Images</h3>
          {!auth.currentUser ? (
            <p>Log in to see your saved images.</p>
          ) : savedImages.length === 0 ? (
            <p>You haven't saved any biblical images yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedImages.map(image => (
                <div key={image.id} className="border rounded-lg overflow-hidden shadow-md">
                  <img 
                    src={image.imageUrl} 
                    alt={image.prompt} 
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-2 bg-gray-50">
                    <p className="text-sm text-gray-700 truncate">"{image.prompt}"</p>
                    <p className="text-xs text-gray-500">
                      {image.createdAt?.toDate().toLocaleDateString() || 'Unknown date'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Images; 
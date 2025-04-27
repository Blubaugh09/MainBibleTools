import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BibleVerseModal = ({ isOpen, onClose, verseReference }) => {
  const [verseContent, setVerseContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Fetch verse content when reference changes
  useEffect(() => {
    if (!isOpen || !verseReference) return;
    
    const fetchVerseContent = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        // Format reference for API
        const formattedRef = verseReference.replace(/\s+/g, '+');
        
        // Get ESV API key from environment
        const esvApiKey = import.meta.env.VITE_ESV_API_KEY;
        
        if (!esvApiKey) {
          throw new Error('ESV API key is not configured');
        }
        
        // Make request to ESV API
        const response = await axios.get(
          `https://api.esv.org/v3/passage/text/?q=${formattedRef}&include-headings=false&include-footnotes=false&include-verse-numbers=true&include-short-copyright=false&include-passage-references=false`,
          {
            headers: {
              'Authorization': `Token ${esvApiKey}`
            }
          }
        );
        
        if (response.data && response.data.passages && response.data.passages.length > 0) {
          setVerseContent(response.data.passages[0]);
        } else {
          setError('Verse not found');
        }
      } catch (err) {
        console.error('Error fetching Bible verse:', err);
        setError(err.message || 'Failed to load verse');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVerseContent();
  }, [isOpen, verseReference]);
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-800">
            {verseReference}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-4">
              {error}
            </div>
          ) : (
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap">{verseContent}</p>
              <p className="text-xs text-gray-500 mt-4">
                Scripture quotations marked "ESV" are from the ESV® Bible (The Holy Bible, English Standard Version®), 
                copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BibleVerseModal; 
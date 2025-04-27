import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import axios from 'axios';
import BibleVerseModal from '../common/BibleVerseModal';
import { extractVerseReferences, containsVerseReferences } from '../common/VerseReferenceParser';

const CharacterStudy = () => {
  const [characterQuery, setCharacterQuery] = useState('');
  const [characterData, setCharacterData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentStudyId, setCurrentStudyId] = useState(null);
  const [savedStudies, setSavedStudies] = useState([]);
  const [activeTab, setActiveTab] = useState('biography');
  // Bible verse modal state
  const [isVerseModalOpen, setIsVerseModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();

  // Auto-scroll to results when data changes
  useEffect(() => {
    if (characterData) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [characterData, activeTab]);

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
        const response = await axios.get('/api/health');
        if (response.data.status === 'ok') {
          console.log('Server health check for Character Study:', response.data);
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
    
    // Fetch saved studies if user is logged in
    if (currentUser) {
      fetchSavedStudies();
    }
  }, [currentUser]);

  // Fetch saved character studies
  const fetchSavedStudies = async () => {
    if (!currentUser) return;
    
    try {
      const q = query(
        collection(db, 'mainBibleTools_characterStudies'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const studies = [];
      
      querySnapshot.forEach((doc) => {
        studies.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort by created date (newest first)
      studies.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.seconds - a.createdAt.seconds;
      });
      
      setSavedStudies(studies);
    } catch (error) {
      console.error('Error fetching saved character studies:', error);
    }
  };

  // Save character study to Firestore
  const saveStudyToFirestore = async (data) => {
    try {
      if (!currentUser) {
        console.log('User not logged in, cannot save character study');
        return;
      }

      // If this is a new study
      if (!currentStudyId) {
        // Create a new document
        const docRef = await addDoc(collection(db, 'mainBibleTools_characterStudies'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          query: characterQuery,
          characterName: data.character?.name || 'Unknown Character',
          characterData: data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        setCurrentStudyId(docRef.id);
        console.log('Created new character study with ID:', docRef.id);
      } else {
        // Get the existing document
        const studyRef = doc(db, 'mainBibleTools_characterStudies', currentStudyId);
        const studySnap = await getDoc(studyRef);
        
        if (studySnap.exists()) {
          // Update the existing document
          await updateDoc(studyRef, {
            characterData: data,
            updatedAt: serverTimestamp()
          });
          
          console.log('Updated character study:', currentStudyId);
        } else {
          console.error('Character study document not found');
          // If the document was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_characterStudies'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            query: characterQuery,
            characterName: data.character?.name || 'Unknown Character',
            characterData: data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          setCurrentStudyId(docRef.id);
          console.log('Created replacement character study with ID:', docRef.id);
        }
      }
      
      // Refresh the saved studies list
      fetchSavedStudies();
      
    } catch (err) {
      console.error('Error saving character study to Firestore:', err);
      // Don't show this error to user as it's not critical
    }
  };

  // Find existing study
  const findExistingStudy = async (query) => {
    if (!currentUser) return null;
    
    try {
      // Create a query against the collection
      const q = query(
        collection(db, 'mainBibleTools_characterStudies'), 
        where('userId', '==', currentUser.uid),
        where('query', '==', query)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Get the first matching document
        const doc = querySnapshot.docs[0];
        console.log('Found existing study for query:', query);
        return {
          id: doc.id,
          ...doc.data()
        };
      }
      
      return null;
    } catch (err) {
      console.error('Error finding existing study:', err);
      return null;
    }
  };

  // Load saved study
  const loadSavedStudy = (study) => {
    setCharacterQuery(study.query || '');
    setCharacterData(study.characterData);
    setCurrentStudyId(study.id);
  };

  // Reset current study
  const resetStudy = () => {
    setCharacterData(null);
    setCurrentStudyId(null);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!characterQuery.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot generate character study: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setCharacterData(null);
    
    // Reset current study
    resetStudy();

    try {
      // First check if we have an existing study for this query
      if (currentUser) {
        const existingStudy = await findExistingStudy(characterQuery);
        
        if (existingStudy && existingStudy.characterData) {
          console.log('Loading existing character study from Firestore');
          
          // Set the study ID
          setCurrentStudyId(existingStudy.id);
          
          // Set the character data
          setCharacterData(existingStudy.characterData);
          
          setIsLoading(false);
          return;
        }
      }
      
      // If no existing study is found, proceed with API request
      console.log(`Generating character study for: ${characterQuery}`);
      const response = await axios.post('/api/tools/character-study', {
        query: characterQuery
      });
      
      console.log('Response received:', response.status, response.statusText);
      
      if (!response.data) {
        throw new Error('Invalid response format from server');
      }
      
      setCharacterData(response.data);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        saveStudyToFirestore(response.data);
      }
    } catch (error) {
      console.error('Character study generation error:', error);
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data);
        setError(error.response.data?.message || 'Failed to generate character study. Server error.');
      } else if (error.request) {
        console.error('No response received:', error.request);
        setError('Failed to reach the server. Please try again later.');
      } else {
        setError(error.message || 'Failed to generate character study. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render a list of items with icons
  const renderList = (items, icon) => {
    if (!items || items.length === 0) return <p className="text-gray-500 italic">No information available</p>;
    
    return (
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-start">
            <span className="mr-2 text-indigo-500">{icon}</span>
            {containsVerseReferences(item) ? (
              <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(item) }} />
            ) : (
              <span>{item}</span>
            )}
          </li>
        ))}
      </ul>
    );
  };

  // Render an event card
  const renderEvent = (event, index) => {
    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="font-bold text-lg mb-2">{event.title}</h3>
        <p className="mb-2">
          {containsVerseReferences(event.description) ? (
            <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(event.description) }} />
          ) : (
            event.description
          )}
        </p>
        <p className="text-sm text-indigo-600">
          {containsVerseReferences(event.reference) ? (
            <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(event.reference) }} />
          ) : (
            event.reference
          )}
        </p>
      </div>
    );
  };

  // Render a relationship card
  const renderRelationship = (relationship, index) => {
    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg">{relationship.name}</h3>
          <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-0.5 rounded">
            {relationship.relationship}
          </span>
        </div>
        <p className="mb-2">
          {containsVerseReferences(relationship.description) ? (
            <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(relationship.description) }} />
          ) : (
            relationship.description
          )}
        </p>
        <p className="text-sm text-indigo-600">
          {containsVerseReferences(relationship.reference) ? (
            <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(relationship.reference) }} />
          ) : (
            relationship.reference
          )}
        </p>
      </div>
    );
  };

  // Render a verse card
  const renderVerse = (verse, index) => {
    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
        <div className="mb-2">
          <span 
            className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded cursor-pointer verse-reference"
            data-verse={verse.reference}
            onClick={() => handleVerseClick(verse.reference)}
          >
            {verse.reference}
          </span>
        </div>
        <p className="italic mb-2">"{verse.text}"</p>
        <p className="text-sm">
          {containsVerseReferences(verse.significance) ? (
            <span dangerouslySetInnerHTML={{ __html: processContentWithVerseReferences(verse.significance) }} />
          ) : (
            verse.significance
          )}
        </p>
      </div>
    );
  };

  // Get content based on active tab
  const getTabContent = () => {
    if (!characterData) return null;
    
    switch (activeTab) {
      case 'biography':
        return (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-2">Summary</h3>
              <p>{characterData.biography?.summary}</p>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-2">Background</h3>
              <p>{characterData.biography?.background}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Key Events</h3>
              {characterData.biography?.keyEvents?.map(renderEvent) || 
                <p className="text-gray-500 italic">No key events listed</p>
              }
            </div>
          </div>
        );
        
      case 'relationships':
        return (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Key Relationships</h3>
            {characterData.relationships?.map(renderRelationship) || 
              <p className="text-gray-500 italic">No relationships listed</p>
            }
          </div>
        );
        
      case 'verses':
        return (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Key Verses</h3>
            {characterData.verses?.map(renderVerse) || 
              <p className="text-gray-500 italic">No verses listed</p>
            }
          </div>
        );
        
      case 'attributes':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Qualities</h3>
              {renderList(characterData.attributes?.qualities, '✅')}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Flaws</h3>
              {renderList(characterData.attributes?.flaws, '⚠️')}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Roles</h3>
              {renderList(characterData.attributes?.roles, '👑')}
            </div>
          </div>
        );
        
      case 'legacy':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Impact</h3>
              <p>{characterData.legacy?.impact}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Lessons</h3>
              {renderList(characterData.legacy?.lessons, '📝')}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">In Other Texts</h3>
              <p>{characterData.legacy?.inOtherTexts}</p>
            </div>
          </div>
        );
        
      case 'visual':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Symbols</h3>
              {renderList(characterData.visualElements?.symbols, '🔍')}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Settings</h3>
              {renderList(characterData.visualElements?.settings, '🏞️')}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Artifacts</h3>
              {renderList(characterData.visualElements?.artifacts, '📦')}
            </div>
          </div>
        );
        
      default:
        return <p>Select a tab to view information</p>;
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
          <span className="font-bold">Note:</span> Character studies will not be saved since you're not logged in
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row">
        {/* Input area */}
        <div className="p-4 bg-gray-50 lg:w-1/3">
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label htmlFor="character-query" className="block text-sm font-medium text-gray-700 mb-1">
                Search for a Biblical Character
              </label>
              <textarea
                id="character-query"
                value={characterQuery}
                onChange={(e) => setCharacterQuery(e.target.value)}
                placeholder="Enter a character name (e.g., 'David', 'Moses') or describe them (e.g., 'the woman at the well', 'father of John the Baptist')"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-32"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                You can enter a specific name or describe the character you're looking for.
              </p>
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !characterQuery.trim() || serverStatus !== 'online'}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Study...
                </div>
              ) : 'Study Character'}
            </button>
            
            {characterData && (
              <button
                type="button"
                onClick={resetStudy}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                New Study
              </button>
            )}
          </form>
          
          {/* Saved studies */}
          {currentUser && savedStudies.length > 0 && (
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-2">Your Saved Studies</h3>
              <div className="max-h-80 overflow-y-auto">
                {savedStudies.map(study => (
                  <div 
                    key={study.id} 
                    className={`cursor-pointer p-3 rounded mb-2 hover:bg-indigo-50 ${
                      currentStudyId === study.id ? 'bg-indigo-50 border-indigo-300 border' : 'bg-white border border-gray-200'
                    }`}
                    onClick={() => loadSavedStudy(study)}
                  >
                    <h4 className="font-medium">{study.characterName}</h4>
                    <p className="text-sm text-gray-600 truncate">{study.query}</p>
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-700"></div>
            </div>
          ) : characterData ? (
            <div>
              {/* Character header */}
              <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                <h2 className="text-2xl font-bold text-indigo-800 mb-1">
                  {characterData.character?.name}
                </h2>
                
                {characterData.character?.alternateNames && characterData.character.alternateNames.length > 0 && (
                  <p className="text-sm text-indigo-600 mb-2">
                    Also known as: {characterData.character.alternateNames.join(', ')}
                  </p>
                )}
                
                <p className="text-gray-700 mb-2">{characterData.character?.shortDescription}</p>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {characterData.character?.testament && (
                    <span className="bg-indigo-100 text-indigo-800 text-sm px-2 py-1 rounded">
                      {characterData.character.testament}
                    </span>
                  )}
                  
                  {characterData.character?.timePeriod && (
                    <span className="bg-amber-100 text-amber-800 text-sm px-2 py-1 rounded">
                      {characterData.character.timePeriod}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Tab navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="flex -mb-px overflow-x-auto">
                  {[
                    { id: 'biography', label: 'Biography', icon: '📝' },
                    { id: 'relationships', label: 'Relationships', icon: '👥' },
                    { id: 'verses', label: 'Key Verses', icon: '📖' },
                    { id: 'attributes', label: 'Attributes', icon: '✨' },
                    { id: 'legacy', label: 'Legacy', icon: '🏆' },
                    { id: 'visual', label: 'Visual Elements', icon: '🎨' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      className={`py-4 px-6 font-medium text-sm border-b-2 focus:outline-none whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* Tab content */}
              <div className="prose max-w-none">
                {getTabContent()}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-5xl mb-3">👤</div>
              <p className="text-gray-500">Enter a query to study a Biblical character</p>
              <p className="text-gray-400 text-sm mt-2">Learn about key figures from Scripture, their stories, relationships, and legacy</p>
            </div>
          )}
        </div>
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

export default CharacterStudy; 
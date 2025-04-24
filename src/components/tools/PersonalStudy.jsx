import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import axios from 'axios';

const PersonalStudy = () => {
  const [studyQuery, setStudyQuery] = useState('');
  const [studyPlanData, setStudyPlanData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentStudyId, setCurrentStudyId] = useState(null);
  const [savedStudies, setSavedStudies] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSession, setActiveSession] = useState(0);
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();

  // Auto-scroll to results when data changes
  useEffect(() => {
    if (studyPlanData) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [studyPlanData, activeTab, activeSession]);

  // Check server health when component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await axios.get('/api/health');
        if (response.data.status === 'ok') {
          console.log('Server health check for Personal Study:', response.data);
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

  // Fetch saved study plans
  const fetchSavedStudies = async () => {
    if (!currentUser) return;
    
    try {
      const q = query(
        collection(db, 'mainBibleTools_personalStudies'),
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
      console.error('Error fetching saved study plans:', error);
    }
  };

  // Save study plan to Firestore
  const saveStudyToFirestore = async (data) => {
    try {
      if (!currentUser) {
        console.log('User not logged in, cannot save study plan');
        return;
      }

      // If this is a new study
      if (!currentStudyId) {
        // Create a new document
        const docRef = await addDoc(collection(db, 'mainBibleTools_personalStudies'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          query: studyQuery,
          studyTitle: data.studyPlan?.title || 'Untitled Study',
          studyPlanData: data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        setCurrentStudyId(docRef.id);
        console.log('Created new study plan with ID:', docRef.id);
      } else {
        // Get the existing document
        const studyRef = doc(db, 'mainBibleTools_personalStudies', currentStudyId);
        const studySnap = await getDoc(studyRef);
        
        if (studySnap.exists()) {
          // Update the existing document
          await updateDoc(studyRef, {
            studyPlanData: data,
            updatedAt: serverTimestamp()
          });
          
          console.log('Updated study plan:', currentStudyId);
        } else {
          console.error('Study plan document not found');
          // If the document was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_personalStudies'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            query: studyQuery,
            studyTitle: data.studyPlan?.title || 'Untitled Study',
            studyPlanData: data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          setCurrentStudyId(docRef.id);
          console.log('Created replacement study plan with ID:', docRef.id);
        }
      }
      
      // Refresh the saved studies list
      fetchSavedStudies();
      
    } catch (err) {
      console.error('Error saving study plan to Firestore:', err);
      // Don't show this error to user as it's not critical
    }
  };

  // Find existing study plan
  const findExistingStudy = async (query) => {
    if (!currentUser) return null;
    
    try {
      // Create a query against the collection
      const q = query(
        collection(db, 'mainBibleTools_personalStudies'), 
        where('userId', '==', currentUser.uid),
        where('query', '==', query)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Get the first matching document
        const doc = querySnapshot.docs[0];
        console.log('Found existing study plan for query:', query);
        return {
          id: doc.id,
          ...doc.data()
        };
      }
      
      return null;
    } catch (err) {
      console.error('Error finding existing study plan:', err);
      return null;
    }
  };

  // Load saved study
  const loadSavedStudy = (study) => {
    setStudyQuery(study.query || '');
    setStudyPlanData(study.studyPlanData);
    setCurrentStudyId(study.id);
    setActiveTab('overview');
    setActiveSession(0);
  };

  // Reset current study
  const resetStudy = () => {
    setStudyPlanData(null);
    setCurrentStudyId(null);
    setActiveTab('overview');
    setActiveSession(0);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studyQuery.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot generate study plan: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setStudyPlanData(null);
    
    // Reset current study
    resetStudy();

    try {
      // First check if we have an existing study for this query
      if (currentUser) {
        const existingStudy = await findExistingStudy(studyQuery);
        
        if (existingStudy && existingStudy.studyPlanData) {
          console.log('Loading existing study plan from Firestore');
          
          // Set the study ID
          setCurrentStudyId(existingStudy.id);
          
          // Set the study plan data
          setStudyPlanData(existingStudy.studyPlanData);
          
          setIsLoading(false);
          return;
        }
      }
      
      // If no existing study is found, proceed with API request
      console.log(`Generating study plan for: ${studyQuery}`);
      const response = await axios.post('/api/tools/personal-study', {
        query: studyQuery
      });
      
      console.log('Response received:', response.status, response.statusText);
      
      if (!response.data) {
        throw new Error('Invalid response format from server');
      }
      
      setStudyPlanData(response.data);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        saveStudyToFirestore(response.data);
      }
    } catch (error) {
      console.error('Study plan generation error:', error);
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data);
        setError(error.response.data?.message || 'Failed to generate study plan. Server error.');
      } else if (error.request) {
        console.error('No response received:', error.request);
        setError('Failed to reach the server. Please try again later.');
      } else {
        setError(error.message || 'Failed to generate study plan. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render a badge based on difficulty
  const renderDifficultyBadge = (difficulty) => {
    let bgColor, textColor;
    
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
        break;
      case 'intermediate':
        bgColor = 'bg-blue-100';
        textColor = 'text-blue-800';
        break;
      case 'advanced':
        bgColor = 'bg-purple-100';
        textColor = 'text-purple-800';
        break;
      default:
        bgColor = 'bg-gray-100';
        textColor = 'text-gray-800';
    }
    
    return (
      <span className={`${bgColor} ${textColor} text-sm px-2 py-1 rounded`}>
        {difficulty || 'Unspecified'}
      </span>
    );
  };

  // Render list of items with icons
  const renderList = (items, icon) => {
    if (!items || items.length === 0) return <p className="text-gray-500 italic">No information available</p>;
    
    return (
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start">
            <span className="mr-2 text-indigo-500 mt-1">{icon}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  };

  // Render a memory verse card
  const renderMemoryVerse = (verse, index) => {
    return (
      <div key={index} className="border border-indigo-100 bg-indigo-50 rounded-lg p-4 mb-4">
        <p className="text-center font-bold text-indigo-800 mb-2">{verse.reference}</p>
        <p className="text-center italic mb-3">"{verse.text}"</p>
        {verse.reason && (
          <p className="text-sm text-gray-700 mt-2">
            <span className="font-medium">Why memorize this:</span> {verse.reason}
          </p>
        )}
      </div>
    );
  };

  // Render a study method card
  const renderStudyMethod = (method, index) => {
    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="font-bold text-lg mb-2">{method.name}</h3>
        <p className="mb-4">{method.description}</p>
        {method.steps && method.steps.length > 0 && (
          <div>
            <p className="font-medium text-gray-700 mb-2">Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              {method.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  };

  // Render a resource card
  const renderResource = (resource, index) => {
    const getIconForResourceType = (type) => {
      switch (type?.toLowerCase()) {
        case 'book':
          return '📚';
        case 'article':
          return '📄';
        case 'video':
          return '🎬';
        case 'commentary':
          return '📝';
        case 'website':
          return '🌐';
        case 'audio':
          return '🎧';
        default:
          return '📌';
      }
    };

    return (
      <div key={index} className="border border-gray-200 rounded-lg p-3 mb-3">
        <div className="flex items-start">
          <span className="text-xl mr-2">{getIconForResourceType(resource.type)}</span>
          <div>
            <h4 className="font-medium">{resource.title}</h4>
            <p className="text-sm text-gray-600">{resource.type}</p>
            {resource.description && <p className="mt-1 text-sm">{resource.description}</p>}
          </div>
        </div>
      </div>
    );
  };

  // Render a session activity
  const renderActivity = (activity, index) => {
    const getIconForActivityType = (type) => {
      switch (type?.toLowerCase()) {
        case 'read':
          return '📖';
        case 'reflect':
          return '🤔';
        case 'apply':
          return '⚙️';
        case 'discuss':
          return '💬';
        case 'pray':
          return '🙏';
        case 'write':
          return '✍️';
        default:
          return '📌';
      }
    };

    return (
      <div key={index} className="mb-4">
        <div className="flex items-center mb-2">
          <span className="text-xl mr-2">{getIconForActivityType(activity.type)}</span>
          <h4 className="font-medium text-indigo-700">{activity.type}</h4>
        </div>
        <div className="pl-8">
          <p>{activity.description}</p>
        </div>
      </div>
    );
  };

  // Get content based on active tab
  const getTabContent = () => {
    if (!studyPlanData) return null;
    
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Description</h3>
              <p>{studyPlanData.studyPlan?.description}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Learning Objectives</h3>
              {renderList(studyPlanData.learningObjectives, '🎯')}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Main Scriptures</h3>
              {renderList(studyPlanData.studyPlan?.mainScriptures, '📖')}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {studyPlanData.studyPlan?.keywords?.map((keyword, index) => (
                  <span key={index} className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
        
      case 'sessions':
        const session = studyPlanData.sessions?.[activeSession];
        if (!session) return <p>No session details available</p>;
        
        return (
          <div>
            {/* Session selector */}
            <div className="mb-6 overflow-x-auto">
              <div className="flex space-x-2">
                {studyPlanData.sessions?.map((session, index) => (
                  <button
                    key={index}
                    className={`px-3 py-2 rounded whitespace-nowrap ${
                      activeSession === index
                        ? 'bg-indigo-100 text-indigo-800 font-medium'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveSession(index)}
                  >
                    Session {index + 1}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Session content */}
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium text-indigo-800 mb-1">{session.title}</h3>
                <p className="text-gray-600 mb-4">{session.focus}</p>
              </div>
              
              <div>
                <h4 className="text-lg font-medium text-gray-800 mb-2">Scripture Passages</h4>
                {renderList(session.scriptures, '📖')}
              </div>
              
              <div>
                <h4 className="text-lg font-medium text-gray-800 mb-2">Activities</h4>
                {session.activities?.map(renderActivity) || 
                  <p className="text-gray-500 italic">No activities specified</p>
                }
              </div>
              
              <div>
                <h4 className="text-lg font-medium text-gray-800 mb-2">Study Questions</h4>
                {renderList(session.questions, '❓')}
              </div>
              
              {session.resources && session.resources.length > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-800 mb-2">Session Resources</h4>
                  {session.resources.map(renderResource)}
                </div>
              )}
            </div>
          </div>
        );
        
      case 'memory':
        return (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-4">Memory Verses</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {studyPlanData.memoryVerses?.map(renderMemoryVerse) || 
                <p className="text-gray-500 italic">No memory verses specified</p>
              }
            </div>
          </div>
        );
        
      case 'resources':
        return (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-4">Additional Resources</h3>
            <div className="space-y-2">
              {studyPlanData.additionalResources?.map(renderResource) || 
                <p className="text-gray-500 italic">No additional resources specified</p>
              }
            </div>
          </div>
        );
        
      case 'application':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Application Ideas</h3>
              {renderList(studyPlanData.applicationIdeas, '⚙️')}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Prayer Focus</h3>
              {renderList(studyPlanData.prayerFocus, '🙏')}
            </div>
          </div>
        );
        
      case 'methods':
        return (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-4">Study Methods</h3>
            {studyPlanData.studyMethods?.map(renderStudyMethod) || 
              <p className="text-gray-500 italic">No study methods specified</p>
            }
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
          <span className="font-bold">Note:</span> Study plans will not be saved since you're not logged in
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row">
        {/* Input area */}
        <div className="p-4 bg-gray-50 lg:w-1/3">
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label htmlFor="study-query" className="block text-sm font-medium text-gray-700 mb-1">
                What would you like to study?
              </label>
              <textarea
                id="study-query"
                value={studyQuery}
                onChange={(e) => setStudyQuery(e.target.value)}
                placeholder="Enter a topic, theme, book, character, question, or anything you'd like to study in the Bible (e.g., 'How to overcome anxiety', 'The book of James', 'Faith in difficult times')"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-32"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Be specific about what you want to learn or what questions you hope to answer.
              </p>
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !studyQuery.trim() || serverStatus !== 'online'}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Study Plan...
                </div>
              ) : 'Create Study Plan'}
            </button>
            
            {studyPlanData && (
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
                    <h4 className="font-medium">{study.studyTitle}</h4>
                    <p className="text-sm text-gray-600 truncate">{study.query}</p>
                    {study.studyPlanData?.studyPlan?.duration && (
                      <p className="text-xs text-indigo-600 mt-1">
                        {study.studyPlanData.studyPlan.duration} • {study.studyPlanData.studyPlan.difficulty || 'Unspecified'} level
                      </p>
                    )}
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
          ) : studyPlanData ? (
            <div>
              {/* Study plan header */}
              <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                <h2 className="text-2xl font-bold text-indigo-800 mb-1">
                  {studyPlanData.studyPlan?.title}
                </h2>
                
                <div className="flex flex-wrap gap-2 items-center mt-2">
                  {studyPlanData.studyPlan?.duration && (
                    <span className="bg-indigo-100 text-indigo-800 text-sm px-2 py-1 rounded">
                      {studyPlanData.studyPlan.duration}
                    </span>
                  )}
                  
                  {studyPlanData.studyPlan?.difficulty && (
                    renderDifficultyBadge(studyPlanData.studyPlan.difficulty)
                  )}
                </div>
              </div>
              
              {/* Tab navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="flex -mb-px overflow-x-auto">
                  {[
                    { id: 'overview', label: 'Overview', icon: '📋' },
                    { id: 'sessions', label: 'Study Sessions', icon: '📚' },
                    { id: 'memory', label: 'Memory Verses', icon: '💭' },
                    { id: 'resources', label: 'Resources', icon: '📑' },
                    { id: 'application', label: 'Application', icon: '⚙️' },
                    { id: 'methods', label: 'Study Methods', icon: '🔍' }
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
              <div className="text-5xl mb-3">📚</div>
              <p className="text-gray-500">Enter a topic to create your personalized Bible study plan</p>
              <p className="text-gray-400 text-sm mt-2">Get a structured plan with reading passages, reflection questions, and practical applications</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalStudy; 
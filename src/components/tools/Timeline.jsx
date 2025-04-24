import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db, storage } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query as firestoreQuery, where, getDocs } from 'firebase/firestore';

const Timeline = () => {
  const [queryInput, setQueryInput] = useState('');
  const [timelineData, setTimelineData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentTimelineId, setCurrentTimelineId] = useState(null);
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();

  // Auto-scroll to results when they change
  useEffect(() => {
    if (timelineData) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [timelineData]);

  // Check if the server is running when the component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          console.log('Server health check for Timeline:', data);
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

  // Find existing timelines in Firestore
  const findExistingTimeline = async (searchQuery) => {
    if (!currentUser) return null;
    
    try {
      // Create a query against the collection
      const q = firestoreQuery(
        collection(db, 'mainBibleTools_timelines'), 
        where('userId', '==', currentUser.uid),
        where('query', '==', searchQuery)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Get the first matching document
        const doc = querySnapshot.docs[0];
        console.log('Found existing timeline for query:', searchQuery);
        return {
          id: doc.id,
          ...doc.data()
        };
      }
      
      return null;
    } catch (err) {
      console.error('Error finding existing timeline:', err);
      return null;
    }
  };

  // Save results to Firestore
  const saveTimelineToFirestore = async (data, query) => {
    try {
      if (!currentUser) {
        console.log('User not logged in, cannot save timeline');
        return;
      }

      // If this is a new timeline
      if (!currentTimelineId) {
        // Create a new document
        const docRef = await addDoc(collection(db, 'mainBibleTools_timelines'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          query: query,
          title: data.title,
          timelineData: data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        setCurrentTimelineId(docRef.id);
        console.log('Created new timeline with ID:', docRef.id);
      } else {
        // Get the existing document
        const timelineRef = doc(db, 'mainBibleTools_timelines', currentTimelineId);
        const timelineSnap = await getDoc(timelineRef);
        
        if (timelineSnap.exists()) {
          // Update the existing document
          await updateDoc(timelineRef, {
            timelineData: data,
            updatedAt: serverTimestamp()
          });
          
          console.log('Updated timeline:', currentTimelineId);
        } else {
          console.error('Timeline document not found');
          // If the document was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_timelines'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            query: query,
            title: data.title,
            timelineData: data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          setCurrentTimelineId(docRef.id);
          console.log('Created replacement timeline with ID:', docRef.id);
        }
      }
    } catch (err) {
      console.error('Error saving timeline to Firestore:', err);
      // Don't show this error to user as it's not critical
    }
  };

  // Reset current timeline
  const resetTimeline = () => {
    setTimelineData(null);
    setCurrentTimelineId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!queryInput.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot generate timeline: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setTimelineData(null);
    
    // Reset current timeline
    resetTimeline();

    try {
      // First check if we have an existing timeline for this query
      if (currentUser) {
        const existingTimeline = await findExistingTimeline(queryInput);
        
        if (existingTimeline && existingTimeline.timelineData) {
          console.log('Loading existing timeline from Firestore');
          
          // Set the timeline ID
          setCurrentTimelineId(existingTimeline.id);
          
          // Set the timeline data
          setTimelineData(existingTimeline.timelineData);
          
          setIsLoading(false);
          return;
        }
      }
      
      // If no existing timeline is found, proceed with API request
      console.log(`Generating timeline for: ${queryInput}`);
      const response = await fetch('/api/tools/timeline', {
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
        throw new Error(errorData.message || 'Failed to generate timeline');
      }

      const data = await response.json();
      console.log('Received timeline data:', data);
      setTimelineData(data);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        saveTimelineToFirestore(data, queryInput);
      }
    } catch (error) {
      console.error('Error generating timeline:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Render a timeline event
  const renderTimelineEvent = (event, index) => {
    return (
      <div key={index} className="mb-8 relative pl-8 before:content-[''] before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-blue-300">
        {/* Date/Period Circle */}
        <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">{index + 1}</span>
        </div>
        
        {/* Event Content */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-blue-700">{event.date}</h3>
          <h4 className="text-base font-semibold mb-2">{event.title}</h4>
          <div className="text-gray-700 mb-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {event.description}
            </ReactMarkdown>
          </div>
          {event.scripture && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-600">Scripture References: </span>
              <span className="text-sm text-blue-600">{event.scripture}</span>
            </div>
          )}
        </div>
      </div>
    );
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
          <span className="font-bold">Note:</span> Timelines will not be saved since you're not logged in
        </div>
      )}
      
      {/* Input area */}
      <div className="p-4 bg-gray-50 border-b">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="query-input" className="block text-sm font-medium text-gray-700 mb-1">
              Enter your timeline query
            </label>
            <textarea
              id="query-input"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Example: Timeline of the Book of Acts, or Kings of Israel and Judah, or Events in the life of Moses"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-24"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              You can ask about specific biblical periods, events, characters, or books.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !queryInput.trim() || serverStatus !== 'online'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating Timeline...' : 'Generate Timeline'}
          </button>
        </form>
      </div>
      
      {/* Results area */}
      <div className="flex-1 p-4 overflow-y-auto" ref={resultsRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        ) : timelineData ? (
          <div className="prose max-w-none">
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">{timelineData.title}</h1>
            {timelineData.description && (
              <div className="mb-8 text-center text-gray-600 max-w-2xl mx-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {timelineData.description}
                </ReactMarkdown>
              </div>
            )}
            
            {/* Timeline View */}
            <div className="timeline-container">
              {timelineData.events && timelineData.events.map((event, index) => (
                renderTimelineEvent(event, index)
              ))}
            </div>
            
            {/* Additional information */}
            {timelineData.additionalInfo && (
              <div className="mt-8 pt-4 border-t border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Additional Information</h2>
                <div className="text-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {timelineData.additionalInfo}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">📜</div>
            <p className="text-gray-500">Enter a query to generate a biblical timeline</p>
            <p className="text-gray-400 text-sm mt-2">Visualize events, periods, or characters from the Bible</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Timeline; 
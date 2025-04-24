import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../firebase/AuthContext';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, query as firestoreQuery, where, getDocs } from 'firebase/firestore';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const Maps = () => {
  const [queryInput, setQueryInput] = useState('');
  const [mapData, setMapData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentMapId, setCurrentMapId] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const mapRef = useRef(null);
  const resultsRef = useRef(null);
  const { currentUser } = useAuth();
  const [mapInput, setMapInput] = useState('');
  const [savedMaps, setSavedMaps] = useState([]);
  const [currentSavedMapId, setCurrentSavedMapId] = useState(null);
  const [mapTitle, setMapTitle] = useState('');
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Auto-scroll to results when they change
  useEffect(() => {
    if (mapData) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mapData]);

  // Check if the server is running when the component mounts
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setServerStatus('checking');
        const response = await axios.get('/api/health');
        if (response.data.status === 'ok') {
          console.log('Server health check for Maps:', response.data);
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
  }, []);

  // Initialize map when data changes
  useEffect(() => {
    if (mapData && mapRef.current) {
      initializeMap();
    }
  }, [mapData]);

  // Find existing maps in Firestore
  const findExistingMap = async (searchQuery) => {
    if (!currentUser) return null;
    
    try {
      // Create a query against the collection
      const q = firestoreQuery(
        collection(db, 'mainBibleTools_maps'), 
        where('userId', '==', currentUser.uid),
        where('query', '==', searchQuery)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Get the first matching document
        const doc = querySnapshot.docs[0];
        console.log('Found existing map for query:', searchQuery);
        return {
          id: doc.id,
          ...doc.data()
        };
      }
      
      return null;
    } catch (err) {
      console.error('Error finding existing map:', err);
      return null;
    }
  };

  // Save results to Firestore
  const saveMapToFirestore = async (data, query) => {
    try {
      if (!currentUser) {
        console.log('User not logged in, cannot save map');
        return;
      }

      // If this is a new map
      if (!currentMapId) {
        // Create a new document
        const docRef = await addDoc(collection(db, 'mainBibleTools_maps'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          query: query,
          title: data.title,
          mapData: data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        setCurrentMapId(docRef.id);
        console.log('Created new map with ID:', docRef.id);
      } else {
        // Get the existing document
        const mapRef = doc(db, 'mainBibleTools_maps', currentMapId);
        const mapSnap = await getDoc(mapRef);
        
        if (mapSnap.exists()) {
          // Update the existing document
          await updateDoc(mapRef, {
            mapData: data,
            updatedAt: serverTimestamp()
          });
          
          console.log('Updated map:', currentMapId);
        } else {
          console.error('Map document not found');
          // If the document was deleted, create a new one
          const docRef = await addDoc(collection(db, 'mainBibleTools_maps'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            query: query,
            title: data.title,
            mapData: data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          setCurrentMapId(docRef.id);
          console.log('Created replacement map with ID:', docRef.id);
        }
      }
    } catch (err) {
      console.error('Error saving map to Firestore:', err);
      // Don't show this error to user as it's not critical
    }
  };

  // Initialize map with locations
  const initializeMap = () => {
    if (!mapData || !mapData.locations || mapData.locations.length === 0 || !mapRef.current) {
      console.error("Cannot initialize map - missing data or DOM element", {
        hasMapData: !!mapData,
        hasLocations: !!(mapData && mapData.locations),
        locationsLength: mapData?.locations?.length || 0,
        hasMapRef: !!mapRef.current
      });
      return;
    }

    console.log("Initializing map with locations:", mapData.locations);

    // Clear any existing map
    mapRef.current.innerHTML = '';

    try {
      // Directly use Leaflet since we've already imported it
      // Create map instance
      const map = L.map(mapRef.current);
      mapInstanceRef.current = map;

      // Add the OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Process locations and add markers
      const markers = [];
      mapData.locations.forEach((location, index) => {
        if (!location.coordinates || location.coordinates.length < 2) {
          console.warn(`Location ${location.name} has invalid coordinates`, location.coordinates);
          return;
        }

        const lat = location.coordinates[0];
        const lng = location.coordinates[1];
        
        console.log(`Adding marker for ${location.name} at [${lat}, ${lng}]`);
        
        try {
          const marker = L.marker([lat, lng]).addTo(map);
          markers.push(marker);
          
          // Add a popup with basic info
          marker.bindPopup(`<b>${location.name}</b><br>${location.shortDescription || ''}`);
          
          // Add a click handler to update the selected location
          marker.on('click', () => {
            setSelectedLocation(location);
          });
        } catch (err) {
          console.error(`Error adding marker for ${location.name}:`, err);
        }
      });
      
      // If we have markers, set the view to fit them all
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
      } else {
        // Default view centered on Jerusalem if no markers
        map.setView([31.7683, 35.2137], 8);
      }
      
      // Select the first location by default
      if (mapData.locations.length > 0 && !selectedLocation) {
        setSelectedLocation(mapData.locations[0]);
      }
    } catch (error) {
      console.error("Error initializing map:", error);
      setError("Failed to initialize map. Please try again.");
    }
  };

  // Reset current map
  const resetMap = () => {
    setMapData(null);
    setCurrentMapId(null);
    setSelectedLocation(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!queryInput.trim()) return;

    // Don't try to send if server is offline
    if (serverStatus !== 'online') {
      setError('Cannot generate map: server is offline');
      return;
    }

    // Reset any previous errors
    setError('');
    setIsLoading(true);
    setMapData(null);
    setSelectedLocation(null);
    
    // Reset current map
    resetMap();

    try {
      // First check if we have an existing map for this query
      if (currentUser) {
        const existingMap = await findExistingMap(queryInput);
        
        if (existingMap && existingMap.mapData) {
          console.log('Loading existing map from Firestore');
          
          // Set the map ID
          setCurrentMapId(existingMap.id);
          
          // Set the map data
          setMapData(existingMap.mapData);
          
          setIsLoading(false);
          return;
        }
      }
      
      // If no existing map is found, proceed with API request
      console.log(`Generating map for: ${queryInput}`);
      const response = await axios.post('/api/maps', {
        query: queryInput
      });

      console.log('Response status:', response.status);
      
      const data = response.data;
      console.log('Received map data:', data);
      setMapData(data);
      
      // Save to Firestore if user is logged in
      if (currentUser) {
        saveMapToFirestore(data, queryInput);
      }
    } catch (error) {
      console.error('Error generating map:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSavedMaps = async () => {
    if (!currentUser) return;
    
    try {
      const mapsQuery = firestoreQuery(
        collection(db, "users", currentUser.uid, "maps"),
        where("userId", "==", currentUser.uid)
      );
      
      const querySnapshot = await getDocs(mapsQuery);
      const maps = [];
      
      querySnapshot.forEach((doc) => {
        maps.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setSavedMaps(maps);
    } catch (error) {
      console.error("Error fetching maps:", error);
    }
  };

  const findExistingMapInUserCollection = async (title) => {
    if (!currentUser) return null;
    
    try {
      const mapsQuery = firestoreQuery(
        collection(db, "users", currentUser.uid, "maps"),
        where("title", "==", title),
        where("userId", "==", currentUser.uid)
      );
      
      const querySnapshot = await getDocs(mapsQuery);
      
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id;
      }
      
      return null;
    } catch (error) {
      console.error("Error finding existing map:", error);
      return null;
    }
  };

  const saveMapToFirestoreInUserCollection = async () => {
    if (!currentUser || !mapData) return;
    
    try {
      const title = mapTitle || mapInput.substring(0, 30) + (mapInput.length > 30 ? '...' : '');
      
      const mapToSave = {
        title,
        query: mapInput,
        locations: mapData.locations,
        createdAt: serverTimestamp(),
        userId: currentUser.uid
      };
      
      if (currentSavedMapId) {
        const mapRef = doc(db, "users", currentUser.uid, "maps", currentSavedMapId);
        
        try {
          const mapDoc = await getDoc(mapRef);
          
          if (mapDoc.exists()) {
            await updateDoc(mapRef, {
              ...mapToSave,
              updatedAt: serverTimestamp()
            });
            return currentSavedMapId;
          } else {
            setCurrentSavedMapId(null);
            const newMapRef = await addDoc(collection(db, "users", currentUser.uid, "maps"), mapToSave);
            return newMapRef.id;
          }
        } catch (error) {
          console.error("Error checking map existence:", error);
          const newMapRef = await addDoc(collection(db, "users", currentUser.uid, "maps"), mapToSave);
          return newMapRef.id;
        }
      } else {
        const existingMapId = await findExistingMapInUserCollection(title);
        
        if (existingMapId) {
          const mapRef = doc(db, "users", currentUser.uid, "maps", existingMapId);
          await updateDoc(mapRef, {
            ...mapToSave,
            updatedAt: serverTimestamp()
          });
          return existingMapId;
        } else {
          const newMapRef = await addDoc(collection(db, "users", currentUser.uid, "maps"), mapToSave);
          return newMapRef.id;
        }
      }
    } catch (error) {
      console.error("Error saving map to Firestore:", error);
      throw error;
    }
  };

  const handleMapSubmit = async (e) => {
    e.preventDefault();
    
    if (!mapInput.trim() || serverStatus !== 'online') {
      return;
    }
    
    setIsLoading(true);
    setError('');
    setMapData(null); // Clear previous map data
    
    try {
      console.log(`Generating map for query: "${mapInput}"`);
      const response = await axios.post('/api/maps', {
        query: mapInput
      });
      
      console.log('Response received:', response.status, response.statusText);
      console.log('Map data:', response.data);
      
      if (!response.data || !response.data.locations || !Array.isArray(response.data.locations)) {
        throw new Error('Invalid response format from server');
      }
      
      setMapData(response.data);
      setCurrentSavedMapId(null);
      
      // Initialize map after data is set
      setTimeout(() => {
        if (mapRef.current) {
          initializeMap();
        }
      }, 100);
      
      if (currentUser) {
        try {
          const savedId = await saveMapToFirestoreInUserCollection();
          setCurrentSavedMapId(savedId);
          fetchSavedMaps();
        } catch (error) {
          console.error("Error saving map:", error);
        }
      }
    } catch (error) {
      console.error("Map generation error:", error);
      if (error.response) {
        console.error("Error response:", error.response.status, error.response.data);
        setError(error.response.data?.message || "Failed to generate map data. Server error.");
      } else if (error.request) {
        console.error("No response received:", error.request);
        setError("Failed to reach the server. Please try again later.");
      } else {
        setError(error.message || "Failed to generate map data. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedMap = async (mapId) => {
    if (!currentUser) return;
    
    try {
      const mapRef = doc(db, "users", currentUser.uid, "maps", mapId);
      const mapDoc = await getDoc(mapRef);
      
      if (mapDoc.exists()) {
        const mapData = mapDoc.data();
        setMapInput(mapData.query);
        setMapData({
          locations: mapData.locations
        });
        setMapTitle(mapData.title);
        setCurrentSavedMapId(mapId);
      }
    } catch (error) {
      console.error("Error loading saved map:", error);
      setError("Failed to load saved map. Please try again.");
    }
  };

  return (
    <div className="relative">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {serverStatus !== 'online' && (
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded">
          {serverStatus === 'checking' ? 'Checking server status...' : 'Server is offline. Maps tool is currently unavailable.'}
        </div>
      )}
      
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-1/3">
          <form onSubmit={handleMapSubmit} className="mb-8">
            <div className="mb-4">
              <label 
                htmlFor="mapInput" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                What biblical places would you like to explore?
              </label>
              <textarea
                id="mapInput"
                rows="4"
                className="w-full p-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Example: Show me locations from Paul's missionary journeys"
                value={mapInput}
                onChange={(e) => setMapInput(e.target.value)}
                disabled={isLoading || serverStatus !== 'online'}
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={!mapInput.trim() || isLoading || serverStatus !== 'online'}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate Map'
                )}
              </button>
              
              {mapData && (
                <button
                  type="button"
                  onClick={resetMap}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
          
          {currentUser && savedMaps.length > 0 && (
            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-700 mb-2">Your Saved Maps</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {savedMaps.map(map => (
                  <button
                    key={map.id}
                    onClick={() => loadSavedMap(map.id)}
                    className={`block w-full text-left p-2 rounded hover:bg-gray-100 ${currentSavedMapId === map.id ? 'bg-blue-50 border border-blue-200' : ''}`}
                  >
                    <div className="font-medium">{map.title}</div>
                    <div className="text-xs text-gray-500">
                      {map.createdAt?.toDate ? map.createdAt.toDate().toLocaleDateString() : 'Unknown date'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="w-full md:w-2/3">
          {mapData ? (
            <div className="rounded shadow-lg overflow-hidden">
              <div 
                ref={mapRef} 
                className="h-80 w-full"
              ></div>
              
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-4">Results</h2>
                
                <div className="space-y-4">
                  {mapData.overview && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-700 mb-1">Overview</h3>
                      <div className="text-gray-600">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {mapData.overview}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  <h3 className="font-medium text-gray-700 mb-1">Locations</h3>
                  <div className="space-y-3">
                    {mapData.locations?.map((location, index) => (
                      <div key={`${location.name}-${index}`} className="bg-gray-50 p-3 rounded">
                        <h4 className="font-medium">{location.name}</h4>
                        {location.description && (
                          <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                        )}
                        {location.verses && location.verses.length > 0 && (
                          <div className="mt-2">
                            <h5 className="text-xs font-medium text-gray-500">Bible References:</h5>
                            <ul className="text-xs text-gray-600 list-disc pl-4 mt-1">
                              {location.verses.map((verse, i) => (
                                <li key={i}>{verse}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {location.coordinates && (
                          <div className="mt-2 text-xs text-gray-500">
                            Coordinates: {location.coordinates.latitude}, {location.coordinates.longitude}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded flex flex-col items-center justify-center h-80">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <h3 className="text-lg font-medium text-gray-700 mb-1">No Map Generated Yet</h3>
              <p className="text-gray-500 text-center">
                Enter your query about biblical locations to generate an interactive map
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Maps; 
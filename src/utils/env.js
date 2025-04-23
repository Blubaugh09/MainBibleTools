/**
 * Get environment variables with fallbacks
 * This helps handle both REACT_APP_ and VITE_ prefixed environment variables
 */
export const getEnvVariable = (key) => {
  // First try direct access to the variable
  if (import.meta.env[key] !== undefined) {
    return import.meta.env[key];
  }
  
  // For Vite, REACT_APP_ variables need to be explicitly defined in vite.config.js
  // We'll log which variables are missing to help debugging
  console.log(`Accessing env variable: ${key}, value: ${import.meta.env[key] || 'undefined'}`);
  
  return import.meta.env[key] || '';
};

// Firebase config
export const firebaseConfig = {
  apiKey: import.meta.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.REACT_APP_FIREBASE_APP_ID,
  databaseURL: import.meta.env.REACT_APP_FIREBASE_DATABASE_URL,
  measurementId: import.meta.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Log Firebase config for debugging (remove sensitive info in production)
console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? 'SET' : 'NOT SET',
  authDomain: firebaseConfig.authDomain ? 'SET' : 'NOT SET',
  projectId: firebaseConfig.projectId ? 'SET' : 'NOT SET',
  storageBucket: firebaseConfig.storageBucket ? 'SET' : 'NOT SET',
  messagingSenderId: firebaseConfig.messagingSenderId ? 'SET' : 'NOT SET', 
  appId: firebaseConfig.appId ? 'SET' : 'NOT SET',
  databaseURL: firebaseConfig.databaseURL ? 'SET' : 'NOT SET',
  measurementId: firebaseConfig.measurementId ? 'SET' : 'NOT SET'
});

// Other API keys
export const openAiApiKey = import.meta.env.REACT_APP_OPENAI_API_KEY;
export const esvApiKey = import.meta.env.REACT_APP_ESV_API_KEY; 
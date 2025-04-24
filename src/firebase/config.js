import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Helper to get env vars from either location
const getEnvVar = (key, reactKey) => {
  // First try with VITE_ prefix, then with REACT_APP_ prefix
  return import.meta.env[key] || import.meta.env[reactKey] || '';
};

// Access environment variables with fallbacks
const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', 'REACT_APP_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', 'REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', 'REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', 'REACT_APP_FIREBASE_APP_ID'),
  databaseURL: getEnvVar('VITE_FIREBASE_DATABASE_URL', 'REACT_APP_FIREBASE_DATABASE_URL'),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', 'REACT_APP_FIREBASE_MEASUREMENT_ID')
};

// For debugging - remove in production
console.log("Firebase config keys:", Object.keys(firebaseConfig));
console.log("Firebase config initialized with:", {
  apiKey: firebaseConfig.apiKey ? "API KEY SET" : "API KEY MISSING",
  authDomain: firebaseConfig.authDomain ? "SET" : "MISSING",
  projectId: firebaseConfig.projectId ? "SET" : "MISSING",
  storageBucket: firebaseConfig.storageBucket ? "SET" : "MISSING",
  messagingSenderId: firebaseConfig.messagingSenderId ? "SET" : "MISSING",
  appId: firebaseConfig.appId ? "SET" : "MISSING",
  databaseURL: firebaseConfig.databaseURL ? "SET" : "MISSING",
  measurementId: firebaseConfig.measurementId ? "SET" : "MISSING"
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage }; 
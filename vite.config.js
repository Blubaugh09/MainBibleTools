import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory
  // Only load variables with VITE_ prefix for security
  const env = loadEnv(mode, process.cwd())
  
  // Replace REACT_APP_ variables with VITE_ versions to support both formats
  const envWithReactAppVars = {
    'VITE_FIREBASE_API_KEY': env.VITE_FIREBASE_API_KEY,
    'VITE_FIREBASE_AUTH_DOMAIN': env.VITE_FIREBASE_AUTH_DOMAIN,
    'VITE_FIREBASE_PROJECT_ID': env.VITE_FIREBASE_PROJECT_ID,
    'VITE_FIREBASE_STORAGE_BUCKET': env.VITE_FIREBASE_STORAGE_BUCKET,
    'VITE_FIREBASE_MESSAGING_SENDER_ID': env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    'VITE_FIREBASE_APP_ID': env.VITE_FIREBASE_APP_ID,
    'VITE_FIREBASE_DATABASE_URL': env.VITE_FIREBASE_DATABASE_URL,
    'VITE_FIREBASE_MEASUREMENT_ID': env.VITE_FIREBASE_MEASUREMENT_ID,
    'VITE_OPENAI_API_KEY': env.VITE_OPENAI_API_KEY,
    'VITE_ESV_API_KEY': env.VITE_ESV_API_KEY,
    // Also provide REACT_APP_ versions
    'REACT_APP_FIREBASE_API_KEY': env.VITE_FIREBASE_API_KEY,
    'REACT_APP_FIREBASE_AUTH_DOMAIN': env.VITE_FIREBASE_AUTH_DOMAIN,
    'REACT_APP_FIREBASE_PROJECT_ID': env.VITE_FIREBASE_PROJECT_ID,
    'REACT_APP_FIREBASE_STORAGE_BUCKET': env.VITE_FIREBASE_STORAGE_BUCKET,
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID': env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    'REACT_APP_FIREBASE_APP_ID': env.VITE_FIREBASE_APP_ID,
    'REACT_APP_FIREBASE_DATABASE_URL': env.VITE_FIREBASE_DATABASE_URL,
    'REACT_APP_FIREBASE_MEASUREMENT_ID': env.VITE_FIREBASE_MEASUREMENT_ID,
    'REACT_APP_OPENAI_API_KEY': env.VITE_OPENAI_API_KEY,
    'REACT_APP_ESV_API_KEY': env.VITE_ESV_API_KEY
  }
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false
        }
      }
    },
    define: {
      // Only expose specific env variables to avoid security issues
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID),
      'import.meta.env.VITE_FIREBASE_DATABASE_URL': JSON.stringify(env.VITE_FIREBASE_DATABASE_URL),
      'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(env.VITE_FIREBASE_MEASUREMENT_ID),
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY),
      'import.meta.env.VITE_ESV_API_KEY': JSON.stringify(env.VITE_ESV_API_KEY),
      // Also provide REACT_APP_ versions
      'import.meta.env.REACT_APP_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.REACT_APP_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.REACT_APP_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID),
      'import.meta.env.REACT_APP_FIREBASE_DATABASE_URL': JSON.stringify(env.VITE_FIREBASE_DATABASE_URL),
      'import.meta.env.REACT_APP_FIREBASE_MEASUREMENT_ID': JSON.stringify(env.VITE_FIREBASE_MEASUREMENT_ID),
      'import.meta.env.REACT_APP_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY),
      'import.meta.env.REACT_APP_ESV_API_KEY': JSON.stringify(env.VITE_ESV_API_KEY)
    }
  }
})

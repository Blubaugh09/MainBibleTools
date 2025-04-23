import React from 'react';
import VisualParallels from '../../components/tools/VisualParallels';
import { useAuth } from '../../firebase/AuthContext';
import { Navigate } from 'react-router-dom';

const VisualParallelsView = () => {
  const { currentUser, loading } = useAuth();

  // If auth is still loading, show a loading indicator
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-700"></div>
      </div>
    );
  }

  // If user is not logged in, redirect to login page
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Visual Parallels</h1>
        <p className="text-gray-600 mb-8">
          Explore the connections between Old and New Testament themes, symbols, and concepts. 
          Enter a query about biblical parallels, and the tool will generate a visual side-by-side comparison.
        </p>
        
        <VisualParallels />
      </div>
    </div>
  );
};

export default VisualParallelsView; 
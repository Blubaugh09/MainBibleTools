import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../firebase/AuthContext';
import Images from '../../components/tools/Images';

const ImagesView = () => {
  const [error, setError] = useState('');
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError('Failed to log out');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Biblical Image Generator</h1>
          </div>
          
          <div className="flex items-center">
            {currentUser && (
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
            <p>{error}</p>
          </div>
        )}
        
        <div className="bg-white shadow rounded-lg p-6">
          <Images />
          
          <div className="mt-8 border-t pt-6 text-gray-600">
            <h2 className="text-lg font-medium text-gray-900 mb-2">About Biblical Image Generator</h2>
            <p>
              This tool uses advanced AI to create images based on biblical scenes, characters, and concepts. 
              The images are generated with careful attention to historical and biblical accuracy while 
              maintaining appropriate representation.
            </p>
            <p className="mt-3">
              You can create visualizations of stories from Scripture, conceptual images of biblical themes, 
              or artistic renderings of locations mentioned in the Bible.
            </p>
            <p className="mt-3 text-sm">
              <strong>Note:</strong> All images are AI-generated interpretations and should be considered artistic 
              representations rather than historically accurate depictions.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ImagesView; 
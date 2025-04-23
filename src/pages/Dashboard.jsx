import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../firebase/AuthContext';

const Dashboard = () => {
  const [error, setError] = useState('');
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setError('');
    
    try {
      await logout();
      navigate('/');
    } catch {
      setError('Failed to log out');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Bible Tools Dashboard</h1>
          <button 
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Welcome, {currentUser?.email}</h2>
          
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-700 mb-3">Dashboard Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded shadow-sm">
                <h4 className="font-medium text-blue-700">Bible Study Tools</h4>
                <p className="text-sm text-gray-600 mt-1">Access various Bible study tools</p>
              </div>
              <div className="bg-green-50 p-4 rounded shadow-sm">
                <h4 className="font-medium text-green-700">Personal Notes</h4>
                <p className="text-sm text-gray-600 mt-1">Manage your personal study notes</p>
              </div>
              <div className="bg-purple-50 p-4 rounded shadow-sm">
                <h4 className="font-medium text-purple-700">Bible Reading Plans</h4>
                <p className="text-sm text-gray-600 mt-1">Track your Bible reading progress</p>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-4">
            <h3 className="text-lg font-medium text-gray-700 mb-3">Recent Activity</h3>
            <p className="text-gray-500 italic">No recent activity to display</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 
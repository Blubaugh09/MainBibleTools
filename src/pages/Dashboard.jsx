import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

  // Available tools
  const tools = [
    {
      id: 'advanced-chat',
      name: 'Advanced Bible Chat',
      description: 'Get deeper insights with our more advanced AI model using GPT-4o-mini',
      icon: '✨',
      color: 'indigo',
      path: '/tools/advanced-chat'
    },
    {
      id: 'bible-commentary',
      name: 'Bible Commentary',
      description: 'Get in-depth commentary on any chapter of the Bible',
      icon: '📖',
      color: 'blue',
      path: '/tools/bible-commentary'
    },
    {
      id: 'verse-analyzer',
      name: 'Verse Analyzer',
      description: 'Analyze any Bible verse to discover deeper meaning and context',
      icon: '🔍',
      color: 'purple',
      path: '/tools/verse-analyzer'
    }
  ];

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
        
        <div className="grid grid-cols-1 gap-6">
          {/* User Info */}
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
          </div>

          {/* Bible Study AI Tools */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Bible Study AI Tools</h2>
            <p className="text-gray-600 mb-6">
              Select a tool to enhance your Bible study experience. Each tool provides unique 
              capabilities powered by artificial intelligence.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => {
                // Define styles based on color
                let borderClass = "border-gray-200";
                let hoverClass = "hover:bg-gray-50";
                let textClass = "text-gray-700";
                let linkClass = "text-gray-600";
                
                if (tool.color === 'indigo') {
                  borderClass = "border-indigo-200";
                  hoverClass = "hover:bg-indigo-50";
                  textClass = "text-indigo-700";
                  linkClass = "text-indigo-600";
                } else if (tool.color === 'blue') {
                  borderClass = "border-blue-200";
                  hoverClass = "hover:bg-blue-50";
                  textClass = "text-blue-700";
                  linkClass = "text-blue-600";
                } else if (tool.color === 'purple') {
                  borderClass = "border-purple-200";
                  hoverClass = "hover:bg-purple-50";
                  textClass = "text-purple-700";
                  linkClass = "text-purple-600";
                }
                
                return (
                  <Link 
                    key={tool.id}
                    to={tool.path}
                    className={`block p-6 border ${borderClass} rounded-lg ${hoverClass} transition-colors duration-200`}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-center mb-4">
                        <span className="text-3xl mr-2">{tool.icon}</span>
                        <h3 className={`font-semibold ${textClass}`}>{tool.name}</h3>
                      </div>
                      <p className="text-gray-600 text-sm flex-grow">{tool.description}</p>
                      <div className={`mt-4 ${linkClass} font-medium text-sm flex items-center`}>
                        Open Tool
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
            <p className="text-gray-500 italic">No recent activity to display</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 
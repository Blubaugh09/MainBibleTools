import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../firebase/AuthContext';
import BibleCommentary from '../components/tools/BibleCommentary';
import VerseAnalyzer from '../components/tools/VerseAnalyzer';
import AdvancedChat from '../components/AdvancedChat';

const UnifiedToolView = () => {
  const [error, setError] = useState('');
  const [selectedTool, setSelectedTool] = useState('chat');
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

  const navigateToDashboard = () => {
    navigate('/dashboard');
  };

  // Available tools
  const tools = [
    {
      id: 'chat',
      name: 'Advanced Bible Chat',
      description: 'Get deeper insights with our more advanced AI model using GPT-4o-mini',
      icon: '✨',
      color: 'indigo'
    },
    {
      id: 'commentary',
      name: 'Bible Commentary',
      description: 'Get in-depth commentary on any chapter of the Bible',
      icon: '📖',
      color: 'blue'
    },
    {
      id: 'verse-analyzer',
      name: 'Verse Analyzer',
      description: 'Analyze any Bible verse to discover deeper meaning and context',
      icon: '🔍',
      color: 'purple'
    }
  ];

  // Get current tool
  const currentTool = tools.find(tool => tool.id === selectedTool) || tools[0];

  // Render the selected tool component
  const renderSelectedTool = () => {
    switch (selectedTool) {
      case 'commentary':
        return <BibleCommentary />;
      case 'verse-analyzer':
        return <VerseAnalyzer />;
      case 'chat':
      default:
        return <AdvancedChat />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={navigateToDashboard}
              className="mr-4 text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Bible Study AI Tools</h1>
          </div>
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
          {/* Tool selector */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              <span className="mr-2">{currentTool.icon}</span>
              {currentTool.name}
            </h2>
            <p className="text-gray-600 mb-4">{currentTool.description}</p>
            
            <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600 w-full mb-2">Choose a tool:</p>
              {tools.map((tool) => {
                // Define styles based on color
                let bgClass = "bg-gray-100";
                let textClass = "text-gray-700";
                let activeClass = "bg-gray-200 border-gray-300";
                
                if (tool.color === 'indigo') {
                  bgClass = "bg-indigo-50";
                  textClass = "text-indigo-700";
                  activeClass = "bg-indigo-100 border-indigo-300";
                } else if (tool.color === 'blue') {
                  bgClass = "bg-blue-50";
                  textClass = "text-blue-700";
                  activeClass = "bg-blue-100 border-blue-300";
                } else if (tool.color === 'purple') {
                  bgClass = "bg-purple-50";
                  textClass = "text-purple-700";
                  activeClass = "bg-purple-100 border-purple-300";
                }
                
                return (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 border-2 
                      ${selectedTool === tool.id 
                        ? activeClass
                        : `${bgClass} border-transparent hover:bg-opacity-70`}`}
                  >
                    <span className="text-lg">{tool.icon}</span>
                    <span className={`font-medium ${textClass}`}>{tool.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Tool content area */}
          <div className="border-t border-gray-200 pt-6">
            {renderSelectedTool()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UnifiedToolView; 
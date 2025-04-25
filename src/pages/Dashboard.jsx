import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../firebase/AuthContext';
import BibleCommentary from '../components/tools/BibleCommentary';
import VerseAnalyzer from '../components/tools/VerseAnalyzer';
import VisualParallels from '../components/tools/VisualParallels';
import Timeline from '../components/tools/Timeline';
import Maps from '../components/tools/Maps';
import Images from '../components/tools/Images';
import CharacterStudy from '../components/tools/CharacterStudy';
import PersonalStudy from '../components/tools/PersonalStudy';
import AdvancedChat from '../components/AdvancedChat';
import ThemeThreads from '../components/tools/ThemeThreads';

const Dashboard = () => {
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
    },
    {
      id: 'character-study',
      name: 'Character Study',
      description: 'Study biblical characters, their stories, relationships, and legacy',
      icon: '👤',
      color: 'teal'
    },
    {
      id: 'personal-study',
      name: 'Personal Study',
      description: 'Get customized Bible study plans for any topic or question',
      icon: '📚',
      color: 'pink'
    },
    {
      id: 'theme-threads',
      name: 'Theme Threads',
      description: 'Explore how biblical themes develop and connect across Scripture',
      icon: '🧵',
      color: 'orange'
    },
    {
      id: 'visual-parallels',
      name: 'Visual Parallels',
      description: 'Explore connections between Old and New Testament themes and symbols',
      icon: '🔄',
      color: 'green'
    },
    {
      id: 'timeline',
      name: 'Biblical Timeline',
      description: 'Generate visual timelines of biblical events, characters, and periods',
      icon: '📅',
      color: 'amber'
    },
    {
      id: 'maps',
      name: 'Biblical Maps',
      description: 'Explore locations and geography mentioned in the Bible',
      icon: '🗺️',
      color: 'amber'
    },
    {
      id: 'images',
      name: 'Biblical Images',
      description: 'Generate visual representations of biblical scenes and concepts',
      icon: '🖼️',
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
      case 'character-study':
        return <CharacterStudy />;
      case 'personal-study':
        return <PersonalStudy />;
      case 'theme-threads':
        return <ThemeThreads />;
      case 'visual-parallels':
        return <VisualParallels />;
      case 'timeline':
        return <Timeline />;
      case 'maps':
        return <Maps />;
      case 'images':
        return <Images />;
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
            <h1 className="text-2xl font-bold text-gray-800">Bible Study Tools</h1>
            <p className="ml-4 text-sm text-gray-500">Logged in as: {currentUser?.email}</p>
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
                } else if (tool.color === 'teal') {
                  bgClass = "bg-teal-50";
                  textClass = "text-teal-700";
                  activeClass = "bg-teal-100 border-teal-300";
                } else if (tool.color === 'green') {
                  bgClass = "bg-green-50";
                  textClass = "text-green-700";
                  activeClass = "bg-green-100 border-green-300";
                } else if (tool.color === 'amber') {
                  bgClass = "bg-amber-50";
                  textClass = "text-amber-700";
                  activeClass = "bg-amber-100 border-amber-300";
                } else if (tool.color === 'orange') {
                  bgClass = "bg-orange-50";
                  textClass = "text-orange-700";
                  activeClass = "bg-orange-100 border-orange-300";
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

export default Dashboard; 
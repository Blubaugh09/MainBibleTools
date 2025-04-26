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
import ThemeThread from '../components/tools/ThemeThread';

const Dashboard = () => {
  const [error, setError] = useState('');
  const [selectedTool, setSelectedTool] = useState('chat');
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  /* -----------------------------------------
     Auth
  ----------------------------------------- */
  const handleLogout = async () => {
    setError('');
    try {
      await logout();
      navigate('/');
    } catch {
      setError('Failed to log out');
    }
  };

  /* -----------------------------------------
     Tools & helpers
  ----------------------------------------- */
  const tools = [
    { id: 'chat', name: 'Advanced Bible Chat', description: 'Get deeper insights with our more advanced AI model using GPT‑4o‑mini', icon: '✨', color: 'indigo' },
    { id: 'commentary', name: 'Bible Commentary', description: 'Get in‑depth commentary on any chapter of the Bible', icon: '📖', color: 'blue' },
    { id: 'verse-analyzer', name: 'Verse Analyzer', description: 'Analyze any Bible verse to discover deeper meaning and context', icon: '🔍', color: 'purple' },
    { id: 'character-study', name: 'Character Study', description: 'Study biblical characters, their stories, relationships, and legacy', icon: '👤', color: 'teal' },
    { id: 'personal-study', name: 'Personal Study', description: 'Get customized Bible study plans for any topic or question', icon: '📚', color: 'pink' },
    { id: 'visual-parallels', name: 'Visual Parallels', description: 'Explore connections between Old and New Testament themes and symbols', icon: '🔄', color: 'green' },
    { id: 'timeline', name: 'Biblical Timeline', description: 'Generate visual timelines of biblical events, characters, and periods', icon: '📅', color: 'amber' },
    { id: 'maps', name: 'Biblical Maps', description: 'Explore locations and geography mentioned in the Bible', icon: '🗺️', color: 'amber' },
    { id: 'images', name: 'Biblical Images', description: 'Generate visual representations of biblical scenes and concepts', icon: '🖼️', color: 'purple' },
    { id: 'theme-thread', name: 'Theme Thread', description: 'View the theme thread of the Bible', icon: '🧵', color: 'green' }
  ];

  const quickTools = tools.slice(0, 3);
  const extraTools = tools.slice(3);
  const currentTool = tools.find((t) => t.id === selectedTool) || tools[0];

  /* Map color → Tailwind classes */
  const getColorClasses = (tool) => {
    const map = {
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', active: 'bg-indigo-100 border-indigo-300' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-700', active: 'bg-blue-100 border-blue-300' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-700', active: 'bg-purple-100 border-purple-300' },
      teal: { bg: 'bg-teal-50', text: 'text-teal-700', active: 'bg-teal-100 border-teal-300' },
      green: { bg: 'bg-green-50', text: 'text-green-700', active: 'bg-green-100 border-green-300' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-700', active: 'bg-amber-100 border-amber-300' },
      pink: { bg: 'bg-pink-50', text: 'text-pink-700', active: 'bg-pink-100 border-pink-300' }
    };
    return map[tool.color] || { bg: 'bg-gray-50', text: 'text-gray-700', active: 'bg-gray-200 border-gray-300' };
  };

  /* Render the proper component */
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
      case 'visual-parallels':
        return <VisualParallels />;
      case 'timeline':
        return <Timeline />;
      case 'maps':
        return <Maps />;
      case 'images':
        return <Images />;
      case 'theme-thread':
        return <ThemeThread />;
      case 'chat':
      default:
        return <AdvancedChat />;
    }
  };

  /* -----------------------------------------
     UI
  ----------------------------------------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 w-full">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Bible Study Tools</h1>
            <p className="text-xs sm:text-sm text-gray-500 sm:ml-3 break-all">Logged in as: {currentUser?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium text-sm">
            Logout
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 overflow-x-hidden">
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

        <div className="bg-white shadow rounded-lg p-4 sm:p-6">
          {/* Tool Selector */}
          <div className="mb-5">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <span className="text-xl sm:text-2xl">{currentTool.icon}</span>
              {currentTool.name}
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 leading-snug">{currentTool.description}</p>

            {/* Quick tools */}
            <p className="text-xs text-gray-600 mb-2">Quick tools:</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {quickTools.map((tool) => {
                const { bg, text, active } = getColorClasses(tool);
                const isActive = selectedTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                    className={`flex flex-col items-center justify-center rounded-lg border-2 p-2 text-center text-[10px] xs:text-xs sm:text-sm h-16 ${
                      isActive ? active : `${bg} ${text} border-transparent hover:bg-opacity-80`
                    }`}
                  >
                    <span className="text-base xs:text-lg">{tool.icon}</span>
                    <span className="font-medium leading-tight truncate max-w-full">{tool.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Toggle extra tools */}
            <button
              onClick={() => setShowMore(!showMore)}
              className="text-xs sm:text-sm font-medium text-blue-600 underline mb-2"
            >
              {showMore ? 'Hide extra tools' : 'More tools'}
            </button>

            {/* Extra tools grid */}
            {showMore && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {extraTools.map((tool) => {
                  const { bg, text, active } = getColorClasses(tool);
                  const isActive = selectedTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setSelectedTool(tool.id)}
                      className={`flex flex-col items-center justify-center rounded-lg border-2 p-2 text-center text-[10px] xs:text-xs sm:text-sm h-16 ${
                        isActive ? active : `${bg} ${text} border-transparent hover:bg-opacity-80`
                      }`}
                    >
                      <span className="text-base xs:text-lg">{tool.icon}</span>
                      <span className="font-medium leading-tight truncate max-w-full">{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tool content */}
          <div className="border-t border-gray-200 pt-5">{renderSelectedTool()}</div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

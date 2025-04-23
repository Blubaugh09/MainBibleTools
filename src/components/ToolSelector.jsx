import { useState } from 'react';

// Tool components
import BibleCommentary from './tools/BibleCommentary';
import VerseAnalyzer from './tools/VerseAnalyzer';
import AdvancedChat from './AdvancedChat';

const ToolSelector = () => {
  const [selectedTool, setSelectedTool] = useState('chat');

  // Define available tools
  const tools = [
    { id: 'chat', name: 'Advanced Chat', description: 'Get answers from GPT-4o-mini' },
    { id: 'commentary', name: 'Bible Commentary', description: 'In-depth commentary on Bible chapters' },
    { id: 'verse-analyzer', name: 'Verse Analyzer', description: 'Analyze and understand Bible verses' },
  ];

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
    <div className="w-full flex flex-col gap-6">
      {/* Tool selector */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select a Tool</h3>
        <div className="flex flex-wrap gap-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                selectedTool === tool.id
                  ? 'bg-indigo-100 text-indigo-800 border-2 border-indigo-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              <span className="font-medium">{tool.name}</span>
              {selectedTool === tool.id && (
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {tools.find(tool => tool.id === selectedTool)?.description}
        </p>
      </div>

      {/* Tool content area */}
      <div className="bg-white rounded-lg shadow">
        {renderSelectedTool()}
      </div>
    </div>
  );
};

export default ToolSelector; 
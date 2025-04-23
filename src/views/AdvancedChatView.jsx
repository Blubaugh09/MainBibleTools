import { useState } from 'react';
import AdvancedChat from '../components/AdvancedChat';
import { useChatMessages } from '../hooks/useChatMessages';

const AdvancedChatView = () => {
  // Custom hook to fetch and manage chat data
  const { 
    messages, 
    isLoading, 
    error, 
    sendMessage 
  } = useChatMessages('advanced');

  const handleSendMessage = async (messageText) => {
    await sendMessage(messageText);
  };

  return (
    <div className="w-full h-full">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Advanced Bible Chat</h1>
        <p className="text-gray-600 mb-4">
          Ask questions about the Bible and get detailed answers using our advanced AI model.
        </p>
      </div>
      
      <AdvancedChat 
        messages={messages}
        isLoading={isLoading}
        error={error}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};

export default AdvancedChatView; 
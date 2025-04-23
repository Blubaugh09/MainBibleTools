import { useState } from 'react';
import BibleCommentary from '../components/tools/BibleCommentary';
import { useCommentaryData } from '../hooks/useCommentaryData';

const BibleCommentaryView = () => {
  const [book, setBook] = useState('Genesis');
  const [chapter, setChapter] = useState('1');
  
  // Custom hook to fetch and manage commentary data
  const { 
    commentaryData, 
    isLoading, 
    error, 
    fetchCommentary 
  } = useCommentaryData();

  const handleFetchCommentary = async (bookName, chapterNum) => {
    await fetchCommentary(bookName, chapterNum);
  };

  return (
    <div className="w-full h-full">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Bible Commentary</h1>
        <p className="text-gray-600 mb-4">
          Get in-depth commentary on any chapter of the Bible with historical context and theological insights.
        </p>
      </div>
      
      <BibleCommentary 
        currentBook={book}
        currentChapter={chapter}
        commentaryData={commentaryData}
        isLoading={isLoading}
        error={error}
        onBookChange={setBook}
        onChapterChange={setChapter}
        onSubmit={handleFetchCommentary}
      />
    </div>
  );
};

export default BibleCommentaryView; 
import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BibleCommentary = ({
  currentBook = 'Genesis',
  currentChapter = '1',
  commentaryData = null,
  isLoading = false,
  error = '',
  serverStatus = 'checking',
  onBookChange,
  onChapterChange,
  onSubmit
}) => {
  const commentaryRef = useRef(null);

  // Bible books array for dropdown
  const bibleBooks = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
    "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(currentBook, currentChapter);
  };

  // Generate an array of chapter numbers based on the selected book
  const getChapterCount = (book) => {
    const chapterCounts = {
      "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
      "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24, 
      "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36, 
      "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150, 
      "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66, 
      "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12, 
      "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7, 
      "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, 
      "Malachi": 4, "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, 
      "Acts": 28, "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, 
      "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4, 
      "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, 
      "Titus": 3, "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, 
      "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
    };
    
    return Array.from({ length: chapterCounts[book] || 1 }, (_, i) => (i + 1).toString());
  };

  const chapters = getChapterCount(currentBook);

  // Render table of contents if available
  const renderTableOfContents = () => {
    if (!commentaryData || !commentaryData.sections || commentaryData.sections.length === 0) {
      return null;
    }

    return (
      <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Contents</h3>
        <ul className="list-disc pl-5 space-y-1">
          {commentaryData.sections.map((section, index) => (
            <li key={index} className={section.level === 3 ? "ml-4" : ""}>
              <span className="text-indigo-600 hover:underline cursor-pointer">
                {section.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Status indicators */}
      {error && (
        <div className="px-4 py-2 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}
      
      {serverStatus === 'checking' && (
        <div className="px-4 py-2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 text-sm">
          <span className="font-bold">Connecting...</span> Checking server status
        </div>
      )}
      
      {serverStatus === 'offline' && !error && (
        <div className="px-4 py-2 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm">
          <span className="font-bold">Offline:</span> Server is not running
        </div>
      )}
      
      {/* Selection controls */}
      <div className="p-4 bg-gray-50 border-b">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="book-select" className="block text-sm font-medium text-gray-700 mb-1">Book</label>
            <select
              id="book-select"
              value={currentBook}
              onChange={(e) => {
                onBookChange(e.target.value);
                onChapterChange('1'); // Reset chapter when book changes
              }}
              className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              {bibleBooks.map((bookName) => (
                <option key={bookName} value={bookName}>
                  {bookName}
                </option>
              ))}
            </select>
          </div>
          
          <div className="w-full sm:w-auto">
            <label htmlFor="chapter-select" className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
            <select
              id="chapter-select"
              value={currentChapter}
              onChange={(e) => onChapterChange(e.target.value)}
              className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              {chapters.map((chapterNum) => (
                <option key={chapterNum} value={chapterNum}>
                  {chapterNum}
                </option>
              ))}
            </select>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || serverStatus !== 'online'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Get Commentary'}
          </button>
        </form>
      </div>
      
      {/* Commentary content area */}
      <div className="flex-1 p-4 h-[400px] overflow-y-auto" ref={commentaryRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-700"></div>
          </div>
        ) : commentaryData ? (
          <div className="prose max-w-none">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{commentaryData.book} {commentaryData.chapter}</h2>
            
            {renderTableOfContents()}
            
            <div className="markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-md font-bold mb-1" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1" {...props} />,
                  a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />,
                  code: ({node, inline, ...props}) => 
                    inline 
                      ? <code className="bg-gray-100 text-sm rounded px-1 py-0.5" {...props} />
                      : <pre className="bg-gray-100 p-2 rounded my-2 overflow-x-auto"><code {...props} /></pre>
                }}
              >
                {commentaryData.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-gray-500">Select a book and chapter and click "Get Commentary"</p>
            <p className="text-gray-400 text-sm mt-2">You'll receive AI-generated insights and commentary</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BibleCommentary; 
import { useState } from 'react';
import VerseAnalyzer from '../components/tools/VerseAnalyzer';
import { useVerseAnalysis } from '../hooks/useVerseAnalysis';

const VerseAnalyzerView = () => {
  const [verseInput, setVerseInput] = useState('');
  
  // Custom hook to fetch and manage verse analysis data
  const { 
    analysisData, 
    isLoading, 
    error, 
    analyzeVerse 
  } = useVerseAnalysis();

  const handleAnalyzeVerse = async (verseText) => {
    await analyzeVerse(verseText);
  };

  return (
    <div className="w-full h-full">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Verse Analyzer</h1>
        <p className="text-gray-600 mb-4">
          Analyze Bible verses for deeper understanding of their meaning, context, and application.
        </p>
      </div>
      
      <VerseAnalyzer 
        currentVerse={verseInput}
        analysisData={analysisData}
        isLoading={isLoading}
        error={error}
        onVerseChange={setVerseInput}
        onSubmit={handleAnalyzeVerse}
      />
    </div>
  );
};

export default VerseAnalyzerView; 
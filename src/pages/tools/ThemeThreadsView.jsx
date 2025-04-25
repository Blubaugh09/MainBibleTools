import React from 'react';
import { Helmet } from 'react-helmet';
import ThemeThreads from '../../components/tools/ThemeThreads';
import { Link } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';

const ThemeThreadsView = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Theme Threads | Bible Study Assistant</title>
      </Helmet>
      
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                <RiArrowLeftLine className="mr-1" />
                Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Theme Threads</h1>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <ThemeThreads />
        </div>
      </main>
    </div>
  );
};

export default ThemeThreadsView; 
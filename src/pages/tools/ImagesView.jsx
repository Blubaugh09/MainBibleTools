import React from 'react';
import Header from '../../components/Header';
import Images from '../../components/tools/Images';
import RequireAuth from '../../components/RequireAuth';

const ImagesView = () => {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto py-6 px-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold mb-6 text-center">Biblical Image Generator</h1>
            <p className="text-gray-600 mb-8 text-center max-w-2xl mx-auto">
              Use AI to visualize biblical scenes, characters, and stories. Create educational 
              visuals for Bible study, presentations, or personal reflection.
            </p>
            <Images />
          </div>
        </main>
      </div>
    </RequireAuth>
  );
};

export default ImagesView; 
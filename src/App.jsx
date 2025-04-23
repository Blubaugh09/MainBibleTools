import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './firebase/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import BibleCommentaryView from './pages/tools/BibleCommentaryView';
import VerseAnalyzerView from './pages/tools/VerseAnalyzerView';
import AdvancedChatView from './pages/tools/AdvancedChatView';

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/tools/bible-commentary" 
            element={
              <PrivateRoute>
                <BibleCommentaryView />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/tools/verse-analyzer" 
            element={
              <PrivateRoute>
                <VerseAnalyzerView />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/tools/advanced-chat" 
            element={
              <PrivateRoute>
                <AdvancedChatView />
              </PrivateRoute>
            } 
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './firebase/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import VisualParallelsView from './pages/tools/VisualParallelsView';
import TimelineView from './pages/tools/TimelineView';
import MapsView from './pages/tools/MapsView';
import ImagesView from './pages/tools/ImagesView';

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
            path="/tools/visual-parallels" 
            element={
              <PrivateRoute>
                <VisualParallelsView />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/tools/timeline" 
            element={
              <PrivateRoute>
                <TimelineView />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/tools/maps" 
            element={
              <PrivateRoute>
                <MapsView />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/tools/images" 
            element={
              <PrivateRoute>
                <ImagesView />
              </PrivateRoute>
            } 
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;

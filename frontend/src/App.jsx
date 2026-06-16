import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { storage } from './utils/api';
import JoinPage from './pages/JoinPage';
import DashboardPage from './pages/DashboardPage';
import MomentsPage from './pages/MomentsPage';
import ProfilePage from './pages/ProfilePage';
import TeamPage from './pages/TeamPage';
import PlayersPage from './pages/PlayersPage';
import Navigation from './components/Navigation';

// Inner component that has access to Router context (needed for useNavigate)
function AppContent() {
  const [playerId, setPlayerId] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Load player ID from localStorage
    const savedPlayerId = storage.getPlayerId();
    setPlayerId(savedPlayerId);

    // Load dark mode preference
    const isDarkMode = storage.isDarkModeEnabled();
    setDarkMode(isDarkMode);

    // Apply dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    setLoading(false);
  }, []);

  const handleJoinTeam = (newPlayerId) => {
    storage.setPlayerId(newPlayerId);
    setPlayerId(newPlayerId);
    // Explicitly navigate to home so the user always lands on the right page
    navigate('/', { replace: true });
  };

  const handleLogout = () => {
    setPlayerId(null);
    storage.clearPlayerId();
    storage.clearPlayerInfo();
    // Navigate back to join page on logout
    navigate('/', { replace: true });
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    storage.setDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-volleyball-darker flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-volleyball-darker text-gray-100">
      {playerId ? (
        <>
          <Routes>
            <Route path="/" element={<MomentsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/map" element={<Navigate to="/" replace />} />
            <Route path="/moments" element={<Navigate to="/" replace />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Navigation
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            onLogout={handleLogout}
          />
        </>
      ) : (
        <Routes>
          <Route path="/*" element={<JoinPage onJoinTeam={handleJoinTeam} />} />
        </Routes>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

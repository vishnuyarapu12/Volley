import React, { useState, useEffect, useRef } from 'react';
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const playerIdRef = useRef(null);

  useEffect(() => {
    // Load player ID from localStorage
    const savedPlayerId = storage.getPlayerId();
    setPlayerId(savedPlayerId);
    
    // Load admin state
    const savedIsAdmin = storage.isAdmin();
    setIsAdmin(savedIsAdmin);

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
    playerIdRef.current = newPlayerId;
    setPlayerId(newPlayerId);
    // Explicitly navigate to home so the user always lands on the right page
    navigate('/', { replace: true });
  };

  const handleAdminLogin = () => {
    storage.setAdmin(true);
    setIsAdmin(true);
    navigate('/', { replace: true });
  };

  const handleLogout = async () => {
    playerIdRef.current = null;
    setPlayerId(null);
    setIsAdmin(false);
    storage.clearPlayerId();
    storage.clearPlayerInfo();
    storage.clearAdmin();
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
      {playerId || isAdmin ? (
        <>
          <Routes>
            <Route path="/" element={<MomentsPage isAdmin={isAdmin} />} />
            <Route path="/dashboard" element={<DashboardPage isAdmin={isAdmin} />} />
            <Route path="/players" element={<PlayersPage isAdmin={isAdmin} />} />
            <Route path="/team" element={<TeamPage isAdmin={isAdmin} />} />
            <Route path="/map" element={<Navigate to="/" replace />} />
            <Route path="/moments" element={<Navigate to="/" replace />} />
            <Route path="/profile" element={playerId ? <ProfilePage /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Navigation
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            onLogout={handleLogout}
            isAdmin={isAdmin}
            hasPlayerId={!!playerId}
          />
        </>
      ) : (
        <Routes>
          <Route path="/*" element={<JoinPage onJoinTeam={handleJoinTeam} onAdminLogin={handleAdminLogin} />} />
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

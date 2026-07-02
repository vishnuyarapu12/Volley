import axios from 'axios';

// VITE_API_URL must be set in .env (e.g. https://your-backend.com)
// In dev with no env var, falls back to Vite proxy (/api → localhost:5000)
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}`
  : (import.meta.env.DEV ? '' : 'http://localhost:5000');

const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  }
});

// API endpoints
export const playerAPI = {
  // Join a team (name only — instant, no location)
  joinTeam: async (name, team, jersey = 0) => {
    try {
      const parsedJersey = Number.parseInt(String(jersey), 10);
      const response = await api.post('/join', {
        name: String(name).trim(),
        team: String(team || '').trim(),
        jersey: Number.isFinite(parsedJersey) ? parsedJersey : 0,
      });
      return response.data;
    } catch (error) {
      console.error('Error joining team:', error);
      throw error;
    }
  },

  // Get all players
  getPlayers: async () => {
    try {
      const response = await api.get('/players');
      return response.data;
    } catch (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
  },

  // Cast where-you-are vote (manual check-in)
  castLocationVote: async (playerId, vote) => {
    try {
      const info = localStorage.getItem('volleytrack_player_info');
      const playerInfo = info ? JSON.parse(info) : {};

      const response = await api.post('/location-vote', {
        player_id: playerId,
        vote,
        name: playerInfo.name || 'Unknown Player',
        team: playerInfo.team || '',
        jersey: playerInfo.jersey || 0,
      });
      return response.data;
    } catch (error) {
      console.error('Error casting location vote:', error);
      throw error;
    }
  },

  // Get all location votes and counts
  getLocationVotes: async () => {
    try {
      const response = await api.get('/location-votes');
      return response.data;
    } catch (error) {
      console.error('Error fetching location votes:', error);
      throw error;
    }
  },

  // Get dashboard stats
  getStats: async () => {
    try {
      const response = await api.get('/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  },

  // Get ground status
  getGroundStatus: async () => {
    try {
      const response = await api.get('/ground-status');
      return response.data;
    } catch (error) {
      console.error('Error fetching ground status:', error);
      throw error;
    }
  },

  // Get player details
  getPlayerDetails: async (playerId) => {
    try {
      const response = await api.get(`/player/${playerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching player details:', error);
      throw error;
    }
  },

  // Health check
  healthCheck: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Error in health check:', error);
      throw error;
    }
  },

  // Mark player as offline (browser close / tab close)
  goOffline: async (playerId) => {
    try {
      await api.post('/go-offline', { player_id: playerId });
    } catch (error) {
      // Silently fail — this is best-effort on browser close
    }
  },

  // Upload profile picture with optional display name for showcase
  uploadProfilePicture: async (playerId, file, pictureName = '') => {
    try {
      const formData = new FormData();
      formData.append('player_id', playerId);
      formData.append('image', file);
      if (pictureName) {
        formData.append('picture_name', pictureName);
      }

      const response = await api.post('/upload-profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw error;
    }
  },

  // Get player picture
  getPlayerPicture: async (playerId) => {
    try {
      const response = await api.get(`/player/${playerId}/picture`);
      return response.data;
    } catch (error) {
      console.error('Error getting player picture:', error);
      throw error;
    }
  },

  // Admin Login
  adminLogin: async (username, password) => {
    try {
      const response = await api.post('/admin-login', { username, password });
      return response.data;
    } catch (error) {
      console.error('Error admin login:', error);
      throw error;
    }
  },

  // Update Admin Credentials
  updateAdminCredentials: async (new_username, new_password) => {
    try {
      const response = await api.put('/admin/credentials', { new_username, new_password });
      return response.data;
    } catch (error) {
      console.error('Error updating admin credentials:', error);
      throw error;
    }
  },

  // Get uploaded moments
  getMoments: async () => {
    try {
      const response = await api.get('/moments');
      return response.data;
    } catch (error) {
      console.error('Error getting moments:', error);
      throw error;
    }
  },

  // Upload a moment image
  uploadMoment: async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.post('/upload-moment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading moment:', error);
      throw error;
    }
  }
};

// Local storage helpers
export const storage = {
  setPlayerId: (id) => localStorage.setItem('volleytrack_player_id', id),
  getPlayerId: () => localStorage.getItem('volleytrack_player_id'),
  clearPlayerId: () => localStorage.removeItem('volleytrack_player_id'),
  
  setPlayerInfo: (info) => localStorage.setItem('volleytrack_player_info', JSON.stringify(info)),
  getPlayerInfo: () => {
    const info = localStorage.getItem('volleytrack_player_info');
    return info ? JSON.parse(info) : null;
  },
  clearPlayerInfo: () => localStorage.removeItem('volleytrack_player_info'),

  setLocationTracking: (enabled) => localStorage.setItem('volleytrack_tracking', enabled),
  isLocationTrackingEnabled: () => localStorage.getItem('volleytrack_tracking') === 'true',

  setDarkMode: (enabled) => localStorage.setItem('volleytrack_dark_mode', enabled),
  isDarkModeEnabled: () => localStorage.getItem('volleytrack_dark_mode') !== 'false',

  setAdmin: (isAdmin) => localStorage.setItem('volleytrack_admin', isAdmin),
  isAdmin: () => localStorage.getItem('volleytrack_admin') === 'true',
  clearAdmin: () => localStorage.removeItem('volleytrack_admin')
};

export default api;

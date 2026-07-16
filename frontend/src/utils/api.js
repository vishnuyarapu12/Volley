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
  // Join a team
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

  // Save/update a player in the database (admin roster edit)
  savePlayer: async ({ player_id, name, role, team, jersey }) => {
    try {
      const response = await api.post('/join', {
        player_id: player_id || undefined,
        name: String(name).trim(),
        role: String(role || 'Player').trim(),
        team: String(team || '').trim(),
        jersey: Number.isFinite(Number(jersey)) ? Number(jersey) : 0,
      });
      return response.data;
    } catch (error) {
      console.error('Error saving player:', error);
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

  // Upload profile picture with optional display name
  // onProgress: (percent) => void — optional callback for upload progress
  uploadProfilePicture: async (playerId, file, pictureName = '', onProgress = null) => {
    try {
      const formData = new FormData();
      formData.append('player_id', playerId);
      formData.append('image', file);
      if (pictureName) {
        formData.append('picture_name', pictureName);
      }

      const response = await api.post('/upload-profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress
          ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || 1)))
          : undefined,
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

  // Get uploaded moments from the database
  getMoments: async () => {
    try {
      const response = await api.get('/moments');
      return response.data;
    } catch (error) {
      console.error('Error getting moments:', error);
      throw error;
    }
  },

  // Upload a moment image (to Supabase Storage via the backend)
  // onProgress: (percent) => void — optional callback for upload progress
  uploadMoment: async (file, onProgress = null) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.post('/upload-moment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress
          ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || 1)))
          : undefined,
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading moment:', error);
      throw error;
    }
  },

  // Delete a moment by ID
  deleteMoment: async (momentId) => {
    try {
      const response = await api.delete(`/delete-moment/${momentId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting moment:', error);
      throw error;
    }
  },
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

  setDarkMode: (enabled) => localStorage.setItem('volleytrack_dark_mode', enabled),
  isDarkModeEnabled: () => localStorage.getItem('volleytrack_dark_mode') !== 'false',

  setAdmin: (isAdmin) => localStorage.setItem('volleytrack_admin', isAdmin),
  isAdmin: () => localStorage.getItem('volleytrack_admin') === 'true',
  clearAdmin: () => localStorage.removeItem('volleytrack_admin')
};

export default api;

import axios from 'axios';

// In dev, use Vite proxy (/api → backend). In production, set VITE_API_URL or default to :5000.
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:5000');

const api = axios.create({
  baseURL: API_BASE_URL,
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

  // Send location update (includes name/team for auto-registration after server restart)
  updateLocation: async (playerId, latitude, longitude) => {
    try {
      // Pull player info from localStorage for auto-registration fallback
      const info = localStorage.getItem('volleytrack_player_info');
      const playerInfo = info ? JSON.parse(info) : {};

      const response = await api.post('/location-update', {
        player_id: playerId,
        latitude,
        longitude,
        name: playerInfo.name || 'Unknown Player',
        team: playerInfo.team || '',
        jersey: playerInfo.jersey || 0,
      });
      return response.data;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  },

  // Moments gallery images from ./images folder
  getMomentsImages: async () => {
    try {
      const response = await api.get('/images/list');
      return response.data;
    } catch (error) {
      console.error('Error fetching moments images:', error);
      throw error;
    }
  },

  // Live map: ground + online players with GPS
  getMapData: async () => {
    try {
      const response = await api.get('/map/data');
      return response.data;
    } catch (error) {
      console.error('Error fetching map data:', error);
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

  // Update ground location (runtime only, resets on server restart)
  updateGroundLocation: async (latitude, longitude) => {
    try {
      const response = await api.post('/update-ground-location', {
        latitude,
        longitude
      });
      return response.data;
    } catch (error) {
      console.error('Error updating ground location:', error);
      throw error;
    }
  },

  // Permanently save ground location to config.py on disk
  saveGroundLocation: async (latitude, longitude) => {
    try {
      const response = await api.post('/save-ground-location', {
        latitude,
        longitude
      });
      return response.data;
    } catch (error) {
      console.error('Error saving ground location:', error);
      throw error;
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
  isDarkModeEnabled: () => localStorage.getItem('volleytrack_dark_mode') !== 'false'
};

/** URL for an image served from backend ./images */
export const getMomentImageUrl = (filename) => {
  const path = `/images/${encodeURIComponent(filename)}`;
  if (import.meta.env.DEV) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
};

export default api;

import React, { useEffect, useState } from 'react';
import { storage, playerAPI } from '../utils/api';
import MatchReadinessMeter from '../components/MatchReadinessMeter';
import PlayerGroundStatus from '../components/PlayerGroundStatus';
import { Lock, Save, Loader } from 'lucide-react';

export default function DashboardPage({ isAdmin }) {
  const [playerInfo, setPlayerInfo] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPlayerInfo(storage.getPlayerInfo());
  }, []);

  const handleUpdateCredentials = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      setError('Username and password are required');
      setMessage('');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await playerAPI.updateAdminCredentials(newUsername.trim(), newPassword.trim());
      if (res?.success) {
        setMessage('Credentials updated successfully!');
        setNewUsername('');
        setNewPassword('');
      } else {
        setError(res?.error || 'Failed to update credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-volleyball-darker">
      <div className="sticky top-0 z-20 bg-volleyball-dark/95 backdrop-blur border-b border-white/10 px-4 py-4">
        <h1 className="text-2xl font-black text-volleyball-accent">VolleyTrack</h1>
        <p className="text-sm text-gray-400">Welcome, {isAdmin ? 'Admin' : (playerInfo?.name || 'Player')}</p>
      </div>

      <div className="px-4 py-6 mb-24 space-y-8">
        {isAdmin && (
          <div className="glass-dark p-6 rounded-3xl border border-volleyball-accent/20 animate-slideUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-xl border border-red-500/30">
                <Lock className="text-red-400" size={20} />
              </div>
              <h2 className="text-xl font-bold text-white">Admin Settings</h2>
            </div>
            
            <form onSubmit={handleUpdateCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-300">New Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="input-field"
                  placeholder="Enter new username"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-300">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field"
                  placeholder="Enter new password"
                  disabled={loading}
                />
              </div>
              
              {message && <div className="text-green-400 text-sm font-semibold bg-green-500/10 p-3 rounded-xl border border-green-500/20 text-center">{message}</div>}
              {error && <div className="text-red-400 text-sm font-semibold bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">{error}</div>}
              
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base"
              >
                {loading ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                Update Credentials
              </button>
            </form>
          </div>
        )}

        <MatchReadinessMeter />
        <PlayerGroundStatus />
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { playerAPI, storage } from '../utils/api';
import { User, Users, Shirt, CheckCircle, Loader, Lock, Key } from 'lucide-react';

export default function JoinPage({ onJoinTeam, onAdminLogin }) {
  const [loginMode, setLoginMode] = useState('player'); // 'player' or 'admin'
  const [formData, setFormData] = useState({ name: '', team: '', jersey: '' });
  const [adminData, setAdminData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleAdminInputChange = (e) => {
    const { name, value } = e.target;
    setAdminData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await playerAPI.joinTeam(
        formData.name.trim(),
        formData.team.trim(),
        formData.jersey || 0
      );

      if (response?.success && response?.player_id) {
        storage.setPlayerId(response.player_id);
        storage.setPlayerInfo({
          name: formData.name.trim(),
          team: formData.team.trim(),
          jersey: Number.parseInt(formData.jersey, 10) || 0,
        });
        onJoinTeam(response.player_id);
      } else {
        setError(response?.error || 'Unable to join the team. Please try again.');
      }
    } catch (err) {
      const isNetwork =
        err.code === 'ERR_NETWORK' ||
        err.message?.includes('Network Error');
      setError(
        err.response?.data?.error ||
          (isNetwork
            ? 'Cannot reach the server. Start the backend (python backend/app.py) and refresh.'
            : 'Unable to join the team. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!adminData.username.trim() || !adminData.password.trim()) {
      setError('Username and password are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await playerAPI.adminLogin(adminData.username.trim(), adminData.password.trim());
      if (response?.success) {
        onAdminLogin();
      } else {
        setError(response?.error || 'Invalid credentials.');
      }
    } catch (err) {
      const isNetwork = err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      setError(
        err.response?.data?.error ||
        (isNetwork ? 'Cannot reach the server.' : 'Login failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-animated flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fadeIn">
          <div className="text-7xl mb-4 animate-float">🏐</div>
          <h1 className="text-5xl font-black text-volleyball-accent mb-2 tracking-tight">
            VolleyTrack
          </h1>
          <p className="text-gray-400 text-lg">Smart Volleyball Presence Network</p>
        </div>

        <div className="glass-dark p-8 rounded-3xl border border-volleyball-accent/20 shadow-2xl shadow-black/50 animate-slideUp">
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setLoginMode('player'); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${loginMode === 'player' ? 'bg-volleyball-accent text-gray-900 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              Player Login
            </button>
            <button
              onClick={() => { setLoginMode('admin'); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${loginMode === 'admin' ? 'bg-volleyball-accent text-gray-900 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              Admin Login
            </button>
          </div>

          <h2 className="text-2xl font-bold text-center mb-6">
            {loginMode === 'player' ? 'Join Your Team' : 'Admin Access'}
          </h2>

          {loginMode === 'player' ? (
            <form onSubmit={handleJoin} className="space-y-5">
              <div className="input-group">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  <User className="inline mr-2 text-yellow-400" size={15} />
                  Your Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="Enter your full name"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  <Users className="inline mr-2 text-blue-400" size={15} />
                  Team Name <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="team"
                  value={formData.team}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="e.g., Warriors, Tigers"
                  disabled={loading}
                />
              </div>

              <div className="input-group">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  <Shirt className="inline mr-2 text-purple-400" size={15} />
                  Jersey Number <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  name="jersey"
                  value={formData.jersey}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="e.g., 7"
                  min="1"
                  max="99"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-500/15 border border-red-500/40 text-red-300 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                id="join-team-btn"
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base"
              >
                {loading ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Join Team
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-5">
              <div className="input-group">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  <User className="inline mr-2 text-yellow-400" size={15} />
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={adminData.username}
                  onChange={handleAdminInputChange}
                  className="input-field"
                  placeholder="Admin username"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  <Key className="inline mr-2 text-red-400" size={15} />
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={adminData.password}
                  onChange={handleAdminInputChange}
                  className="input-field"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-500/15 border border-red-500/40 text-red-300 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base"
              >
                {loading ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock size={20} />
                    Login as Admin
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

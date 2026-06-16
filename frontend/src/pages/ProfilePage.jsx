import React, { useEffect, useState } from 'react';
import { storage, playerAPI } from '../utils/api';
import { User, Users, Award, TrendingUp } from 'lucide-react';

export default function ProfilePage() {
  const [playerInfo, setPlayerInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const playerId = storage.getPlayerId();
    const info = storage.getPlayerInfo();

    setPlayerInfo(info);

    if (playerId) {
      fetchPlayerStats(playerId);
    }
  }, []);

  const fetchPlayerStats = async (playerId) => {
    try {
      const response = await playerAPI.getPlayerDetails(playerId);
      setStats(response.statistics);
    } catch (error) {
      console.error('Error fetching player stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!playerInfo) {
    return (
      <div className="min-h-screen bg-volleyball-darker flex items-center justify-center">
        <p className="text-gray-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-volleyball-darker pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-volleyball-dark/95 backdrop-blur border-b border-white/10 px-4 py-4">
        <h1 className="text-2xl font-black text-volleyball-accent flex items-center gap-2">
          <User size={28} />
          Profile
        </h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Player Card */}
        <div className="glass-dark p-8 rounded-2xl text-center border-2 border-volleyball-accent/30">
          <div className="text-6xl mb-4">⚽</div>
          <h2 className="text-3xl font-black text-volleyball-accent mb-2">
            {playerInfo.name}
          </h2>
          <p className="text-gray-300 mb-4">{playerInfo.team}</p>

          {playerInfo.jersey > 0 && (
            <div className="inline-flex items-center gap-3 bg-volleyball-accent/20 border border-volleyball-accent/50 rounded-lg px-4 py-2">
              <span className="text-gray-300">Jersey:</span>
              <div className="w-10 h-10 bg-volleyball-accent text-volleyball-darker flex items-center justify-center rounded font-bold">
                {playerInfo.jersey}
              </div>
            </div>
          )}
        </div>

        {/* Statistics */}
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="spinner"></div>
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-volleyball-accent">Statistics</h3>

            <StatCard
              icon={Award}
              label="Total Visits"
              value={stats.visits}
              color="green"
            />

            <StatCard
              icon={TrendingUp}
              label="Attendance Percentage"
              value={`${stats.attendance_percentage}%`}
              color="yellow"
            />

            <StatCard
              icon={Users}
              label="Consecutive Streak"
              value={stats.consecutive_streak}
              color="blue"
            />

            {/* Recent Arrivals */}
            {stats.recent_arrivals && stats.recent_arrivals.length > 0 && (
              <div className="glass-dark p-4 rounded-lg">
                <p className="text-sm font-bold mb-3 text-gray-300">Recent Arrivals:</p>
                <div className="space-y-2">
                  {stats.recent_arrivals.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <span className="w-2 h-2 bg-volleyball-accent rounded-full"></span>
                      <span className="text-gray-300">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Visit */}
            <div className="glass-dark p-4 rounded-lg">
              <p className="text-sm font-bold text-gray-300 mb-1">Last Visit:</p>
              <p className="text-volleyball-accent">
                {stats.last_visit === 'Never' ? 'Never' : new Date(stats.last_visit).toLocaleDateString()}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };

  return (
    <div className={`glass-dark p-4 border ${colorClasses[color]} rounded-lg`}>
      <div className="flex items-center gap-3">
        <Icon size={24} />
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

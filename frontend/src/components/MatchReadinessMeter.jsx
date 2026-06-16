import React, { useEffect, useState } from 'react';
import { playerAPI } from '../utils/api';
import { Users, MapPin, Clock, TrendingUp } from 'lucide-react';

export default function MatchReadinessMeter() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await playerAPI.getStats();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return <div className="spinner"></div>;
  }

  const {
    match_status: matchStatus,
    players: playerStats
  } = stats;

  const fullMatchRequired = matchStatus.required_for_full_match;
  const isReady = matchStatus.status === 'Full Match Ready';
  const playersNeeded = Math.max(0, fullMatchRequired - playerStats.at_ground);

  const statusColors = {
    'Full Match Ready': 'from-green-500 to-green-600',
    'Not Enough Players': 'from-red-500 to-red-600',
  };

  const statusBgColors = {
    'Full Match Ready': 'bg-green-500/20',
    'Not Enough Players': 'bg-red-500/20',
  };

  return (
    <div className="space-y-6">
      {/* Main Match Status Card */}
      <div className={`glass-dark p-8 text-center rounded-2xl border-2 border-white/10 ${statusBgColors[matchStatus.status]}`}>
        <h2 className="text-2xl font-bold mb-4">MATCH READINESS</h2>

        <div className="mb-6">
          <div className="text-5xl font-black text-volleyball-accent mb-2">
            {playerStats.at_ground} / {fullMatchRequired}
          </div>
          <p className="text-lg text-gray-300">At Ground (for full match)</p>
          <p className="text-sm text-gray-500 mt-1">
            {playerStats.logged_in ?? playerStats.total} logged in
          </p>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar mb-6">
          <div
            className={`progress-fill bg-gradient-to-r ${statusColors[matchStatus.status]}`}
            style={{ width: `${matchStatus.readiness_percentage}%` }}
          ></div>
        </div>

        <p className="text-2xl font-bold mb-2 text-volleyball-accent">
          {matchStatus.readiness_percentage}%
        </p>

        {/* Status Message */}
        <div className="text-center">
          <p className={`text-2xl font-bold mb-2 ${isReady ? 'text-green-400' : 'text-red-400'}`}>
            {matchStatus.status}
          </p>
          <p className="text-gray-300">
            {isReady
              ? '🎉 Ready to start full match!'
              : `Need ${playersNeeded} more player${playersNeeded === 1 ? '' : 's'} for full match`}
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={MapPin}
          label="At Ground"
          value={playerStats.at_ground}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="On The Way"
          value={playerStats.on_the_way}
          color="yellow"
        />
        <StatCard
          icon={Users}
          label="Nearby"
          value={playerStats.nearby}
          color="orange"
        />
        <StatCard
          icon={TrendingUp}
          label="Away"
          value={playerStats.away ?? 0}
          color="red"
        />
      </div>

      {/* Requirements */}
      <div className="glass-dark p-4 rounded-lg">
        <p className="text-sm text-gray-400 mb-3">REQUIREMENT:</p>
        <div className="flex justify-between items-center">
          <span>Full Match</span>
          <span className="font-bold text-volleyball-accent">{fullMatchRequired} players</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
  };

  return (
    <div className={`glass-dark p-4 border ${colorClasses[color]} rounded-lg`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="counter">{value}</div>
    </div>
  );
}

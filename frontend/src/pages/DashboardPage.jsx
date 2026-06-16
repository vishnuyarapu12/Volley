import React, { useEffect, useState } from 'react';
import { storage } from '../utils/api';
import MatchReadinessMeter from '../components/MatchReadinessMeter';
import PlayerGroundStatus from '../components/PlayerGroundStatus';

export default function DashboardPage() {
  const [playerInfo, setPlayerInfo] = useState(null);

  useEffect(() => {
    setPlayerInfo(storage.getPlayerInfo());
  }, []);

  return (
    <div className="min-h-screen bg-volleyball-darker">
      <div className="sticky top-0 z-20 bg-volleyball-dark/95 backdrop-blur border-b border-white/10 px-4 py-4">
        <h1 className="text-2xl font-black text-volleyball-accent">VolleyTrack</h1>
        <p className="text-sm text-gray-400">Welcome, {playerInfo?.name || 'Player'}</p>
      </div>

      <div className="px-4 py-6 mb-24 space-y-8">
        <MatchReadinessMeter />
        <PlayerGroundStatus />
      </div>
    </div>
  );
}

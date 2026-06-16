import React, { useEffect, useState } from 'react';
import { playerAPI } from '../utils/api';
import { MapPin, Clock, User } from 'lucide-react';

export default function PlayerList() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const data = await playerAPI.getPlayers();
        setPlayers(data.players || []);
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
    const interval = setInterval(fetchPlayers, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'At Ground':
        return 'status-at-ground';
      case 'Nearby':
        return 'status-nearby';
      case 'On The Way':
        return 'status-on-the-way';
      case 'Away':
        return 'status-away';
      case 'Offline':
        return 'status-offline';
      default:
        return 'status-offline';
    }
  };

  const filteredPlayers = filter === 'all'
    ? players
    : players.filter(p => p.status === filter);

  const filterOptions = [
    { label: 'All', value: 'all', count: players.length },
    { label: 'At Ground', value: 'At Ground', count: players.filter(p => p.status === 'At Ground').length },
    { label: 'On The Way', value: 'On The Way', count: players.filter(p => p.status === 'On The Way').length },
    { label: 'Away', value: 'Away', count: players.filter(p => p.status === 'Away').length },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filterOptions.map(option => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              filter === option.value
                ? 'bg-volleyball-accent text-volleyball-darker font-bold'
                : 'glass-dark hover:bg-white/20'
            }`}
          >
            {option.label} <span className="text-xs">({option.count})</span>
          </button>
        ))}
      </div>

      {/* Players List */}
      <div className="space-y-3">
        {filteredPlayers.length === 0 ? (
          <div className="glass-dark p-8 text-center rounded-lg">
            <p className="text-gray-400">No players found</p>
          </div>
        ) : (
          filteredPlayers.map(player => (
            <div
              key={player.id}
              className="player-card glass-dark p-4 rounded-lg hover:shadow-lg hover:shadow-volleyball-accent/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{player.name}</h3>
                    <span className={getStatusColor(player.status)}>
                      {player.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{player.team}</p>
                </div>
                {player.jersey > 0 && (
                  <div className="text-center">
                    <div className="w-8 h-8 bg-volleyball-accent text-volleyball-darker flex items-center justify-center rounded font-bold text-sm">
                      {player.jersey}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <MapPin size={16} className="text-volleyball-accent" />
                  <span>{player.distance}m from ground</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock size={16} className="text-volleyball-accent" />
                  <span>{player.last_seen}</span>
                </div>
              </div>

              {/* Progress bar showing distance */}
              <div className="mt-3 progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, (player.distance / 2000) * 100)}%`
                  }}
                ></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

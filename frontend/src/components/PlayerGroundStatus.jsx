import React, { useCallback, useEffect, useState } from 'react';
import { playerAPI, storage } from '../utils/api';
import { Users, Vote, Check, Loader } from 'lucide-react';

const VOTE_OPTIONS = [
  { value: 'At Ground', label: 'At Ground', emoji: '🏐' },
  { value: 'On The Way', label: 'On The Way', emoji: '🚗' },
  { value: 'Nearby', label: 'Nearby', emoji: '📍' },
  { value: 'Away', label: 'Away', emoji: '🏠' },
  { value: 'Not Coming', label: 'Not Coming', emoji: '❌' },
];

function getStatusClass(status) {
  switch (status) {
    case 'At Ground':
      return 'status-at-ground';
    case 'Nearby':
      return 'status-nearby';
    case 'On The Way':
      return 'status-on-the-way';
    case 'Away':
      return 'status-away';
    case 'Not Coming':
      return 'status-offline';
    default:
      return 'status-offline';
  }
}

export default function PlayerGroundStatus() {
  const [voteData, setVoteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [voteMessage, setVoteMessage] = useState('');

  const playerId = storage.getPlayerId();
  const players = voteData?.players || [];
  const myVote = players.find((p) => p.id === playerId)?.location_vote || null;

  const fetchData = useCallback(async () => {
    try {
      const data = await playerAPI.getLocationVotes();
      setVoteData(data);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleVote = async (vote) => {
    if (!playerId || voting) return;
    setVoting(true);
    setVoteMessage('');
    try {
      await playerAPI.castLocationVote(playerId, vote);
      setVoteMessage(`You chose: ${vote}`);
      await fetchData();
      setTimeout(() => setVoteMessage(''), 3000);
    } catch {
      setVoteMessage('Could not save. Try again.');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-dark p-8 rounded-2xl flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const loggedInCount = voteData?.total ?? players.length;
  const atGroundCount = voteData?.counts?.['At Ground'] ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-1">Players Logged In</h2>
        <p className="text-sm text-gray-500">Pick where you are — everyone sees it live</p>
      </div>

      {/* Logged in summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-dark p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
            <Users size={14} />
            Logged In
          </div>
          <p className="text-3xl font-black text-volleyball-accent">{loggedInCount}</p>
        </div>
        <div className="glass-dark p-4 rounded-xl border border-green-500/30 bg-green-500/5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">At Ground</p>
          <p className="text-3xl font-black text-green-400">{atGroundCount}</p>
        </div>
      </div>

      {/* Your vote */}
      <div className="glass-dark p-5 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Vote size={18} className="text-volleyball-accent" />
          <h3 className="font-bold">Where are you?</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VOTE_OPTIONS.map((option) => {
            const isSelected = myVote === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={voting}
                onClick={() => handleVote(option.value)}
                className={`relative p-3 rounded-xl border text-left transition-all disabled:opacity-60 ${
                  isSelected
                    ? 'border-volleyball-accent bg-volleyball-accent/15 ring-1 ring-volleyball-accent/40'
                    : 'border-white/10 bg-white/5 hover:border-white/25'
                }`}
              >
                <span className="text-xl block mb-0.5">{option.emoji}</span>
                <span className="text-xs font-bold leading-tight">{option.label}</span>
                {isSelected && (
                  <Check size={14} className="absolute top-2 right-2 text-volleyball-accent" />
                )}
              </button>
            );
          })}
        </div>
        {voting && (
          <p className="text-center text-sm text-gray-400 mt-3 flex items-center justify-center gap-2">
            <Loader size={14} className="animate-spin" />
            Saving…
          </p>
        )}
        {voteMessage && (
          <p className="text-center text-sm text-volleyball-accent mt-3 font-semibold">{voteMessage}</p>
        )}
      </div>

      {/* All players list */}
      <div className="glass-dark rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <p className="text-sm font-semibold text-gray-300">
            {loggedInCount} player{loggedInCount === 1 ? '' : 's'} · names &amp; status
          </p>
        </div>

        {players.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No players yet — be the first to join!</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {players.map((player) => {
              const status = player.location_vote || 'Not set';
              const isMe = player.id === playerId;
              return (
                <li
                  key={player.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    isMe ? 'bg-volleyball-accent/5' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">
                      {player.name}
                      {isMe && (
                        <span className="ml-2 text-[10px] uppercase text-volleyball-accent font-bold">
                          You
                        </span>
                      )}
                    </p>
                    {player.team && (
                      <p className="text-xs text-gray-500 truncate">{player.team}</p>
                    )}
                  </div>
                  <span className={`shrink-0 ${getStatusClass(status)}`}>{status}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

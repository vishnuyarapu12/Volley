import React, { useState } from 'react';
import { PlayerProfileCard, PlayerLightbox } from './PlayerProfileCard';
import ImageUploadModal from './ImageUploadModal';
import { storage } from '../utils/api';
import { Camera, Users } from 'lucide-react';

export default function PlayerProfileGallery({ players, onUploadSuccess, isAdmin }) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = closed
  const currentPlayerId = storage.getPlayerId();

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const otherPlayers = players.filter(p => p.id !== currentPlayerId);

  // All players in order: current first, then others (for lightbox navigation)
  const allPlayers = [
    ...(currentPlayer ? [currentPlayer] : []),
    ...otherPlayers
  ];

  const openLightbox = (player) => {
    const idx = allPlayers.findIndex(p => p.id === player.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
  };

  return (
    <div className="space-y-8">

      {/* ── Your Profile ── */}
      {currentPlayer && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full" />
            <h3 className="text-lg font-bold text-white">Your Profile</h3>
            {isAdmin && (
              <button
                id="upload-photo-btn"
                onClick={() => setUploadModalOpen(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-sm font-semibold hover:bg-yellow-400/20 transition-all"
              >
                <Camera size={14} />
                {currentPlayer.profile_picture ? 'Change Photo' : 'Add Photo'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlayerProfileCard
              player={currentPlayer}
              isCurrentUser={true}
              onEditClick={isAdmin ? () => setUploadModalOpen(true) : undefined}
              onClick={() => openLightbox(currentPlayer)}
            />
          </div>
        </div>
      )}

      {/* ── Team Members ── */}
      {otherPlayers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
            <h3 className="text-lg font-bold text-white">
              Team Members
              <span className="ml-2 text-sm text-gray-400 font-normal">({otherPlayers.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {otherPlayers.map((player, index) => (
              <div
                key={player.id}
                className="animate-cardReveal"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <PlayerProfileCard
                  player={player}
                  isCurrentUser={false}
                  onClick={() => openLightbox(player)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {players.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 border border-white/10">
            <Users size={36} className="text-gray-500" />
          </div>
          <div>
            <p className="text-gray-400 text-lg font-semibold">No players yet</p>
            <p className="text-gray-600 text-sm mt-1">
              Players will appear here once they join the team
            </p>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && allPlayers.length > 0 && (
        <PlayerLightbox
          players={allPlayers}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* ── Upload Modal ── */}
      <ImageUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={() => {
          setUploadModalOpen(false);
          onUploadSuccess?.();
        }}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Camera, ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';

// Status config
const STATUS_CONFIG = {
  'At Ground':  { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: '🟢 At Ground' },
  'Nearby':     { color: '#f97316', bg: 'rgba(249,115,22,0.15)',  label: '🟠 Nearby' },
  'On The Way': { color: '#eab308', bg: 'rgba(234,179,8,0.15)',   label: '🟡 On The Way' },
  'Away':       { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: '🔴 Away' },
  'Offline':    { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: '⚫ Offline' },
};

function getAvatarColor(name) {
  const palette = ['#fbbf24', '#f87171', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6'];
  return palette[name.charCodeAt(0) % palette.length];
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Individual card ──────────────────────────────────────────────────────────
export function PlayerProfileCard({ player, isCurrentUser, onEditClick, onClick }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const status = STATUS_CONFIG[player.status] || STATUS_CONFIG['Offline'];
  const avatarColor = getAvatarColor(player.name);
  const initials = getInitials(player.name);

  useEffect(() => { setImageLoaded(false); }, [player.profile_picture]);

  return (
    <div
      className="profile-card group relative overflow-hidden rounded-2xl cursor-pointer select-none"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      {/* Image / Avatar */}
      <div className="relative w-full aspect-square overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900">
        {player.profile_picture ? (
          <>
            <img
              src={player.profile_picture}
              alt={player.name}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ willChange: 'transform, opacity' }}
            />
            {/* overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-lg transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
          </div>
        )}

        {/* Status dot */}
        <div
          className="absolute top-3 left-3 w-3 h-3 rounded-full border-2 border-white shadow-lg"
          style={{ backgroundColor: status.color }}
        />

        {/* You badge */}
        {isCurrentUser && (
          <div className="absolute top-3 right-3 px-2.5 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full shadow">
            You
          </div>
        )}

        {/* Edit overlay */}
        {isCurrentUser && (
          <button
            onClick={e => { e.stopPropagation(); onEditClick?.(); }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm"
          >
            <Camera className="text-white drop-shadow" size={28} />
            <span className="text-white text-xs font-semibold">Change Photo</span>
          </button>
        )}

        {/* Expand icon (non-edit hover) */}
        {!isCurrentUser && (
          <div className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Maximize2 size={12} className="text-white" />
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="relative px-4 pb-4 pt-3 bg-gradient-to-b from-slate-800/80 to-slate-900/90 backdrop-blur-md">
        {/* Name */}
        <h3 className="font-black text-base text-white truncate group-hover:text-yellow-300 transition-colors duration-300">
          {player.name}
        </h3>
        {player.team && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{player.team}</p>
        )}

        {/* Status pill */}
        <div
          className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: status.bg, color: status.color }}
        >
          {player.status || 'Offline'}
        </div>

        {/* Distance */}
        {player.distance !== undefined && (
          <p className="text-xs text-gray-500 mt-1">{player.distance}m away</p>
        )}
      </div>

      {/* Shimmer sweep */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
    </div>
  );
}

// ── Lightbox Modal ───────────────────────────────────────────────────────────
export function PlayerLightbox({ players, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex ?? 0);
  const player = players[idx];
  const status = STATUS_CONFIG[player?.status] || STATUS_CONFIG['Offline'];
  const avatarColor = player ? getAvatarColor(player.name) : '#fbbf24';
  const initials = player ? getInitials(player.name) : '?';

  const prev = () => setIdx(i => (i - 1 + players.length) % players.length);
  const next = () => setIdx(i => (i + 1) % players.length);

  // Keyboard navigation
  useEffect(() => {
    const handler = e => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!player) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lightbox-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="lightbox-panel relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-lightboxIn">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-all"
        >
          <X size={18} className="text-white" />
        </button>

        {/* Navigation arrows */}
        {players.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2.5 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-all hover:scale-110"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2.5 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-all hover:scale-110"
            >
              <ChevronRight size={20} className="text-white" />
            </button>
          </>
        )}

        {/* Image area */}
        <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-700 to-slate-900 overflow-hidden">
          {player.profile_picture ? (
            <>
              <img
                key={player.id}
                src={player.profile_picture}
                alt={player.name}
                loading="lazy"
                className="w-full h-full object-cover animate-lightboxImgIn"
                style={{ willChange: 'transform, opacity' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-2xl"
                style={{ backgroundColor: avatarColor }}
              >
                {initials}
              </div>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="relative bg-slate-900 px-6 py-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white">{player.name}</h2>
              {player.team && <p className="text-sm text-gray-400 mt-0.5">{player.team}</p>}
            </div>
            {player.jersey > 0 && (
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-yellow-400 flex items-center justify-center">
                <span className="text-lg font-black text-yellow-900">#{player.jersey}</span>
              </div>
            )}
          </div>

          {/* Status and distance row */}
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
              style={{ backgroundColor: status.bg, color: status.color }}
            >
              {player.status || 'Offline'}
            </span>
            {player.distance !== undefined && (
              <span className="text-sm text-gray-400">📍 {player.distance}m from ground</span>
            )}
          </div>

          {/* Dot indicators for carousel position */}
          {players.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {players.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === idx ? 'w-5 h-2 bg-yellow-400' : 'w-2 h-2 bg-gray-600 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlayerProfileCard;

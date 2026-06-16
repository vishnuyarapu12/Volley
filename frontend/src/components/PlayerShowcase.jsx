import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Camera, Users, Upload } from 'lucide-react';
import ImageUploadModal from './ImageUploadModal';
import { storage } from '../utils/api';

const AVATAR_COLORS = ['#fbbf24', '#f87171', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6'];

function getAvatarColor(name) {
  return AVATAR_COLORS[(name || '?').charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getDisplayName(player) {
  return player.picture_label || player.name;
}

export default function PlayerShowcase({ players, onUploadSuccess }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const currentPlayerId = storage.getPlayerId();

  const slides = players.length > 0 ? players : [];
  const activePlayer = slides[activeIndex];

  const goTo = useCallback((index) => {
    if (slides.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex(((index % slides.length) + slides.length) % slides.length);
      setIsTransitioning(false);
    }, 280);
  }, [slides.length]);

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (slides.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [slides.length, activeIndex]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex(i => (i + 1) % slides.length);
        setIsTransitioning(false);
      }, 280);
    }, 4500);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  return (
    <div className="space-y-5">
      {/* Header + upload */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full" />
        <h3 className="text-lg font-bold text-white flex-1">Player Showcase</h3>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-sm font-semibold hover:bg-yellow-400/20 transition-all"
        >
          <Camera size={14} />
          Upload Photo
        </button>
      </div>

      {slides.length === 0 ? (
        <div className="text-center py-14 space-y-4 rounded-2xl border border-white/10 bg-white/5">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 border border-white/10">
            <Users size={36} className="text-gray-500" />
          </div>
          <div>
            <p className="text-gray-400 text-lg font-semibold">No players yet</p>
            <p className="text-gray-600 text-sm mt-1">Join the team to appear in the showcase</p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-primary text-sm"
          >
            <Upload size={15} />
            Upload Your Photo
          </button>
        </div>
      ) : (
        <>
          {/* Main carousel */}
          <div
            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] bg-gradient-to-br from-slate-800 to-slate-950">
              {slides.map((player, i) => (
                <div
                  key={player.id}
                  className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                    i === activeIndex && !isTransitioning
                      ? 'opacity-100 scale-100 z-10'
                      : i === activeIndex
                      ? 'opacity-0 scale-[1.02] z-10'
                      : 'opacity-0 scale-100 z-0 pointer-events-none'
                  }`}
                >
                  {player.profile_picture ? (
                    <img
                      src={player.profile_picture}
                      alt={getDisplayName(player)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${getAvatarColor(player.name)}33, #0f172a)` }}
                    >
                      <div
                        className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-white text-4xl sm:text-5xl font-black shadow-2xl border-4 border-white/20"
                        style={{ backgroundColor: getAvatarColor(player.name) }}
                      >
                        {getInitials(player.name)}
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                </div>
              ))}

              {/* Name overlay */}
              {activePlayer && (
                <div
                  className={`absolute bottom-0 left-0 right-0 px-5 pb-5 pt-12 z-20 transition-opacity duration-500 ${
                    isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                  }`}
                >
                  <p className="text-xs uppercase tracking-widest text-yellow-400/90 font-semibold mb-1">
                    {activePlayer.id === currentPlayerId ? 'You' : activePlayer.team || 'Team Player'}
                  </p>
                  <h4 className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg">
                    {getDisplayName(activePlayer)}
                  </h4>
                  {activePlayer.picture_label && activePlayer.picture_label !== activePlayer.name && (
                    <p className="text-sm text-gray-400 mt-0.5">{activePlayer.name}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {activeIndex + 1} / {slides.length}
                    {activePlayer.status ? ` · ${activePlayer.status}` : ''}
                  </p>
                </div>
              )}

              {/* Nav arrows */}
              {slides.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-all hover:scale-110"
                    aria-label="Previous player"
                  >
                    <ChevronLeft size={22} className="text-white" />
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-all hover:scale-110"
                    aria-label="Next player"
                  >
                    <ChevronRight size={22} className="text-white" />
                  </button>
                </>
              )}
            </div>

            {/* Dot indicators */}
            {slides.length > 1 && (
              <div className="flex items-center justify-center gap-2 py-3 bg-slate-900/80">
                {slides.map((player, i) => (
                  <button
                    key={player.id}
                    onClick={() => goTo(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === activeIndex ? 'w-6 h-2 bg-yellow-400' : 'w-2 h-2 bg-gray-600 hover:bg-gray-400'
                    }`}
                    aria-label={`Show ${getDisplayName(player)}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
            {slides.map((player, i) => (
              <button
                key={player.id}
                onClick={() => goTo(i)}
                className={`flex-shrink-0 relative rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                  i === activeIndex
                    ? 'border-yellow-400 scale-105 shadow-lg shadow-yellow-400/20'
                    : 'border-white/10 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20">
                  {player.profile_picture ? (
                    <img
                      src={player.profile_picture}
                      alt={getDisplayName(player)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: getAvatarColor(player.name) }}
                    >
                      {getInitials(player.name)}
                    </div>
                  )}
                </div>
                <span className="absolute bottom-0 left-0 right-0 text-[9px] font-bold text-white bg-black/60 px-1 py-0.5 truncate text-center">
                  {getDisplayName(player).split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <ImageUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadSuccess={() => {
          setUploadOpen(false);
          onUploadSuccess?.();
        }}
      />
    </div>
  );
}

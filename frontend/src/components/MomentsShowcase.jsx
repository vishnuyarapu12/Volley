import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, Upload } from 'lucide-react';
import { playerAPI } from '../utils/api';
import { pickRandomTitle, formatMomentLabel } from '../utils/momentsTitles';

const DISPLAY_MS = 1700;
const TRANSITION_MS = 1000;

const SlideLayer = React.memo(function SlideLayer({ slide, animClass, zIndex }) {
  return (
    <div
      className={`moments-slide-layer absolute inset-0 ${animClass}`}
      style={{ zIndex, contain: 'layout paint' }}
    >
      <div className="moments-photo-wrap absolute inset-0">
        <img src={slide.src} alt={slide.label} className="moments-photo" draggable={false} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20 pointer-events-none" />
    </div>
  );
});

export default function MomentsShowcase({ hero = false, isAdmin = false }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState(null);
  const [direction, setDirection] = useState('next');
  const [animTick, setAnimTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clickTitle, setClickTitle] = useState('');
  const [titleKey, setTitleKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const lastTitleRef = useRef('');
  const transitioningRef = useRef(false);
  const activeIndexRef = useRef(0);
  const fileInputRef = useRef(null);

  const slides = images;
  const active = slides[activeIndex];
  activeIndexRef.current = activeIndex;

  const bumpRandomTitle = useCallback(() => {
    const next = pickRandomTitle(lastTitleRef.current);
    lastTitleRef.current = next;
    setClickTitle(next);
    setTitleKey((k) => k + 1);
  }, []);

  const transitionTo = useCallback(
    (nextIndex) => {
      if (slides.length <= 1 || transitioningRef.current) return;

      const current = activeIndexRef.current;
      const target = ((nextIndex % slides.length) + slides.length) % slides.length;
      if (target === current) return;

      const isNext =
        target === (current + 1) % slides.length ||
        (current === slides.length - 1 && target === 0);
      const dir = isNext ? 'next' : 'prev';

      transitioningRef.current = true;
      setDirection(dir);
      setOutgoingIndex(current);
      setActiveIndex(target);
      setAnimTick((t) => t + 1);
      bumpRandomTitle();

      setTimeout(() => {
        setOutgoingIndex(null);
        transitioningRef.current = false;
      }, TRANSITION_MS);
    },
    [slides.length, bumpRandomTitle]
  );

  const next = useCallback(
    () => transitionTo(activeIndexRef.current + 1),
    [transitionTo]
  );

  const prev = useCallback(
    () => transitionTo(activeIndexRef.current - 1),
    [transitionTo]
  );

  const goTo = useCallback(
    (index) => transitionTo(index),
    [transitionTo]
  );

  const fetchMoments = useCallback(async (switchToLast = false) => {
    try {
      const data = await playerAPI.getMoments();
      if (data?.moments) {
        const list = data.moments.map((img, i) => ({
          ...img,
          label: formatMomentLabel(img.filename, i),
        }));
        setImages(list);
        if (list.length > 0 && switchToLast) {
          transitionTo(list.length - 1);
        } else if (list.length > 0 && images.length === 0) {
          bumpRandomTitle();
        }
      }
    } catch (err) {
      console.error('Failed to load moments', err);
    } finally {
      setLoading(false);
    }
  }, [bumpRandomTitle, images.length, transitionTo]);

  useEffect(() => {
    fetchMoments();
  }, [fetchMoments]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      await playerAPI.uploadMoment(file);
      await fetchMoments(true);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload moment");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (paused || slides.length <= 1) return;

    const timer = setInterval(() => {
      if (!transitioningRef.current) {
        transitionTo(activeIndexRef.current + 1);
      }
    }, DISPLAY_MS);

    return () => clearInterval(timer);
  }, [paused, slides.length, transitionTo]);

  const handleImageClick = () => {
    bumpRandomTitle();
    if (slides.length > 1) next();
  };

  const exitClass = direction === 'next' ? 'moments-anim-exit-next' : 'moments-anim-exit-prev';
  const enterClass = direction === 'next' ? 'moments-anim-enter-next' : 'moments-anim-enter-prev';

  if (loading) {
    return (
      <div
        className={`moments-loading flex flex-col items-center justify-center gap-4 ${hero ? 'moments-hero-loading' : 'py-24'
          }`}
      >
        <div className="w-10 h-10 border-2 border-volleyball-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading moments…</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div
        className={`text-center px-6 rounded-2xl border border-white/10 bg-white/5 ${hero ? 'moments-hero-empty' : 'py-20'
          }`}
      >
        <Sparkles className="mx-auto text-gray-500 mb-4" size={40} />
        <p className="text-lg font-semibold text-gray-300">No moments yet</p>
        <p className="text-sm text-gray-500 mt-2">
          Admins can upload photos to populate the showcase.
        </p>
      </div>
    );
  }

  const viewerClass = hero
    ? 'moments-viewer moments-viewer-hero relative overflow-hidden'
    : 'moments-viewer relative rounded-3xl overflow-hidden border border-white/15 shadow-2xl shadow-black/40';

  const stageClass = hero
    ? 'moments-stage moments-stage-hero relative bg-slate-950'
    : 'moments-stage relative aspect-[4/5] sm:aspect-[16/10] bg-slate-950';

  return (
    <div className={hero ? 'moments-hero-wrap' : 'space-y-6'}>
      {isAdmin && !hero && (
        <div className="flex justify-end mb-4">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-sm font-semibold hover:bg-yellow-400/20 transition-all disabled:opacity-50"
          >
            {isUploading ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
            {isUploading ? 'Uploading...' : 'Upload New Moment'}
          </button>
        </div>
      )}
      <div
        className={viewerClass}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {!hero && <div className="moments-viewer-glow" aria-hidden />}

        <div className={stageClass}>
          {outgoingIndex !== null && slides[outgoingIndex] && (
            <SlideLayer
              key={`out-${outgoingIndex}-${animTick}`}
              slide={slides[outgoingIndex]}
              animClass={exitClass}
              zIndex={2}
            />
          )}

          <SlideLayer
            key={outgoingIndex !== null ? `in-${activeIndex}-${animTick}` : `idle-${activeIndex}`}
            slide={slides[activeIndex]}
            animClass={outgoingIndex !== null ? enterClass : 'moments-slide-idle'}
            zIndex={3}
          />

          {hero && (
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-6 sm:pt-8 pointer-events-none">
              <div className="flex items-center gap-2 text-yellow-400/90 mb-1">
                <Sparkles size={16} />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em]">VolleyTrack Moments</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-lg">
                Moments
              </h1>
            </div>
          )}

          <button
            type="button"
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={handleImageClick}
            aria-label="Next moment or random title"
          />

          {active && (
            <div key={`${activeIndex}-${animTick}`} className="moments-caption absolute bottom-0 left-0 right-0 z-20 px-5 pb-5 sm:pb-6 pt-20">
              {!hero && (
                <p className="text-[10px] uppercase tracking-[0.2em] text-yellow-400/90 font-bold mb-1">
                  VolleyTrack Moments
                </p>
              )}
              <h3 className="text-xl sm:text-2xl font-black text-white drop-shadow-lg leading-tight">
                {active.label}
              </h3>
              <p className="text-xs text-gray-400 mt-2 font-mono">
                {activeIndex + 1} / {slides.length}
              </p>
            </div>
          )}

          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="moments-nav-btn left-3 sm:left-5"
                aria-label="Previous"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="moments-nav-btn right-3 sm:right-5"
                aria-label="Next"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {slides.length > 1 && !paused && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 z-30">
              <div
                key={activeIndex}
                className="moments-progress h-full bg-gradient-to-r from-yellow-400 to-amber-500"
                style={{ animationDuration: `${DISPLAY_MS}ms` }}
              />
            </div>
          )}
        </div>

        {slides.length > 1 && (
          <div
            className={`flex justify-center gap-2 backdrop-blur-sm ${hero ? 'py-3 bg-black/40' : 'py-3 bg-slate-900/90'
              }`}
          >
            {slides.map((slide, i) => (
              <button
                key={slide.filename}
                type="button"
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-500 ease-out ${i === activeIndex ? 'w-8 h-2 bg-yellow-400' : 'w-2 h-2 bg-gray-600 hover:bg-gray-400'
                  }`}
                aria-label={`Go to ${slide.label}`}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className={`relative min-h-[3.5rem] flex items-center justify-center px-2 ${hero ? 'px-4 py-4' : ''
          }`}
      >
        <button
          type="button"
          onClick={bumpRandomTitle}
          className="moments-title-chip group"
          aria-label="Show another random title"
        >
          <Sparkles size={14} className="text-yellow-400 shrink-0 opacity-80 group-hover:opacity-100" />
          <span key={titleKey} className="moments-title-text">
            {clickTitle}
          </span>
          <RefreshCw size={12} className="text-gray-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>
        <p className="absolute -bottom-1 text-[10px] text-gray-600 tracking-wide uppercase">
          tap for random titles
        </p>
      </div>

      <div className={`moments-filmstrip flex gap-3 overflow-x-auto pb-2 ${hero ? 'px-4' : 'px-1'}`}>
        {slides.map((slide, i) => (
          <button
            key={slide.filename}
            type="button"
            onClick={() => goTo(i)}
            className={`moments-thumb flex-shrink-0 ${i === activeIndex ? 'moments-thumb-active' : ''}`}
          >
            <img src={slide.src} alt="" className="w-full h-full object-cover" loading="lazy" />
            <span className="moments-thumb-label">{slide.label.split('·')[0].trim().slice(0, 12)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

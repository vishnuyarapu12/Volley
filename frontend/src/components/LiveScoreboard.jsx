import React, { useState, useEffect, useRef } from 'react';

// ─── Volleyball scoring logic ─────────────────────────────────────────────────
// Rules: First team to reach exactly 25 wins. No deuce. No lead-by-2.
// 23 = O Ball (2 away), 24 = Game Ball (1 away)
function getWinner(sA, sB) {
  if (sA >= 25) return 'A';
  if (sB >= 25) return 'B';
  return null;
}
// Returns 'A', 'B', or null — which team is at Game Ball (24)
function isGameBall(sA, sB) {
  if (getWinner(sA, sB)) return null;
  if (sA === 24) return 'A';
  if (sB === 24) return 'B';
  return null;
}
// Returns 'A', 'B', or null — which team is at O Ball (23)
function isOBall(sA, sB) {
  if (getWinner(sA, sB)) return null;
  if (isGameBall(sA, sB)) return null; // Game Ball takes priority
  if (sA === 23) return 'A';
  if (sB === 23) return 'B';
  return null;
}

// ─── Confetti particle system ─────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#fbbf24', '#f59e0b', '#34d399', '#60a5fa',
  '#f472b6', '#a78bfa', '#fb7185', '#4ade80',
];
function useConfetti(active) {
  const [particles, setParticles] = useState([]);
  const raf = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!active) { setParticles([]); return; }

    const total = 90;
    const initial = Array.from({ length: total }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 2 + Math.random() * 3,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      opacity: 1,
    }));
    setParticles(initial);
    startRef.current = performance.now();

    function tick(now) {
      const elapsed = now - startRef.current;
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx * 0.5,
            y: p.y + p.vy * 0.4,
            rot: p.rot + p.vrot,
            vy: p.vy + 0.04, // gravity
            opacity: elapsed > 2500 ? Math.max(0, 1 - (elapsed - 2500) / 1500) : 1,
          }))
          .filter(p => p.y < 115 && p.opacity > 0)
      );
      if (elapsed < 4000) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active]);

  return particles;
}

function Confetti({ active }) {
  const particles = useConfetti(active);
  if (!particles.length) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[200]" style={{ overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.shape === 'circle' ? p.size : p.size * 0.6,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            background: p.color,
            opacity: p.opacity,
            transform: `rotate(${p.rot}deg)`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}

// ─── Score digit with flip animation ─────────────────────────────────────────
function ScoreDisplay({ score, dir }) {
  const [animKey, setAnimKey] = useState(0);
  const [animClass, setAnimClass] = useState('');
  const prev = useRef(score);

  useEffect(() => {
    if (score !== prev.current) {
      const cls = score > prev.current ? 'sb-score-up' : 'sb-score-down';
      setAnimClass(cls);
      setAnimKey(k => k + 1);
      prev.current = score;
      const t = setTimeout(() => setAnimClass(''), 400);
      return () => clearTimeout(t);
    }
  }, [score]);

  return (
    <span
      key={animKey}
      className={`sb-score-digit ${animClass}`}
    >
      {score}
    </span>
  );
}

// ─── Ripple button ────────────────────────────────────────────────────────────
function RippleBtn({ onClick, children, className, disabled, style }) {
  const btnRef = useRef(null);

  function handleClick(e) {
    if (disabled) return;
    const btn = btnRef.current;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.className = 'sb-ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
    onClick && onClick(e);
  }

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      disabled={disabled}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}

// ─── O Ball banner (23 pts) ───────────────────────────────────────────────────
function OBallBanner({ teamName }) {
  return (
    <div className="sb-oball-banner flex flex-col items-center justify-center py-2 px-4 rounded-2xl mx-auto max-w-sm">
      <div className="flex items-center gap-2">
        <span className="text-xl">🟠</span>
        <span className="text-base font-black tracking-widest text-white uppercase">O Ball</span>
        <span className="text-xl">🟠</span>
      </div>
      <p className="text-xs font-bold text-orange-300/80 tracking-wider mt-0.5">{teamName} — 2 points from victory</p>
    </div>
  );
}

// ─── Game Ball banner (24 pts) ────────────────────────────────────────────────
function GameBallBanner({ teamName }) {
  return (
    <div className="sb-gameball-banner flex flex-col items-center justify-center py-2 px-4 rounded-2xl mx-auto max-w-sm">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏐</span>
        <span className="text-base font-black tracking-widest text-white uppercase">Game Ball!</span>
        <span className="text-xl">🏐</span>
      </div>
      <p className="text-xs font-bold text-yellow-300/90 tracking-wider mt-0.5">{teamName} — 1 point from victory</p>
    </div>
  );
}

// ─── Winner screen ────────────────────────────────────────────────────────────
function WinnerScreen({ teamName, scoreA, scoreB, nameA, nameB, duration, onPlayAgain }) {
  return (
    <div className="sb-winner-screen flex flex-col items-center justify-center gap-6 py-10 px-4">
      {/* Trophy */}
      <div className="sb-trophy text-8xl">🏆</div>

      {/* Congratulations */}
      <div className="text-center">
        <p className="text-xs font-bold tracking-[0.35em] text-yellow-400/80 uppercase mb-1">🎉 Congratulations</p>
        <h2 className="sb-winner-name text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
          {teamName}
        </h2>
        <p className="text-lg font-bold text-yellow-400 mt-1">WINS THE MATCH!</p>
      </div>

      {/* Match result card */}
      <div className="w-full max-w-xs rounded-2xl border border-white/10 overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
        <div className="px-6 py-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-3">Match Result</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 font-semibold truncate max-w-[80px]">{nameA}</p>
              <p className={`text-4xl font-black ${teamName === nameA ? 'text-yellow-400' : 'text-white/50'}`}>{scoreA}</p>
            </div>
            <div className="text-2xl font-black text-gray-600">–</div>
            <div className="text-center">
              <p className="text-xs text-gray-400 font-semibold truncate max-w-[80px]">{nameB}</p>
              <p className={`text-4xl font-black ${teamName === nameB ? 'text-yellow-400' : 'text-white/50'}`}>{scoreB}</p>
            </div>
          </div>
          {duration && (
            <p className="text-[10px] text-gray-600 text-center mt-3 font-mono">Match duration: {duration}</p>
          )}
        </div>
        <div className="px-6 py-3 border-t border-white/5 flex items-center justify-center gap-2">
          <span className="text-base">🏆</span>
          <span className="text-sm font-black text-yellow-400">{teamName}</span>
        </div>
      </div>

      {/* Play again */}
      <RippleBtn
        onClick={onPlayAgain}
        className="px-8 py-3.5 rounded-2xl font-black text-base text-black tracking-wide hover:brightness-110 active:scale-95 transition-all duration-200 shadow-xl shadow-yellow-400/30"
        style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}
      >
        🔄 Play Again
      </RippleBtn>
    </div>
  );
}

// ─── Team Score Panel ─────────────────────────────────────────────────────────
function TeamPanel({ name, score, accent, isWinner, ballState, isFinished, onPlus, onMinus, onReset }) {
  // ballState: null | 'oball' | 'gameball'
  const borderClass = isWinner
    ? 'sb-winner-glow border-yellow-400/60'
    : ballState === 'gameball'
    ? 'border-yellow-400/35'
    : ballState === 'oball'
    ? 'border-orange-400/25'
    : 'border-white/8';

  return (
    <div className={`sb-team-panel flex-1 flex flex-col items-center rounded-3xl border transition-all duration-500 overflow-hidden ${borderClass}`}
         style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%)', backdropFilter: 'blur(16px)' }}>

      {/* Accent bar */}
      <div className="h-1.5 w-full shrink-0" style={{ background: accent }} />

      <div className="flex flex-col items-center gap-3 p-5 sm:p-6 w-full">
        {/* Team name */}
        <h3 className="text-base sm:text-xl font-black text-white text-center tracking-wide uppercase truncate max-w-full px-2">
          {name}
        </h3>

        {/* Score */}
        <div className={`sb-score-wrap flex items-center justify-center rounded-2xl w-full py-4
          ${isWinner ? 'sb-score-winner' : ''}`}
             style={{ background: 'rgba(0,0,0,0.25)' }}>
          <ScoreDisplay score={score} />
        </div>

        {/* Buttons */}
        {!isFinished && (
          <div className="flex gap-2 w-full mt-1">
            <RippleBtn
              onClick={onMinus}
              disabled={score === 0}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-white/10 text-gray-300 hover:border-red-400/40 hover:text-red-300 hover:bg-red-400/5 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              −1
            </RippleBtn>
            <RippleBtn
              onClick={onPlus}
              className="flex-[2] py-2.5 rounded-xl font-black text-sm text-black transition-all duration-200 hover:brightness-110 active:scale-95 shadow-lg"
              style={{ background: accent, boxShadow: `0 4px 20px ${accent}44` }}
            >
              +1 Point
            </RippleBtn>
            <RippleBtn
              onClick={onReset}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-white/10 text-gray-400 hover:border-gray-400/40 hover:text-gray-200 hover:bg-white/5 transition-all duration-200"
              title="Reset score"
            >
              ↺
            </RippleBtn>
          </div>
        )}

        {/* Ball state badge */}
        {!isFinished && ballState === 'gameball' && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm">🏐</span>
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Game Ball</span>
          </div>
        )}
        {!isFinished && ballState === 'oball' && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm">🟠</span>
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">O Ball</span>
          </div>
        )}
        {isWinner && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xl">🏆</span>
            <span className="text-sm font-black text-yellow-400 uppercase tracking-wide">Winner!</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Setup screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [nameA, setNameA] = useState('Tigers');
  const [nameB, setNameB] = useState('Falcons');

  function handleStart(e) {
    e.preventDefault();
    if (!nameA.trim() || !nameB.trim()) return;
    onStart(nameA.trim(), nameB.trim());
  }

  return (
    <div className="flex flex-col items-center gap-8 py-10 px-4">
      {/* Icon */}
      <div className="text-7xl sb-ball-float">🏐</div>

      <div className="text-center">
        <h3 className="text-2xl font-black text-white">Set Up Match</h3>
        <p className="text-gray-400 text-sm mt-1">Enter team names to start the match</p>
      </div>

      <form onSubmit={handleStart} className="w-full max-w-sm space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Team A</label>
          <input
            value={nameA}
            onChange={e => setNameA(e.target.value)}
            placeholder="e.g. Tigers"
            maxLength={20}
            className="px-4 py-3 rounded-xl border border-white/15 text-white text-base font-bold placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 focus:ring-1 focus:ring-yellow-400/30 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
        </div>

        {/* VS divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs font-black text-gray-500 tracking-widest">VS</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Team B</label>
          <input
            value={nameB}
            onChange={e => setNameB(e.target.value)}
            placeholder="e.g. Falcons"
            maxLength={20}
            className="px-4 py-3 rounded-xl border border-white/15 text-white text-base font-bold placeholder-gray-600 focus:outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
        </div>

        <RippleBtn
          onClick={handleStart}
          className="w-full py-4 rounded-2xl font-black text-lg text-black mt-2 hover:brightness-110 active:scale-95 transition-all duration-200 shadow-xl shadow-yellow-400/25"
          style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}
        >
          🏐 Start Match
        </RippleBtn>
      </form>
    </div>
  );
}

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useMatchTimer(running) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    if (!running) { cancelAnimationFrame(raf.current); return; }
    if (!startRef.current) startRef.current = Date.now() - elapsed * 1000;

    function tick() {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  return { formatted: formatTime(elapsed), seconds: elapsed };
}

// ─── Main scoreboard ──────────────────────────────────────────────────────────
const TEAM_COLORS = {
  A: '#f59e0b',  // amber
  B: '#3b82f6',  // blue
};

export default function LiveScoreboard() {
  const [phase, setPhase] = useState('setup'); // 'setup' | 'playing' | 'finished'
  const [nameA, setNameA] = useState('Team A');
  const [nameB, setNameB] = useState('Team B');
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [winner, setWinner] = useState(null); // null | 'A' | 'B'
  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedDuration, setFinishedDuration] = useState('');
  const { formatted: timerStr, seconds: timerSecs } = useMatchTimer(phase === 'playing');

  const gameBall = isGameBall(scoreA, scoreB);  // 'A', 'B', or null
  const oBall    = isOBall(scoreA, scoreB);      // 'A', 'B', or null

  function handleStart(a, b) {
    setNameA(a);
    setNameB(b);
    setScoreA(0);
    setScoreB(0);
    setWinner(null);
    setPhase('playing');
  }

  function applyScore(team, delta) {
    if (phase !== 'playing') return;
    let nA = scoreA, nB = scoreB;
    if (team === 'A') nA = Math.max(0, scoreA + delta);
    else              nB = Math.max(0, scoreB + delta);

    setScoreA(nA);
    setScoreB(nB);

    const w = getWinner(nA, nB);
    if (w) {
      setWinner(w);
      setPhase('finished');
      setFinishedDuration(timerStr);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
    }
  }

  function handlePlayAgain() {
    setScoreA(0);
    setScoreB(0);
    setWinner(null);
    setPhase('setup');
    setShowConfetti(false);
  }

  // Derive match status label
  let statusLabel = 'Normal Play';
  let statusColor = 'text-green-400';
  if (phase === 'finished')        { statusLabel = 'Finished';  statusColor = 'text-gray-400'; }
  else if (gameBall)               { statusLabel = 'Game Ball'; statusColor = 'text-yellow-400'; }
  else if (oBall)                  { statusLabel = 'O Ball';    statusColor = 'text-orange-400'; }

  const winnerName = winner === 'A' ? nameA : winner === 'B' ? nameB : '';

  return (
    <section className="relative overflow-hidden py-12 px-4"
             style={{ background: 'linear-gradient(180deg,#06092b 0%,#0a0f3d 50%,#06092b 100%)' }}>

      {/* Confetti */}
      <Confetti active={showConfetti} />

      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03] blur-3xl"
             style={{ background: 'radial-gradient(circle,#fbbf24,transparent 70%)' }} />
        {/* Decorative hexagon grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="sbGrid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sbGrid)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* ── Section header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-yellow-400/80">VolleyTrack</span>
            <div className="h-px w-12 bg-gradient-to-r from-yellow-400/40 to-transparent" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">🏐 Live Match Scoreboard</h2>
          <p className="text-gray-400 text-sm mt-1">Track the match score in real time.</p>
        </div>

        {/* ── Main card ── */}
        <div className="rounded-3xl border border-white/10 overflow-hidden"
             style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)', backdropFilter: 'blur(20px)' }}>

          {/* Card header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/8"
               style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-2">
              {phase === 'playing' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/60" />
                  <span className="text-xs font-black text-red-400 uppercase tracking-widest">LIVE</span>
                </>
              )}
              {phase === 'setup' && (
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Setup</span>
              )}
              {phase === 'finished' && (
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">⬛ Finished</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {phase === 'playing' && (
                <span className="font-mono text-xs text-gray-400">{timerStr}</span>
              )}
              <span className={`text-xs font-bold ${statusColor} uppercase tracking-wider`}>
                {statusLabel}
              </span>
            </div>
          </div>

          {/* ── Content ── */}
          {phase === 'setup' && (
            <SetupScreen onStart={handleStart} />
          )}

          {(phase === 'playing' || phase === 'finished') && (
            <div className="p-4 sm:p-6">

              {/* Winner screen overlay */}
              {phase === 'finished' && winner ? (
                <WinnerScreen
                  teamName={winnerName}
                  scoreA={scoreA}
                  scoreB={scoreB}
                  nameA={nameA}
                  nameB={nameB}
                  duration={finishedDuration}
                  onPlayAgain={handlePlayAgain}
                />
              ) : (
                <>
                  {/* O Ball / Game Ball banner */}
                  <div className="mb-4 min-h-[52px] flex items-center justify-center">
                    {gameBall && (
                      <GameBallBanner teamName={gameBall === 'A' ? nameA : nameB} />
                    )}
                    {!gameBall && oBall && (
                      <OBallBanner teamName={oBall === 'A' ? nameA : nameB} />
                    )}
                    {!gameBall && !oBall && (
                      <div className="flex items-center gap-2 opacity-40">
                        <div className="h-px w-16 bg-white/20" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Normal Play</span>
                        <div className="h-px w-16 bg-white/20" />
                      </div>
                    )}
                  </div>

                  {/* Score panels */}
                  <div className="flex gap-3 sm:gap-5 items-stretch">
                    <TeamPanel
                      name={nameA}
                      score={scoreA}
                      accent={TEAM_COLORS.A}
                      isWinner={winner === 'A'}
                      ballState={gameBall === 'A' ? 'gameball' : oBall === 'A' ? 'oball' : null}
                      isFinished={phase === 'finished'}
                      onPlus={() => applyScore('A', 1)}
                      onMinus={() => applyScore('A', -1)}
                      onReset={() => { setScoreA(0); }}
                    />

                    {/* Center volleyball */}
                    <div className="flex flex-col items-center justify-center gap-2 shrink-0 select-none">
                      <div className="sb-ball-center text-3xl sm:text-4xl">🏐</div>
                      <div className="h-px w-4 bg-white/10" />
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest rotate-90 sm:rotate-0">VS</span>
                      <div className="h-px w-4 bg-white/10" />
                    </div>

                    <TeamPanel
                      name={nameB}
                      score={scoreB}
                      accent={TEAM_COLORS.B}
                      isWinner={winner === 'B'}
                      ballState={gameBall === 'B' ? 'gameball' : oBall === 'B' ? 'oball' : null}
                      isFinished={phase === 'finished'}
                      onPlus={() => applyScore('B', 1)}
                      onMinus={() => applyScore('B', -1)}
                      onReset={() => { setScoreB(0); }}
                    />
                  </div>

                  {/* Winning rule reminder */}
                  <div className="mt-5 flex items-center justify-center gap-3 opacity-50">
                    <span className="text-[10px] text-gray-500 font-mono">23 = O Ball</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-[10px] text-gray-500 font-mono">24 = Game Ball</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-[10px] text-gray-500 font-mono">25 = Victory 🏆</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

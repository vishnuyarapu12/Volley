import React, { useState, useEffect, useRef, useCallback } from 'react';
import { playerAPI } from '../utils/api';
import { getPlayerImage } from '../utils/playerImages';

// ─── Editable player roster ───────────────────────────────────────────────────
const DEFAULT_ROSTER = [
  { id: 'Bharath',  name: 'Bharath',  role: 'Outside Hitter', jersey: 7,  tagline: 'Smashes the impossible', img: 'Bharath.jpeg'  },
  { id: 'Devaraj',  name: 'Devaraj',  role: 'Middle Blocker', jersey: 3,  tagline: 'Wall at the net',        img: 'Devaraj.jpeg'  },
  { id: 'Mahesh',   name: 'Mahesh',   role: 'Setter',         jersey: 5,  tagline: 'The playmaker',          img: 'Mahesh.jpeg'   },
  { id: 'Nawaz',    name: 'Nawaz',    role: 'Libero',         jersey: 12, tagline: 'Nothing gets past me',   img: 'Nawaz.jpeg'    },
  { id: 'Pinchu',   name: 'Pinchu',   role: 'Opposite',       jersey: 9,  tagline: 'Pure power',             img: 'Pinchu.jpeg'   },
  { id: 'Praveen',  name: 'Praveen',  role: 'Captain',        jersey: 1,  tagline: 'Leads from the front',   img: 'Praveen.jpeg'  },
  { id: 'Sai',      name: 'Sai',      role: 'Setter',         jersey: 6,  tagline: 'Precision in every set', img: 'Sai.jpeg'      },
  { id: 'Sandeep',  name: 'Sandeep',  role: 'Blocker',        jersey: 4,  tagline: 'Fortress at the net',    img: 'Sandeep.jpeg'  },
  { id: 'Vishnu',   name: 'Vishnu',   role: 'Spiker',         jersey: 8,  tagline: 'Sky-high ambitions',     img: 'Vishnu.jpeg'   },
];

const ROLES = [
  'Captain', 'Setter', 'Spiker', 'Libero', 'Blocker',
  'Outside Hitter', 'Opposite Hitter', 'Middle Blocker', 'Defensive Specialist', 'Serving Specialist',
  "Middle",
];

const STORAGE_KEY = 'volleytrack_team_roster';

function loadRoster() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (_) { /* ignore */ }
  return DEFAULT_ROSTER;
}
function saveRoster(roster) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(roster)); } catch (_) { /* ignore */ }
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_META = {
  'At Ground':  { dot: 'bg-green-400',  label: 'At Ground',  text: 'text-green-400',  ring: 'shadow-green-500/50'  },
  'On The Way': { dot: 'bg-yellow-400', label: 'On The Way', text: 'text-yellow-400', ring: 'shadow-yellow-500/50' },
  'Nearby':     { dot: 'bg-orange-400', label: 'Nearby',     text: 'text-orange-400', ring: 'shadow-orange-500/50' },
  'Away':       { dot: 'bg-red-400',    label: 'Away',       text: 'text-red-400',    ring: 'shadow-red-500/50'    },
  'Offline':    { dot: 'bg-gray-500',   label: 'Offline',    text: 'text-gray-400',   ring: 'shadow-gray-500/30'   },
};
function statusMeta(s) { return STATUS_META[s] || STATUS_META['Offline']; }

// ─── Role badge colours ────────────────────────────────────────────────────────
const ROLE_COLORS = {
  'Captain':              { gradient: 'from-yellow-500 to-amber-600',    bg: '#b45309', accent: '#fbbf24', icon: '👑' },
  'Setter':               { gradient: 'from-blue-500 to-cyan-600',       bg: '#0e7490', accent: '#38bdf8', icon: '🎯' },
  'Spiker':               { gradient: 'from-red-500 to-orange-600',      bg: '#b91c1c', accent: '#f87171', icon: '⚡' },
  'Libero':               { gradient: 'from-purple-500 to-indigo-600',   bg: '#5b21b6', accent: '#c084fc', icon: '🛡️' },
  'Blocker':              { gradient: 'from-green-500 to-teal-600',      bg: '#065f46', accent: '#34d399', icon: '🧱' },
  'Outside Hitter':       { gradient: 'from-pink-500 to-rose-600',       bg: '#9f1239', accent: '#fb7185', icon: '💥' },
  'Opposite':             { gradient: 'from-fuchsia-500 to-violet-600',  bg: '#6b21a8', accent: '#e879f9', icon: '🔄' },
  'Middle Blocker':       { gradient: 'from-sky-500 to-blue-600',        bg: '#1e40af', accent: '#60a5fa', icon: '🏔️' },
  'Defensive Specialist': { gradient: 'from-teal-500 to-emerald-600',    bg: '#134e4a', accent: '#2dd4bf', icon: '🔒' },
  'Serving Specialist':   { gradient: 'from-orange-500 to-red-600',      bg: '#9a3412', accent: '#fb923c', icon: '🚀' },
};
const DEFAULT_ROLE_COLOR = { gradient: 'from-gray-500 to-slate-600', bg: '#374151', accent: '#9ca3af', icon: '🏐' };

function roleMeta(role) { return ROLE_COLORS[role] || DEFAULT_ROLE_COLOR; }
function roleBg(role)   { return roleMeta(role).gradient; }

// ─── Custom Role Dropdown ─────────────────────────────────────────────────────
function RoleDropdown({ value, useCustom, onSelectPreset, onSwitchCustom }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const displayRole = useCustom ? null : value;
  const meta = displayRole ? roleMeta(displayRole) : DEFAULT_ROLE_COLOR;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none"
        style={{
          background: useCustom
            ? 'rgba(255,255,255,0.07)'
            : `linear-gradient(135deg, ${meta.bg}55, ${meta.bg}33)`,
          borderColor: useCustom ? 'rgba(255,255,255,0.15)' : `${meta.accent}55`,
        }}
      >
        {useCustom ? (
          <span className="text-gray-400 italic">✏️ Custom role…</span>
        ) : (
          <span className="flex items-center gap-2 font-semibold text-white">
            <span>{meta.icon}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r ${meta.gradient} text-white`}
            >
              {displayRole}
            </span>
          </span>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
          style={{ background: 'linear-gradient(160deg,#1a2744,#0f172a)', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
        >
          <div className="p-1.5 max-h-64 overflow-y-auto tp-role-scroll">
            {/* Preset roles */}
            {ROLES.map(r => {
              const rm = roleMeta(r);
              const isActive = !useCustom && value === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => { onSelectPreset(r); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group hover:scale-[1.01]"
                  style={{
                    background: isActive
                      ? `linear-gradient(135deg, ${rm.bg}99, ${rm.bg}66)`
                      : 'transparent',
                    borderLeft: isActive ? `3px solid ${rm.accent}` : '3px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = `linear-gradient(135deg, ${rm.bg}44, ${rm.bg}22)`;
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span className="text-base w-6 text-center flex-shrink-0">{rm.icon}</span>
                  <span
                    className={`flex-1 text-left text-sm font-semibold`}
                    style={{ color: isActive ? rm.accent : '#e5e7eb' }}
                  >
                    {r}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${rm.gradient} text-white uppercase tracking-wide opacity-70`}
                  >
                    {r.split(' ')[0]}
                  </span>
                  {isActive && (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                         style={{ color: rm.accent }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* Divider */}
            <div className="mx-2 my-1.5 border-t border-white/10" />

            {/* Custom option */}
            <button
              type="button"
              onClick={() => { onSwitchCustom(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group"
              style={{
                background: useCustom ? 'rgba(251,191,36,0.12)' : 'transparent',
                borderLeft: useCustom ? '3px solid rgba(251,191,36,0.6)' : '3px solid transparent',
              }}
              onMouseEnter={e => {
                if (!useCustom) e.currentTarget.style.background = 'rgba(251,191,36,0.07)';
              }}
              onMouseLeave={e => {
                if (!useCustom) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="text-base w-6 text-center flex-shrink-0">✏️</span>
              <span className="flex-1 text-left text-sm font-semibold text-yellow-300">
                Custom role…
              </span>
              <span className="text-[9px] text-yellow-500 uppercase tracking-wider">custom</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({ player, onSave, onClose }) {
  const [form, setForm] = useState({ ...player });

  const isPreset = ROLES.includes(form.role);
  const [useCustom, setUseCustom] = useState(!isPreset);
  const [customRole, setCustomRole] = useState(isPreset ? '' : form.role);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleSelectPreset(val) {
    setUseCustom(false);
    set('role', val);
  }

  function handleSwitchCustom() {
    setUseCustom(true);
    set('role', customRole || '');
  }

  function handleCustomInput(e) {
    const val = e.target.value;
    setCustomRole(val);
    set('role', val);
  }

  function handleSaveClick() {
    const finalForm = useCustom ? { ...form, role: customRole || form.role } : form;
    onSave(finalForm);
  }

  const previewMeta = roleMeta(form.role);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(14px)' }}
         onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-3xl p-6 border border-white/15"
           style={{ background: 'linear-gradient(145deg,#1e293b,#0f172a)', animation: 'tpPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
           onClick={e => e.stopPropagation()}>

        {/* Header accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r ${roleBg(form.role)}`} />

        <button onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-sm">
          ✕
        </button>

        {/* Player avatar + name header */}
        <div className="flex items-center gap-3 mb-5 pr-8">
          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0`}
               style={{ borderColor: previewMeta.accent + '88' }}>
            <img
              src={getPlayerImage(player.img) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23334155'/%3E%3Ctext x='20' y='26' font-size='18' text-anchor='middle' fill='%23fbbf24' font-family='sans-serif'%3E${encodeURIComponent(player.name[0])}%3C/text%3E%3C/svg%3E`}
              alt={player.name}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div>
            <h3 className="text-lg font-black text-white leading-tight">Edit Player</h3>
            <p className="text-xs text-gray-400">{player.name}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Display Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
                   className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/30 text-sm" />
          </div>

          {/* Role — custom dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Role</label>

            <RoleDropdown
              value={form.role}
              useCustom={useCustom}
              onSelectPreset={handleSelectPreset}
              onSwitchCustom={handleSwitchCustom}
            />

            {/* Custom input — appears when custom selected */}
            {useCustom && (
              <div className="mt-2 flex items-center gap-2 tp-slide-in">
                <input
                  autoFocus
                  value={customRole}
                  onChange={handleCustomInput}
                  placeholder="Type your custom role…"
                  className="flex-1 px-3 py-2.5 rounded-xl border text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/30 text-sm transition-all duration-200"
                  style={{ background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.35)' }}
                />
                <button
                  type="button"
                  title="Back to preset roles"
                  onClick={() => {
                    setUseCustom(false);
                    set('role', ROLES[0]);
                  }}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  ↩
                </button>
              </div>
            )}

            {/* Live preview badge */}
            {form.role && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Preview:</span>
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${roleBg(form.role)} text-white uppercase tracking-wide`}>
                  <span>{roleMeta(form.role).icon}</span>
                  {form.role}
                </span>
              </div>
            )}
          </div>

          {/* Jersey # */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Jersey #</label>
            <input type="number" min={1} max={99} value={form.jersey} onChange={e => set('jersey', Number(e.target.value))}
                   className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:border-yellow-400/50 text-sm" />
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Tagline</label>
            <input value={form.tagline} onChange={e => set('tagline', e.target.value)}
                   className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 text-sm"
                   placeholder="Short player tagline" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-gray-300 font-semibold text-sm hover:bg-white/15 transition-colors">
            Cancel
          </button>
          <button onClick={handleSaveClick}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-volleyball-darker transition-all hover:brightness-110 active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hover popup overlay ──────────────────────────────────────────────────────
function HoverPopup({ player, liveStatus, stats }) {
  const sm = statusMeta(liveStatus || player.status || 'Offline');
  const rm = roleMeta(player.role);
  return (
    <div className="tp-popup absolute inset-x-0 bottom-0 z-20 rounded-b-[22px] overflow-hidden"
         style={{ background: 'rgba(6,9,43,0.94)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="p-3.5 space-y-2">
        {/* Name + role row */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-black text-white text-sm leading-tight truncate">{player.name}</p>
            <p className={`text-xs font-semibold ${sm.text}`}>{sm.label}</p>
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-gradient-to-r ${roleBg(player.role)} text-white flex-shrink-0`}>
            <span>{rm.icon}</span>
            <span className="hidden sm:inline">{player.role.split(' ')[0]}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <StatPill label="Jersey" value={`#${player.jersey}`} accent="text-yellow-400" />
          <StatPill label="Matches" value={stats?.visits ?? '–'} accent="text-blue-400" />
          <StatPill label="Attend." value={stats?.attendance ? `${stats.attendance}%` : '–'} accent="text-green-400" />
        </div>

        {player.tagline && (
          <p className="text-[9px] text-gray-400 italic text-center pt-0.5 leading-snug truncate">"{player.tagline}"</p>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div className="flex flex-col items-center py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <span className={`text-sm font-black ${accent}`}>{value}</span>
      <span className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

// ─── Full image modal ────────────────────────────────────────────────────────
function FullImageModal({ player, onClose }) {
  const rm = roleMeta(player.role);
  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-4"
        style={{ animation: 'tpPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white text-base font-bold transition-colors shadow-lg"
        >
          ✕
        </button>

        {/* Image */}
        <div
          className="rounded-3xl overflow-hidden border-2 shadow-2xl"
          style={{
            borderColor: rm.accent + '88',
            boxShadow: `0 0 60px ${rm.accent}44, 0 0 120px ${rm.accent}22`,
            maxWidth: 'min(88vw, 420px)',
            maxHeight: 'min(80vh, 520px)',
          }}
        >
          <img
            src={getPlayerImage(player.img) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23334155'/%3E%3Ctext x='200' y='220' font-size='120' text-anchor='middle' fill='%23fbbf24' font-family='sans-serif'%3E${encodeURIComponent(player.name[0])}%3C/text%3E%3C/svg%3E`}
            alt={player.name}
            className="block w-full h-full object-cover object-top"
            style={{ maxWidth: 'min(88vw, 420px)', maxHeight: 'min(80vh, 520px)' }}
          />
        </div>

        {/* Name + role */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-2xl font-black text-white tracking-tight">{player.name}</p>
          <span
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r ${roleBg(player.role)} text-white uppercase tracking-wide shadow-lg`}
          >
            <span>{rm.icon}</span>
            {player.role}
          </span>
          {player.tagline && (
            <p className="text-sm text-gray-400 italic text-center max-w-xs">"{player.tagline}"</p>
          )}
        </div>

        {/* Hint */}
        <p className="text-[10px] text-gray-600 uppercase tracking-widest">Tap anywhere to close</p>
      </div>
    </div>
  );
}

// ─── Single player card ───────────────────────────────────────────────────────
function PlayerCard({ player, index, liveStatus, stats, editMode, onEdit, onViewImage }) {
  const [hovered, setHovered] = useState(false);
  const sm = statusMeta(liveStatus || 'Offline');
  const rm = roleMeta(player.role);
  const isOnline = liveStatus && liveStatus !== 'Offline';

  // Double-tap detection for mobile
  const lastTapRef = useRef(0);
  function handleTouchEnd(e) {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      onViewImage(player);
    }
    lastTapRef.current = now;
  }

  return (
    <div
      className="tp-card relative select-none"
      style={{ animationDelay: `${index * 60}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={() => onViewImage(player)}
      onTouchStart={() => setHovered(v => !v)}
      onTouchEnd={handleTouchEnd}
    >
      {/* Glow border gradient */}
      <div className={`tp-card-glow absolute inset-0 rounded-[22px] pointer-events-none transition-opacity duration-500 ${hovered ? 'opacity-100' : 'opacity-0'}`}
           style={{ background: `linear-gradient(135deg, ${rm.accent}55, rgba(96,165,250,0.2), rgba(167,139,250,0.15))`, padding: '1px', borderRadius: '22px' }}>
        <div className="w-full h-full rounded-[21px]" style={{ background: '#08102a' }} />
      </div>

      {/* Card body */}
      <div className={`tp-card-body relative h-full flex flex-col items-center overflow-hidden rounded-[22px] border transition-all duration-300 ${hovered ? 'tp-card-lifted' : ''}`}
           style={{
             borderColor: hovered ? `${rm.accent}44` : 'rgba(255,255,255,0.07)',
             background: 'linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%)',
             backdropFilter: 'blur(12px)',
           }}>

        {/* Top accent bar — role colour */}
        <div className={`h-1 w-full bg-gradient-to-r ${roleBg(player.role)} shrink-0`} />

        {/* Photo area */}
        <div className="pt-5 pb-3 px-3 flex flex-col items-center gap-2 flex-1 w-full">
          {/* Avatar with status ring */}
          <div className={`relative shrink-0 transition-all duration-300 ${hovered ? 'scale-110' : 'scale-100'}`}>
            {/* Status glow ring */}
            {isOnline && (
              <div className={`absolute inset-0 rounded-full animate-ping-slow opacity-40 ${sm.dot.replace('bg-', 'ring-2 ring-')}`}
                   style={{ boxShadow: `0 0 16px 4px currentColor` }} />
            )}

            <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 transition-all duration-300 ${isOnline ? `border-current ${sm.text} shadow-lg ${sm.ring}` : 'border-white/15'}`}
                 style={isOnline ? { boxShadow: `0 0 12px 2px ${sm.dot.includes('green') ? '#4ade80' : sm.dot.includes('yellow') ? '#facc15' : sm.dot.includes('orange') ? '#fb923c' : '#9ca3af'}55` } : {}}>
              <img
                src={getPlayerImage(player.img) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23334155'/%3E%3Ctext x='32' y='40' font-size='28' text-anchor='middle' fill='%23fbbf24' font-family='sans-serif'%3E${encodeURIComponent(player.name[0])}%3C/text%3E%3C/svg%3E`}
                alt={player.name}
                loading="lazy"
                className="w-full h-full object-cover object-top"
              />
            </div>

            {/* Jersey badge */}
            <div className={`tp-jersey absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white border border-black/30 shadow-lg transition-all duration-300 ${hovered ? 'scale-125 tp-jersey-pulse' : ''}`}
                 style={{
                   background: `linear-gradient(135deg,${rm.accent},${rm.bg})`,
                   boxShadow: hovered ? `0 0 10px ${rm.accent}88` : ''
                 }}>
              {player.jersey}
            </div>

            {/* Live status dot */}
            <div className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-[#08102a] ${sm.dot} ${isOnline ? 'animate-pulse-slow' : ''}`} />
          </div>

          {/* Name */}
          <p className="text-xs sm:text-sm font-black text-white text-center leading-tight mt-1 truncate w-full px-1">
            {player.name}
          </p>

          {/* Role badge */}
          <span className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${roleBg(player.role)} text-white uppercase tracking-wide`}>
            <span className="text-[8px]">{rm.icon}</span>
            {player.role}
          </span>

          {/* Status indicator */}
          <div className="flex items-center gap-1 mt-auto">
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} ${isOnline ? 'animate-pulse' : ''}`} />
            <span className={`text-[9px] font-semibold ${sm.text}`}>{sm.label}</span>
          </div>
        </div>

        {/* Hover popup */}
        {hovered && <HoverPopup player={player} liveStatus={liveStatus} stats={stats} />}

        {/* Edit button */}
        {editMode && (
          <button
            onClick={e => { e.stopPropagation(); onEdit(player); }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-yellow-400/90 text-yellow-900 text-[10px] font-black flex items-center justify-center hover:bg-yellow-300 transition-all z-30 shadow-lg"
          >
            ✎
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Floating particles ───────────────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 3,
    x: Math.random() * 100,
    delay: Math.random() * 8,
    dur: 6 + Math.random() * 6,
    opacity: 0.15 + Math.random() * 0.25,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div key={p.id}
             className="absolute rounded-full bg-yellow-400"
             style={{
               width: p.size, height: p.size,
               left: `${p.x}%`, bottom: '-10px',
               opacity: p.opacity,
               animation: `tpFloat ${p.dur}s ${p.delay}s ease-in-out infinite`,
             }} />
      ))}
    </div>
  );
}

// ─── Role summary bar ─────────────────────────────────────────────────────────
function RoleSummaryBar({ roster, activeFilter, onFilter }) {
  // Count each role
  const roleCounts = {};
  for (const p of roster) {
    roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
  }
  const uniqueRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      {/* All filter */}
      <button
        onClick={() => onFilter(null)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${
          activeFilter === null
            ? 'bg-white/20 border-white/30 text-white shadow-lg'
            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
        }`}
      >
        🏐 All
        <span className="bg-white/20 text-white rounded-full px-1.5 py-0.5 text-[9px] font-black">{roster.length}</span>
      </button>

      {uniqueRoles.map(([role, count]) => {
        const rm = roleMeta(role);
        const isActive = activeFilter === role;
        return (
          <button
            key={role}
            onClick={() => onFilter(isActive ? null : role)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border`}
            style={{
              background: isActive
                ? `linear-gradient(135deg, ${rm.bg}cc, ${rm.bg}99)`
                : 'rgba(255,255,255,0.04)',
              borderColor: isActive ? `${rm.accent}88` : 'rgba(255,255,255,0.08)',
              color: isActive ? rm.accent : '#9ca3af',
              boxShadow: isActive ? `0 0 12px ${rm.accent}33` : 'none',
            }}
          >
            <span className="text-[11px]">{rm.icon}</span>
            <span style={{ color: isActive ? '#fff' : '#9ca3af' }}>{role}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-black"
              style={{
                background: isActive ? `${rm.accent}33` : 'rgba(255,255,255,0.1)',
                color: isActive ? rm.accent : '#6b7280',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Team stats summary ───────────────────────────────────────────────────────
function TeamStatsSummary({ roster, liveData }) {
  const online = roster.filter(p => {
    const d = liveData[p.name.toLowerCase()];
    return d?.status && d.status !== 'Offline';
  }).length;
  const atGround = roster.filter(p => {
    const d = liveData[p.name.toLowerCase()];
    return d?.status === 'At Ground';
  }).length;
  const uniqueRoles = new Set(roster.map(p => p.role)).size;

  const stats = [
    { label: 'Players', value: roster.length, icon: '👥', accent: '#60a5fa' },
    { label: 'Online', value: online, icon: '🟢', accent: '#4ade80' },
    { label: 'At Ground', value: atGround, icon: '📍', accent: '#fbbf24' },
    { label: 'Positions', value: uniqueRoles, icon: '🎯', accent: '#c084fc' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-6">
      {stats.map(s => (
        <div
          key={s.label}
          className="flex flex-col items-center py-3 px-2 rounded-2xl border border-white/8"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <span className="text-lg mb-0.5">{s.icon}</span>
          <span className="text-xl font-black" style={{ color: s.accent }}>{s.value}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main showcase ────────────────────────────────────────────────────────────
export default function TeamPlayersShowcase() {
  const [roster, setRoster] = useState(loadRoster);
  const [liveData, setLiveData] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [imagePlayer, setImagePlayer] = useState(null);
  const [visible, setVisible] = useState(false);
  const [roleFilter, setRoleFilter] = useState(null);
  const sectionRef = useRef(null);

  // Intersection observer for stagger reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch live player statuses
  const fetchLive = useCallback(async () => {
    try {
      const data = await playerAPI.getLocationVotes();
      if (!data?.players) return;
      const map = {};
      for (const p of data.players) {
        map[p.name?.toLowerCase()] = {
          status: p.location_vote || p.gps_status || 'Offline',
          visits: p.visits ?? null,
        };
      }
      setLiveData(map);
    } catch (_) { /* silently ignore */ }
  }, []);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 30_000);
    return () => clearInterval(id);
  }, [fetchLive]);

  function getLiveStatus(player) {
    return liveData[player.name.toLowerCase()]?.status || null;
  }
  function getStats(player) {
    const d = liveData[player.name.toLowerCase()];
    if (!d) return null;
    return { visits: d.visits, attendance: d.visits != null ? Math.min(100, d.visits * 10) : null };
  }

  function handleSave(updated) {
    const next = roster.map(p => p.id === updated.id ? { ...p, ...updated } : p);
    setRoster(next);
    saveRoster(next);
    setEditTarget(null);
  }

  const filteredRoster = roleFilter
    ? roster.filter(p => p.role === roleFilter)
    : roster;

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-12 px-4"
             style={{ background: 'linear-gradient(180deg, #06092b 0%, #090d35 50%, #06092b 100%)' }}>
      {/* Animated background gradient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-5 blur-3xl"
             style={{ background: 'radial-gradient(circle,#fbbf24,transparent 70%)', animation: 'tpBlob1 10s ease-in-out infinite' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-5 blur-3xl"
             style={{ background: 'radial-gradient(circle,#3b82f6,transparent 70%)', animation: 'tpBlob2 13s ease-in-out infinite' }} />
      </div>

      <Particles />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* ── Section header ── */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-yellow-400/80">VolleyTrack</span>
              <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-yellow-400/40 to-transparent" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              🏐 Team Players
            </h2>
            <p className="text-gray-400 text-sm mt-1">Meet the athletes who make every match possible.</p>
          </div>

          {/* Edit toggle */}
          <button
            onClick={() => setEditMode(m => !m)}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-300 ${editMode ? 'bg-yellow-400 text-yellow-900 border-yellow-400 shadow-lg shadow-yellow-400/30' : 'bg-white/5 text-gray-400 border-white/10 hover:border-yellow-400/30 hover:text-yellow-400'}`}
          >
            {editMode ? '✓ Done' : '✎ Edit Roster'}
          </button>
        </div>

        {/* ── Team stats ── */}
        <TeamStatsSummary roster={roster} liveData={liveData} />

        {/* ── Role filter tabs ── */}
        <RoleSummaryBar
          roster={roster}
          activeFilter={roleFilter}
          onFilter={setRoleFilter}
        />

        {/* ── Player grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredRoster.map((player, i) => (
            <div key={player.id}
                 className={`tp-card-wrap transition-all ${visible ? 'tp-card-visible' : 'tp-card-hidden'}`}
                 style={{ transitionDelay: visible ? `${i * 60}ms` : '0ms', transitionDuration: '500ms' }}>
              <PlayerCard
                player={player}
                index={i}
                liveStatus={getLiveStatus(player)}
                stats={getStats(player)}
                editMode={editMode}
                onEdit={setEditTarget}
                onViewImage={setImagePlayer}
              />
            </div>
          ))}
        </div>

        {/* Empty state for filtered view */}
        {filteredRoster.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm font-semibold">No players found for this role</p>
            <button onClick={() => setRoleFilter(null)} className="mt-3 text-xs text-yellow-400 hover:underline">Clear filter</button>
          </div>
        )}

        {/* ── Live indicator ── */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Live status updates every 30s</span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
      </div>

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          player={editTarget}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Full image modal */}
      {imagePlayer && (
        <FullImageModal
          player={imagePlayer}
          onClose={() => setImagePlayer(null)}
        />
      )}
    </section>
  );
}

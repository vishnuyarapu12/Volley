/** Playful titles shown on slide change or when the user taps a moment */
export const MOMENT_CLICK_TITLES = [
  'That spike was personal',
  'Net cord drama — classic',
  'Ace mode: unlocked',
  'Dig first, breathe later',
  'Set it like you mean it',
  'Game point goosebumps',
  'Sideline hype is real',
  'Block party on court',
  'Rally till the lights blink',
  'Sand in shoes, joy in heart',
  'Pass perfect, vibe immaculate',
  'Coach said “one more”',
  'Team huddle energy',
  'Championship flashback',
  'Ouch… that rotate though',
  'Libero instincts activated',
  'Jump serve confidence',
  'Middle blocker menace',
  'Clutch touch at the tape',
  'Volleyball: organized chaos',
  'That celebration was illegal',
  'Warm-up or main character?',
  'Golden hour on the court',
  'Telangana volleyball vibes',
  'Click for another story',
];

export function pickRandomTitle(exclude = '') {
  const pool = MOMENT_CLICK_TITLES.filter((t) => t !== exclude);
  if (pool.length === 0) return MOMENT_CLICK_TITLES[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function formatMomentLabel(filename, index) {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/^WhatsApp Image\s*/i, '')
    .replace(/\s*at\s*/i, ' · ')
    .trim();
  return base || `Moment ${index + 1}`;
}

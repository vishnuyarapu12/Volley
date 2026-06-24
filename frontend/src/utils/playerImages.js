/**
 * Player image mapping — auto-discovers all images in src/player_img
 * using Vite's import.meta.glob so new images work immediately
 * without any manual registration.
 *
 * Key: player name (stem of the filename, e.g. "Bharath").
 * Value: Vite-resolved image URL.
 */

// Eagerly import every image in the folder — Vite resolves them at build time.
const rawModules = import.meta.glob('../player_img/*.{jpeg,jpg,png,webp,avif,gif}', { eager: true });

export const playerImages = {};

for (const [path, mod] of Object.entries(rawModules)) {
  // Extract the filename stem: "../player_img/Bharath.jpeg" → "Bharath"
  const stem = path.split('/').pop().replace(/\.[^.]+$/, '');
  playerImages[stem] = mod.default ?? mod;
}

/**
 * Look up a player image by name or filename.
 * Returns the imported image URL or undefined if not found.
 */
export function getPlayerImage(nameOrFilename) {
  if (!nameOrFilename) return undefined;

  // Try direct name match first (e.g. "Bharath")
  if (playerImages[nameOrFilename]) return playerImages[nameOrFilename];

  // Try stripping extension from filename (e.g. "Bharath.jpeg" → "Bharath")
  const stem = nameOrFilename.replace(/\.[^.]+$/, '');
  if (playerImages[stem]) return playerImages[stem];

  return undefined;
}

/**
 * Moments image mapping — auto-discovers all gallery photos from src/moments_img
 * using Vite's import.meta.glob so new images work immediately
 * without any manual registration.
 *
 * Each entry has a `src` (Vite-resolved URL) and a `filename` (original name).
 */

// Eagerly import every image in the folder — Vite resolves them at build time.
const rawModules = import.meta.glob('../moments_img/*.{jpeg,jpg,png,webp,avif,gif}', { eager: true });

export const momentImages = Object.entries(rawModules)
  .map(([path, mod]) => {
    // "../moments_img/WhatsApp Image 2026-06-06 at 3.47.52 PM.jpeg"
    const filename = path.split('/').pop();
    return { filename, src: mod.default ?? mod };
  })
  // Sort alphabetically by filename for a stable, predictable order
  .sort((a, b) => a.filename.localeCompare(b.filename));

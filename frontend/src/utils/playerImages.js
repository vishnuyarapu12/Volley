/**
 * Player image mapping — imports all player photos from src/player_img
 * so they are bundled by Vite and served from the CDN in production.
 *
 * Key: player name (must match the `name` field in the roster).
 * Value: Vite-resolved image URL.
 */
import Bharath from '../player_img/Bharath.jpeg';
import Devaraj from '../player_img/Devaraj.jpeg';
import Mahesh from '../player_img/Mahesh.jpeg';
import Nawaz from '../player_img/Nawaz.jpeg';
import Pinchu from '../player_img/Pinchu.jpeg';
import Praveen from '../player_img/Praveen.jpeg';
import Sai from '../player_img/Sai.jpeg';
import Sandeep from '../player_img/Sandeep.jpeg';
import Vishnu from '../player_img/Vishnu.jpeg';

export const playerImages = {
  Bharath,
  Devaraj,
  Mahesh,
  Nawaz,
  Pinchu,
  Praveen,
  Sai,
  Sandeep,
  Vishnu,
};

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

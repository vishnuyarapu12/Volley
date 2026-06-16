/** Fallback map center only — NOT used as "your location" */
export const DEFAULT_CENTER = { latitude: 17.3850, longitude: 78.4867 };

const INDIA_CENTER = { latitude: 20.5937, longitude: 78.9629 };
const LAST_GPS_KEY = 'volleytrack_last_gps';

const GEO_GPS = { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 };
const GEO_NETWORK = { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 };

function readPosition(pos) {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  };
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('Geolocation not supported'), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(readPosition(pos)),
      (err) => reject(err),
      options
    );
  });
}

export function saveLastGps(pos) {
  if (!pos?.latitude || !pos?.longitude) return;
  try {
    localStorage.setItem(
      LAST_GPS_KEY,
      JSON.stringify({
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
        savedAt: Date.now(),
      })
    );
  } catch { /* ignore */ }
}

export function getLastGps() {
  try {
    const raw = localStorage.getItem(LAST_GPS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.latitude == null || data.longitude == null) return null;
    return data;
  } catch {
    return null;
  }
}

export function isLowAccuracy(accuracyMeters) {
  return accuracyMeters == null || accuracyMeters > 1500;
}

/** Coarse IP fix often lands on Hyderabad default — wait for a better reading */
export function isLikelyHyderabadPlaceholder(lat, lon, accuracyMeters) {
  const dLat = Math.abs(lat - DEFAULT_CENTER.latitude);
  const dLon = Math.abs(lon - DEFAULT_CENTER.longitude);
  const nearDefault = dLat < 0.15 && dLon < 0.15;
  return nearDefault && isLowAccuracy(accuracyMeters);
}

/**
 * Watch GPS until we get a good fix (best accuracy), up to timeoutMs.
 * This is the most reliable way to get real device location on Windows/Android.
 */
export function watchBestPosition({ timeoutMs = 50000, onUpdate } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('Geolocation not supported'), { code: 0 }));
      return;
    }

    let best = null;
    let watchId = null;
    let settled = false;

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      if (best && !isLikelyHyderabadPlaceholder(best.latitude, best.longitude, best.accuracy)) {
        finish(() => resolve(best));
      } else if (best) {
        finish(() => resolve(best));
      } else {
        finish(() => reject(Object.assign(new Error('GPS timeout'), { code: 3 })));
      }
    }, timeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const reading = readPosition(pos);
        onUpdate?.(reading);

        const better =
          !best ||
          reading.accuracy < best.accuracy ||
          (isLikelyHyderabadPlaceholder(best.latitude, best.longitude, best.accuracy) &&
            !isLikelyHyderabadPlaceholder(reading.latitude, reading.longitude, reading.accuracy));

        if (better) best = reading;

        if (reading.accuracy <= 80) {
          finish(() => resolve(reading));
          return;
        }

        if (reading.accuracy <= 400 && !isLikelyHyderabadPlaceholder(reading.latitude, reading.longitude, reading.accuracy)) {
          finish(() => resolve(reading));
        }
      },
      (err) => finish(() => reject(err)),
      GEO_GPS
    );
  });
}

/** Primary API: get user's real current location for the map */
export async function getMyCurrentLocation(onProgress) {
  const last = getLastGps();
  if (last) onProgress?.(last);

  try {
    const pos = await watchBestPosition({
      timeoutMs: 50000,
      onUpdate: (reading) => {
        saveLastGps(reading);
        onProgress?.(reading);
      },
    });
    saveLastGps(pos);
    return pos;
  } catch (watchErr) {
    if (watchErr?.code === 1) throw watchErr;
    try {
      const pos = await getCurrentPosition(GEO_GPS);
      saveLastGps(pos);
      return pos;
    } catch {
      if (last) return last;
      throw watchErr;
    }
  }
}

export async function getPositionWithFallback() {
  return getMyCurrentLocation();
}

export function getInitialMapCenter() {
  const last = getLastGps();
  if (last) {
    return { latitude: last.latitude, longitude: last.longitude, zoom: 15 };
  }
  return { ...INDIA_CENTER, zoom: 6 };
}

export function getGeoErrorMessage(err) {
  if (!err) return 'Unable to get location';
  if (err.code === 1) {
    return 'Location permission denied — click the lock icon in the address bar and allow Location, then tap “Use My Current Location”.';
  }
  if (err.code === 3) {
    return 'GPS timed out — enable Location in Windows Settings, use Chrome/Edge, and try again near a window.';
  }
  if (err.code === 2) {
    return 'Location unavailable — turn on device location services.';
  }
  return err.message || 'Unable to get location';
}

export { GEO_GPS, GEO_NETWORK, getCurrentPosition, INDIA_CENTER };

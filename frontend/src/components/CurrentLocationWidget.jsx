import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Navigation, Copy, Check } from 'lucide-react';
import { getPositionWithFallback, getGeoErrorMessage, isLowAccuracy } from '../utils/geolocation';

export default function CurrentLocationWidget() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getPositionWithFallback();
      setLocation({
        latitude: pos.latitude.toFixed(6),
        longitude: pos.longitude.toFixed(6),
        accuracy: pos.accuracy?.toFixed(0) ?? '?',
        lowAccuracy: isLowAccuracy(pos.accuracy),
      });
    } catch (err) {
      setError(getGeoErrorMessage(err));
      setLocation(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const handleCopy = () => {
    if (location) {
      const text = `${location.latitude}, ${location.longitude}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = () => fetchLocation();

  return (
    <div className="glass-dark p-6 rounded-2xl border border-white/10 hover:border-blue-400/50 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <MapPin className="text-blue-400" size={20} />
          </div>
          <h3 className="font-bold text-white">Current Location</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh location"
        >
          <Navigation
            className={`text-blue-400 transition-transform ${loading ? 'animate-spin' : ''}`}
            size={18}
          />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-white/10 rounded animate-pulse"></div>
          <div className="h-4 bg-white/10 rounded animate-pulse w-3/4"></div>
        </div>
      ) : error ? (
        <div className="text-sm text-red-300 bg-red-500/10 p-2 rounded">
          {error}
        </div>
      ) : location ? (
        <div className="space-y-3">
          {/* Latitude */}
          <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
            <div>
              <p className="text-xs text-gray-400">Latitude</p>
              <p className="font-mono text-sm text-green-300">{location.latitude}</p>
            </div>
          </div>

          {/* Longitude */}
          <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
            <div>
              <p className="text-xs text-gray-400">Longitude</p>
              <p className="font-mono text-sm text-green-300">{location.longitude}</p>
            </div>
          </div>

          {/* Accuracy */}
          <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
            <div>
              <p className="text-xs text-gray-400">Accuracy</p>
              <p className="font-mono text-sm text-blue-300">±{location.accuracy}m</p>
            </div>
          </div>

          {location.lowAccuracy && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
              Low accuracy — browser may show a city center (e.g. Hyderabad). Enable GPS on your device and refresh.
            </p>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="w-full mt-4 py-2 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg text-blue-300 text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check size={16} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy Coordinates
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

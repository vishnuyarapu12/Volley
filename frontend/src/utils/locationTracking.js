import { playerAPI, storage } from './api';

/**
 * Location tracking utility
 * Handles GPS location updates with configurable intervals
 */

export class LocationTracker {
  constructor(playerId, updateInterval = 30000) {
    this.playerId = playerId;
    this.updateInterval = updateInterval; // 30 seconds by default
    this.watchId = null;
    this.isTracking = false;
    this.lastLocation = null;
    this.onLocationUpdate = null;
    this.onError = null;
  }

  /**
   * Start tracking location - uses low accuracy for fast first fix,
   * then progressively improves with high accuracy updates
   */
  startTracking() {
    if (this.isTracking) {
      console.log('Location tracking already active');
      return;
    }

    if (!navigator.geolocation) {
      const error = 'Geolocation is not supported by your browser';
      console.error(error);
      this.onError?.(error);
      return;
    }

    this.isTracking = true;

    // Watch with moderate accuracy for a good speed/precision balance
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionSuccess(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );

    console.log('Location tracking started');
    storage.setLocationTracking(true);
  }

  /**
   * Get a fast one-shot location using low accuracy (sub-500ms on most devices)
   * Returns a Promise<{latitude, longitude, accuracy}>
   */
  static async getQuickPosition() {
    const { getPositionWithFallback } = await import('./geolocation');
    return getPositionWithFallback();
  }

  /**
   * Stop tracking location
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.isTracking = false;
      console.log('Location tracking stopped');
      storage.setLocationTracking(false);
    }
  }

  /**
   * Handle successful position update
   */
  async handlePositionSuccess(position) {
    const { latitude, longitude, accuracy } = position.coords;

    // Check if location has actually changed significantly
    if (this.lastLocation) {
      const distance = this.calculateDistance(
        this.lastLocation.latitude,
        this.lastLocation.longitude,
        latitude,
        longitude
      );

      // Only update if moved more than 10 meters or accuracy improved
      if (distance < 10 && accuracy >= this.lastLocation.accuracy) {
        return;
      }
    }

    this.lastLocation = { latitude, longitude, accuracy };

    try {
      // Send location to backend
      const response = await playerAPI.updateLocation(
        this.playerId,
        latitude,
        longitude
      );

      // Call callback if provided
      this.onLocationUpdate?.(response);

      console.log('Location updated:', { latitude, longitude });
    } catch (error) {
      console.error('Failed to send location update:', error);
      this.onError?.(error);
    }
  }

  /**
   * Handle position error
   */
  handlePositionError(error) {
    let message = 'Unknown error';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Location permission denied. Please enable location access.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Location information is unavailable.';
        break;
      case error.TIMEOUT:
        message = 'Location request timed out.';
        break;
    }
    console.error('Geolocation error:', message);
    this.onError?.(message);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) *
        Math.cos(φ2) *
        Math.sin(Δλ / 2) *
        Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  /**
   * Get last known location
   */
  getLastLocation() {
    return this.lastLocation;
  }

  /**
   * Check if tracking is active
   */
  isActive() {
    return this.isTracking;
  }

  /**
   * Set callback for location updates
   */
  setOnLocationUpdate(callback) {
    this.onLocationUpdate = callback;
  }

  /**
   * Set callback for errors
   */
  setOnError(callback) {
    this.onError = callback;
  }
}

export default LocationTracker;

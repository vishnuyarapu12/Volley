import React, { useEffect, useState, useCallback, useRef } from 'react';
import { playerAPI, storage } from '../utils/api';
import {
  getMyCurrentLocation,
  getInitialMapCenter,
  getGeoErrorMessage,
  isLowAccuracy,
  isLikelyHyderabadPlaceholder,
  getLastGps,
} from '../utils/geolocation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PLAYER_CIRCLE_RADIUS = 50;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function getStatusColor(status) {
  const colors = {
    'At Ground': '#10b981',
    'Nearby': '#f97316',
    'On The Way': '#eab308',
    'Away': '#ef4444',
    'Offline': '#6b7280',
  };
  return colors[status] || '#9ca3af';
}

function scheduleMapResize(mapInstance) {
  if (!mapInstance) return;
  const run = () => mapInstance.invalidateSize();
  requestAnimationFrame(run);
  setTimeout(run, 100);
  setTimeout(run, 400);
}

/** React Strict Mode leaves _leaflet_id on the DOM; must clear before re-init */
function destroyLeafletContainer(mapInstance, container) {
  if (mapInstance) {
    try {
      mapInstance.off();
      mapInstance.remove();
    } catch (e) {
      console.warn('Leaflet remove:', e);
    }
  }
  if (container) {
    if (container._leaflet_id != null) {
      delete container._leaflet_id;
    }
    container.replaceChildren();
  }
}

// ─── Tile Layer Definitions (all 100% free, no API key) ────────────────────
const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    label: '🗺️ Map',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    label: '🛰️ Satellite',
  },
  hybrid: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
    attribution: 'Tiles &copy; Esri | Labels &copy; CARTO',
    maxZoom: 19,
    label: '🛰️ Hybrid',
  },
};

// ─── Player marker: circle + name ───────────────────────────────────────────
function createPlayerMapIcon(name, color) {
  const safeName = escapeHtml(name);
  const shortName = escapeHtml((name || '?').split(' ')[0]);
  return L.divIcon({
    className: 'player-map-icon-wrap',
    html: `
      <div class="player-map-marker">
        <div class="player-map-circle" style="border-color:${color}; background:${color}40; box-shadow:0 0 0 5px ${color}25;">
          <span style="color:#fff">${shortName}</span>
        </div>
        <div class="player-map-name" style="border-color:${color}55">${safeName}</div>
      </div>`,
    iconSize: [90, 58],
    iconAnchor: [45, 29],
    popupAnchor: [0, -32],
  });
}

function createGroundIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position: relative; width: 44px; height: 44px;">
        <div style="
          width: 44px; height: 44px;
          background: radial-gradient(circle, #fbbf24, #f59e0b);
          border: 3px solid #fff;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(251,191,36,0.7), 0 4px 15px rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          animation: groundPulse 2s ease-in-out infinite;
        ">🏐</div>
      </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -25],
  });
}

function createUserIcon(label = 'You') {
  const safe = escapeHtml(label);
  return L.divIcon({
    className: 'player-map-icon-wrap',
    html: `
      <div class="player-map-marker">
        <div class="player-map-circle" style="border-color:#3b82f6; background:rgba(59,130,246,0.45); box-shadow:0 0 0 6px rgba(59,130,246,0.2);">
          <span style="color:#fff">●</span>
        </div>
        <div class="player-map-name" style="border-color:#3b82f655; color:#93c5fd">${safe}</div>
      </div>`,
    iconSize: [90, 58],
    iconAnchor: [45, 29],
    popupAnchor: [0, -32],
  });
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function MapComponent() {
  const [mapReady, setMapReady] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [settingGround, setSettingGround] = useState(false);
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [savingGround, setSavingGround] = useState(false);
  const [tileMode, setTileMode] = useState('dark'); // 'dark' | 'satellite' | 'hybrid'
  const [mapInitFailed, setMapInitFailed] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(true);

  const mapRef = useRef(null);
  const mapHostRef = useRef(null);
  const groundRadiusRef = useRef(500);
  const currentLocationRef = useRef(null);
  const syncUserLocationRef = useRef(null);
  const markersRef = useRef({});
  const playerCirclesRef = useRef({});
  const userCircleRef = useRef(null);
  const userAccuracyCircleRef = useRef(null);
  const userMarkerRef = useRef(null);
  const lastBackendLocationSentRef = useRef(0);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const labelLayerRef = useRef(null);
  const groundMarkerRef = useRef(null);
  const groundCircleRef = useRef(null);
  const settingGroundRef = useRef(settingGround);
  const lastMappedPlayerCountRef = useRef(-1);

  // Keep settingGroundRef in sync (so map click closure sees latest value)
  useEffect(() => { settingGroundRef.current = settingGround; }, [settingGround]);

  const showMsg = useCallback((text, duration = 3500) => {
    setMessage(text);
    setTimeout(() => setMessage(''), duration);
  }, []);

  const setupGroundLayers = useCallback((mapInstance, groundLat, groundLon, radiusM = 500) => {
    if (!mapInstance) return;
    groundRadiusRef.current = radiusM;
    if (groundMarkerRef.current) {
      groundMarkerRef.current.setLatLng([groundLat, groundLon]);
    } else {
      groundMarkerRef.current = L.marker([groundLat, groundLon], { icon: createGroundIcon() })
        .bindPopup('<div style="text-align:center;font-weight:700;font-size:14px">🏐 Volleyball Ground</div>')
        .addTo(mapInstance);
    }
    if (groundCircleRef.current) {
      groundCircleRef.current.setLatLng([groundLat, groundLon]);
      groundCircleRef.current.setRadius(radiusM);
    } else {
      groundCircleRef.current = L.circle([groundLat, groundLon], {
        radius: radiusM,
        color: '#fbbf24',
        fillColor: '#fbbf24',
        fillOpacity: 0.05,
        weight: 2,
        dashArray: '6 4',
      }).addTo(mapInstance);
    }
  }, []);

  const applyUserOnMap = useCallback((userPos, { flyTo = false } = {}) => {
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance || !userPos) return;

    const { latitude: lat, longitude: lon } = userPos;
    setCurrentLocation(userPos);
    currentLocationRef.current = userPos;

    const playerInfo = storage.getPlayerInfo();
    const youLabel = playerInfo?.name ? `${playerInfo.name} (You)` : 'You';

    const accuracyRadius = Math.min(Math.max(userPos.accuracy || 50, 25), 800);

    if (userCircleRef.current) {
      userCircleRef.current.setLatLng([lat, lon]);
    } else {
      userCircleRef.current = L.circle([lat, lon], {
        radius: PLAYER_CIRCLE_RADIUS,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 3,
        dashArray: '4 4',
      }).addTo(mapInstance);
    }

    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.setLatLng([lat, lon]);
      userAccuracyCircleRef.current.setRadius(accuracyRadius);
    } else {
      userAccuracyCircleRef.current = L.circle([lat, lon], {
        radius: accuracyRadius,
        color: '#60a5fa',
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '2 6',
      }).addTo(mapInstance);
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lon]);
    } else {
      userMarkerRef.current = L.marker([lat, lon], { icon: createUserIcon(youLabel) })
        .bindPopup(`<div style="font-weight:700">📌 ${escapeHtml(youLabel)}</div>`)
        .addTo(mapInstance);
    }

    if (flyTo) {
      mapInstance.flyTo([lat, lon], 16, { animate: true, duration: 1 });
    }
  }, []);

  const syncUserLocation = useCallback(async (options = {}) => {
    const { flyTo = false, silent = false } = options;
    setGpsLoading(true);
    try {
      const userPos = await getMyCurrentLocation((reading) => {
        applyUserOnMap(reading, { flyTo: false });
        if (flyTo && mapInstanceRef.current) {
          mapInstanceRef.current.panTo([reading.latitude, reading.longitude]);
        }
      });

      applyUserOnMap(userPos, { flyTo });

      if (
        !silent &&
        (isLowAccuracy(userPos.accuracy) ||
          isLikelyHyderabadPlaceholder(userPos.latitude, userPos.longitude, userPos.accuracy))
      ) {
        showMsg(
          `⚠️ GPS still approximate (±${Math.round(userPos.accuracy || 0)}m). Move near a window or outdoors and tap “Use My Current Location” again.`,
          8000
        );
      } else if (!silent && flyTo) {
        showMsg('✅ Map centered on your current location', 3500);
      }

      const playerId = storage.getPlayerId();
      if (playerId) {
        try {
          await playerAPI.updateLocation(playerId, userPos.latitude, userPos.longitude);
        } catch { /* backend optional */ }
      }
      return userPos;
    } catch (err) {
      const cached = getLastGps();
      if (cached) {
        applyUserOnMap(cached, { flyTo });
        if (!silent) {
          showMsg('📍 Using last known GPS fix — tap “Use My Current Location” to refresh.', 6000);
        }
        return cached;
      }
      if (!silent) {
        showMsg(`⚠️ ${getGeoErrorMessage(err)}`, 6000);
      }
      return null;
    } finally {
      setGpsLoading(false);
    }
  }, [applyUserOnMap, showMsg]);

  syncUserLocationRef.current = syncUserLocation;

  // ── Inject CSS animations once ──────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('map-keyframes')) return;
    const style = document.createElement('style');
    style.id = 'map-keyframes';
    style.textContent = `
      @keyframes userPulse {
        0%   { transform: scale(1);   opacity: 0.8; }
        70%  { transform: scale(2.2); opacity: 0; }
        100% { transform: scale(1);   opacity: 0; }
      }
      @keyframes groundPulse {
        0%, 100% { box-shadow: 0 0 20px rgba(251,191,36,0.7), 0 4px 15px rgba(0,0,0,0.4); }
        50%       { box-shadow: 0 0 35px rgba(251,191,36,1),   0 4px 20px rgba(0,0,0,0.5); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // ── Initialize map (sync create, no API wait) ───────────────────────────
  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;

    let cancelled = false;

    const bootMap = () => {
      if (cancelled || !mapRef.current) return;

      destroyLeafletContainer(mapInstanceRef.current, container);

      try {
        const initial = getInitialMapCenter();
        const lastGps = getLastGps();

        const mapInstance = L.map(container, {
          zoomControl: false,
          attributionControl: true,
        }).setView([initial.latitude, initial.longitude], initial.zoom);

        L.control.zoom({ position: 'topright' }).addTo(mapInstance);

        const tile = TILE_LAYERS.dark;
        tileLayerRef.current = L.tileLayer(tile.url, {
          attribution: tile.attribution,
          maxZoom: tile.maxZoom,
        }).addTo(mapInstance);

        mapInstanceRef.current = mapInstance;

        if (lastGps) {
          applyUserOnMap(lastGps, { flyTo: false });
        }

        mapInstance.on('click', async (e) => {
          if (!settingGroundRef.current) return;
          const { lat, lng } = e.latlng;
          try {
            const response = await playerAPI.updateGroundLocation(lat, lng);
            if (response.success) {
              groundMarkerRef.current?.setLatLng([lat, lng]);
              groundCircleRef.current?.setLatLng([lat, lng]);
              mapInstance.flyTo([lat, lng], 17, { duration: 1 });
              setSettingGround(false);
              setMessage('✅ Ground location updated!');
              setTimeout(() => setMessage(''), 3500);
            }
          } catch {
            setMessage('❌ Failed to update location');
            setTimeout(() => setMessage(''), 3500);
          }
        });

        setMapReady(true);
        setMapInitFailed(false);
        scheduleMapResize(mapInstance);

        (async () => {
          try {
            const mapData = await playerAPI.getMapData();
            if (cancelled || !mapInstanceRef.current) return;
            if (mapData?.ground_location) {
              const { latitude: gLat, longitude: gLon } = mapData.ground_location;
              setupGroundLayers(
                mapInstanceRef.current,
                gLat,
                gLon,
                mapData.ground_radius_m || 500
              );
              setPlayers(mapData.players || []);
            }
          } catch (err) {
            console.warn('Map data API:', err.message);
          }

          if (cancelled || !mapInstanceRef.current) return;

          setGpsLoading(true);
          const userPos = await syncUserLocationRef.current?.({ flyTo: true, silent: true });
          setGpsLoading(false);
          if (!userPos) {
            setMessage('📍 Allow location, then tap “Use My Current Location”.');
            setTimeout(() => setMessage(''), 6000);
          }
        })();
      } catch (err) {
        console.error('Map init error:', err);
        setMapInitFailed(true);
        setMapReady(false);
        setMessage('❌ Could not load map. Refresh the page.');
        setTimeout(() => setMessage(''), 5000);
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(bootMap));

    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      if (mapInstanceRef.current) {
        setMapReady(true);
        scheduleMapResize(mapInstanceRef.current);
      } else {
        bootMap();
      }
    }, 2000);

    return () => {
      clearTimeout(safetyTimer);
      cancelled = true;
      destroyLeafletContainer(mapInstanceRef.current, container);
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      labelLayerRef.current = null;
      groundMarkerRef.current = null;
      groundCircleRef.current = null;
      userMarkerRef.current = null;
      userCircleRef.current = null;
      userAccuracyCircleRef.current = null;
      markersRef.current = {};
      playerCirclesRef.current = {};
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map must init once per mount
  }, []);

  // Keep blue "You" marker synced with best live GPS while on this page
  useEffect(() => {
    if (!mapReady || !navigator.geolocation) return;

    let best = currentLocationRef.current;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const userPos = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        const improved =
          !best ||
          userPos.accuracy < best.accuracy ||
          (isLikelyHyderabadPlaceholder(best.latitude, best.longitude, best.accuracy) &&
            !isLikelyHyderabadPlaceholder(userPos.latitude, userPos.longitude, userPos.accuracy));

        if (!improved) return;
        best = userPos;

        applyUserOnMap(userPos);
        mapInstanceRef.current?.panTo([userPos.latitude, userPos.longitude], { animate: true });

        const now = Date.now();
        if (now - lastBackendLocationSentRef.current < 12000) return;
        lastBackendLocationSentRef.current = now;

        const playerId = storage.getPlayerId();
        if (playerId) {
          try {
            await playerAPI.updateLocation(playerId, userPos.latitude, userPos.longitude);
          } catch { /* ignore */ }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mapReady, applyUserOnMap]);

  // Resize map when tab becomes visible (fixes blank map after navigation)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && mapInstanceRef.current) {
        scheduleMapResize(mapInstanceRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [mapReady]);

  // Resize map when the container size changes (flex layout / rotation)
  useEffect(() => {
    const host = mapHostRef.current;
    if (!mapReady || !host) return;

    const ro = new ResizeObserver(() => {
      scheduleMapResize(mapInstanceRef.current);
    });
    ro.observe(host);
    scheduleMapResize(mapInstanceRef.current);
    return () => ro.disconnect();
  }, [mapReady]);

  // ── Tile mode switcher ──────────────────────────────────────────────────
  useEffect(() => {
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance) return;

    // Remove old layers
    if (tileLayerRef.current) mapInstance.removeLayer(tileLayerRef.current);
    if (labelLayerRef.current) mapInstance.removeLayer(labelLayerRef.current);

    const tile = TILE_LAYERS[tileMode];
    const newLayer = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      maxZoom: tile.maxZoom,
    });
    newLayer.addTo(mapInstance);
    tileLayerRef.current = newLayer;

    // Hybrid: add label overlay on top of satellite
    if (tileMode === 'hybrid' && tile.labelsUrl) {
      const labels = L.tileLayer(tile.labelsUrl, { maxZoom: 20, pane: 'overlayPane' });
      labels.addTo(mapInstance);
      labelLayerRef.current = labels;
    } else {
      labelLayerRef.current = null;
    }
    scheduleMapResize(mapInstance);
  }, [tileMode]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const fitMapToMarkers = useCallback(() => {
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance) return;

    const layers = [];
    if (groundMarkerRef.current) layers.push(groundMarkerRef.current);
    if (groundCircleRef.current) layers.push(groundCircleRef.current);
    if (userMarkerRef.current) layers.push(userMarkerRef.current);
    if (userCircleRef.current) layers.push(userCircleRef.current);
    if (userAccuracyCircleRef.current) layers.push(userAccuracyCircleRef.current);
    Object.values(markersRef.current).forEach(m => layers.push(m));
    Object.values(playerCirclesRef.current).forEach(c => layers.push(c));

    if (layers.length === 0) return;
    if (layers.length === 1) {
      const layer = layers[0];
      const latLng = layer.getLatLng?.() ?? layer.getBounds?.()?.getCenter();
      if (latLng) mapInstance.setView(latLng, 15);
      return;
    }
    const group = L.featureGroup(layers);
    mapInstance.fitBounds(group.getBounds().pad(0.15), { animate: true, maxZoom: 17 });
  }, []);

  const updatePlayerMarkers = useCallback((playersList) => {
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance) return;

    Object.values(markersRef.current).forEach(m => mapInstance.removeLayer(m));
    Object.values(playerCirclesRef.current).forEach(c => mapInstance.removeLayer(c));
    markersRef.current = {};
    playerCirclesRef.current = {};

    const currentPlayerId = storage.getPlayerId();

    playersList.forEach(player => {
      const isYou = player.id === currentPlayerId;
      const live = isYou ? currentLocationRef.current : null;

      let lat = live?.latitude ?? player.latitude;
      let lon = live?.longitude ?? player.longitude;
      if (lat == null || lon == null) return;

      const color = getStatusColor(player.status);
      const displayName = isYou ? `${player.name} (You)` : player.name;

      const circle = L.circle([lat, lon], {
        radius: PLAYER_CIRCLE_RADIUS,
        color,
        fillColor: color,
        fillOpacity: 0.22,
        weight: 3,
      }).addTo(mapInstance);
      playerCirclesRef.current[player.id] = circle;

      const marker = L.marker([lat, lon], {
        icon: createPlayerMapIcon(displayName, color),
        zIndexOffset: isYou ? 1000 : 0,
      });

      marker.bindPopup(`
        <div style="min-width:150px;font-family:sans-serif;color:#fff">
          <div style="font-size:15px;font-weight:800;margin-bottom:4px">${escapeHtml(player.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <span style="width:10px;height:10px;background:${color};border-radius:50%;display:inline-block"></span>
            <span style="font-size:12px;font-weight:600">${player.status}</span>
          </div>
          <div style="font-size:11px;color:#aaa">Team: <strong>${escapeHtml(player.team || '—')}</strong></div>
          <div style="font-size:11px;color:#aaa">Distance: <strong>${player.distance}m</strong></div>
          <div style="font-size:11px;color:#aaa">Last seen: ${player.last_seen}</div>
        </div>
      `);

      marker.addTo(mapInstance);
      markersRef.current[player.id] = marker;
    });

    const mappedCount = Object.keys(markersRef.current).length;
    if (mappedCount !== lastMappedPlayerCountRef.current) {
      lastMappedPlayerCountRef.current = mappedCount;
      fitMapToMarkers();
    }
  }, [fitMapToMarkers]);

  // Re-draw player markers when live GPS updates (so "You" is not stuck at stale server coords)
  useEffect(() => {
    if (mapReady) {
      updatePlayerMarkers(players);
    }
  }, [currentLocation, mapReady, players, updatePlayerMarkers]);

  // ── Player markers refresh ──────────────────────────────────────────────
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const data = await playerAPI.getMapData();
        if (data?.ground_location && mapInstanceRef.current) {
          const { latitude: gLat, longitude: gLon } = data.ground_location;
          setupGroundLayers(
            mapInstanceRef.current,
            gLat,
            gLon,
            data.ground_radius_m || groundRadiusRef.current
          );
        }
        const list = data.players || [];
        setPlayers(list);
        if (mapReady) updatePlayerMarkers(list);
      } catch (err) {
        console.error('Error fetching map data:', err);
      }
    };

    if (!mapReady) return undefined;
    fetchMapData();
    const id = setInterval(fetchMapData, 10000);
    return () => clearInterval(id);
  }, [mapReady, updatePlayerMarkers, setupGroundLayers]);

  // ── Set ground at a clicked point ────────────────────────────────────────
  const handleSetGroundAtPoint = async (lat, lng) => {
    try {
      const response = await playerAPI.updateGroundLocation(lat, lng);
      if (response.success) {
        groundMarkerRef.current?.setLatLng([lat, lng]);
        groundCircleRef.current?.setLatLng([lat, lng]);
        mapInstanceRef.current?.flyTo([lat, lng], 17, { duration: 1 });
        setSettingGround(false);
        showMsg('✅ Ground location updated!');
      }
    } catch {
      showMsg('❌ Failed to update location');
    }
  };

  // ── Go to current location ───────────────────────────────────────────────
  const goToCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) return showMsg('❌ Geolocation not supported');
    setLocating(true);
    showMsg('🔍 Acquiring your current GPS location…');
    await syncUserLocation({ flyTo: true, silent: false });
    setLocating(false);
  }, [showMsg, syncUserLocation]);

  // ── Set ground to my GPS (permanent) ────────────────────────────────────
  const setGroundToMyLocation = useCallback(async () => {
    if (!navigator.geolocation) return showMsg('❌ Geolocation not supported');
    setSavingGround(true);
    showMsg('🔍 Getting your GPS location…');
    try {
      const userPos = await getMyCurrentLocation();
      const { latitude: lat, longitude: lon } = userPos;
      const res = await playerAPI.saveGroundLocation(lat, lon);
      if (res.success) {
        applyUserOnMap(userPos);
        groundMarkerRef.current?.setLatLng([lat, lon]);
        groundCircleRef.current?.setLatLng([lat, lon]);
        mapInstanceRef.current?.flyTo([lat, lon], 16, { duration: 1 });
        showMsg(`✅ Ground set at your location (${lat.toFixed(5)}, ${lon.toFixed(5)})`, 6000);
      }
    } catch (err) {
      showMsg(`⚠️ ${getGeoErrorMessage(err)}`, 6000);
    } finally {
      setSavingGround(false);
    }
  }, [applyUserOnMap, showMsg]);

  const toggleSetGround = () => {
    const next = !settingGround;
    setSettingGround(next);
    showMsg(next ? '📍 Click on the map to place the volleyball ground' : '');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="flex-shrink-0 px-3 pt-2 pb-2 border-b border-white/10 bg-volleyball-darker/90">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-lg font-bold text-volleyball-accent">📍 Live Map</h2>
          {currentLocation && (
            <span className="text-[10px] font-mono text-gray-500 truncate max-w-[50%]">
              {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </span>
          )}
        </div>

        <div className="flex gap-1 mb-2 p-0.5 rounded-lg bg-white/5 border border-white/10">
          {Object.entries(TILE_LAYERS).map(([key, { label }]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTileMode(key)}
              className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${
                tileMode === key
                  ? 'bg-volleyball-accent text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={toggleSetGround}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
              settingGround
                ? 'bg-red-500/20 border border-red-500/50 text-red-300'
                : 'btn-secondary'
            }`}
          >
            {settingGround ? 'Cancel' : 'Set ground'}
          </button>
          <button
            type="button"
            id="current-location-btn"
            onClick={goToCurrentLocation}
            disabled={locating || gpsLoading}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-black disabled:opacity-60"
            style={{
              background: locating || gpsLoading
                ? 'rgba(59,130,246,0.35)'
                : 'linear-gradient(135deg,#60a5fa,#3b82f6)',
            }}
          >
            {locating || gpsLoading ? 'GPS…' : 'My location'}
          </button>
          <button
            type="button"
            id="set-ground-to-my-location-btn"
            onClick={setGroundToMyLocation}
            disabled={savingGround}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg,#10b981,#059669)',
              border: '1px solid rgba(16,185,129,0.4)',
            }}
          >
            {savingGround ? 'Saving…' : 'Ground = me'}
          </button>
        </div>

        {message && (
          <p className="mt-2 text-[11px] text-center text-blue-300 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
            {message}
          </p>
        )}
      </div>

      <div
        ref={mapHostRef}
        className="relative flex-1 min-h-0 mx-2 my-2 rounded-xl overflow-hidden border border-white/10"
      >
        {!mapReady && !mapInitFailed && (
          <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-3 bg-slate-900 pointer-events-none">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading map…</p>
          </div>
        )}
        {mapInitFailed && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-900 p-4 text-center text-sm text-red-300">
            Map failed to load. Refresh the page.
          </div>
        )}
        <div ref={mapRef} className="leaflet-map-host absolute inset-0" />

        <div className="absolute bottom-2 left-2 z-[500] pointer-events-none max-w-[85%]">
          <div className="glass-dark px-2 py-1.5 rounded-lg border border-white/10 text-[9px] leading-tight text-gray-300">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1 align-middle" />
            You
            <span className="mx-1 text-gray-600">·</span>
            <span>🏐</span> Court
            <span className="mx-1 text-gray-600">·</span>
            Colored = players
          </div>
        </div>
      </div>

      {/* Tooltip label CSS */}
      <style>{`
        .player-map-icon-wrap { background: transparent !important; border: none !important; }
        .player-map-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }
        .player-map-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          font-family: system-ui, sans-serif;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        }
        .player-map-name {
          margin-top: 4px;
          padding: 2px 8px;
          background: rgba(15,15,25,0.92);
          border: 1px solid;
          border-radius: 8px;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          font-family: system-ui, sans-serif;
          white-space: nowrap;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .leaflet-popup-content-wrapper {
          background: rgba(15,15,25,0.95) !important;
          color: #fff !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.6) !important;
        }
        .leaflet-popup-tip { background: rgba(15,15,25,0.95) !important; }
        .leaflet-popup-close-button { color: #aaa !important; }
      `}</style>
    </div>
  );
}

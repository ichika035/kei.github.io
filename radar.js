/* radar.js
 * Shows a rain-cloud radar for the visitor's current location.
 *
 *   - Base map : CARTO Positron (OpenStreetMap data)
 *   - Radar    : RainViewer public tiles (latest frame, refreshed every 5 min)
 *   - Location : navigator.geolocation, falling back to Tokyo when denied
 *
 * Replaces the earlier sumi-e weather painting (weather.js, kept in the repo
 * but no longer loaded by works.html).
 */
(async function () {
  'use strict';

  const el = document.getElementById('radar-map');
  if (!el || typeof L === 'undefined') return;

  const FALLBACK = { lat: 35.681236, lon: 139.767125, label: '東京（位置情報が使えないため）' };
  const $city = document.getElementById('radar-city');
  const $time = document.getElementById('radar-time');

  // ------------------------------------------------------------ location
  let lat = FALLBACK.lat, lon = FALLBACK.lon, cityName = FALLBACK.label;
  try {
    const pos = await new Promise((ok, ng) =>
      navigator.geolocation.getCurrentPosition(ok, ng, { timeout: 7000 })
    );
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    cityName = '—';
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${lat}&lon=${lon}&accept-language=ja`,
        { headers: { 'Accept-Language': 'ja' } }
      );
      const d = await r.json();
      const a = d.address ?? {};
      cityName = a.city || a.town || a.village || a.municipality || a.county || d.name || '—';
    } catch (_) {}
  } catch (_) {}
  if ($city) $city.textContent = cityName;

  // ------------------------------------------------------------ map
  const map = L.map(el, {
    center: [lat, lon],
    zoom: 8,
    scrollWheelZoom: false,   // ページのスクロールを奪わない
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 12,
    minZoom: 4,
  }).addTo(map);

  L.circleMarker([lat, lon], {
    radius: 4,
    color: '#1c2633',
    weight: 1.5,
    fillColor: '#1c2633',
    fillOpacity: 0.9,
  }).addTo(map);

  // ------------------------------------------------------------ radar frames
  let radarLayer = null;

  function stamp(unix) {
    const d = new Date(unix * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())} 時点`;
  }

  async function refresh() {
    try {
      const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const d = await r.json();
      const past = d.radar?.past ?? [];
      const frame = past[past.length - 1];
      if (!frame) return;

      const next = L.tileLayer(
        `${d.host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png`,
        { opacity: 0.7, maxZoom: 12, attribution: 'Radar: RainViewer' }
      );
      next.addTo(map);
      next.once('load', () => { if (radarLayer) map.removeLayer(radarLayer); radarLayer = next; });
      // load イベントが来ないブラウザでも古い層が残らないように
      setTimeout(() => { if (radarLayer && radarLayer !== next) { map.removeLayer(radarLayer); radarLayer = next; } }, 4000);
      radarLayer = radarLayer || next;

      if ($time) $time.textContent = stamp(frame.time);
    } catch (_) {
      if ($time) $time.textContent = '取得できませんでした';
    }
  }

  await refresh();
  setInterval(refresh, 5 * 60 * 1000);
})();

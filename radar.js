/* radar.js
 * Shows a rain-cloud radar for the visitor's location.
 *
 *   - Base map : OpenStreetMap tiles (desaturated with a CSS filter)
 *   - Radar    : RainViewer public tiles (latest frame, refreshed every 5 min)
 *   - Location : IP-based estimate first (no permission needed), then refined
 *                with navigator.geolocation if the visitor allows it
 *
 * Replaces the earlier sumi-e weather painting (weather.js, kept in the repo
 * but no longer loaded by works.html).
 */
(async function () {
  'use strict';

  const el = document.getElementById('radar-map');
  if (!el || typeof L === 'undefined') return;

  const $city = document.getElementById('radar-city');
  const $time = document.getElementById('radar-time');

  // 位置が取れないときの最終手段
  let lat = 35.681236, lon = 139.767125;

  // ------------------------------------------------------- 1. IP から概算
  try {
    const r = await fetch('https://get.geojs.io/v1/ip/geo.json');
    const d = await r.json();
    const la = parseFloat(d.latitude), lo = parseFloat(d.longitude);
    if (isFinite(la) && isFinite(lo)) {
      lat = la; lon = lo;
      if ($city && d.city) $city.textContent = `${d.city} 周辺`;
    }
  } catch (_) {}

  // ------------------------------------------------------- 2. 地図
  const map = L.map(el, {
    center: [lat, lon],
    zoom: 8,
    scrollWheelZoom: false,   // ページのスクロールを奪わない
    attributionControl: true,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    className: 'basemap-quiet',
    maxZoom: 12,
    minZoom: 4,
  }).addTo(map);

  let here = L.circleMarker([lat, lon], {
    radius: 4,
    color: '#1c2633',
    weight: 1.5,
    fillColor: '#1c2633',
    fillOpacity: 0.9,
  }).addTo(map);

  // ------------------------------------------------------- 3. 正確な現在地
  (async function refine() {
    if (!navigator.geolocation) return;
    let pos;
    try {
      pos = await new Promise((ok, ng) =>
        navigator.geolocation.getCurrentPosition(ok, ng, { timeout: 10000, maximumAge: 300000 })
      );
    } catch (_) {
      return;   // 拒否された場合は IP からの概算のまま
    }
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    map.setView([lat, lon], 9);
    here.setLatLng([lat, lon]);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${lat}&lon=${lon}&accept-language=ja`,
        { headers: { 'Accept-Language': 'ja' } }
      );
      const d = await r.json();
      const a = d.address ?? {};
      const name = a.city || a.town || a.village || a.municipality || a.county || d.name;
      if ($city && name) $city.textContent = name;
    } catch (_) {}
  })();

  // ------------------------------------------------------- 4. 雨雲
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
        { opacity: 0.75, maxZoom: 12, attribution: 'Radar: RainViewer' }
      );
      const previous = radarLayer;
      next.addTo(map);
      radarLayer = next;
      if (previous) setTimeout(() => map.removeLayer(previous), 1500);

      if ($time) $time.textContent = stamp(frame.time);
    } catch (_) {
      if ($time) $time.textContent = '取得できませんでした';
    }
  }

  await refresh();
  setInterval(refresh, 5 * 60 * 1000);
})();

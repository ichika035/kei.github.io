/* radar.js
 * Animated rain-cloud radar for the visitor's location.
 *
 *   - Base map : OpenStreetMap tiles (desaturated with a CSS filter)
 *   - Radar    : RainViewer public tiles — past ~2h frames plus the nowcast,
 *                played as a loop and refreshed every 5 minutes
 *   - Location : IP-based estimate first (no permission needed), then refined
 *                with navigator.geolocation if the visitor allows it
 *   - Zoom     : Ctrl (⌘) + wheel, or the +/− buttons. A bare wheel scrolls
 *                the page instead of the map.
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

  const FRAME_MS = 500;      // 1コマの表示時間
  const LOOP_PAUSE_MS = 1200; // 最後のコマで止める時間
  const RELOAD_MS = 5 * 60 * 1000;

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
    maxZoom: 10,
    minZoom: 4,
    scrollWheelZoom: false,   // 素のホイールはページのスクロールに任せる
    attributionControl: true,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    className: 'basemap-quiet',
    maxZoom: 10,
    minZoom: 4,
  }).addTo(map);

  const here = L.circleMarker([lat, lon], {
    radius: 4,
    color: '#1c2633',
    weight: 1.5,
    fillColor: '#1c2633',
    fillOpacity: 0.9,
  }).addTo(map);

  // Ctrl (⌘) を押しながらのホイール / ピンチでズーム
  el.addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;   // 押していなければページをスクロール
    e.preventDefault();
    const point = map.mouseEventToContainerPoint(e);
    const latlng = map.containerPointToLatLng(point);
    const delta = e.deltaY < 0 ? 1 : -1;
    map.setZoomAround(latlng, map.getZoom() + delta);
  }, { passive: false });

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

  // ------------------------------------------------------- 4. 雨雲のアニメーション
  let frames = [];     // { time, layer, forecast }
  let index = 0;
  let timer = null;

  function clock(unix) {
    const d = new Date(unix * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function show(i) {
    frames.forEach((f, n) => f.layer.setOpacity(n === i ? 0.75 : 0));
    const f = frames[i];
    if (f && $time) $time.textContent = f.forecast ? `${clock(f.time)} 予報` : `${clock(f.time)}`;
  }

  function step() {
    if (!frames.length) return;
    index = (index + 1) % frames.length;
    show(index);
    const last = index === frames.length - 1;
    timer = setTimeout(step, last ? LOOP_PAUSE_MS : FRAME_MS);
  }

  function play() {
    stop();
    if (frames.length) timer = setTimeout(step, FRAME_MS);
  }
  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  async function load() {
    let data;
    try {
      const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      data = await r.json();
    } catch (_) {
      if ($time && !frames.length) $time.textContent = '取得できませんでした';
      return;
    }
    const past = (data.radar?.past ?? []).map((f) => ({ ...f, forecast: false }));
    const soon = (data.radar?.nowcast ?? []).map((f) => ({ ...f, forecast: true }));
    const list = past.concat(soon);
    if (!list.length) return;

    const old = frames;
    frames = list.map((f) => ({
      time: f.time,
      forecast: f.forecast,
      layer: L.tileLayer(`${data.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
        opacity: 0,
        // RainViewer の無料タイルは z7 まで。それ以上は z7 を引き伸ばして使う
        // (指定しないと "Zoom Level Not Supported" の画像が返る)
        maxNativeZoom: 7,
        maxZoom: 10,
        attribution: 'Radar: RainViewer',
      }).addTo(map),
    }));

    index = Math.max(0, past.length - 1);   // まず「いま」のコマを出す
    show(index);
    setTimeout(() => old.forEach((f) => map.removeLayer(f.layer)), 800);
    play();
  }

  // タブが見えていないときは動かさない
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else play();
  });

  await load();
  setInterval(load, RELOAD_MS);
})();

/* weather.js
 * Sesshū-inspired sumi-e rendering of the visitor's current weather.
 *
 * Composition (Haboku Sansui / Shūtō Sansui の構図に倣ふ):
 *   - far mountain ridge (upper right, pale wash)
 *   - near cliff with tree (middle-left, bolder ink)
 *   - water plane (lower third)
 *   - foreground pine (lower right, deepest ink)
 *   - empty sky (upper left) 余白
 *
 * Weather enters as: mist density, rain streaks, snow flakes,
 * sun/moon, sky wash, and overall paper tone.
 */
(async function () {
  'use strict';

  const canvas = document.getElementById('weather-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;
  const R = Math.random;

  // ------------------------------------------------------------ DPR resize
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildScene();
  }

  const W = () => canvas.width  / dpr;
  const H = () => canvas.height / dpr;

  // ------------------------------------------------------------ Fetch data
  let code = 0, isDay = 1, temp = null;
  let cityName = '—', lat = null, lon = null;

  async function fetchWeather(la, lo) {
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
        `&current=weather_code,is_day,temperature_2m&timezone=auto`
      );
      const d = await r.json();
      code  = d.current?.weather_code   ?? 0;
      isDay = d.current?.is_day         ?? 1;
      temp  = d.current?.temperature_2m ?? null;
    } catch (_) {}
  }
  async function fetchCity(la, lo) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${la}&lon=${lo}&accept-language=ja`,
        { headers: { 'Accept-Language': 'ja' } }
      );
      const d = await r.json();
      const a = d.address ?? {};
      cityName = a.city || a.town || a.village || a.municipality || a.county || d.name || '—';
    } catch (_) {}
  }

  // Try geolocation; fall back silently to a "clear day" default
  try {
    const pos = await new Promise((ok, ng) =>
      navigator.geolocation.getCurrentPosition(ok, ng, { timeout: 7000 })
    );
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    await Promise.all([fetchWeather(lat, lon), fetchCity(lat, lon)]);
  } catch (_) {}

  await document.fonts.ready.catch(() => {});

  // ------------------------------------------------------------ Weather maps
  function wtype() {
    if (code === 0)                return 'clear';
    if (code <= 3)                 return 'partly';
    if (code >= 45 && code <= 48) return 'fog';
    if (code >= 51 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code >= 85 && code <= 86) return 'snow';
    if (code >= 95)                return 'thunder';
    return 'partly';
  }
  function weatherLabel() {
    if (code === 0)   return ['快晴',    'Clear sky'];
    if (code <= 2)    return ['晴れ',    'Mainly clear'];
    if (code === 3)   return ['曇り',    'Overcast'];
    if (code <= 48)   return ['霧',      'Fog'];
    if (code <= 55)   return ['霧雨',    'Drizzle'];
    if (code <= 67)   return ['雨',      'Rain'];
    if (code <= 77)   return ['雪',      'Snow'];
    if (code <= 82)   return ['にわか雨', 'Showers'];
    if (code <= 86)   return ['にわか雪', 'Snow showers'];
    return                   ['雷雨',    'Thunderstorm'];
  }

  // ------------------------------------------------------------ Caption (DOM)
  (function updateCaption() {
    const [jp, en] = weatherLabel();
    const $city  = document.getElementById('weather-city');
    const $label = document.getElementById('weather-label');
    const $temp  = document.getElementById('weather-temp');
    const $title = document.getElementById('weather-title');
    if ($city)  $city.textContent  = cityName;
    if ($label) $label.textContent = `${jp} / ${en}`;
    if ($temp)  $temp.textContent  = (temp !== null)
      ? `${temp > 0 ? '+' : ''}${Math.round(temp)}°C`
      : '—';
    if ($title) $title.textContent = `${jp}${isDay ? '' : '（夜）'}`;
  })();

  // ------------------------------------------------------------ Palette
  const INK = {
    deepest: 'rgba(18, 14, 10, 1)',
    dark:    'rgba(40, 32, 24, 1)',
    mid:     'rgba(70, 58, 44, 1)',
    light:   'rgba(120, 104, 82, 1)',
    wash:    'rgba(50, 40, 28, 0.09)',
    red:     '#a13525',
  };

  function paperTone(t) {
    if (!isDay) return '#d7ccb0';
    if (t === 'rain' || t === 'thunder') return '#d8ceb2';
    if (t === 'fog')                      return '#e4ddc5';
    if (t === 'snow')                     return '#efead8';
    return '#ede6d0';
  }

  // ------------------------------------------------------------ Brush helper
  function brush(pts, width, opacity, color) {
    if (!pts.length) return;
    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    const passes = [
      { w: 1.9, a: 0.18 },
      { w: 1.3, a: 0.40 },
      { w: 1.0, a: 1.00 },
    ];
    for (const p of passes) {
      ctx.lineWidth   = width * p.w;
      ctx.globalAlpha = opacity * p.a;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ Scene cache
  let scene = null;

  function buildScene() {
    const w = W(), h = H();
    if (w <= 0 || h <= 0) return;

    // Far mountain ridge — stretches across upper right into mid
    const far = (() => {
      const pts = [];
      const n = 48;
      const seed = 0.73;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        // base y decreases toward middle (peak) and rises on the edges
        const peak = 0.26 - 0.10 * Math.sin(Math.min(1, Math.max(0, (u - 0.05) / 0.9)) * Math.PI);
        const rough =
          0.035 * Math.sin(u * 11 + seed * 4.0) * (1 - Math.pow(u - 0.5, 2)) +
          0.018 * Math.sin(u * 23 + seed * 9.0) +
          0.010 * Math.sin(u * 53 + seed * 17.0);
        pts.push({ x: (0.30 + u * 0.72), y: peak + rough });
      }
      return pts;
    })();

    // Mid cliff — a chunkier ridge lower-left, taller on the right
    const mid = (() => {
      const pts = [];
      const n = 36;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const base = 0.48 - 0.18 * Math.exp(-Math.pow((u - 0.70) / 0.22, 2));
        const rough =
          0.025 * Math.sin(u * 9 + 1.7) +
          0.014 * Math.sin(u * 27 + 3.1);
        pts.push({ x: 0.02 + u * 0.52, y: base + rough });
      }
      return pts;
    })();

    // Cliff-top small trees (2–3 silhouettes atop the mid ridge)
    const cliffTrees = [];
    const treeXs = [0.30, 0.38, 0.44];
    for (const tx of treeXs) {
      // find y on mid ridge at x≈tx
      let minD = Infinity, ty = 0.42;
      for (const p of mid) {
        const d = Math.abs(p.x - tx);
        if (d < minD) { minD = d; ty = p.y; }
      }
      const th = 0.045 + R() * 0.025;
      // pre-sample crown dot positions (cache to avoid flicker)
      const crown = [];
      for (let i = 0; i < 14; i++) {
        const ang = R() * TAU;
        const rr  = Math.pow(R(), 0.6);
        crown.push({
          ang, rr,
          a: 0.35 + R() * 0.35,
        });
      }
      cliffTrees.push({ x: tx, y: ty, h: th, crown });
    }

    // Foreground pine — gnarled trunk with branch clusters, lower right
    const pine = (() => {
      const baseX = 0.76, baseY = 0.94;
      const topX  = 0.79, topY  = 0.46;
      const trunk = [];
      const n = 20;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const cx = baseX + (topX - baseX) * u;
        const cy = baseY + (topY - baseY) * u;
        const wobble = 0.012 * Math.sin(u * 3.3) + 0.006 * Math.sin(u * 9.1 + 0.7);
        trunk.push({ x: cx + wobble, y: cy });
      }
      // Branch sprouts with needle clusters
      const branches = [
        { from: [0.78, 0.70], to: [0.88, 0.64], size: 0.030 },
        { from: [0.77, 0.62], to: [0.66, 0.58], size: 0.034 },
        { from: [0.78, 0.56], to: [0.90, 0.50], size: 0.032 },
        { from: [0.79, 0.50], to: [0.68, 0.44], size: 0.038 },
        { from: [0.795, 0.46],to: [0.84, 0.40], size: 0.034 },
      ];
      // Pre-compute needle-dot positions so they don't flicker each frame
      for (const b of branches) {
        const dots = [];
        const n = 42;
        for (let i = 0; i < n; i++) {
          const a = R() * TAU;
          const rr = Math.pow(R(), 0.55);
          dots.push({
            dx: Math.cos(a) * rr,
            dy: Math.sin(a) * rr * 0.78,
            s: 0.65 + R() * 0.95,
            a: 0.45 + R() * 0.45,
          });
        }
        b.dots = dots;
        // Pre-sample snow-on-branch positions (used only when snowing)
        const snow = [];
        for (let i = 0; i < 10; i++) {
          const a = (R() * 0.6 - 0.3) * Math.PI;
          const rr = Math.pow(R(), 0.5);
          snow.push({ a, rr });
        }
        b.snow = snow;
      }
      return { trunk, branches };
    })();

    // Water — horizontal ink lines in lower third
    const waterLines = [];
    for (let i = 0; i < 28; i++) {
      const y = 0.68 + R() * 0.28;
      const x1 = R() * 0.35;
      const x2 = x1 + 0.05 + R() * 0.30;
      waterLines.push({ x1, x2, y, a: 0.12 + R() * 0.24, w: 0.35 + R() * 0.8 });
    }

    // Mist bands — horizontal wash zones
    const mistBands = [
      { y: 0.30, h: 0.08, a: 0.10, driftSpd: 0.0000120 },
      { y: 0.42, h: 0.06, a: 0.07, driftSpd: 0.0000170 },
      { y: 0.58, h: 0.05, a: 0.05, driftSpd: 0.0000220 },
    ];

    // Paper texture dots (static grain)
    const grain = [];
    const gridN = Math.min(1800, Math.floor(w * h / 900));
    for (let i = 0; i < gridN; i++) {
      grain.push({
        x: R() * w,
        y: R() * h,
        a: 0.02 + R() * 0.05,
        r: R() < 0.05 ? 1 : 0.6,
      });
    }

    // Japanese-painting clouds (suyari-gumo) for partly / rain / thunder skies
    // Each cloud: {cx, cy, w, h, lobes: [{center, height, sharpness}], alpha}
    function makeLobes(n, heightBase, seed) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const center = (i + 0.45 + (((seed + i) * 13) % 10) / 40) / n;
        const height = heightBase * (0.75 + (((seed + i * 7) % 50) / 100));
        const sharpness = 22 + ((seed + i * 3) % 18); // 22-40
        out.push({ center, height, sharpness });
      }
      return out;
    }
    const skyClouds = {
      partly: [
        { cx: 0.24, cy: 0.18, w: 0.30, h: 0.055, alpha: 0.55, lobes: makeLobes(4, 0.85, 3) },
        { cx: 0.60, cy: 0.12, w: 0.36, h: 0.050, alpha: 0.45, lobes: makeLobes(5, 0.80, 7) },
        { cx: 0.82, cy: 0.22, w: 0.22, h: 0.040, alpha: 0.40, lobes: makeLobes(3, 0.90, 11) },
      ],
      storm: [
        { cx: 0.14, cy: 0.13, w: 0.34, h: 0.070, alpha: 0.82, lobes: makeLobes(5, 0.95, 5) },
        { cx: 0.48, cy: 0.10, w: 0.42, h: 0.080, alpha: 0.92, lobes: makeLobes(6, 0.95, 17) },
        { cx: 0.82, cy: 0.15, w: 0.30, h: 0.065, alpha: 0.78, lobes: makeLobes(4, 0.90, 23) },
        { cx: 0.30, cy: 0.24, w: 0.28, h: 0.055, alpha: 0.62, lobes: makeLobes(4, 0.85, 29) },
      ],
    };

    scene = { far, mid, cliffTrees, pine, waterLines, mistBands, grain, skyClouds };
  }

  // ------------------------------------------------------------ Rain / snow
  const RAIN = Array.from({ length: 160 }, () => ({
    x: R(), y: R(), len: 0.020 + R() * 0.015, spd: 0.0028 + R() * 0.0022,
  }));
  const SNOW = Array.from({ length: 90 }, () => ({
    x: R(), y: R(), r: 1.0 + R() * 1.8, spd: 0.00030 + R() * 0.00030, ph: R() * TAU,
  }));

  // ------------------------------------------------------------ Drawers

  function drawPaper(t) {
    const w = W(), h = H();
    // Base paper tone with subtle top/bottom variation
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const base = paperTone(t);
    g.addColorStop(0, shade(base,  0.02));
    g.addColorStop(1, shade(base, -0.03));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Static grain (cached positions)
    if (!scene) return;
    for (const d of scene.grain) {
      ctx.fillStyle = `rgba(60,45,30,${d.a})`;
      ctx.fillRect(d.x, d.y, d.r, d.r);
    }
  }

  // lighten (+) or darken (-) a hex by amt (-1..1)
  function shade(hex, amt) {
    const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return hex;
    const [r, gc, b] = [1, 2, 3].map(i => parseInt(m[i], 16));
    const k = Math.max(-1, Math.min(1, amt));
    const adj = v => Math.max(0, Math.min(255, Math.round(v + (k > 0 ? (255 - v) * k : v * k))));
    return `rgb(${adj(r)},${adj(gc)},${adj(b)})`;
  }

  // Draw a single suyari-gumo style cloud in sumi-e.
  // lobes: array of {center (0..1 within cloud), height (0..1 of h), sharpness}
  function drawSuyariCloud(cx, cy, w, h, lobes, alpha) {
    if (w <= 0 || h <= 0) return;
    const yFn = (t) => {
      let y = 0;
      for (const lb of lobes) {
        const d = t - lb.center;
        y -= lb.height * Math.exp(-d * d * lb.sharpness);
      }
      return y;
    };
    const bottomFn = (t) => {
      // Gentle undulation on the bottom edge (opposite phase)
      return 0.22 + 0.10 * Math.sin(t * Math.PI * 2.2);
    };

    ctx.save();
    ctx.translate(cx, cy);

    const steps = Math.max(36, Math.min(120, Math.floor(w / 5)));

    // Outer path (closed shape): top edge L→R, then bottom edge R→L
    ctx.beginPath();
    // Left tip
    ctx.moveTo(-w / 2, 0);
    // Top edge (sample densely)
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = -w / 2 + t * w;
      // Taper toward tips
      const taper = Math.sin(t * Math.PI);
      const y = yFn(t) * h * taper;
      ctx.lineTo(x, y);
    }
    // Right tip
    ctx.lineTo(w / 2, 0);
    // Bottom edge (coarser, gentler)
    const bSteps = Math.max(10, Math.floor(steps / 3));
    for (let s = 1; s < bSteps; s++) {
      const t = 1 - s / bSteps;
      const x = -w / 2 + t * w;
      const taper = Math.sin(t * Math.PI);
      const y = bottomFn(t) * h * taper;
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Pale wash interior — multiple soft passes for ink-bleed feel
    ctx.fillStyle = `rgba(80,66,50,${(alpha * 0.18).toFixed(3)})`;
    ctx.fill();
    ctx.fillStyle = `rgba(55,44,30,${(alpha * 0.10).toFixed(3)})`;
    ctx.fill();

    // Outline brush stroke (two passes)
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';
    ctx.strokeStyle = `rgba(40,30,22,${(alpha * 0.45).toFixed(3)})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.strokeStyle = `rgba(20,14,10,${(alpha * 0.90).toFixed(3)})`;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  function drawSkyWash(t) {
    if (!scene) return;
    const w = W(), h = H();
    const stormy = (t === 'rain' || t === 'thunder');
    if (stormy) {
      // Dark haze across the upper sky
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      g.addColorStop(0, 'rgba(40,32,22,0.20)');
      g.addColorStop(1, 'rgba(40,32,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.55);
      // Japanese-painting storm clouds
      for (const c of scene.skyClouds.storm) {
        drawSuyariCloud(c.cx * w, c.cy * h, c.w * w, c.h * h, c.lobes, c.alpha);
      }
    } else if (t === 'partly' || (t === 'clear' && !isDay)) {
      for (const c of scene.skyClouds.partly) {
        drawSuyariCloud(c.cx * w, c.cy * h, c.w * w, c.h * h, c.lobes, c.alpha * 0.85);
      }
    }
  }

  function drawSun() {
    const w = W(), h = H();
    const x = w * 0.22, y = h * 0.18, r = Math.min(w, h) * 0.055;
    // Faint halo
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    halo.addColorStop(0,   'rgba(195,70,40,0.18)');
    halo.addColorStop(0.5, 'rgba(195,70,40,0.06)');
    halo.addColorStop(1,   'rgba(195,70,40,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
    // Red disc
    ctx.fillStyle = 'rgba(180,55,35,0.92)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function drawMoon() {
    const w = W(), h = H();
    const x = w * 0.22, y = h * 0.18, r = Math.min(w, h) * 0.045;
    // Halo
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    halo.addColorStop(0,   'rgba(200,185,145,0.22)');
    halo.addColorStop(0.6, 'rgba(200,185,145,0.05)');
    halo.addColorStop(1,   'rgba(200,185,145,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
    // Ring (outline only — Sesshū-ish empty circle)
    ctx.strokeStyle = 'rgba(40,30,20,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    // Slight inner shade
    ctx.fillStyle = 'rgba(240,232,210,0.55)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.94, 0, TAU); ctx.fill();
  }

  function drawFarMountain(t) {
    if (!scene) return;
    const w = W(), h = H();
    const pts = scene.far.map(p => ({ x: p.x * w, y: p.y * h }));
    // Wash silhouette (filled polygon down to mid-ground)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h * 0.52);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, h * 0.52);
    ctx.closePath();
    const washA = t === 'fog' ? 0.05 : t === 'snow' ? 0.10 : 0.13;
    ctx.fillStyle = `rgba(60,48,34,${washA})`;
    ctx.fill();
    ctx.restore();
    // Ridge line
    const ridgeA = t === 'fog' ? 0.18 : 0.35;
    brush(pts, 1.1, ridgeA, INK.mid);
  }

  function drawMidMountain(t) {
    if (!scene) return;
    const w = W(), h = H();
    const pts = scene.mid.map(p => ({ x: p.x * w, y: p.y * h }));
    // Silhouette fill (darker)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h * 0.75);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, h * 0.75);
    ctx.closePath();
    const washA = t === 'fog' ? 0.12 : t === 'snow' ? 0.18 : 0.24;
    ctx.fillStyle = `rgba(42,32,22,${washA})`;
    ctx.fill();
    ctx.restore();
    // Strong ridge line
    brush(pts, 1.6, t === 'fog' ? 0.35 : 0.72, INK.dark);

    // Small trees on ridge
    for (const tr of scene.cliffTrees) {
      const bx = tr.x * w, by = tr.y * h;
      const th = tr.h * h;
      // trunk
      brush([{x: bx, y: by}, {x: bx - th * 0.05, y: by - th}], 1.3, 0.65, INK.deepest);
      // crown dots (cached positions → no flicker)
      for (const d of tr.crown) {
        const rr = d.rr * th * 0.35;
        ctx.fillStyle = `rgba(18,14,10,${d.a})`;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(d.ang) * rr, by - th + Math.sin(d.ang) * rr * 0.6, 0.7, 0, TAU);
        ctx.fill();
      }
    }

    // Snow caps on ridge peaks if snowing
    if (t === 'snow') {
      ctx.fillStyle = 'rgba(245,240,226,0.75)';
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i];
        // only near local minima (peaks)
        const a = pts[i - 1].y, b = pts[i + 1].y;
        if (p.y <= a && p.y <= b) {
          ctx.beginPath();
          ctx.arc(p.x, p.y + 1.5, 2.2, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function drawWater(t) {
    if (!scene) return;
    const w = W(), h = H();
    const stormy = t === 'rain' || t === 'thunder';
    const driftOffs = (tick * (stormy ? 0.00035 : 0.00012)) % 1;
    for (const ln of scene.waterLines) {
      const x1 = ((ln.x1 + driftOffs) % 1.1) * w;
      const x2 = ((ln.x2 + driftOffs) % 1.1) * w;
      const y  = ln.y * h;
      ctx.strokeStyle = `rgba(50,40,28,${ln.a})`;
      ctx.lineWidth = ln.w;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
    // Shoreline suggestion — very thin curved stroke
    ctx.strokeStyle = 'rgba(50,40,28,0.24)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.quadraticCurveTo(w * 0.35, h * 0.71, w * 0.58, h * 0.735);
    ctx.stroke();
  }

  function drawPineTree(t) {
    if (!scene) return;
    const w = W(), h = H();
    const { trunk, branches } = scene.pine;
    // Trunk tapered via multiple brush passes with decreasing width
    const tpts = trunk.map(p => ({ x: p.x * w, y: p.y * h }));
    brush(tpts, 4.8, 0.90, INK.deepest);
    // Inner dark streak along the trunk for fibrous feel
    brush(tpts, 1.2, 0.50, INK.dark);

    // Branches
    for (const b of branches) {
      const fx = b.from[0] * w, fy = b.from[1] * h;
      const ex = b.to[0]   * w, ey = b.to[1]   * h;
      brush([{x: fx, y: fy}, {x: ex, y: ey}], 2.0, 0.80, INK.deepest);
      // Needles — pre-sampled dots
      const rad = b.size * Math.min(w, h);
      for (const d of b.dots) {
        const px = ex + d.dx * rad;
        const py = ey + d.dy * rad;
        ctx.fillStyle = `rgba(18,14,10,${d.a})`;
        ctx.beginPath();
        ctx.arc(px, py, d.s, 0, TAU);
        ctx.fill();
      }
    }

    // Snow on pine crowns (uses cached offsets → no flicker)
    if (t === 'snow') {
      ctx.fillStyle = 'rgba(245,240,226,0.78)';
      for (const b of branches) {
        const ex = b.to[0] * w, ey = b.to[1] * h;
        const rad = b.size * Math.min(w, h);
        for (const s of b.snow) {
          const rr = s.rr * rad * 0.9;
          ctx.beginPath();
          ctx.arc(ex + Math.cos(s.a) * rr, ey - rad * 0.3 + Math.sin(s.a) * rr * 0.3, 1.1, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function drawMist(t, zone) {
    if (!scene) return;
    const w = W(), h = H();
    const heavy = t === 'fog';
    const mid   = t === 'rain' || t === 'thunder' || t === 'snow';
    for (const b of scene.mistBands) {
      // zone-filter: 'far' for upper mist, 'mid' for middle mist
      if (zone === 'far' && b.y > 0.45) continue;
      if (zone === 'mid' && b.y <= 0.45) continue;
      const drift = (tick * b.driftSpd) % 1.4 - 0.2;
      const y  = b.y * h;
      const hh = b.h * h;
      const mult = heavy ? 4.2 : mid ? 1.8 : 1.0;
      const g = ctx.createLinearGradient(0, y - hh, 0, y + hh);
      g.addColorStop(0,   `rgba(230,224,208,0)`);
      g.addColorStop(0.5, `rgba(230,224,208,${Math.min(0.92, b.a * mult)})`);
      g.addColorStop(1,   `rgba(230,224,208,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-w * 0.2 + drift * w * 0.1, y - hh, w * 1.4, hh * 2);
    }
  }

  function drawRain() {
    const w = W(), h = H();
    ctx.strokeStyle = 'rgba(45,35,24,0.42)';
    ctx.lineWidth = 0.9;
    for (const p of RAIN) {
      p.y += p.spd;
      p.x -= p.spd * 0.12;
      if (p.y > 1) { p.y = -p.len; p.x = R(); }
      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo((p.x - p.spd * 0.12 * 3) * w, (p.y + p.len) * h);
      ctx.stroke();
    }
  }

  function drawSnow() {
    const w = W(), h = H(), T = tick * 0.0024;
    ctx.fillStyle = 'rgba(245,240,226,0.90)';
    ctx.beginPath();
    for (const p of SNOW) {
      p.y += p.spd;
      if (p.y > 1) { p.y = -0.02; p.x = R(); }
      const sx = p.x * w + Math.sin(T + p.ph) * w * 0.008;
      ctx.moveTo(sx + p.r, p.y * h);
      ctx.arc(sx, p.y * h, p.r, 0, TAU);
    }
    ctx.fill();
  }

  function drawThunder() {
    if (tick % 220 < 5) {
      const w = W(), h = H();
      ctx.fillStyle = 'rgba(245,238,210,0.18)';
      ctx.fillRect(0, 0, w, h);
      const lx = w * (0.30 + R() * 0.40);
      ctx.save();
      ctx.strokeStyle = 'rgba(40,30,22,0.92)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(lx,       h * 0.12);
      ctx.lineTo(lx - 10,  h * 0.32);
      ctx.lineTo(lx + 6,   h * 0.36);
      ctx.lineTo(lx - 14,  h * 0.58);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ Main loop
  let tick = 0;
  let lastT = 0;
  function draw(ts) {
    if (!scene) { requestAnimationFrame(draw); return; }
    // clamp frame time for low-fps safety
    const dt = Math.min(40, ts - lastT || 16);
    lastT = ts;
    tick += dt * 0.06;

    const t = wtype();
    ctx.clearRect(0, 0, W(), H());

    drawPaper(t);
    drawSkyWash(t);

    if (!isDay)                              drawMoon();
    else if (t === 'clear' || t === 'partly') drawSun();

    drawFarMountain(t);
    drawMist(t, 'far');
    drawMidMountain(t);
    drawMist(t, 'mid');
    drawWater(t);
    drawPineTree(t);

    if (t === 'rain' || t === 'thunder') drawRain();
    if (t === 'snow')                    drawSnow();
    if (t === 'thunder')                 drawThunder();

    requestAnimationFrame(draw);
  }

  resize();                                // initial sizing + scene build
  new ResizeObserver(resize).observe(canvas);
  requestAnimationFrame(draw);
})();

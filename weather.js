/* weather.js
 * 浮世絵風リアルタイム気象アニメーション
 * + 攻殻機動隊 ARISE 風 HUD オーバーレイ
 */
(async function () {
  'use strict';

  const canvas = document.getElementById('weather-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ── サイズ同期 ─────────────────────────────────────────── */
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      canvas.width  = Math.round(r.width);
      canvas.height = Math.round(r.height);
    }
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  /* ── データ取得 ─────────────────────────────────────────── */
  let code = 0, isDay = 1, temp = null;
  let cityName = '---', lat = null, lon = null;

  async function fetchWeather(la, lo) {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
      `&current=weather_code,is_day,temperature_2m&timezone=auto`
    );
    const d = await r.json();
    code  = d.current?.weather_code     ?? 0;
    isDay = d.current?.is_day           ?? 1;
    temp  = d.current?.temperature_2m   ?? null;
  }

  async function fetchCity(la, lo) {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${la}&lon=${lo}&accept-language=ja`,
      { headers: { 'Accept-Language': 'ja' } }
    );
    const d = await r.json();
    const a = d.address ?? {};
    cityName =
      a.city       ||
      a.town       ||
      a.village    ||
      a.municipality ||
      a.county     ||
      d.name       ||
      '---';
  }

  try {
    const pos = await new Promise((ok, ng) =>
      navigator.geolocation.getCurrentPosition(ok, ng, { timeout: 7000 })
    );
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    await Promise.all([fetchWeather(lat, lon), fetchCity(lat, lon)]);
  } catch (_) { /* デフォルト値を使用 */ }

  /* ── フォント読み込み待機 ───────────────────────────────── */
  await document.fonts.ready;

  /* ── 天気種別 ───────────────────────────────────────────── */
  function wtype() {
    if (code === 0)                      return 'clear';
    if (code <= 3)                       return 'partly';
    if (code >= 45 && code <= 48)        return 'fog';
    if (code >= 51 && code <= 67)        return 'rain';
    if (code >= 71 && code <= 77)        return 'snow';
    if (code >= 80 && code <= 82)        return 'rain';
    if (code >= 85 && code <= 86)        return 'snow';
    if (code >= 95)                      return 'thunder';
    return 'partly';
  }

  function weatherLabel() {
    if (code === 0)              return ['快晴',      'CLEAR SKY'];
    if (code <= 2)               return ['晴れ',      'MAINLY CLEAR'];
    if (code === 3)              return ['曇り',      'OVERCAST'];
    if (code <= 48)              return ['霧',        'FOG'];
    if (code <= 55)              return ['霧雨',      'DRIZZLE'];
    if (code <= 67)              return ['雨',        'RAIN'];
    if (code <= 77)              return ['雪',        'SNOW'];
    if (code <= 82)              return ['にわか雨',   'SHOWERS'];
    if (code <= 86)              return ['にわか雪',   'SNOW SHOWERS'];
    return                              ['雷雨',      'THUNDERSTORM'];
  }

  /* ── パーティクル ───────────────────────────────────────── */
  const RAIN = Array.from({ length: 130 }, () => ({
    x: Math.random(), y: Math.random(),
    len: 0.022 + Math.random() * 0.012,
    spd: 0.005 + Math.random() * 0.003,
  }));
  const SNOW = Array.from({ length: 65 }, () => ({
    x: Math.random(), y: Math.random(),
    r: 0.003 + Math.random() * 0.004,
    spd: 0.0007 + Math.random() * 0.0009,
    ph: Math.random() * Math.PI * 2,
  }));

  /* ── 描画ユーティリティ ─────────────────────────────────── */
  const W = () => canvas.width;
  const H = () => canvas.height;

  /* ── 浮世絵シーン描画 ───────────────────────────────────── */

  function drawSky(t) {
    const w = W(), h = H();
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.67);
    if (!isDay) {
      g.addColorStop(0, '#04040F'); g.addColorStop(1, '#0C1630');
    } else if (t === 'clear' || t === 'partly') {
      g.addColorStop(0, '#1C3858'); g.addColorStop(0.4, '#3278B0'); g.addColorStop(1, '#A2CFEA');
    } else if (t === 'rain' || t === 'thunder') {
      g.addColorStop(0, '#181F2E'); g.addColorStop(1, '#30404F');
    } else if (t === 'snow') {
      g.addColorStop(0, '#5878A0'); g.addColorStop(1, '#C4D8EE');
    } else if (t === 'fog') {
      g.addColorStop(0, '#7888A0'); g.addColorStop(1, '#BDD0DA');
    } else {
      g.addColorStop(0, '#353548'); g.addColorStop(1, '#848494');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars() {
    const w = W(), h = H(), t = tick * 0.002;
    for (let i = 0; i < 38; i++) {
      const sx = ((i * 137.508) % 100) / 100 * w;
      const sy = ((i * 97.332)  % 58)  / 100 * h;
      const a  = 0.35 + 0.55 * Math.sin(t + i * 1.31);
      ctx.beginPath();
      ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,248,210,${a})`;
      ctx.fill();
    }
  }

  function drawSun() {
    const w = W(), h = H(), t = tick * 0.0022;
    const x = w * 0.76, y = h * 0.16, r = Math.min(w, h) * 0.072;
    const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.9);
    halo.addColorStop(0, 'rgba(215,130,35,0.28)');
    halo.addColorStop(1, 'rgba(215,130,35,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, r * 2.9, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(t);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.18, Math.sin(a) * r * 1.18);
      ctx.lineTo(Math.cos(a) * r * 2.15, Math.sin(a) * r * 2.15);
      ctx.strokeStyle = 'rgba(195,90,15,0.32)';
      ctx.lineWidth = 1.3; ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#BE3418'; ctx.fill();
    ctx.strokeStyle = 'rgba(100,20,8,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawMoon() {
    const w = W(), h = H();
    const x = w * 0.74, y = h * 0.14, r = Math.min(w, h) * 0.066;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.3);
    halo.addColorStop(0, 'rgba(235,220,150,0.22)');
    halo.addColorStop(1, 'rgba(235,220,150,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, r * 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#EED860'; ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.30, y, r * 0.83, 0, Math.PI * 2);
    ctx.fillStyle = '#0C1630'; ctx.fill();
  }

  function ukiyoCloud(cx, cy, sz, dark) {
    const base = dark ? '#72728A' : '#E8DDD0';
    const shad = dark ? '#525262' : '#C4B0A0';
    const puffs = [
      [0,        0,        sz * 0.50],
      [ sz*0.42, sz*0.13,  sz * 0.44],
      [-sz*0.38, sz*0.18,  sz * 0.40],
      [ sz*0.74, sz*0.29,  sz * 0.33],
      [-sz*0.62, sz*0.31,  sz * 0.28],
    ];
    puffs.forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(cx+dx, cy+dy + sz*0.08, r, 0, Math.PI*2);
      ctx.fillStyle = shad; ctx.fill();
    });
    puffs.forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(cx+dx, cy+dy, r, 0, Math.PI*2);
      ctx.fillStyle = base; ctx.fill();
    });
    puffs.forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(cx+dx, cy+dy, r, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(55,35,15,0.28)'; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }

  function drawClouds(t) {
    const w = W(), h = H();
    const dark = t === 'rain' || t === 'thunder';
    const spd = tick * 0.00016;
    [
      { ox: 0.07, oy: 0.17, sz: 0.145, s: 0.00010 },
      { ox: 0.43, oy: 0.11, sz: 0.110, s: 0.00007 },
      { ox: 0.63, oy: 0.23, sz: 0.120, s: 0.00012 },
    ].forEach(d => {
      const cx = (((d.ox + spd * d.s * 1e5) % 1.30) - 0.15) * w;
      ukiyoCloud(cx, d.oy * h, d.sz * w, dark);
    });
  }

  function drawMountain(t) {
    const w = W(), h = H();
    const snowy = t === 'snow';

    // ── 遠景山（薄墨・雪舟風）──
    // なだらかなベジェ曲線で山の輪郭を描く
    const peak1x = w * 0.50, peak1y = h * 0.135;
    const peak2x = w * 0.20, peak2y = h * 0.31;  // 左奥の山
    const peak3x = w * 0.82, peak3y = h * 0.27;  // 右奥の山

    // 遠景山（右）
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.65);
    ctx.bezierCurveTo(w * 0.68, h * 0.55, w * 0.74, h * 0.40, peak3x, peak3y);
    ctx.bezierCurveTo(w * 0.90, h * 0.40, w * 1.00, h * 0.52, w * 1.02, h * 0.65);
    ctx.closePath();
    const rmg = ctx.createLinearGradient(peak3x, peak3y, peak3x, h * 0.65);
    rmg.addColorStop(0,   snowy ? 'rgba(210,215,220,0.70)' : 'rgba(165,155,138,0.60)');
    rmg.addColorStop(0.5, 'rgba(100,105,90,0.55)');
    rmg.addColorStop(1,   'rgba(45,50,35,0.50)');
    ctx.fillStyle = rmg; ctx.fill();

    // 遠景山（左）
    ctx.beginPath();
    ctx.moveTo(w * -0.02, h * 0.65);
    ctx.bezierCurveTo(w * 0.00, h * 0.52, w * 0.08, h * 0.40, peak2x, peak2y);
    ctx.bezierCurveTo(w * 0.32, h * 0.40, w * 0.40, h * 0.55, w * 0.46, h * 0.65);
    ctx.closePath();
    const lmg = ctx.createLinearGradient(peak2x, peak2y, peak2x, h * 0.65);
    lmg.addColorStop(0,   snowy ? 'rgba(210,215,220,0.68)' : 'rgba(160,150,135,0.58)');
    lmg.addColorStop(0.5, 'rgba(95,100,85,0.52)');
    lmg.addColorStop(1,   'rgba(42,47,32,0.48)');
    ctx.fillStyle = lmg; ctx.fill();

    // ── メイン富士山形（なめらかS字ライン）──
    ctx.beginPath();
    ctx.moveTo(w * 0.10, h * 0.65);
    // 左裾 → 山頂: なだらかな凹型カーブ
    ctx.bezierCurveTo(w * 0.18, h * 0.58, w * 0.32, h * 0.38, peak1x, peak1y);
    // 山頂 → 右裾
    ctx.bezierCurveTo(w * 0.68, h * 0.38, w * 0.82, h * 0.58, w * 0.90, h * 0.65);
    ctx.closePath();

    const mg = ctx.createLinearGradient(peak1x, peak1y, peak1x, h * 0.65);
    if (snowy) {
      mg.addColorStop(0,    '#E8E4DC');
      mg.addColorStop(0.12, '#CDD5DF');
      mg.addColorStop(0.30, '#8A9080');
      mg.addColorStop(0.55, '#3A4030');
      mg.addColorStop(1,    '#181E12');
    } else {
      mg.addColorStop(0,    '#E2D8C8');
      mg.addColorStop(0.14, '#A89E8C');
      mg.addColorStop(0.32, '#626856');
      mg.addColorStop(0.55, '#363C2A');
      mg.addColorStop(1,    '#171C10');
    }
    ctx.fillStyle = mg; ctx.fill();

    // 山の輪郭線（雪舟の筆跡風：細い墨線）
    ctx.beginPath();
    ctx.moveTo(w * 0.10, h * 0.65);
    ctx.bezierCurveTo(w * 0.18, h * 0.58, w * 0.32, h * 0.38, peak1x, peak1y);
    ctx.bezierCurveTo(w * 0.68, h * 0.38, w * 0.82, h * 0.58, w * 0.90, h * 0.65);
    ctx.strokeStyle = 'rgba(18,22,14,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // ── 雪線（山頂付近の白い帯）──
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.255);
    ctx.bezierCurveTo(w * 0.41, h * 0.230, w * 0.46, h * 0.185, peak1x, peak1y);
    ctx.bezierCurveTo(w * 0.54, h * 0.185, w * 0.59, h * 0.230, w * 0.62, h * 0.255);
    ctx.strokeStyle = snowy ? 'rgba(245,242,236,0.92)' : 'rgba(210,204,190,0.72)';
    ctx.lineWidth = snowy ? 2.0 : 1.4;
    ctx.stroke();

    // 雪帽子のにじみ（墨の濃淡）
    if (snowy) {
      ctx.beginPath();
      ctx.moveTo(w * 0.40, h * 0.245);
      ctx.bezierCurveTo(w * 0.44, h * 0.200, w * 0.48, h * 0.168, peak1x, peak1y);
      ctx.bezierCurveTo(w * 0.52, h * 0.168, w * 0.56, h * 0.200, w * 0.60, h * 0.245);
      ctx.strokeStyle = 'rgba(235,238,242,0.50)';
      ctx.lineWidth = 4.5;
      ctx.stroke();
    }

    // ── 山肌の皴法（かすれた水墨線）──
    ctx.lineWidth = 0.65;
    const wrinkles = [
      // [x0, y0, cx1, cy1, cx2, cy2, x1, y1]
      [0.42, 0.26, 0.40, 0.33, 0.37, 0.42, 0.34, 0.52],
      [0.48, 0.22, 0.46, 0.30, 0.44, 0.40, 0.40, 0.52],
      [0.55, 0.25, 0.56, 0.33, 0.58, 0.41, 0.60, 0.51],
      [0.60, 0.28, 0.62, 0.36, 0.65, 0.44, 0.68, 0.52],
      [0.44, 0.30, 0.43, 0.38, 0.41, 0.46, 0.38, 0.58],
      [0.56, 0.30, 0.58, 0.38, 0.61, 0.46, 0.64, 0.57],
    ];
    wrinkles.forEach(([x0, y0, cx1, cy1, cx2, cy2, x1, y1]) => {
      ctx.beginPath();
      ctx.moveTo(w * x0, h * y0);
      ctx.bezierCurveTo(w * cx1, h * cy1, w * cx2, h * cy2, w * x1, h * y1);
      ctx.strokeStyle = 'rgba(30,35,22,0.20)';
      ctx.stroke();
    });

    // ── 霧（fog時）──
    if (t === 'fog') {
      const fog = ctx.createLinearGradient(0, h * 0.32, 0, h * 0.62);
      fog.addColorStop(0, 'rgba(188,200,212,0.78)');
      fog.addColorStop(1, 'rgba(188,200,212,0)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, h * 0.32, w, h * 0.30);
    }
  }

  function drawWaves(t) {
    const w = W(), h = H(), spd = tick * 0.009;
    const storm = t === 'rain' || t === 'thunder';
    const amp = storm ? 2.1 : 1.0;
    const layers = [
      { y: 0.625, c: '#092235', a: 20, f: 0.0135 },
      { y: 0.665, c: '#0F3355', a: 16, f: 0.0188 },
      { y: 0.705, c: '#1A4D78', a: 13, f: 0.0235 },
      { y: 0.755, c: '#256495', a: 11, f: 0.0195 },
      { y: 0.810, c: '#3278AA', a:  9, f: 0.0270 },
      { y: 0.875, c: '#408EC0', a:  7, f: 0.0310 },
    ];
    layers.forEach((l, i) => {
      const by = l.y * h;
      ctx.beginPath(); ctx.moveTo(0, by);
      for (let x = 0; x <= w; x += 3)
        ctx.lineTo(x, by + Math.sin(x * l.f + spd + i * 0.65) * l.a * amp);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fillStyle = l.c; ctx.fill();
    });
    drawWaveCrests(storm);
  }

  function drawWaveCrests(storm) {
    const w = W(), h = H();
    ctx.strokeStyle = storm ? 'rgba(190,215,240,0.85)' : 'rgba(225,242,255,0.75)';
    ctx.lineWidth = storm ? 2.8 : 2.0;
    for (let i = 0; i < 7; i++) {
      const bx = ((tick * (storm ? 1.0 : 0.65) + i * w / 7) % (w + 100)) - 50;
      const by = h * (0.595 + i * 0.046);
      ctx.beginPath();
      ctx.moveTo(bx - 28, by + 7);
      ctx.bezierCurveTo(bx - 14, by - 20, bx + 14, by - 20, bx + 28, by + 7);
      ctx.stroke();
      for (let j = 0; j < 5; j++) {
        ctx.beginPath();
        ctx.arc(bx - 16 + j * 8, by - 2, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(225,242,255,0.70)'; ctx.fill();
      }
    }
  }

  function drawRain() {
    const w = W(), h = H();
    ctx.strokeStyle = 'rgba(120,165,210,0.52)'; ctx.lineWidth = 1.2;
    RAIN.forEach(p => {
      p.y += p.spd; p.x -= p.spd * 0.14;
      if (p.y > 1) { p.y = -p.len; p.x = Math.random(); }
      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo((p.x - p.spd * 0.14 * 3.5) * w, (p.y + p.len) * h);
      ctx.stroke();
    });
  }

  function drawSnow() {
    const w = W(), h = H(), t = tick * 0.007;
    SNOW.forEach(p => {
      p.y += p.spd;
      if (p.y > 1) { p.y = -0.02; p.x = Math.random(); }
      const sx = p.x * w + Math.sin(t + p.ph) * w * 0.014;
      ctx.beginPath();
      ctx.arc(sx, p.y * h, p.r * Math.min(w, h), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(228,232,255,0.86)'; ctx.fill();
    });
  }

  function drawThunder() {
    if (tick % 150 < 5) {
      const w = W(), h = H();
      ctx.fillStyle = 'rgba(255,255,200,0.10)';
      ctx.fillRect(0, 0, w, h);
      const lx = w * (0.22 + Math.random() * 0.56);
      ctx.save();
      ctx.strokeStyle = '#FFFF80'; ctx.lineWidth = 2.8;
      ctx.shadowColor = '#FFFFAA'; ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(lx,      h * 0.21);
      ctx.lineTo(lx - 13, h * 0.42);
      ctx.lineTo(lx + 8,  h * 0.42);
      ctx.lineTo(lx - 20, h * 0.72);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFog() {
    const w = W(), h = H(), t = tick * 0.0003;
    for (let i = 0; i < 5; i++) {
      const fy = h * (0.28 + i * 0.10);
      const xo = Math.sin(t + i * 1.6) * w * 0.06;
      const fg = ctx.createLinearGradient(0, fy - 35, 0, fy + 35);
      fg.addColorStop(0, 'rgba(192,204,216,0)');
      fg.addColorStop(0.5, 'rgba(192,204,216,0.28)');
      fg.addColorStop(1, 'rgba(192,204,216,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(xo, fy - 35, w, 70);
    }
  }

  /* ── 攻殻機動隊 ARISE 風 HUD ────────────────────────────── */
  function drawHUD() {
    const w = W(), h = H();

    // スキャンライン（全面・極薄）
    ctx.fillStyle = 'rgba(0,0,0,0.035)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    const fs   = Math.max(9, Math.min(w * 0.027, 14));   // ベースフォントサイズ
    const lh   = fs * 2.0;                                 // 行高さ
    const px   = w * 0.055;                                // 左余白
    const rows = 6;
    const panH = lh * rows + lh * 0.5;
    const py   = h - h * 0.055 - panH;                    // 下から配置
    const panW = Math.min(w * 0.78, w - px * 2);

    const COL  = '#5EFFD8';                                // GITS シアン
    const DIM  = 'rgba(94,255,216,0.45)';
    const BG   = 'rgba(0,6,14,0.62)';

    // ── パネル背景 ──
    ctx.fillStyle = BG;
    ctx.fillRect(px, py, panW, panH);

    // ── 上罫線 ──
    ctx.strokeStyle = COL; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + panW, py); ctx.stroke();

    // ── 左縦線（アクセント） ──
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + panH); ctx.stroke();

    const FONT     = `"Share Tech Mono", monospace`;
    const FONT_SM  = `${fs * 0.78}px ${FONT}`;
    const FONT_MD  = `${fs}px ${FONT}`;
    const FONT_LG  = `${fs * 1.22}px ${FONT}`;

    ctx.textBaseline = 'middle';
    ctx.shadowColor  = COL;

    let cy = py + lh * 0.55;  // 現在の描画Y座標

    // ── Row 1: ラベル "LOCATION DATA" ──
    ctx.font = FONT_SM;
    ctx.shadowBlur = 4;
    ctx.fillStyle = DIM;
    ctx.fillText('◈  LOCATION DATA', px + lh * 0.45, cy);
    cy += lh;

    // ── セパレータ ──
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(94,255,216,0.28)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(px + 2, cy - lh * 0.38); ctx.lineTo(px + panW, cy - lh * 0.38); ctx.stroke();

    // ── Row 2: 都市名（大きめ） ──
    ctx.font = FONT_LG;
    ctx.shadowBlur = 8;
    ctx.fillStyle = COL;
    ctx.fillText(cityName, px + lh * 0.45, cy);
    cy += lh;

    // ── セパレータ ──
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(94,255,216,0.28)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(px + 2, cy - lh * 0.38); ctx.lineTo(px + panW, cy - lh * 0.38); ctx.stroke();

    // ── Row 3: 天気ラベル ──
    const [jp, en] = weatherLabel();
    ctx.font = FONT_MD;
    ctx.shadowBlur = 4;
    ctx.fillStyle = DIM;
    ctx.fillText('WX', px + lh * 0.45, cy);
    ctx.shadowBlur = 6;
    ctx.fillStyle = COL;
    ctx.fillText(`${jp}  /  ${en}`, px + lh * 2.2, cy);
    cy += lh;

    // ── Row 4: 気温バー ──
    if (temp !== null) {
      ctx.font = FONT_MD;
      ctx.shadowBlur = 4;
      ctx.fillStyle = DIM;
      ctx.fillText('TEMP', px + lh * 0.45, cy);

      const barX = px + lh * 2.2;
      const barW = panW * 0.36;
      const barH = lh * 0.22;
      const barY = cy - barH / 2;
      const ratio = Math.max(0, Math.min(1, (temp + 20) / 60));

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(94,255,216,0.12)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.shadowBlur = 6;
      ctx.fillStyle = COL;
      ctx.fillRect(barX, barY, barW * ratio, barH);

      ctx.font = FONT_MD;
      ctx.shadowBlur = 4;
      ctx.fillStyle = COL;
      const sign = temp > 0 ? '+' : '';
      ctx.fillText(`${sign}${Math.round(temp)}℃`, barX + barW + lh * 0.35, cy);
      cy += lh;
    } else {
      cy += lh;
    }

    // ── Row 5: 座標 + 点滅カーソル ──
    ctx.font = FONT_SM;
    ctx.shadowBlur = 3;
    ctx.fillStyle = 'rgba(94,255,216,0.52)';
    if (lat !== null && lon !== null) {
      const cursor = Math.floor(tick / 32) % 2 === 0 ? '▌' : ' ';
      const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
      ctx.fillText(`${latStr}  ·  ${lonStr}  ${cursor}`, px + lh * 0.45, cy);
    } else {
      const cursor = Math.floor(tick / 32) % 2 === 0 ? '▌' : ' ';
      ctx.fillText(`LOCATION UNAVAILABLE  ${cursor}`, px + lh * 0.45, cy);
    }
    cy += lh;

    // ── 下罫線 ──
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COL; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(px, py + panH); ctx.lineTo(px + panW, py + panH); ctx.stroke();

    ctx.shadowBlur = 0;
  }

  /* ── 版画風仕上げ（ビネット＋縁取り）──────────────────── */
  function postProcess() {
    const w = W(), h = H();
    const vg = ctx.createRadialGradient(w/2, h/2, h*0.28, w/2, h/2, h*0.88);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(25,15,5,0.55)'; ctx.lineWidth = 4.5;
    ctx.strokeRect(2.5, 2.5, w - 5, h - 5);
  }

  /* ── メインループ ───────────────────────────────────────── */
  let tick = 0;
  function draw() {
    const t = wtype();
    ctx.clearRect(0, 0, W(), H());

    drawSky(t);
    if (!isDay) { drawStars(); drawMoon(); }
    else if (t !== 'rain' && t !== 'thunder') drawSun();

    if (t !== 'clear' || !isDay) drawClouds(t);
    if (t === 'fog') drawFog();

    drawMountain(t);
    drawWaves(t);

    if (t === 'rain' || t === 'thunder') drawRain();
    if (t === 'snow') drawSnow();
    if (t === 'thunder') drawThunder();

    postProcess();
    drawHUD();   // HUDは最前面

    tick++;
    requestAnimationFrame(draw);
  }
  draw();
})();

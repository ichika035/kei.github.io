/* weather.js
 * 水墨画パーティクルシステム
 * 暗背景に白〜灰のパーティクル群で墨の濃淡を表現
 * + 攻殻機動隊 ARISE 風 HUD
 */
(async function () {
  'use strict';

  const canvas = document.getElementById('weather-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;

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
    code  = d.current?.weather_code   ?? 0;
    isDay = d.current?.is_day         ?? 1;
    temp  = d.current?.temperature_2m ?? null;
  }

  async function fetchCity(la, lo) {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${la}&lon=${lo}&accept-language=ja`,
      { headers: { 'Accept-Language': 'ja' } }
    );
    const d = await r.json();
    const a = d.address ?? {};
    cityName = a.city || a.town || a.village || a.municipality || a.county || d.name || '---';
  }

  try {
    const pos = await new Promise((ok, ng) =>
      navigator.geolocation.getCurrentPosition(ok, ng, { timeout: 7000 })
    );
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    await Promise.all([fetchWeather(lat, lon), fetchCity(lat, lon)]);
  } catch (_) {}

  await document.fonts.ready;

  /* ── 天気種別 ───────────────────────────────────────────── */
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
    if (code === 0)    return ['快晴',    'CLEAR SKY'];
    if (code <= 2)     return ['晴れ',    'MAINLY CLEAR'];
    if (code === 3)    return ['曇り',    'OVERCAST'];
    if (code <= 48)    return ['霧',      'FOG'];
    if (code <= 55)    return ['霧雨',    'DRIZZLE'];
    if (code <= 67)    return ['雨',      'RAIN'];
    if (code <= 77)    return ['雪',      'SNOW'];
    if (code <= 82)    return ['にわか雨', 'SHOWERS'];
    if (code <= 86)    return ['にわか雪', 'SNOW SHOWERS'];
    return                    ['雷雨',    'THUNDERSTORM'];
  }

  const W = () => canvas.width;
  const H = () => canvas.height;

  /* ── 枯木スケルトン（パーティクル配置基準）───────────── */
  /* [dx0,dy0,dx1,dy1,相対太さ]  dy正=上、dx/dy は tree height の倍率 */
  const TREE_SEGS = [
    [ 0.000, 0.000, -0.013, 0.420, 1.00],
    [-0.013, 0.420,  0.000, 1.000, 0.72],
    [-0.013, 0.420, -0.095, 0.608, 0.64],
    [-0.095, 0.608, -0.128, 0.748, 0.46],
    [-0.128, 0.748, -0.158, 0.872, 0.34],
    [-0.128, 0.748, -0.096, 0.858, 0.30],
    [-0.013, 0.420,  0.054, 0.568, 0.60],
    [ 0.054, 0.568,  0.078, 0.698, 0.44],
    [ 0.078, 0.698,  0.100, 0.814, 0.32],
    [ 0.078, 0.698,  0.060, 0.802, 0.28],
    [ 0.000, 0.720, -0.054, 0.858, 0.42],
    [-0.054, 0.858, -0.072, 0.952, 0.28],
    [-0.054, 0.858, -0.038, 0.960, 0.24],
    [ 0.000, 0.720,  0.036, 0.848, 0.38],
    [ 0.036, 0.848,  0.052, 0.942, 0.26],
    [ 0.000, 1.000, -0.030, 1.112, 0.34],
    [ 0.000, 1.000,  0.026, 1.090, 0.30],
    [-0.030, 1.112, -0.044, 1.185, 0.20],
    [ 0.026, 1.090,  0.040, 1.175, 0.18],
  ];

  /* ── 岩形状プロファイル ─────────────────────────────────── */
  /* tx: x within rock zone [0,1] → returns normalized y of rock top */
  function rockTopY(tx) {
    return 0.62 - 0.28 * Math.min(1.0,
      0.55 * Math.exp(-6.5 * Math.pow(tx - 0.38, 2)) +
      0.30 * Math.exp(-9.0 * Math.pow(tx - 0.64, 2)) +
      0.15 * Math.exp(-11.0 * Math.pow(tx - 0.14, 2))
    );
  }

  /* ── パーティクル生成 ────────────────────────────────────── */
  const R = Math.random;

  const PARTICLES = (function () {
    const ps = [];

    /* 遠景 (d): 上部、極薄 */
    for (let i = 0; i < 220; i++) {
      ps.push({ tp: 'd',
        ox: R(),          oy: 0.12 + R() * 0.28,
        r:  0.4 + R() * 1.1,
        ba: 0.04 + R() * 0.06,
        fr: 0.00036 + R() * 0.00026,
        am: 0.007  + R() * 0.011,
        p1: R() * TAU,  p2: R() * TAU,  ag: R() * 3000,
      });
    }

    /* 岩 (r): 左中央、rejection sampling で崖形状に */
    let rc = 0;
    while (rc < 560) {
      const ox = 0.05 + R() * 0.38;
      const oy = 0.36 + R() * 0.28;
      const tx = (ox - 0.05) / 0.38;
      if (oy < rockTopY(tx)) continue;
      ps.push({ tp: 'r',
        ox, oy,
        r:  0.6 + R() * 2.0,
        ba: 0.36 + R() * 0.46,
        fr: 0.00044 + R() * 0.00030,
        am: 0.0015 + R() * 0.0022,
        p1: R() * TAU,  p2: R() * TAU,  ag: R() * 3000,
      });
      rc++;
    }

    /* 霞 (m): 中帯、横に流れる、大粒 */
    for (let i = 0; i < 240; i++) {
      ps.push({ tp: 'm',
        ox: R() * 1.25 - 0.12, oy: 0.33 + R() * 0.26,
        r:  5  + R() * 11,
        ba: 0.020 + R() * 0.030,
        fr: 0.00020 + R() * 0.00013,
        am: 0.013  + R() * 0.018,
        p1: R() * TAU,  p2: R() * TAU,  ag: R() * 3000,
        dr: 0.0000170 + R() * 0.0000120,   /* 横流れ */
      });
    }

    /* 水面 (w): 下部、右流れ */
    for (let i = 0; i < 280; i++) {
      ps.push({ tp: 'w',
        ox: R() * 1.15, oy: 0.645 + R() * 0.34,
        r:  0.4 + R() * 1.1,
        ba: 0.08 + R() * 0.14,
        fr: 0.00090 + R() * 0.00070,
        am: 0.005  + R() * 0.006,
        p1: R() * TAU,  p2: R() * TAU,  ag: R() * 3000,
        dr: 0.0000480 + R() * 0.0000320,
      });
    }

    /* 枯木 (t): 右側、枝セグメント沿い */
    const segLen = TREE_SEGS.map(s => Math.hypot(s[2]-s[0], s[3]-s[1]));
    const segSum = segLen.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 240; i++) {
      let rw = R() * segSum, si = 0;
      for (let j = 0; j < TREE_SEGS.length; j++) {
        rw -= segLen[j]; if (rw <= 0) { si = j; break; }
      }
      const seg = TREE_SEGS[si], t_ = R();
      const THf = 0.36, TXf = 0.60;
      const sc  = 0.004 * (1.0 - Math.min(1, seg[4] * 1.2)) + 0.0006;
      ps.push({ tp: 't',
        ox: 0.76 + (seg[0] + (seg[2]-seg[0])*t_) * THf * TXf + (R()-0.5)*sc,
        oy: 0.63 - (seg[1] + (seg[3]-seg[1])*t_) * THf        + (R()-0.5)*sc,
        r:  0.5  + R() * 1.4,
        ba: 0.40 + R() * 0.42,
        fr: 0.00065 + R() * 0.00036,
        am: 0.0012 + R() * 0.0016,
        p1: R() * TAU,  p2: R() * TAU,  ag: R() * 3000,
      });
    }

    return ps;
  })();

  /* タイプ別に事前分類 */
  const PG = { d: [], r: [], m: [], w: [], t: [] };
  PARTICLES.forEach(p => PG[p.tp].push(p));

  /* ── 天候用パーティクル ──────────────────────────────────── */
  const RAIN_P = Array.from({ length: 90 }, () => ({
    x: R(), y: R(), len: 0.016 + R() * 0.009, spd: 0.0019 + R() * 0.0011,
  }));
  const SNOW_P = Array.from({ length: 60 }, () => ({
    x: R(), y: R(), r: 1.0 + R() * 1.8, spd: 0.00025 + R() * 0.00026, ph: R() * TAU,
  }));

  /* ── 暗背景（天気依存）──────────────────────────────────── */
  function drawSky(t) {
    const w = W(), h = H();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (!isDay) {
      g.addColorStop(0, '#030202'); g.addColorStop(1, '#060508');
    } else if (t === 'clear' || t === 'partly') {
      g.addColorStop(0, '#0D0A07'); g.addColorStop(0.5, '#110D08'); g.addColorStop(1, '#150F09');
    } else if (t === 'rain' || t === 'thunder') {
      g.addColorStop(0, '#060810'); g.addColorStop(1, '#090C16');
    } else if (t === 'snow') {
      g.addColorStop(0, '#080A12'); g.addColorStop(1, '#0C0F18');
    } else if (t === 'fog') {
      g.addColorStop(0, '#0C0C0A'); g.addColorStop(1, '#161512');
    } else {
      g.addColorStop(0, '#080806'); g.addColorStop(1, '#0E0E0C');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  /* ── 太陽（朱赤の光点）─────────────────────────────────── */
  function drawSun() {
    const w = W(), h = H();
    const x = w * 0.74, y = h * 0.10, r = Math.min(w, h) * 0.052;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.0);
    halo.addColorStop(0, 'rgba(210,80,25,0.28)');
    halo.addColorStop(0.4, 'rgba(200,60,18,0.12)');
    halo.addColorStop(1, 'rgba(200,60,18,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 3.0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = 'rgba(225,85,30,0.92)'; ctx.fill();
  }

  /* ── 月（白い三日月）────────────────────────────────────── */
  function drawMoon() {
    const w = W(), h = H();
    const x = w * 0.74, y = h * 0.10, r = Math.min(w, h) * 0.042;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = 'rgba(208,200,182,0.88)'; ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r + 1, 0, TAU); ctx.clip();
    ctx.beginPath(); ctx.arc(x + r * 0.28, y, r * 0.86, 0, TAU);
    ctx.fillStyle = 'rgba(4, 3, 4, 0.92)'; ctx.fill();
    ctx.restore();
  }

  /* ── 星（夜）────────────────────────────────────────────── */
  function drawStars() {
    const w = W(), h = H(), T = tick * 0.00042;
    for (let i = 0; i < 22; i++) {
      const sx = ((i * 137.508) % 100) / 100 * w;
      const sy = ((i * 97.332)  % 48)  / 100 * h;
      const a  = 0.12 + 0.28 * Math.sin(T + i * 1.38);
      ctx.beginPath(); ctx.arc(sx, sy, 0.70, 0, TAU);
      ctx.fillStyle = `rgba(215,206,184,${a})`; ctx.fill();
    }
  }

  /* ── メインパーティクル描画 ──────────────────────────────── */
  function drawParticles(t) {
    const w = W(), h = H();
    const storm = t === 'rain' || t === 'thunder';
    const snowy = t === 'snow';
    const foggy = t === 'fog';
    const partly = t === 'partly';
    const T = tick;

    /* タイプ別アルファ倍率（天気で変わる） */
    const AM = {
      d: foggy ? 0.55 : storm ? 0.48 : 1.00,
      r: foggy ? 0.20 : storm ? 1.35 : snowy ? 0.65 : 1.00,
      m: foggy ? 5.00 : storm ? 2.40 : snowy ? 1.90 : partly ? 1.65 : 1.00,
      w: storm  ? 1.60 : snowy ? 0.88 : 1.00,
      t: foggy ? 0.15 : storm ? 0.78 : snowy ? 0.55 : 1.00,
    };

    /* タイプ別 RGB */
    const TC = {
      d: '145, 135, 118',
      r: '182, 172, 153',
      m: '208, 200, 184',
      w: '138, 128, 112',
      t: '185, 175, 157',
    };

    /* ── 遠景・霞・水面：単一バッチ ── */
    ['d', 'm', 'w'].forEach(tp => {
      const baseA = tp === 'd' ? 0.062 : tp === 'm' ? 0.028 : 0.122;
      const alpha = Math.min(0.92, AM[tp] * baseA);
      if (alpha < 0.006) { /* ドリフトだけ更新 */
        PG[tp].forEach(p => { if (p.dr) { p.ox += p.dr; if (p.ox > 1.18) p.ox -= 1.28; } });
        return;
      }
      ctx.fillStyle = `rgba(${TC[tp]},${alpha.toFixed(3)})`;
      ctx.beginPath();
      PG[tp].forEach(p => {
        if (p.dr) { p.ox += p.dr; if (p.ox > 1.18) p.ox -= 1.28; }
        const T_ = T + p.ag;
        const px = (p.ox + p.am * Math.sin(T_ * p.fr       + p.p1)) * w;
        const py = (p.oy + p.am * 0.55 * Math.cos(T_ * p.fr * 1.28 + p.p2)) * h;
        if (px > -14 && px < w + 14 && py > -14 && py < h + 14) {
          ctx.moveTo(px + p.r, py); ctx.arc(px, py, p.r, 0, TAU);
        }
      });
      ctx.fill();
    });

    /* ── 岩・枯木：3段階アルファで奥行き表現 ── */
    ['r', 't'].forEach(tp => {
      const am = AM[tp];

      /* 位置を一括計算 */
      const pdata = PG[tp].map(p => {
        const T_ = T + p.ag;
        return {
          px: (p.ox + p.am * Math.sin(T_ * p.fr       + p.p1)) * w,
          py: (p.oy + p.am * 0.55 * Math.cos(T_ * p.fr * 1.28 + p.p2)) * h,
          r:  p.r,
          ba: p.ba,
        };
      });

      /* 3段バッチ [高密度→低密度] */
      [
        { minBa: 0.66, maxBa: 1.01, aBase: 0.78 },
        { minBa: 0.42, maxBa: 0.66, aBase: 0.54 },
        { minBa: 0.00, maxBa: 0.42, aBase: 0.30 },
      ].forEach(({ minBa, maxBa, aBase }) => {
        const alpha = Math.min(0.92, Math.max(0.005, am * aBase));
        ctx.fillStyle = `rgba(${TC[tp]},${alpha.toFixed(3)})`;
        ctx.beginPath();
        pdata.forEach(({ px, py, r, ba }) => {
          if (ba < minBa || ba >= maxBa) return;
          if (px > -10 && px < w + 10 && py > -10 && py < h + 10) {
            ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
          }
        });
        ctx.fill();
      });
    });
  }

  /* ── 雨（墨色の細線）────────────────────────────────────── */
  function drawRain() {
    const w = W(), h = H();
    ctx.strokeStyle = 'rgba(155,145,128,0.22)'; ctx.lineWidth = 0.72;
    RAIN_P.forEach(p => {
      p.y += p.spd; p.x -= p.spd * 0.11;
      if (p.y > 1) { p.y = -p.len; p.x = Math.random(); }
      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo((p.x - p.spd * 0.11 * 3.0) * w, (p.y + p.len) * h);
      ctx.stroke();
    });
  }

  /* ── 雪（白い浮遊粒子）─────────────────────────────────── */
  function drawSnow() {
    const w = W(), h = H(), T = tick * 0.0022;
    ctx.beginPath();
    SNOW_P.forEach(p => {
      p.y += p.spd;
      if (p.y > 1) { p.y = -0.02; p.x = Math.random(); }
      const sx = p.x * w + Math.sin(T + p.ph) * w * 0.008;
      ctx.moveTo(sx + p.r, p.y * h);
      ctx.arc(sx, p.y * h, p.r, 0, TAU);
    });
    ctx.fillStyle = 'rgba(222,218,208,0.62)'; ctx.fill();
  }

  /* ── 雪積もり（岩頂部の白いライン）────────────────────── */
  function drawSnowCap() {
    const w = W(), h = H();
    const rockX0 = 0.05, rockW = 0.38;
    const steps = 48;
    /* 岩の頂部プロファイルに沿って白い粒子を散らす */
    ctx.beginPath();
    for (let i = 0; i < steps; i++) {
      const tx  = i / steps;
      const ty  = rockTopY(tx);
      const px  = (rockX0 + tx * rockW) * w;
      const py  = ty * h;
      /* 積雪はわずかにふらつく */
      const off = Math.sin(tick * 0.00082 + i * 0.74) * h * 0.004;
      const pr  = 1.2 + Math.sin(i * 2.13) * 0.8;
      ctx.moveTo(px + pr, py + off);
      ctx.arc(px, py + off, pr, 0, TAU);
    }
    ctx.fillStyle = 'rgba(230,226,216,0.55)'; ctx.fill();
  }

  /* ── 雷フラッシュ ───────────────────────────────────────── */
  function drawThunder() {
    if (tick % 160 < 5) {
      const w = W(), h = H();
      ctx.fillStyle = 'rgba(215,212,185,0.07)'; ctx.fillRect(0, 0, w, h);
      const lx = w * (0.25 + Math.random() * 0.50);
      ctx.save();
      ctx.strokeStyle = 'rgba(235,232,172,0.88)'; ctx.lineWidth = 1.8;
      ctx.shadowColor = '#F5F4B8'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(lx,      h * 0.18);
      ctx.lineTo(lx - 10, h * 0.38);
      ctx.lineTo(lx +  6, h * 0.38);
      ctx.lineTo(lx - 15, h * 0.65);
      ctx.stroke(); ctx.restore();
    }
  }

  /* ── 霧（全面霞パーティクル増幅で対処済み・追加アンビエント）*/
  function drawFogAmbient() {
    const w = W(), h = H(), T = tick * 0.000078;
    for (let i = 0; i < 3; i++) {
      const fy = h * (0.18 + i * 0.16);
      const xo = Math.sin(T + i * 2.1) * w * 0.04;
      const fg = ctx.createLinearGradient(0, fy - 55, 0, fy + 55);
      fg.addColorStop(0,   'rgba(180,172,155,0)');
      fg.addColorStop(0.5, 'rgba(180,172,155,0.08)');
      fg.addColorStop(1,   'rgba(180,172,155,0)');
      ctx.fillStyle = fg; ctx.fillRect(xo, fy - 55, w, 110);
    }
  }

  /* ── 攻殻機動隊 ARISE 風 HUD ────────────────────────────── */
  function drawHUD() {
    const w = W(), h = H();

    ctx.fillStyle = 'rgba(0,0,0,0.035)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    const fs   = Math.max(9, Math.min(w * 0.027, 14));
    const lh   = fs * 2.0;
    const px   = w * 0.055;
    const rows = 6;
    const panH = lh * rows + lh * 0.5;
    const py   = h - h * 0.055 - panH;
    const panW = Math.min(w * 0.78, w - px * 2);

    const COL = '#5EFFD8';
    const DIM = 'rgba(94,255,216,0.45)';
    const BG  = 'rgba(0,6,14,0.62)';

    ctx.fillStyle = BG; ctx.fillRect(px, py, panW, panH);
    ctx.strokeStyle = COL; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + panW, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + panH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + panW, py); ctx.lineTo(px + panW, py + panH); ctx.stroke();

    const FONT    = `"Share Tech Mono", monospace`;
    const FONT_SM = `${fs * 0.78}px ${FONT}`;
    const FONT_MD = `${fs}px ${FONT}`;
    const FONT_LG = `${fs * 1.22}px ${FONT}`;

    ctx.textBaseline = 'middle'; ctx.shadowColor = COL;
    let cy = py + lh * 0.55;

    ctx.font = FONT_SM; ctx.shadowBlur = 4; ctx.fillStyle = DIM;
    ctx.fillText('◈  LOCATION DATA', px + lh * 0.45, cy); cy += lh;

    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(94,255,216,0.28)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(px + 2, cy - lh * 0.38); ctx.lineTo(px + panW, cy - lh * 0.38); ctx.stroke();

    ctx.font = FONT_LG; ctx.shadowBlur = 8; ctx.fillStyle = COL;
    ctx.fillText(cityName, px + lh * 0.45, cy); cy += lh;

    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(94,255,216,0.28)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(px + 2, cy - lh * 0.38); ctx.lineTo(px + panW, cy - lh * 0.38); ctx.stroke();

    const [jp, en] = weatherLabel();
    ctx.font = FONT_MD; ctx.shadowBlur = 4; ctx.fillStyle = DIM;
    ctx.fillText('WX', px + lh * 0.45, cy);
    ctx.shadowBlur = 6; ctx.fillStyle = COL;
    ctx.fillText(`${jp}  /  ${en}`, px + lh * 2.2, cy); cy += lh;

    if (temp !== null) {
      ctx.font = FONT_MD; ctx.shadowBlur = 4; ctx.fillStyle = DIM;
      ctx.fillText('TEMP', px + lh * 0.45, cy);
      const barX = px + lh * 2.2, barW = panW * 0.36;
      const barH = lh * 0.22, barY = cy - barH / 2;
      const ratio = Math.max(0, Math.min(1, (temp + 20) / 60));
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(94,255,216,0.12)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.shadowBlur = 6; ctx.fillStyle = COL;
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.font = FONT_MD; ctx.shadowBlur = 4; ctx.fillStyle = COL;
      const sign = temp > 0 ? '+' : '';
      ctx.fillText(`${sign}${Math.round(temp)}℃`, barX + barW + lh * 0.35, cy);
      cy += lh;
    } else { cy += lh; }

    ctx.font = FONT_SM; ctx.shadowBlur = 3; ctx.fillStyle = 'rgba(94,255,216,0.52)';
    if (lat !== null && lon !== null) {
      const cursor = Math.floor(tick / 32) % 2 === 0 ? '▌' : ' ';
      const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
      ctx.fillText(`${latStr}  ·  ${lonStr}  ${cursor}`, px + lh * 0.45, cy);
    } else {
      const cursor = Math.floor(tick / 32) % 2 === 0 ? '▌' : ' ';
      ctx.fillText(`LOCATION UNAVAILABLE  ${cursor}`, px + lh * 0.45, cy);
    }

    ctx.shadowBlur = 0; ctx.strokeStyle = COL; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(px, py + panH); ctx.lineTo(px + panW, py + panH); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ── ビネット ───────────────────────────────────────────── */
  function postProcess() {
    const w = W(), h = H();
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.16, w / 2, h / 2, h * 0.90);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  /* ── メインループ ───────────────────────────────────────── */
  let tick = 0;
  function draw() {
    const t = wtype();
    ctx.clearRect(0, 0, W(), H());

    drawSky(t);

    if (!isDay) { drawStars(); drawMoon(); }
    else if (t !== 'rain' && t !== 'thunder') drawSun();

    drawParticles(t);

    if (t === 'rain' || t === 'thunder') drawRain();
    if (t === 'snow')    { drawSnow(); drawSnowCap(); }
    if (t === 'thunder') drawThunder();
    if (t === 'fog')     drawFogAmbient();

    postProcess();
    drawHUD();

    tick++;
    requestAnimationFrame(draw);
  }
  draw();
})();

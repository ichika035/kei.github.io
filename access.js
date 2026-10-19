/* access.js
 * 国ごとのアクセス数を、緑の線で描いた地球儀の上に表示する。
 *
 *   - 各国の位置から外向きに伸びる線の長さ = その日のページビュー
 *   - 各国から HOME (東京) へ弧を引き、光の点が流れていく
 *   - 集計は GitHub Actions が毎日 Google Analytics から作り、パスワードで暗号化して
 *     access.enc.json として置く (scripts/encrypt_access.py)。打たれたパスワードで復号できたときだけ表示する。
 *     中身: { "updated": "...", "days": [ { "date": "YYYY-MM-DD", "countries": { "JP": 12, ... } }, ... ] }
 */
(async function () {
  'use strict';

  const canvas = document.getElementById('globe');
  const ctx = canvas.getContext('2d');
  const GREEN = '51, 255, 102';
  const HOME = [139.69, 35.69];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const regionName = (() => {
    try {
      const dn = new Intl.DisplayNames(['ja'], { type: 'region' });
      return (code) => { try { return dn.of(code) || code; } catch (_) { return code; } };
    } catch (_) {
      return (code) => code;
    }
  })();

  // ------------------------------------------------------------ Exit
  // ESC (パスワードがわからないときも) か EXIT で、映ったときの逆に画面が横線に縮んで消えてから来たページへ戻る
  function exit() {
    const crt = document.querySelector('.crt');
    if (crt.classList.contains('crt-off')) return;
    crt.classList.add('crt-off');
    const back = document.referrer && new URL(document.referrer).origin === location.origin;
    setTimeout(() => {
      if (back) history.back();
      else location.href = $('exit').href;
    }, reduced ? 0 : 600);
  }
  $('exit').addEventListener('click', (e) => { e.preventDefault(); exit(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') exit(); });
  // 戻ってきたときに消えた画面のままにならないようにする
  window.addEventListener('pageshow', () => {
    document.querySelector('.crt').classList.remove('crt-off');
  });

  // ------------------------------------------------------------ Password
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function decrypt(box, password) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(box.salt), iterations: box.iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  const box = await fetch('./access.enc.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  // 正しいパスワードが打たれるまでここで待つ
  const access = await new Promise((resolve) => {
    const form = $('login'), input = $('password'), msg = $('login-msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!box) { msg.textContent = 'NO DATA'; return; }
      msg.textContent = 'CHECKING...';
      try {
        resolve(await decrypt(box, input.value));
      } catch (_) {
        msg.textContent = 'ACCESS DENIED';
        input.value = '';
      }
    });
  });
  document.querySelector('.crt').classList.remove('locked');

  // ------------------------------------------------------------ Data
  const [world, centroids] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json').then((r) => r.json()).catch(() => null),
    fetch('./access-countries.json').then((r) => r.json()).catch(() => ({})),
  ]);

  const land = world ? topojson.feature(world, world.objects.land) : null;
  const borders = world ? topojson.mesh(world, world.objects.countries, (a, b) => a !== b) : null;
  const graticule = d3.geoGraticule10();

  const days = (access && Array.isArray(access.days)) ? access.days : [];
  let dayIndex = days.length - 1; // 最新の日
  let showAll = false;            // 30 日分の合計

  function currentCounts() {
    if (!days.length) return {};
    if (!showAll) return days[dayIndex].countries || {};
    const sum = {};
    days.forEach((d) => {
      Object.entries(d.countries || {}).forEach(([k, v]) => { sum[k] = (sum[k] || 0) + v; });
    });
    return sum;
  }

  let nodes = []; // { code, pos: [lng, lat], count }
  let maxCount = 1;

  function updateData() {
    const counts = currentCounts();
    nodes = Object.entries(counts)
      .filter(([code, n]) => n > 0 && centroids[code])
      .map(([code, n]) => ({ code, count: n, pos: [centroids[code][1], centroids[code][0]] }))
      .sort((a, b) => b.count - a.count);
    maxCount = Math.max(1, ...nodes.map((n) => n.count));
    renderHud(counts);
  }

  // ------------------------------------------------------------ HUD (文字の表示)
  const pad = (s, n) => String(s).padStart(n, ' ');

  function renderHud(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const rows = $('hud-rows');
    rows.textContent = '';

    if (!days.length) {
      $('hud-status').textContent = 'NO DATA: 集計はまだありません';
      $('hud-date').textContent = '----------';
      $('hud-total').textContent = 'TOTAL ----- PV';
      ['prev', 'next', 'all'].forEach((id) => { $(id).disabled = true; });
      return;
    }

    const first = days[0].date, last = days[days.length - 1].date;
    $('hud-status').textContent = 'LINK OK   ' + Object.keys(counts).length + ' COUNTRIES   UPDATED ' + (access.updated || '').slice(0, 10);
    $('hud-date').textContent = showAll ? first.slice(5) + '..' + last.slice(5) : days[dayIndex].date;
    $('hud-total').textContent = 'TOTAL ' + pad(total, 5) + ' PV';
    $('prev').disabled = showAll || dayIndex <= 0;
    $('next').disabled = showAll || dayIndex >= days.length - 1;
    $('all').setAttribute('aria-pressed', String(showAll));

    const list = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'zero';
      li.textContent = 'この日のアクセスはありません';
      rows.appendChild(li);
    }
    list.forEach(([code, n]) => {
      const li = document.createElement('li');
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.textContent = '█'.repeat(Math.max(1, Math.round((n / maxCount) * 12))).padEnd(12, ' ');
      li.append(code + ' ', bar, ' ' + pad(n, 5) + '  ' + regionName(code));
      rows.appendChild(li);
    });
  }

  $('prev').addEventListener('click', () => { if (dayIndex > 0) { dayIndex--; updateData(); } });
  $('next').addEventListener('click', () => { if (dayIndex < days.length - 1) { dayIndex++; updateData(); } });
  $('all').addEventListener('click', () => { showAll = !showAll; updateData(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') $('prev').click();
    else if (e.key === 'ArrowRight') $('next').click();
  });

  // ------------------------------------------------------------ Globe
  const projection = d3.geoOrthographic().clipAngle(90).precision(0.5);
  const path = d3.geoPath(projection, ctx);
  let rotation = [-HOME[0] + 40, -20];
  let width = 0, height = 0, radius = 0, cx = 0, cy = 0;

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const narrow = width <= 760;
    radius = Math.min(width, height) * (narrow ? 0.34 : 0.36);
    cx = narrow ? width / 2 : width * 0.44;
    cy = narrow ? height * 0.38 : height / 2;
    projection.scale(radius).translate([cx, cy]);
  }
  window.addEventListener('resize', resize);
  resize();

  // 地表から高さ h (半径比) の点を画面に写す。正射図法は線形なので中心からの距離を (1 + h) 倍するだけ
  function lift(pos, h) {
    const p = projection(pos);
    return [cx + (p[0] - cx) * (1 + h), cy + (p[1] - cy) * (1 + h)];
  }
  const visible = (pos) => d3.geoDistance(pos, [-rotation[0], -rotation[1]]) < Math.PI / 2 - 0.02;

  function stroke(alpha, width) {
    ctx.strokeStyle = 'rgba(' + GREEN + ',' + alpha + ')';
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function draw(t) {
    projection.rotate(rotation);
    ctx.clearRect(0, 0, width, height);
    ctx.shadowColor = 'rgba(' + GREEN + ',0.8)';
    ctx.shadowBlur = 6;

    ctx.beginPath(); path({ type: 'Sphere' }); stroke(0.9, 1.5);
    ctx.beginPath(); path(graticule); stroke(0.18, 1);
    if (land) { ctx.beginPath(); path(land); stroke(0.85, 1); }
    if (borders) { ctx.beginPath(); path(borders); stroke(0.35, 0.7); }

    // HOME (東京)
    if (visible(HOME)) {
      const [hx, hy] = projection(HOME);
      const blink = Math.floor(t / 500) % 2 === 0;
      ctx.fillStyle = 'rgba(' + GREEN + ',1)';
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
      if (blink) { ctx.beginPath(); ctx.rect(hx - 9, hy - 9, 18, 18); stroke(0.9, 1); }
      ctx.font = '16px VT323, monospace';
      ctx.fillText('HOME', hx + 12, hy - 8);
    }

    nodes.forEach((node, i) => {
      const k = Math.sqrt(node.count / maxCount);

      // HOME への弧 (ネットワーク)
      if (node.code !== 'JP') {
        const interp = d3.geoInterpolate(node.pos, HOME);
        const dist = d3.geoDistance(node.pos, HOME);
        ctx.beginPath();
        let pen = false;
        for (let s = 0; s <= 48; s++) {
          const u = s / 48, g = interp(u);
          if (!visible(g)) { pen = false; continue; }
          const [x, y] = lift(g, Math.sin(u * Math.PI) * dist * 0.12);
          if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          pen = true;
        }
        stroke(0.25 + 0.45 * k, 1);

        // 弧の上を流れる光
        const u = reduced ? 0.5 : ((t / 2400) + i * 0.137) % 1;
        const g = interp(u);
        if (visible(g)) {
          const [x, y] = lift(g, Math.sin(u * Math.PI) * dist * 0.12);
          ctx.fillStyle = 'rgba(' + GREEN + ',1)';
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
      }

      // アクセス数の棒 (地表から外へ伸びる)
      if (!visible(node.pos)) return;
      const base = projection(node.pos);
      const tip = lift(node.pos, 0.04 + 0.4 * k);
      ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(tip[0], tip[1]); stroke(1, 2);
      ctx.fillStyle = 'rgba(' + GREEN + ',1)';
      ctx.fillRect(tip[0] - 3, tip[1] - 3, 6, 6);
      ctx.font = '15px VT323, monospace';
      ctx.fillText(node.code + ' ' + node.count, tip[0] + 6, tip[1] - 4);
    });
  }

  // ドラッグで回す。触っていないときはゆっくり自転する
  let dragging = null;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, y: e.clientY, r: rotation.slice() };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const k = 0.25;
    rotation = [
      dragging.r[0] + (e.clientX - dragging.x) * k,
      Math.max(-80, Math.min(80, dragging.r[1] - (e.clientY - dragging.y) * k)),
    ];
  });
  const release = () => { dragging = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  updateData();
  await document.fonts.ready.catch(() => {});

  let last = performance.now();
  function frame(now) {
    if (!dragging && !reduced) rotation[0] += (now - last) * 0.006;
    last = now;
    draw(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

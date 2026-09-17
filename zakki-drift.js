/* 雑記: カテゴリのアイコンを画面の中でゆっくり漂わせる。
   へり (cat-field の四辺) に当たったら、そこから離れる向きをランダムに選び直す。 */
(function () {
  var field = document.getElementById('cat-field');
  if (!field) return;

  var tiles = Array.prototype.slice.call(field.querySelectorAll('.cat-tile'));
  if (!tiles.length) return;

  // 秒速 5cm より少しゆっくり。1cm ≒ 96/2.54 ≒ 37.8 CSS px。
  var PX_PER_CM = 96 / 2.54;
  var SPEED = 1.6 * PX_PER_CM; // ≒ 秒速 1.6cm

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  var items = tiles.map(function (el) {
    return { el: el, x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0 };
  });

  function setHeading(item, angle) {
    item.vx = Math.cos(angle) * SPEED;
    item.vy = Math.sin(angle) * SPEED;
  }

  // 壁の外向き法線 (nx, ny) から離れる向きをランダムに選ぶ
  function bounce(item, nx, ny) {
    var away = Math.atan2(-ny, -nx);
    setHeading(item, away + (Math.random() - 0.5) * (Math.PI * 0.7));
  }

  function measure() {
    var fw = field.clientWidth;
    var fh = field.clientHeight;
    items.forEach(function (item, i) {
      item.w = item.el.offsetWidth;
      item.h = item.el.offsetHeight;
      var maxX = Math.max(0, fw - item.w);
      var maxY = Math.max(0, fh - item.h);
      if (item.placed) {
        item.x = Math.min(item.x, maxX);
        item.y = Math.min(item.y, maxY);
      } else {
        // 初期位置は重ならないようにばらけさせる
        // (横に n 等分した帯の中でランダムに取り、先に置いたものと重なったら引き直す)
        var band = maxX / items.length;
        for (var tries = 0; tries < 60; tries++) {
          item.x = band * i + Math.random() * band;
          item.y = Math.random() * maxY;
          if (!items.slice(0, i).some(function (other) {
            return Math.abs(other.x - item.x) < (other.w + item.w) / 2 &&
                   Math.abs(other.y - item.y) < (other.h + item.h) / 2;
          })) break;
        }
        setHeading(item, Math.random() * Math.PI * 2);
        item.placed = true;
      }
      draw(item);
    });
    return { fw: fw, fh: fh };
  }

  function draw(item) {
    item.el.style.transform = 'translate(' + item.x.toFixed(2) + 'px,' + item.y.toFixed(2) + 'px)';
  }

  var last = 0;
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min((now - last) / 1000, 0.1); // タブ復帰時に飛ばない上限
    last = now;

    var fw = field.clientWidth;
    var fh = field.clientHeight;

    // 進んで、へりに当たったら向きを変える
    items.forEach(function (item) {
      item.x += item.vx * dt;
      item.y += item.vy * dt;

      var maxX = Math.max(0, fw - item.w);
      var maxY = Math.max(0, fh - item.h);

      if (item.x <= 0)         { item.x = 0;    bounce(item, -1, 0); }
      else if (item.x >= maxX) { item.x = maxX; bounce(item, 1, 0); }
      if (item.y <= 0)         { item.y = 0;    bounce(item, 0, -1); }
      else if (item.y >= maxY) { item.y = maxY; bounce(item, 0, 1); }
    });

    // アイコン同士が重なったら、離れる向きへ振り分ける
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var a = items[i], b = items[j];
        var dx = (b.x + b.w / 2) - (a.x + a.w / 2);
        var dy = (b.y + b.h / 2) - (a.y + a.h / 2);
        var ox = (a.w + b.w) / 2 - Math.abs(dx);
        var oy = (a.h + b.h) / 2 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;

        var angle = Math.atan2(dy, dx) || 0;
        setHeading(b, angle + (Math.random() - 0.5) * (Math.PI * 0.5));
        setHeading(a, angle + Math.PI + (Math.random() - 0.5) * (Math.PI * 0.5));

        if (ox < oy) {
          var sx = (dx >= 0 ? 1 : -1) * ox / 2;
          a.x -= sx; b.x += sx;
        } else {
          var sy = (dy >= 0 ? 1 : -1) * oy / 2;
          a.y -= sy; b.y += sy;
        }
      }
    }

    items.forEach(function (item) {
      item.x = Math.min(Math.max(item.x, 0), Math.max(0, fw - item.w));
      item.y = Math.min(Math.max(item.y, 0), Math.max(0, fh - item.h));
      draw(item);
    });

    raf = window.requestAnimationFrame(frame);
  }

  var raf = null;
  function start() {
    if (raf || reduced.matches) return;
    last = 0;
    raf = window.requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = null;
  }

  field.classList.add('cat-field--drifting');
  measure();
  start();

  window.addEventListener('resize', function () { measure(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  if (reduced.addEventListener) {
    reduced.addEventListener('change', function () { reduced.matches ? stop() : start(); });
  }

  // カーソルを載せているあいだは止めて、クリックしやすくする
  tiles.forEach(function (el) {
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', start);
    el.addEventListener('focus', stop);
    el.addEventListener('blur', start);
  });
})();

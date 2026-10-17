/* タスクバーの時計と、スタートボタンを押したときの「再起動」の演出。 */
(function () {
  var clock = document.getElementById('clock');
  if (clock) {
    var tick = function () {
      var d = new Date();
      clock.textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    tick();
    setInterval(tick, 10000);
  }

  var start = document.querySelector('.start-button');
  if (!start) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var busy = false;

  // 画面が一瞬消えて、黒い起動画面 (進み具合のバー) が出て、元の画面に戻る
  start.addEventListener('click', function () {
    if (busy) return;
    busy = true;

    var screen = document.createElement('div');
    screen.className = 'reboot' + (reduced.matches ? ' reboot--calm' : '');
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML =
      '<div class="reboot-crt"></div>' +
      '<div class="reboot-boot"><div class="reboot-bar"><span></span></div></div>' +
      '<div class="reboot-flash"></div>';
    document.body.appendChild(screen);

    screen.addEventListener('animationend', function (e) {
      if (e.target !== screen) return;
      screen.remove();
      busy = false;
    });
  });
})();

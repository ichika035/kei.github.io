/* タスクバーの時計と、スタートボタン (アクセスの地球儀へ移る)。 */
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

  // 画面がブラウン管のように消えてから、アクセスの地球儀 (access.html) へ移る
  var target = new URL('access.html', document.currentScript.src).href;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  start.addEventListener('click', function () {
    if (reduced.matches) { location.href = target; return; }
    var screen = document.createElement('div');
    screen.className = 'reboot';
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML = '<div class="reboot-crt"></div>';
    document.body.appendChild(screen);
    setTimeout(function () { location.href = target; }, 500);
  });

  // 戻るボタンで戻ってきたときに黒い画面が残らないようにする
  window.addEventListener('pageshow', function () {
    var left = document.querySelector('.reboot');
    if (left) left.remove();
  });
})();

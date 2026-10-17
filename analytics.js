/* Google Analytics (GA4)。GA_ID に測定 ID (G-XXXXXXXXXX) を入れると計測を始める。
   空のあいだと、手元 (localhost) で開いているときは何もしない。 */
(function () {
  var GA_ID = '';
  if (!GA_ID || location.hostname === 'localhost' || location.protocol === 'file:') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
})();

/* BIOS のセットアップ画面の枠を組み立てる (見た目は style-bios.css)。
   上にタイトルとメニュー (ヘッダーのナビ)、真ん中に本文と「Item Specific Help」、下にキーの案内。
   ナビにページ内の節があるページでは、節をタブのように 1 つずつ出す。
   本文の節より後、ほかのスクリプト (news.js, radar.js など) より前に読み込む。 */
(function () {
  var body = document.body;
  var header = document.querySelector('.site-header');
  var nav = header && header.querySelector('.nav');
  var sections = Array.prototype.slice.call(document.querySelectorAll('body > .section'));
  if (!nav || !sections.length) return;

  var ja = (document.documentElement.lang || '').indexOf('ja') === 0;
  var here = document.currentScript.src;

  function pad(n) { return String(n).padStart(2, '0'); }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  // ------------------------------------------------ 枠
  var title = document.createElement('div');
  title.className = 'bios-title';
  title.textContent = 'KEI ICHIKAWA SETUP UTILITY';
  body.insertBefore(title, header);

  // スタートボタンの代わりに、メニューの最後からアクセスの地球儀へ
  var globe = document.createElement('a');
  globe.href = new URL('access.html', here).href;
  globe.textContent = 'Access';
  nav.appendChild(globe);

  // 右端に EN / JP の切り替え。英語のページは index.html だけなので、日本語は jp.html と行き来する
  var langs = document.createElement('div');
  langs.className = 'bios-lang';
  langs.innerHTML = '<a href="' + new URL('index.html', here).href + '" lang="en">EN</a>' +
                    '<a href="' + new URL('jp.html', here).href + '" lang="ja">JP</a>';
  langs.children[ja ? 1 : 0].classList.add('is-on');
  langs.addEventListener('click', function (e) {
    // 開いているタブ (#papers など) はそのまま、もう一方の言語でも開く
    var a = e.target.closest('a');
    if (a && location.hash) a.href = a.href.split('#')[0] + location.hash;
  });
  header.querySelector('.row').appendChild(langs);

  var frame = document.createElement('main');
  frame.className = 'bios-frame';
  var main = document.createElement('div');
  main.className = 'bios-main';
  var aside = document.createElement('aside');
  aside.className = 'bios-help';
  aside.innerHTML = '<div class="bios-help-title">Item Specific Help</div><div class="bios-help-body" aria-live="polite"></div>';
  var help = aside.lastChild;
  body.insertBefore(frame, sections[0]);
  sections.forEach(function (s) { main.appendChild(s); });
  frame.appendChild(main);
  frame.appendChild(aside);

  // ------------------------------------------------ タブ
  // 研究テーマ・研究手法は、最初のタブ (今いるページのリンク) の紹介文の下に短くまとめる (下の「研究の要約」)。
  // ナビに無いほかの節 (Current Positions など) は、見出しの名前でタブを足す。
  var sectionLinks = Array.prototype.slice.call(nav.querySelectorAll('.nav-section'));
  var tabbed = sectionLinks.length > 0;
  var tabs = [];
  var current = null;

  if (tabbed) {
    body.classList.add('bios-tabbed');
    var home = header.querySelector('a[aria-current="page"]') || header.querySelector('.brand');
    var linkFor = {};
    sectionLinks.forEach(function (a) { linkFor[a.hash.slice(1)] = a; });

    var last = null;
    var keywordSections = [];
    sections.forEach(function (s, i) {
      if (s.classList.contains('section--hero')) {
        last = { link: home, sections: [s] };
        tabs.push(last);
        return;
      }
      if (s.querySelector('.keywords')) {
        s.hidden = true;
        keywordSections.push(s);
        return;
      }
      var link = s.id && linkFor[s.id];
      if (!link) {
        if (last && last.link === home) { last.sections.push(s); return; }
        var h = s.querySelector('.headline');
        if (!h) { if (last) last.sections.push(s); return; }
        if (!s.id) s.id = 'section-' + i;
        link = document.createElement('a');
        link.href = '#' + s.id;
        link.className = 'nav-section';
        link.textContent = h.textContent.trim();
        last.link.after(link);
      }
      last = { link: link, sections: [s] };
      tabs.push(last);
    });

    tabs.forEach(function (t) {
      t.link.addEventListener('click', function (e) {
        e.preventDefault();
        select(t);
      });
    });
    window.addEventListener('hashchange', function () { select(tabFor(location.hash) || tabs[0]); });
    // 本文の中の #news などへのリンクも、タブの切り替えにする
    main.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      var t = a && tabFor(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      select(t);
    });
  } else {
    current = { sections: sections };
  }

  function tabFor(hash) {
    var id = hash.slice(1);
    return id && tabs.filter(function (t) {
      return t.sections.some(function (s) { return s.id === id; });
    })[0];
  }

  function select(t, focus) {
    tabs.forEach(function (x) {
      var on = x === t;
      x.sections.forEach(function (s) { s.hidden = !on; });
      x.link.classList.toggle('is-selected', on);
    });
    current = t;
    showHelp(null);
    if (focus) t.link.focus();
    t.link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    var hash = t.link.hash && t.link.getAttribute('href').charAt(0) === '#' ? t.link.hash : '';
    try { history.replaceState(null, '', location.pathname + location.search + hash); } catch (err) {}
    // 隠れていた地図 (Leaflet) などに大きさを測り直させる
    window.dispatchEvent(new Event('resize'));
  }

  // ------------------------------------------------ 行とヘルプ欄
  var ROWS = '.item, .news-item, .bios-link-row';

  function showHelp(el) {
    var html;
    if (!el) {
      var text = tabbed ? 'Select an item with ↑↓ to see its details here.' : 'Select an item to see its details here.';
      html = '<p>' + escapeHtml(text) + '</p>';
    } else if (el.newsSource || el.classList.contains('item')) {
      // 著者 → タイトル → (リンクがあれば) Enter の案内 → 掲載先 → アブストラクト。
      // お知らせの行は、元になった論文・発表の行の中身を出す
      var src = el.newsSource || el;
      html = ['.item-authors', '.item-title', 'key', '.item-venue', '.item-abstract'].map(function (sel) {
        if (sel === 'key') return linkKey(el);
        var n = src.querySelector(sel);
        return n ? '<p class="' + sel.slice(1) + '">' + n.innerHTML + '</p>' : '';
      }).join('');
    } else if (el.classList.contains('news-item')) {
      html = '<p>' + el.querySelector('.news-text').innerHTML + '</p>';
    } else {
      html = '<p>' + escapeHtml(ja ? 'お知らせの一覧を開きます。' : 'Open the list of all news.') + '</p>';
    }
    if (el && !el.newsSource && !el.classList.contains('item')) html += linkKey(el);
    help.innerHTML = html;
  }

  function linkKey(el) {
    return el.querySelector('a[href]')
      ? '<p class="bios-help-key">&lt;Enter&gt; ' + (ja ? 'リンクを開く' : 'Open link') + '</p>'
      : '';
  }

  function wireRows() {
    main.querySelectorAll(ROWS).forEach(function (el) {
      if (el.classList.contains('bios-row')) return;
      el.classList.add('bios-row');
      el.tabIndex = 0;
      el.addEventListener('focus', function () { showHelp(el); });
      el.addEventListener('mouseenter', function () { el.focus({ preventScroll: true }); });
      el.addEventListener('click', function (e) {
        var a = el.querySelector('a[href]');
        if (a && !e.target.closest('a')) a.click();
      });
    });
  }
  wireRows();
  // お知らせは news.js が後から入れるので、そのあとにもう一度
  document.addEventListener('DOMContentLoaded', function () { setTimeout(wireRows, 0); });

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector('.bios-post')) return;
    if (e.target.closest && e.target.closest('input, textarea, select, .leaflet-container')) return;
    var row = e.target.closest && e.target.closest('.bios-row');

    if (e.key === 'Enter' && row && e.target === row) {
      var a = row.querySelector('a[href]');
      if (a) a.click();
    } else if (tabbed && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var i = tabs.indexOf(current);
      select(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
    } else if (tabbed && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      var rows = [];
      current.sections.forEach(function (s) {
        rows = rows.concat(Array.prototype.slice.call(s.querySelectorAll('.bios-row')));
      });
      if (!rows.length) return;
      var at = rows.indexOf(row);
      var next = at < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)));
      rows[next].focus();
    } else {
      return;
    }
    e.preventDefault();
  });

  // ------------------------------------------------ 日付と時刻
  var heroBlock = document.querySelector('.section--hero .hero-block');
  if (heroBlock) {
    var sys = document.createElement('div');
    sys.className = 'bios-sys';
    sys.innerHTML = '<p><span>System Date</span><span class="bios-val"></span></p>' +
                    '<p><span>System Time</span><span class="bios-val"></span></p>';
    heroBlock.parentNode.appendChild(sys);
    var vals = sys.querySelectorAll('.bios-val');
    var tick = function () {
      var d = new Date();
      vals[0].textContent = d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
      vals[1].textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    };
    tick();
    setInterval(tick, 1000);
  }

  // ------------------------------------------------ 研究の要約 (紹介文の下に、研究テーマ・研究手法を 1 行ずつ)
  if (tabbed && keywordSections.length) {
    var summary = document.createElement('div');
    summary.className = 'bios-summary';
    summary.innerHTML = keywordSections.map(function (s) {
      var items = Array.prototype.map.call(s.querySelectorAll('.keywords li'), function (li) {
        return '<span class="bios-val">' + escapeHtml(li.textContent.trim()) + '</span>';
      }).join(' ');
      return '<p><span>' + escapeHtml(s.querySelector('.headline').textContent.trim()) + '</span><span>' + items + '</span></p>';
    }).join('');
    var block = document.querySelector('.section--hero .hero-block');
    if (block) block.after(summary);
  }

  // ------------------------------------------------ 最近のお知らせ (最初のタブの下に 3 件)
  // お知らせのあるページ (index.html, jp.html) だけ
  if (tabbed && tabFor('#news')) {
    var recent = document.createElement('div');
    recent.className = 'bios-recent';
    recent.innerHTML = '<h2 class="headline">' + (ja ? '最近のお知らせ' : 'Recent News') + '</h2><ul class="items"></ul>';
    document.querySelector('.section--hero').appendChild(recent);
    var recentList = recent.lastChild;

    var showRecent = function (entries) {
      recentList.innerHTML = entries.slice(0, 3).map(function (e) {
        var d = isFinite(e.when) ? new Date(e.when) : null;
        var date = d ? d.getUTCFullYear() + '/' + pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()) : '';
        return '<li class="item"><div class="item-meta"><p>' + date + '</p></div>' +
               '<div class="item-body"><a href="#news"><h3 class="item-title">' +
               escapeHtml(e.label + ': ' + e.title) + '</h3></a></div></li>';
      }).join('') +
      '<li class="bios-link-row"><a href="#news">' + (ja ? 'お知らせの一覧' : 'All News') + '</a></li>';
      entries.slice(0, 3).forEach(function (e, i) { recentList.children[i].newsSource = e.item; });
      wireRows();
    };
    // news.js は後から読み込まれるので、ページが読み終わってから
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { showRecent(window.newsEntries ? window.newsEntries(document) : []); }, 0);
    });
  }

  // ------------------------------------------------ キーの案内
  var footerInner = document.querySelector('.footer-inner');
  if (footerInner) {
    var keys = document.createElement('div');
    keys.className = 'bios-keys';
    keys.innerHTML = tabbed
      ? '<span><kbd>←→</kbd> Select Menu</span><span><kbd>↑↓</kbd> Select Item</span><span><kbd>Enter</kbd> Open</span>'
      : '<span><kbd>Tab</kbd> Select Item</span><span><kbd>Enter</kbd> Open</span>';
    footerInner.insertBefore(keys, footerInner.firstChild);
  }

  if (tabbed) {
    select(tabFor(location.hash) || tabs[0]);
    // 節はタブで出すので、#papers などで開いてもページの先頭から見せる
    if (location.hash) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.addEventListener('load', function () { setTimeout(function () { window.scrollTo(0, 0); }, 0); });
    }
  } else {
    showHelp(null);
  }

  // ------------------------------------------------ 起動画面 (このタブで最初の 1 回だけ)
  var seen = false;
  try { seen = sessionStorage.getItem('bios-posted') === '1'; } catch (err) {}
  if (seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var post = document.createElement('div');
  post.className = 'bios-post';
  post.setAttribute('aria-hidden', 'true');
  post.innerHTML = '<div></div><div class="bios-post-skip">Press any key to skip</div>';
  body.appendChild(post);
  var screen = post.firstChild;
  var timers = [];
  var lines = [
    '<span class="hi">KEI BIOS v2.26</span>  Copyright (C) 1998-' + new Date().getFullYear() + ', Kei Ichikawa',
    'Institute of Science Tokyo / Sasahara Lab',
    '',
    'Main Processor  : Computational Social Science',
    'Memory Testing  : <span class="mem">0K</span>',
    '',
    'Detecting Primary Master   ... <span class="ok">Dis/Misinformation</span>',
    'Detecting Primary Slave    ... <span class="ok">Deepfakes</span>',
    'Detecting Secondary Master ... <span class="ok">Internet Memes</span>',
    'Detecting Secondary Slave  ... <span class="ok">Polarization</span>',
    '',
    'Press <span class="hi">DEL</span> to enter SETUP'
  ];

  function done() {
    timers.forEach(clearTimeout);
    post.remove();
    try { sessionStorage.setItem('bios-posted', '1'); } catch (err) {}
    document.removeEventListener('keydown', skip, true);
  }
  function skip(e) { e.preventDefault(); e.stopPropagation(); done(); }

  lines.forEach(function (line, k) {
    timers.push(setTimeout(function () {
      screen.insertAdjacentHTML('beforeend', line + '\n');
      var mem = screen.querySelector('.mem:not(.counting)');
      if (!mem) return;
      mem.classList.add('counting');
      var v = 0;
      var count = setInterval(function () {
        v = Math.min(65536, v + 4096);
        mem.textContent = v + (v === 65536 ? 'K OK' : 'K');
        if (v === 65536 || !post.isConnected) clearInterval(count);
      }, 30);
    }, 120 + k * 140));
  });
  timers.push(setTimeout(done, 120 + lines.length * 140 + 700));
  post.addEventListener('click', done);
  document.addEventListener('keydown', skip, true);
})();

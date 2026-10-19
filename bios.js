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
  // ターミナル風の見た目 (style-bios.css の .bios-term)。この行を消すと BIOS 風に戻る
  body.classList.add('bios-term');
  var term = body.classList.contains('bios-term');

  var title = document.createElement('div');
  title.className = 'bios-title';
  // ターミナル風では、ウィンドウのタイトルを今いるページの場所にする (kei@isct: ~/zakki/cat-media など)
  var page = location.href.split('#')[0].replace(new URL('.', here).href, '').replace(/\.html$/, '').replace(/^index$/, '');
  title.textContent = term ? 'kei@isct: ~' + (page ? '/' + page : '') : 'KEI ICHIKAWA SETUP UTILITY';
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
    if (started) arrive(t);
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

  // ------------------------------------------------ コマンド (ターミナル風のときだけ)
  // 本文の最後のプロンプトにコマンドを打てる。ブラウザや PC についての情報は出さない
  if (term) {
    var shell = document.createElement('div');
    shell.className = 'bios-shell';
    shell.innerHTML = '<div class="bios-out" aria-live="polite"></div>' +
      '<label class="bios-prompt"><span>kei@isct:~$&nbsp;</span>' +
      '<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command (type help)"></label>';
    main.appendChild(shell);
    var out = shell.firstChild;
    var input = shell.querySelector('input');
    var history_ = [];
    var back = 0;
    var opened = Date.now();

    var print = function (text, cls) {
      var line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = text;
      out.appendChild(line);
      return line;
    };
    var printLink = function (label, href) {
      var line = print('');
      var a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
      line.appendChild(a);
    };

    // 行き先: メニューのリンクの名前・ファイル名・節の id のどれでも cd できる
    var dests = [];
    var addDest = function (link, extra) {
      var names = [link.textContent.trim()].concat(extra || []);
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) === '#') names.push(href.slice(1));
      else names.push(href.split('/').pop().replace(/\.html.*$/, ''));
      dests.push({ link: link, label: link.textContent.trim(), names: names.map(function (n) { return n.toLowerCase(); }) });
    };
    addDest(header.querySelector('.brand'), ['~', 'home']);
    nav.querySelectorAll('a').forEach(function (a) { if (!a.hidden) addDest(a); });
    langs.querySelectorAll('a').forEach(function (a) { addDest(a, [a.lang === 'ja' ? 'ja' : 'english']); });

    // サイト全体の行き先 (今のページのメニューに無いもの)。英語のページが無いものは日本語のページへ
    var SITE = [
      { names: ['~', 'home', 'kei ichikawa', '市川慧'], en: 'index.html', ja: 'jp.html' },
      { names: ['news', 'お知らせ'], en: 'index.html#news', ja: 'jp.html#news' },
      { names: ['papers', 'publications', '学術論文'], en: 'index.html#papers', ja: 'jp.html#papers' },
      { names: ['working papers', 'working-papers', 'preprints', 'プレプリント'], en: 'index.html#working-papers', ja: 'jp.html#working-papers' },
      { names: ['conferences & talks', 'talks', 'conferences', '会議発表', '国際・国内会議'], en: 'index.html#talks', ja: 'jp.html#talks' },
      { names: ['awards', '受賞'], en: 'index.html#awards', ja: 'jp.html#awards' },
      { names: ['service', 'academic service', '教育・学術組織への貢献'], en: 'index.html#service', ja: 'jp.html#service' },
      { names: ['current positions', 'positions'], en: 'index.html#positions' },
      { names: ['press', 'プレス'], ja: 'jp.html#press' },
      { names: ['contact', 'お問い合わせ'], en: 'index.html#contact', ja: 'jp.html#contact' },
      { names: ["how's the weather?", 'weather', '今日の天気は?', 'works'], ja: 'works.html' },
      { names: ['作ったもの'], ja: 'works.html#works' },
      { names: ['イベント', 'events'], ja: 'works.html#events' },
      { names: ['書いたもの', 'writings'], ja: 'works.html#writings' },
      { names: ['notes', '雑記', 'zakki'], ja: 'zakki.html' },
      { names: ['access', 'access globe'], en: 'access.html' },
      { names: ['en', 'english'], en: 'index.html' },
      { names: ['jp', 'ja'], ja: 'jp.html' }
    ];

    var info = ja
      ? ['市川慧', '東京科学大学 環境・社会理工学院']
      : ['Kei Ichikawa', 'PhD candidate, Institute of Science Tokyo (Former Tokyo Institute of Technology)', 'Supervisor: Prof. Kazutoshi Sasahara'];
    var mail = 'ichikawa.k.25a5[at]m.isct.ac.jp';

    var commands = {
      help: function () {
        [
          'ls              list places you can cd to',
          'cd <place>      move (e.g. cd papers, cd ~, cd ..)',
          'df, info        name and affiliation',
          'whoami          same as info',
          'pwd             where you are',
          'mail            how to contact me',
          'cv              open the CV',
          'date            current date and time',
          'uptime          how long this page has been open',
          'history         commands you typed',
          'echo <text>     print text',
          'lang [en|jp]    switch the language',
          'clear           clear the screen',
          'reboot          restart from the boot screen',
          'sl              ...'
        ].forEach(function (l) { print(l); });
      },
      ls: function () {
        print(dests.map(function (d) { return d.label + (d.link.closest('.bios-lang') ? '' : '/'); }).join('   '));
      },
      cd: function (arg) {
        var name = (arg || '~').toLowerCase().replace(/？/g, '?').replace(/\s+/g, ' ').replace(/\/+$/, '');
        if (name === '..') {
          var up = main.querySelector('.back-link');
          if (up) { location.href = up.href; return; }
          name = '~';
        }
        if (name === '.' || name === '') return;
        var d = dests.filter(function (x) { return x.names.indexOf(name) >= 0; })[0];
        if (!d) {
          var site = SITE.filter(function (x) { return x.names.indexOf(name) >= 0; })[0];
          var to = site && (ja ? site.ja || site.en : site.en || site.ja);
          if (!to) { print('cd: no such directory: ' + arg); return; }
          location.href = new URL(to, here).href;
          return;
        }
        d.link.click();
      },
      df: function () {
        print('Filesystem   Name           Affiliation');
        print('/dev/kei     ' + info[0] + '   ' + info.slice(1).join(' / '));
      },
      info: function () { info.forEach(function (l) { print(l); }); },
      whoami: function () { commands.info(); },
      pwd: function () { print('~' + (page ? '/' + page : '')); },
      mail: function () { print(mail); },
      cv: function () { printLink('cv.pdf', new URL('cv/cv.pdf', here).href); },
      date: function () { print(new Date().toString().replace(/ \(.*\)$/, '')); },
      uptime: function () {
        var sec = Math.round((Date.now() - opened) / 1000);
        print('up ' + Math.floor(sec / 60) + ' min ' + (sec % 60) + ' sec');
      },
      history: function () { history_.forEach(function (c, i) { print(String(i + 1).padStart(4) + '  ' + c); }); },
      echo: function (arg) { print(arg || ''); },
      clear: function () { out.textContent = ''; },
      lang: function (arg) {
        var to = (arg || '').toLowerCase();
        if (!to) { print(ja ? 'jp' : 'en'); return; }
        var a = langs.querySelector(to === 'en' ? '[lang="en"]' : (to === 'jp' || to === 'ja') ? '[lang="ja"]' : 'x');
        if (!a) { print('lang: unknown language: ' + arg + ' (en, jp)'); return; }
        a.click();
      },
      reboot: function () {
        // 起動画面をもう一度出してから開き直す
        print('Rebooting...');
        try { sessionStorage.removeItem('bios-posted'); } catch (err) {}
        setTimeout(function () { location.reload(); }, 400);
      },
      sl: function () { sl(); }
    };

    // sl: 豊田正史さんの sl コマンド (https://github.com/mtoyoda/sl) の D51 を、そのままの絵と動きで走らせる。
    //   Copyright 1993,1998,2014 Toyoda Masashi (mtoyoda@acm.org)
    //   Everyone is permitted to do anything on this program including copying,
    //   modifying, and improving, unless you try to pretend that you wrote it.
    //   i.e., the above copyright notice has to appear in all copies.
    //   THE AUTHOR DISCLAIMS ANY RESPONSIBILITY WITH REGARD TO THIS SOFTWARE.
    var D51 = [
          ["      ====        ________                ___________ ", "  _D _|  |_______/        \\__I_I_____===__|_________| ", "   |(_)---  |   H\\________/ |   |        =|___ ___|   ", "   /     |  |   H  |  |     |   |         ||_| |_||   ", "  |      |  |   H  |__--------------------| [___] |   ", "  | ________|___H__/__|_____/[][]~\\_______|       |   ", "  |/ |   |-----------I_____I [][] []  D   |=======|__ ", "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ", " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ", "  \\_/      \\O=====O=====O=====O_/      \\_/            ", "                                                      "],
          ["      ====        ________                ___________ ", "  _D _|  |_______/        \\__I_I_____===__|_________| ", "   |(_)---  |   H\\________/ |   |        =|___ ___|   ", "   /     |  |   H  |  |     |   |         ||_| |_||   ", "  |      |  |   H  |__--------------------| [___] |   ", "  | ________|___H__/__|_____/[][]~\\_______|       |   ", "  |/ |   |-----------I_____I [][] []  D   |=======|__ ", "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ", " |/-=|___|=O=====O=====O=====O   |_____/~\\___/        ", "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ", "                                                      "],
          ["      ====        ________                ___________ ", "  _D _|  |_______/        \\__I_I_____===__|_________| ", "   |(_)---  |   H\\________/ |   |        =|___ ___|   ", "   /     |  |   H  |  |     |   |         ||_| |_||   ", "  |      |  |   H  |__--------------------| [___] |   ", "  | ________|___H__/__|_____/[][]~\\_______|       |   ", "  |/ |   |-----------I_____I [][] []  D   |=======|__ ", "__/ =| o |=-O=====O=====O=====O \\ ____Y___________|__ ", " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ", "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ", "                                                      "],
          ["      ====        ________                ___________ ", "  _D _|  |_______/        \\__I_I_____===__|_________| ", "   |(_)---  |   H\\________/ |   |        =|___ ___|   ", "   /     |  |   H  |  |     |   |         ||_| |_||   ", "  |      |  |   H  |__--------------------| [___] |   ", "  | ________|___H__/__|_____/[][]~\\_______|       |   ", "  |/ |   |-----------I_____I [][] []  D   |=======|__ ", "__/ =| o |=-~O=====O=====O=====O\\ ____Y___________|__ ", " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ", "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ", "                                                      "],
          ["      ====        ________                ___________ ", "  _D _|  |_______/        \\__I_I_____===__|_________| ", "   |(_)---  |   H\\________/ |   |        =|___ ___|   ", "   /     |  |   H  |  |     |   |         ||_| |_||   ", "  |      |  |   H  |__--------------------| [___] |   ", "  | ________|___H__/__|_____/[][]~\\_______|       |   ", "  |/ |   |-----------I_____I [][] []  D   |=======|__ ", "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ", " |/-=|___|=   O=====O=====O=====O|_____/~\\___/        ", "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ", "                                                      "],
          ["      ====        ________                ___________ ", "  _D _|  |_______/        \\__I_I_____===__|_________| ", "   |(_)---  |   H\\________/ |   |        =|___ ___|   ", "   /     |  |   H  |  |     |   |         ||_| |_||   ", "  |      |  |   H  |__--------------------| [___] |   ", "  | ________|___H__/__|_____/[][]~\\_______|       |   ", "  |/ |   |-----------I_____I [][] []  D   |=======|__ ", "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ", " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ", "  \\_/      \\_O=====O=====O=====O/      \\_/            ", "                                                      "]
        ];
    var COAL = [
          "                              ",
          "                              ",
          "    _________________         ",
          "   _|                \\_____A  ",
          " =|                        |  ",
          " -|                        |  ",
          "__|________________________|_ ",
          "|__________________________|_ ",
          "   |_D__D__D_|  |_D__D__D_|   ",
          "    \\_/   \\_/    \\_/   \\_/    ",
          "                              "
        ];
    var SMOKE = [["(   )", "(    )", "(    )", "(   )", "(  )", "(  )", "( )", "( )", "()", "()", "O", "O", "O", "O", "O", " "], ["(@@@)", "(@@@@)", "(@@@@)", "(@@@)", "(@@)", "(@@)", "(@)", "(@)", "@@", "@@", "@", "@", "@", "@", "@", " "]];
    var SMOKE_DY = [2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var SMOKE_DX = [-2, -1, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3];

    var sl = function () {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var screen = document.createElement('pre');
      screen.className = 'bios-sl';
      screen.setAttribute('aria-hidden', 'true');
      screen.textContent = 'M';
      body.appendChild(screen);
      // 画面全体を端末とみなして、文字の大きさから行数・桁数を出す
      var probe = screen.getBoundingClientRect();
      var cw = probe.width, lh = probe.height;
      screen.classList.add('is-running');
      var COLS = Math.max(20, Math.floor(window.innerWidth / cw));
      var LINES = Math.max(14, Math.floor(window.innerHeight / lh));
      var grid = [];
      for (var r = 0; r < LINES; r++) grid.push(new Array(COLS).fill(' '));
      var put = function (y, x, str) {
        if (y < 0 || y >= LINES) return;
        for (var k = 0; k < str.length; k++) {
          var c = x + k;
          if (c >= 0 && c < COLS) grid[y][c] = str.charAt(k);
        }
      };
      var smokes = [];
      var y = Math.floor(LINES / 2) - 5;
      var x = COLS - 1;
      var tick = setInterval(function () {
        if (x < -83) {
          clearInterval(tick);
          screen.remove();
          input.focus();
          return;
        }
        var pattern = D51[((83 + x) % 6 + 6) % 6];
        for (var i = 0; i <= 10; i++) {
          put(y + i, x, pattern[i]);
          put(y + i, x + 53, COAL[i]);
        }
        if (x % 4 === 0) {
          smokes.forEach(function (sm) {
            put(sm.y, sm.x, ' '.repeat(SMOKE[sm.kind][sm.ptrn].length));
            sm.y -= SMOKE_DY[sm.ptrn];
            sm.x += SMOKE_DX[sm.ptrn];
            if (sm.ptrn < 15) sm.ptrn++;
            put(sm.y, sm.x, SMOKE[sm.kind][sm.ptrn]);
          });
          put(y - 1, x + 7, SMOKE[smokes.length % 2][0]);
          smokes.push({ y: y - 1, x: x + 7, ptrn: 0, kind: smokes.length % 2 });
        }
        screen.textContent = grid.map(function (row) { return row.join(''); }).join('\n');
        x--;
      }, 40);
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var line = input.value.trim();
        input.value = '';
        back = 0;
        print('kei@isct:~$ ' + line, 'bios-echo');
        if (!line) return;
        history_.push(line);
        var parts = line.split(/\s+/);
        var cmd = commands.hasOwnProperty(parts[0].toLowerCase()) ? commands[parts[0].toLowerCase()] : null;
        if (cmd) cmd(line.slice(parts[0].length).trim());
        else print(parts[0] + ': command not found (type help)');
        input.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // 打ったコマンドをさかのぼる
        e.preventDefault();
        back = Math.max(0, Math.min(history_.length, back + (e.key === 'ArrowUp' ? 1 : -1)));
        input.value = back ? history_[history_.length - back] : '';
      }
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
    tabs.forEach(function (t) { t.name = t.link.textContent.trim(); });
    select(tabFor(location.hash) || tabs[0]);
    // 節はタブで出すので、#papers などで開いてもページの先頭から見せる
    if (location.hash) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.addEventListener('load', function () { setTimeout(function () { window.scrollTo(0, 0); }, 0); });
    }
  } else {
    showHelp(null);
    var here_ = header.querySelector('a[aria-current="page"]');
    var h1 = main.querySelector('h1');
    current.name = here_ ? here_.textContent.trim() : h1 ? h1.textContent.trim().replace(/\s+/g, ' ') : page;
  }
  // 最初の画面の cd は、お知らせ (news.js) が入ってから
  var started = false;
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () { started = true; pending = current; intro(); }, 0);
  });

  // ------------------------------------------------ cd の行 (ターミナル風のときだけ)
  // タブ (節のないページではページ全体) のいちばん上に「kei@isct:~$ cd Papers」の行を置く。
  // はじめてこのサイトに来て Home を開いたときだけ、その行をひと文字ずつ打ってから中身を上から 1 行ずつ出す。
  // それ以外は、はじめから全部出す
  var BLOCKS = '.item, .news-item, .bios-link-row, .bios-summary p, .bios-sys p, p, li, figure, h1, h2, h3, h4, ' +
               '.hero-portrait, .social, .weather-frame, .cat-field, .media-image, .media-video, .essay-source';
  var playing = null;
  var pending = null;

  function arrive(t) {
    if (!term) return;
    if (document.querySelector('.bios-post')) { pending = t; return; }
    if (playing) playing();

    var line = t.cdLine;
    if (!line) {
      line = t.cdLine = document.createElement('p');
      line.className = 'bios-echo bios-cd';
      line.innerHTML = 'kei@isct:~$ <span></span>';
      var first = t.sections[0];
      if (t.link) first.insertBefore(line, first.firstChild);
      else first.parentNode.insertBefore(line, first);
    }
    var typed = line.lastChild;
    var text = 'cd ' + t.name;

    var animate = false;
    try {
      animate = t === tabs[0] && localStorage.getItem('bios-site-visited') !== '1';
      localStorage.setItem('bios-site-visited', '1');
    } catch (err) {}
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) animate = false;
    if (!animate) { typed.textContent = text; return; }

    // 中身をいったん隠して、上から順に出す (入れ子は外側だけ)
    var blocks = [];
    t.sections.forEach(function (s) {
      s.querySelectorAll(BLOCKS).forEach(function (el) {
        if (el === line || el.closest('.bios-pending')) return;
        el.classList.add('bios-pending');
        blocks.push(el);
      });
    });
    var timers = [];
    var n = 0;
    typed.textContent = '';
    var step = Math.max(15, Math.min(60, 1800 / Math.max(1, blocks.length)));
    var delay = 200;
    var typing = setInterval(function () {
      typed.textContent = text.slice(0, ++n);
      if (n < text.length) return;
      clearInterval(typing);
      blocks.forEach(function (el, k) {
        timers.push(setTimeout(function () { el.classList.remove('bios-pending'); }, delay + k * step));
      });
      timers.push(setTimeout(function () { playing = null; }, delay + blocks.length * step));
    }, 70);
    // ほかのタブに移ったら、残りはすぐに全部出す
    playing = function () {
      clearInterval(typing);
      timers.forEach(clearTimeout);
      typed.textContent = text;
      blocks.forEach(function (el) { el.classList.remove('bios-pending'); });
      playing = null;
    };
  }

  // 起動画面が終わってから (起動画面が無ければ、お知らせなどが入ってから) 最初の画面に cd する
  function intro() {
    if (pending) { var t = pending; pending = null; arrive(t); }
  }

  // ------------------------------------------------ 起動画面 (このタブで最初の 1 回だけ)
  var seen = false;
  try { seen = sessionStorage.getItem('bios-posted') === '1'; } catch (err) {}
  if (seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { intro(); return; }

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
    intro();
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

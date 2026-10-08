/* news.js
 * Populates the #news-list block by scanning the Papers (#papers-list),
 * Working Papers / プレプリント (#preprints-list) and Talks (#talks-list)
 * sections, merging them into a single list
 * sorted newest-first, and rendering every entry. The container itself
 * is capped (via CSS) so only ~2 entries are visible at once and the
 * rest is reachable by scrolling.
 *
 *   - Paper: items whose item-meta[2] matches /journal|accepted/i are rendered
 *     as an acceptance, and /preprint/i as a preprint posting. Anything else is
 *     skipped. Text rendered as:
 *       JP: 論文 「タイトル」 が <venue> にアクセプトされました.
 *       EN: Our paper "title" was accepted at <venue>.
 *       JP: 論文 「タイトル」 を arXiv に投稿しました.
 *       EN: Our paper "title" was posted to arXiv.
 *
 *   - Talk: every entry. Future (year ≥ currentYear) uses future tense,
 *     past uses past tense:
 *       JP: <venue> で 「タイトル」 を発表します / しました.
 *       EN: Presenting / Presented "title" at <venue>.
 *
 * Entries are merged into one strictly newest-first list -- never grouped by
 * category -- using each item's data-date attribute as the sort key.
 *
 * Editing Papers / Talks in the HTML automatically updates News.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    const newsList = document.getElementById('news-list');
    if (!newsList) return;

    const lang = (document.documentElement.lang || 'ja').toLowerCase();
    const isJP = lang.startsWith('ja');

    const currentYear = new Date().getFullYear();

    // ------------------------------------------------ helpers
    function yearOf(item) {
      const p = item.querySelector('.item-meta p');
      const n = p ? parseInt(p.textContent, 10) : NaN;
      return isNaN(n) ? -Infinity : n;
    }
    // Sort key. The item's data-date (YYYY-MM-DD: arXiv submission, journal
    // acceptance/publication, or the meeting's first day) is what actually
    // orders the list; the displayed year is only a fallback for entries that
    // have no data-date yet.
    function dateOf(item) {
      const raw = item.getAttribute ? item.getAttribute('data-date') : null;
      if (raw) {
        const t = Date.parse(raw + 'T00:00:00Z');
        if (!isNaN(t)) return t;
      }
      const y = yearOf(item);
      return y === -Infinity ? -Infinity : Date.UTC(y, 0, 1);
    }
    function textOf(el) {
      return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';
    }
    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function extract(item) {
      const titleEl = item.querySelector('.item-title');
      const titleLink = item.querySelector('.item-body > a, a');
      const venueEl = item.querySelector('.item-venue');
      const yearEl  = item.querySelector('.item-meta p');
      return {
        title: textOf(titleEl),
        href:  titleLink && titleLink.href && titleLink.getAttribute('href').startsWith('http')
                ? titleLink.href : '',
        venue: textOf(venueEl),
        year:  textOf(yearEl),
      };
    }

    // 'accepted' -> journal acceptance, 'preprint' -> posted to a preprint server,
    // '' -> not newsworthy (skipped).
    function paperKind(item) {
      const metas = item.querySelectorAll('.item-meta p');
      const type = metas.length > 1 ? metas[1].textContent.trim() : '';
      if (/preprint/i.test(type)) return 'preprint';
      if (/journal|accepted/i.test(type)) return 'accepted';
      return '';
    }

    // Name of the preprint server, pulled out of the venue string so the news
    // text can read "... was posted to arXiv" rather than echoing the whole
    // venue (e.g. "arXiv preprint (arXiv:2609.35385)").
    function repositoryOf(venue) {
      const m = /\b(arXiv|OSF|SocArXiv|PsyArXiv|bioRxiv|medRxiv|SSRN)\b/i.exec(venue || '');
      return m ? m[1] : '';
    }

    // ------------------------------------------------ Renderers
    function renderPaper(item, idx, kind) {
      const d = extract(item);
      if (!d.title) return null;
      const titleHtml = d.href
        ? `<a href="${escapeHtml(d.href)}" target="_blank" rel="noopener" class="underline-quiet">${isJP ? '「' : '“'}${escapeHtml(d.title)}${isJP ? '」' : '”'}</a>`
        : `${isJP ? '「' : '“'}${escapeHtml(d.title)}${isJP ? '」' : '”'}`;
      const venueHtml = d.venue ? `<em>${escapeHtml(d.venue)}</em>` : '';

      let text;
      let label;
      if (kind === 'preprint') {
        const repo = repositoryOf(d.venue);
        const repoHtml = repo ? `<em>${escapeHtml(repo)}</em>` : '';
        text = isJP
          ? (repoHtml
              ? `論文 ${titleHtml} を ${repoHtml} に投稿しました.`
              : `論文 ${titleHtml} をプリントとして公開しました.`)
          : (repoHtml
              ? `Our paper ${titleHtml} was posted to ${repoHtml}.`
              : `Our paper ${titleHtml} was released as a preprint.`);
        label = isJP ? 'プレプリント' : 'Preprint';
      } else {
        text = isJP
          ? (venueHtml
              ? `論文 ${titleHtml} が ${venueHtml} にアクセプトされました.`
              : `論文 ${titleHtml} がアクセプトされました.`)
          : (venueHtml
              ? `Our paper ${titleHtml} was accepted at ${venueHtml}.`
              : `Our paper ${titleHtml} was accepted.`);
        label = isJP ? '論文' : 'Paper';
      }

      return {
        when: dateOf(item),
        order: idx,
        html: `
        <li class="news-item">
          <span class="news-label">${isJP ? `${label}（${escapeHtml(d.year)}）` : `${label}, ${escapeHtml(d.year)}`}</span>
          <p class="news-text">${text}</p>
        </li>`
      };
    }

    function renderTalk(item, idx) {
      const d = extract(item);
      if (!d.title) return null;
      const n = parseInt(d.year, 10);
      const isFuture = !isNaN(n) && n >= currentYear;
      const titleHtml = d.href
        ? `<a href="${escapeHtml(d.href)}" target="_blank" rel="noopener" class="underline-quiet">${isJP ? '「' : '“'}${escapeHtml(d.title)}${isJP ? '」' : '”'}</a>`
        : `${isJP ? '「' : '“'}${escapeHtml(d.title)}${isJP ? '」' : '”'}`;
      const venueHtml = d.venue ? `<em>${escapeHtml(d.venue)}</em>` : '';
      const text = isJP
        ? (venueHtml
            ? `${venueHtml} で ${titleHtml} を発表${isFuture ? 'します' : 'しました'}.`
            : `${titleHtml} を発表${isFuture ? 'します' : 'しました'}.`)
        : (venueHtml
            ? `${isFuture ? 'Presenting' : 'Presented'} ${titleHtml} at ${venueHtml}.`
            : `${isFuture ? 'Presenting' : 'Presented'} ${titleHtml}.`);
      return {
        when: dateOf(item),
        order: idx,
        html: `
        <li class="news-item">
          <span class="news-label">${isJP ? `発表（${escapeHtml(d.year)}）` : `Talk, ${escapeHtml(d.year)}`}</span>
          <p class="news-text">${text}</p>
        </li>`
      };
    }

    // ------------------------------------------------ Build merged list
    const entries = [];

    ['papers-list', 'preprints-list'].forEach(function (id) {
      const list = document.getElementById(id);
      if (!list) return;
      Array.from(list.querySelectorAll('.item')).forEach(function (it, i) {
        const kind = paperKind(it);
        if (!kind) return;
        const e = renderPaper(it, i, kind);
        if (e) entries.push(e);
      });
    });

    const talksList = document.getElementById('talks-list');
    if (talksList) {
      Array.from(talksList.querySelectorAll('.item')).forEach(function (it, i) {
        const e = renderTalk(it, i);
        if (e) entries.push(e);
      });
    }

    // Sort: date desc; ties keep source order (each section in the HTML is
    // already newest-first).
    entries.sort(function (a, b) {
      if (b.when !== a.when) return b.when - a.when;
      return a.order - b.order;
    });

    newsList.innerHTML = entries.map(function (e) { return e.html; }).join('');
  });
})();

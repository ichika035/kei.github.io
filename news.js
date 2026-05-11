/* news.js
 * Populates the #news-list block by scanning the Papers (#papers-list)
 * and Talks (#talks-list) sections, merging them into a single list
 * sorted newest-first, and rendering every entry. The container itself
 * is capped (via CSS) so only ~2 entries are visible at once and the
 * rest is reachable by scrolling.
 *
 *   - Paper: only items whose item-meta[2] matches /journal|accepted/i are
 *     included. Text rendered as:
 *       JP: 論文 「タイトル」 が <venue> にアクセプトされました.
 *       EN: Our paper "title" was accepted at <venue>.
 *
 *   - Talk: every entry. Future (year ≥ currentYear) uses future tense,
 *     past uses past tense:
 *       JP: <venue> で 「タイトル」 を発表します / しました.
 *       EN: Presenting / Presented "title" at <venue>.
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

    function paperIsAccepted(item) {
      const metas = item.querySelectorAll('.item-meta p');
      const type = metas.length > 1 ? metas[1].textContent.trim() : '';
      return /journal|accepted/i.test(type);
    }

    // ------------------------------------------------ Renderers
    function renderPaper(item, idx) {
      const d = extract(item);
      if (!d.title) return null;
      const titleHtml = d.href
        ? `<a href="${escapeHtml(d.href)}" target="_blank" rel="noopener" class="underline-quiet">${isJP ? '「' : '“'}${escapeHtml(d.title)}${isJP ? '」' : '”'}</a>`
        : `${isJP ? '「' : '“'}${escapeHtml(d.title)}${isJP ? '」' : '”'}`;
      const venueHtml = d.venue ? `<em>${escapeHtml(d.venue)}</em>` : '';
      const text = isJP
        ? (venueHtml
            ? `論文 ${titleHtml} が ${venueHtml} にアクセプトされました.`
            : `論文 ${titleHtml} がアクセプトされました.`)
        : (venueHtml
            ? `Our paper ${titleHtml} was accepted at ${venueHtml}.`
            : `Our paper ${titleHtml} was accepted.`);
      return {
        year: yearOf(item),
        order: idx,
        html: `
        <li class="news-item">
          <span class="news-label">${isJP ? '論文' : 'Paper'} · ${escapeHtml(d.year)}</span>
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
        year: yearOf(item),
        order: idx,
        html: `
        <li class="news-item">
          <span class="news-label">${isJP ? '発表' : 'Talk'} · ${escapeHtml(d.year)}</span>
          <p class="news-text">${text}</p>
        </li>`
      };
    }

    // ------------------------------------------------ Build merged list
    const entries = [];

    const papersList = document.getElementById('papers-list');
    if (papersList) {
      Array.from(papersList.querySelectorAll('.item')).forEach(function (it, i) {
        if (!paperIsAccepted(it)) return;
        const e = renderPaper(it, i);
        if (e) entries.push(e);
      });
    }

    const talksList = document.getElementById('talks-list');
    if (talksList) {
      Array.from(talksList.querySelectorAll('.item')).forEach(function (it, i) {
        const e = renderTalk(it, i);
        if (e) entries.push(e);
      });
    }

    // Sort: year desc; ties keep source order (which is already newest-first
    // within each section in the HTML).
    entries.sort(function (a, b) {
      if (b.year !== a.year) return b.year - a.year;
      return a.order - b.order;
    });

    newsList.innerHTML = entries.map(function (e) { return e.html; }).join('');
  });
})();

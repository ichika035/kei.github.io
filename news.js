/* news.js
 * Populates the #news-list block by scanning the Papers (#papers-list)
 * and Talks (#talks-list) sections and pulling the most recent entry
 * from each.
 *
 *   - Paper: only items whose item-meta[2] matches /journal|accepted/i are
 *     considered. Text rendered as:
 *       JP: 「タイトル」が <venue> にアクセプトされました.
 *       EN: Our paper "title" was accepted at <venue>.
 *
 *   - Talk: the most recent entry by year. Future (year ≥ currentYear) uses
 *     future tense, past uses past tense:
 *       JP: <venue> で「タイトル」を発表します / しました.
 *       EN: Presenting / Presented "title" at <venue>.
 *
 * No manual edits to the News block are needed — re-rendering happens each
 * page load, and editing Papers / Talks in the HTML updates News.
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

    // ------------------------------------------------ Papers: most recent accepted
    function pickPaper() {
      const list = document.getElementById('papers-list');
      if (!list) return null;
      const items = Array.from(list.querySelectorAll('.item'));
      const accepted = items.filter(function (it) {
        const metas = it.querySelectorAll('.item-meta p');
        const type = metas.length > 1 ? metas[1].textContent.trim() : '';
        return /journal|accepted/i.test(type);
      });
      accepted.sort(function (a, b) { return yearOf(b) - yearOf(a); });
      return accepted[0] || null;
    }

    // ------------------------------------------------ Talks: most recent
    function pickTalk() {
      const list = document.getElementById('talks-list');
      if (!list) return null;
      const items = Array.from(list.querySelectorAll('.item'));
      items.sort(function (a, b) { return yearOf(b) - yearOf(a); });
      return items[0] || null;
    }

    // ------------------------------------------------ Render helpers
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

    function renderPaper(item) {
      const d = extract(item);
      if (!d.title) return '';
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
      return `
        <li class="news-item">
          <span class="news-label">${isJP ? '論文' : 'Paper'} · ${escapeHtml(d.year)}</span>
          <p class="news-text">${text}</p>
        </li>`;
    }

    function renderTalk(item) {
      const d = extract(item);
      if (!d.title) return '';
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
      return `
        <li class="news-item">
          <span class="news-label">${isJP ? '発表' : 'Talk'} · ${escapeHtml(d.year)}</span>
          <p class="news-text">${text}</p>
        </li>`;
    }

    // ------------------------------------------------ Build
    const paper = pickPaper();
    const talk  = pickTalk();
    const parts = [];
    if (paper) parts.push(renderPaper(paper));
    if (talk)  parts.push(renderTalk(talk));

    newsList.innerHTML = parts.join('');
  });
})();

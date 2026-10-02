// Builds the page from window.SITE (content.js) and window.PHOTOS (photos.js).
(function () {
  'use strict';

  var SITE = window.SITE;
  var PHOTOS = window.PHOTOS || {};
  var app = document.getElementById('app');

  // Small helper: h('p', {class: 'x', text: 'hi'}, [children])
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) {
      if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  /* ---------- the photographs fade a little more with each visit ---------- */
  var visits = 1;
  try {
    visits = (parseInt(localStorage.getItem('itp-visits') || '0', 10) || 0) + 1;
    localStorage.setItem('itp-visits', String(visits));
  } catch (e) {}
  var fade = Math.min(0.25 + (visits - 1) * 0.05, 0.7);
  document.documentElement.style.setProperty('--f', fade.toFixed(2));
  var visitText = visits <= 1
    ? 'This is your first time here. The photographs rest a little faded; hover over one and it comes back for a moment. Next time they\u2019ll be paler.'
    : 'This is visit number ' + visits + '. The photographs fade a little more each time. Hover over one and it comes back for a moment.';

  /* ---------- page ---------- */
  function frameCount() {
    return SITE.rolls.reduce(function (a, r) { return a + r.frames.length; }, 0);
  }

  function renderFrame(r, f) {
    return h('li', { class: 'frame' }, [
      h('span', { class: 'edge-n', 'aria-hidden': 'true', text: f.n + ' \u25B8' + f.n + 'A' }),
      h('button', {
        type: 'button', class: 'open', 'aria-label': 'Frame ' + f.n + ': ' + (f.alt || 'open'),
        onclick: function () { openLightbox(f); }
      }, [
        h('img', { src: PHOTOS[f.id], width: f.w, height: f.h, alt: f.alt || ('Frame ' + f.n), loading: 'lazy', decoding: 'async' })
      ]),
      h('span', { class: 'edge-s', 'aria-hidden': 'true', text: r.edge })
    ]);
  }

  function renderRoll(r, i) {
    var id = 'roll-' + (i + 1);
    var head = h('header', { class: 'roll-head' }, [
      h('h2', { id: id + '-h', text: r.who }),
      h('p', { class: 'roll-meta', text: r.stock + '. ' + r.frames.length + (r.frames.length === 1 ? ' frame.' : ' frames.') }),
      r.note ? h('p', { class: 'roll-note', text: r.note }) : null
    ]);
    var film = h('ol', { class: 'film' }, r.frames.map(function (f) { return renderFrame(r, f); }));
    return h('section', { class: 'roll', id: id, 'aria-labelledby': id + '-h' }, [
      head,
      h('div', { class: 'strip', tabindex: '0', role: 'region', 'aria-label': r.who + ', frames' }, [film])
    ]);
  }

  function render() {
    var s = SITE.site;

    app.appendChild(h('header', { class: 'hero' }, [
      h('h1', { text: s.title }),
      h('p', { text: SITE.rolls.length + ' rolls, ' + frameCount() + ' frames, ' + s.span + '. ' + s.subtitle })
    ]));

    var main = h('main');

    var toc = h('ol', { class: 'toc' }, SITE.rolls.map(function (r, i) {
      return h('li', null, [h('a', { href: '#roll-' + (i + 1) }, [
        h('span', { class: 'toc-y', text: r.year }),
        h('span', { class: 'toc-w', text: r.who.replace(/^taken by:\s*/i, '') })
      ])]);
    }));
    main.appendChild(h('section', { class: 'intro', 'aria-label': 'Introduction' },
      s.intro.map(function (p) { return h('p', { text: p }); }).concat([toc])));

    SITE.rolls.forEach(function (r, i) {
      if (r.gapBefore) {
        var years = [];
        r.gapBefore.years.forEach(function (y, k) { if (k) years.push(h('br')); years.push(y); });
        main.appendChild(h('section', { class: 'gap', 'aria-label': r.gapBefore.years.join(', ') }, [
          h('p', { class: 'gap-years' }, years),
          h('p', { class: 'gap-text', text: r.gapBefore.text })
        ]));
      }
      main.appendChild(renderRoll(r, i));
    });

    var blanks = [];
    for (var b = 0; b < 6; b++) blanks.push(h('div', { class: 'blank' }));
    main.appendChild(h('section', { class: 'roll next', 'aria-labelledby': 'next-h' }, [
      h('header', { class: 'roll-head' }, [
        h('h2', { id: 'next-h', text: s.next.who }),
        h('p', { class: 'roll-note', text: s.next.note })
      ]),
      h('div', { class: 'strip', 'aria-hidden': 'true' }, [h('div', { class: 'film' }, blanks)])
    ]));

    var L = s.letter;
    main.appendChild(h('section', { class: 'letter', 'aria-labelledby': 'letter-h' }, [
      h('h2', { id: 'letter-h', text: L.title }),
      h('p', { class: 'poem' }, (L.lines || []).map(function (line) { return h('span', { class: 'line', text: line }); }))
    ]));

    app.appendChild(main);
    app.appendChild(h('footer', null, [h('p', { id: 'visits', text: visitText })]));
  }

  /* ---------- full-size view ---------- */
  var dlg = document.getElementById('lb');
  var lbImg = document.getElementById('lb-img');
  var lbWho = document.getElementById('lb-who');
  var lbN = document.getElementById('lb-n');
  var lbCap = document.getElementById('lb-cap');
  var seq = [], cur = -1, lastFocus = null;

  SITE.rolls.forEach(function (r) { r.frames.forEach(function (f) { seq.push({ f: f, r: r }); }); });

  function show(i) {
    cur = (i + seq.length) % seq.length;
    var it = seq[cur];
    lbImg.style.animation = 'none'; void lbImg.offsetWidth; lbImg.style.animation = '';
    lbImg.src = PHOTOS[it.f.id];
    lbImg.alt = it.f.alt || '';
    lbWho.textContent = it.r.who;
    lbN.textContent = 'Frame ' + it.f.n + ', ' + it.r.stock;
    lbCap.textContent = it.f.cap || '';
  }
  function openLightbox(f) {
    var i = seq.findIndex(function (x) { return x.f === f; });
    if (i < 0) return;
    lastFocus = document.activeElement;
    show(i);
    if (dlg.showModal) dlg.showModal();
  }
  document.getElementById('lb-prev').onclick = function () { show(cur - 1); };
  document.getElementById('lb-next').onclick = function () { show(cur + 1); };
  document.getElementById('lb-close').onclick = function () { dlg.close(); };
  lbImg.addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('close', function () { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
  });

  render();
})();

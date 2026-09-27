(function () {
  'use strict';

  var burger = document.getElementById('burgerBtn');
  var menu = document.getElementById('mobileMenu');
  if (!burger || !menu) return;

  var menuLinks = menu.querySelectorAll('a');

  function openMenu() {
    menu.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
    if (menuLinks.length) menuLinks[0].focus();
  }

  function closeMenu() {
    menu.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
    burger.focus();
  }

  burger.addEventListener('click', function () {
    var isOpen = burger.getAttribute('aria-expanded') === 'true';
    if (isOpen) closeMenu(); else openMenu();
  });

  menuLinks.forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      closeMenu();
    }
  });

  // Keep footer year current without a build step.
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme toggle (persisted, no-flash init happens inline in <head>) ---------- */
  var themeToggle = document.querySelectorAll('.theme-toggle');
  if (themeToggle.length) {
    themeToggle.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var root = document.documentElement;
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('bc-theme', next); } catch (e) {}
      });
    });
  }

  /* ---------- Header state on scroll ---------- */
  var header = document.getElementById('siteHeader');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Scroll-reveal + stagger ---------- */
  var revealEls = document.querySelectorAll('.reveal:not(.reveal-load)');
  if (revealEls.length) {
    // Give siblings inside the same grid a stagger index via CSS var --i.
    ['about-grid', 'services-grid', 'work-grid', 'process-row'].forEach(function (cls) {
      document.querySelectorAll('.' + cls).forEach(function (grid) {
        Array.prototype.forEach.call(grid.children, function (child, i) {
          child.style.setProperty('--i', i);
        });
      });
    });

    if ('IntersectionObserver' in window && !reduceMotion) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var heading = entry.target.querySelector('h1, h2');
              if (heading && !heading.dataset.split) {
                splitLines(heading);
                requestAnimationFrame(function () { revealSplit(heading); });
              }
              entry.target.classList.add('is-visible');
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
      );
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) {
        el.classList.add('is-visible');
        var heading = el.querySelector('h1, h2');
        if (heading) { splitLines(heading); revealSplit(heading); }
      });
    }
  }

  // Hero / page-hero fade in immediately on load rather than waiting for scroll.
  requestAnimationFrame(function () {
    document.querySelectorAll('.reveal-load').forEach(function (el) {
      el.classList.add('is-visible');
      if (el.closest('.hero')) return; // homepage hero heading is staged by heroEntrance() below
      var heading = el.querySelector('h1, h2');
      if (heading) { splitLines(heading); revealSplit(heading); }
    });
  });

  /* ---------- Animated stat counters ---------- */
  var counters = document.querySelectorAll('[data-count-to]');
  if (counters.length && 'IntersectionObserver' in window) {
    var animateCount = function (el) {
      var target = parseInt(el.getAttribute('data-count-to'), 10) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduceMotion) { el.textContent = target + suffix; return; }
      var duration = 1200;
      var start = null;
      function step(ts) {
        if (start === null) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };
    var statIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            statIo.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (el) { statIo.observe(el); });
  }

  /* ---------- Subtle 3D tilt on work cards ---------- */
  if (window.matchMedia('(hover: hover)').matches && !reduceMotion) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      var maxTilt = 6;
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(800px) rotateY(' + (x * maxTilt * 2) + 'deg) rotateX(' + (-y * maxTilt * 2) + 'deg) translateY(-4px)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* =========================================================
     CMS-ready content rendering.
     Today this fetches a static JSON file. To connect a real
     headless CMS, replace the fetch() URL below with your
     CMS's REST/GraphQL endpoint — the render functions don't
     need to change as long as the shape matches.
     ========================================================= */
  var workGrid = document.getElementById('work-grid');
  var filterBar = document.getElementById('filter-bar');
  var blogGrid = document.getElementById('blog-grid');

  if (workGrid || blogGrid) {
    fetch('data/content.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (workGrid) renderWork(data.workItems || []);
        if (blogGrid) renderBlog(data.blogPosts || []);
      })
      .catch(function (err) { console.error('Content load failed:', err); });
  }

  function caseCardHTML(item, i) {
    return (
      '<li class="case reveal tilt" data-category="' + item.category + '" style="--i:' + (i % 6) + '">' +
        '<div class="case-visual"><span>' + item.name.toUpperCase() + '</span></div>' +
        '<div class="case-body">' +
          '<h3>' + item.name + '</h3>' +
          '<p>' + item.summary + '</p>' +
          '<ul class="tags">' + item.tags.map(function (t) { return '<li class="tag">' + t + '</li>'; }).join('') + '</ul>' +
          '<a class="case-link" href="' + item.url + '">View Case Study <span aria-hidden="true">→</span></a>' +
        '</div>' +
      '</li>'
    );
  }

  function renderWork(items) {
    function paint(list) {
      workGrid.innerHTML = list.map(caseCardHTML).join('');
      attachTilt(workGrid.querySelectorAll('.tilt'));
      requestAnimationFrame(function () {
        workGrid.querySelectorAll('.reveal').forEach(function (el, i) {
          setTimeout(function () { el.classList.add('is-visible'); }, i * 60);
        });
      });
    }
    paint(items);

    if (filterBar) {
      var cats = ['All'].concat(items.map(function (i) { return i.category; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
      filterBar.innerHTML = cats.map(function (c, i) {
        return '<button class="filter-btn' + (i === 0 ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>';
      }).join('');
      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-btn');
        if (!btn) return;
        filterBar.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var cat = btn.getAttribute('data-cat');
        paint(cat === 'All' ? items : items.filter(function (i) { return i.category === cat; }));
      });
    }
  }

  function renderBlog(posts) {
    if (!posts.length) {
      blogGrid.innerHTML = '<p class="blog-empty">More articles coming soon — this section renders straight from data/content.json, ready to swap in your CMS feed.</p>';
      return;
    }
    blogGrid.innerHTML = posts.map(function (p, i) {
      return (
        '<article class="blog-card reveal" style="--i:' + i + '">' +
          '<p class="eyebrow">Insights</p>' +
          '<h3>' + p.title + '</h3>' +
          '<p>' + p.excerpt + '</p>' +
          '<a class="case-link" href="' + p.url + '">Read Article <span aria-hidden="true">→</span></a>' +
        '</article>'
      );
    }).join('');
    requestAnimationFrame(function () {
      blogGrid.querySelectorAll('.reveal').forEach(function (el, i) {
        setTimeout(function () { el.classList.add('is-visible'); }, i * 60);
      });
    });
  }

  function attachTilt(nodes) {
    if (!(window.matchMedia('(hover: hover)').matches && !reduceMotion)) return;
    nodes.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(800px) rotateY(' + (x * 12) + 'deg) rotateX(' + (-y * 12) + 'deg) translateY(-4px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* =========================================================
     Real line-by-line heading split.
     Splits into word-spans (grouped into detected visual
     lines) WITHOUT re-serializing the heading's HTML — any
     inline child element (e.g. the italic accent span) is
     cloned and moved as-is, so its tag/class/style survive
     untouched. Safe to call more than once (no-ops after
     the first run via a data-split flag).
     ========================================================= */
  function splitLines(el) {
    if (!el || el.dataset.split) return;
    el.dataset.split = '1';

    var tokens = [];
    Array.prototype.forEach.call(el.childNodes, function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/(\s+)/).forEach(function (chunk) {
          if (!chunk.length) return;
          tokens.push(/^\s+$/.test(chunk) ? { space: true } : { text: chunk });
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        tokens.push({ el: node.cloneNode(true) });
      }
    });

    el.innerHTML = '';
    var wordSpans = [];
    tokens.forEach(function (t) {
      if (t.space) { el.appendChild(document.createTextNode(' ')); return; }
      var span = document.createElement('span');
      span.style.display = 'inline-block';
      if (t.text) span.textContent = t.text; else span.appendChild(t.el);
      el.appendChild(span);
      wordSpans.push(span);
    });

    // Group word-spans into their actual rendered lines by offsetTop.
    var lines = [];
    wordSpans.forEach(function (span) {
      var top = span.offsetTop;
      var last = lines[lines.length - 1];
      if (last && Math.abs(last.top - top) < 4) last.spans.push(span);
      else lines.push({ top: top, spans: [span] });
    });

    el.innerHTML = '';
    lines.forEach(function (line, li) {
      var div = document.createElement('div');
      div.className = 'split-line';
      div.style.setProperty('--line', li);
      line.spans.forEach(function (span, i) {
        div.appendChild(span);
        if (i < line.spans.length - 1) div.appendChild(document.createTextNode(' '));
      });
      el.appendChild(div);
    });
  }

  function revealSplit(el) {
    if (!el) return;
    el.querySelectorAll('.split-line').forEach(function (d) { d.classList.add('is-visible'); });
  }

  // Hero + final-CTA headlines: split once up front so layout is measured
  // before any fade/transform is applied to their parent wrappers.
  var splitHeadings = document.querySelectorAll('.hero h1, .final h2');
  if (!reduceMotion) {
    splitHeadings.forEach(function (h) { splitLines(h); });
  }

  // Final CTA headline reveals line-by-line when it scrolls into view,
  // description and button follow (existing .final-sub / .btn are
  // untouched markup — just timed via inline transitions like the hero).
  document.querySelectorAll('.final').forEach(function (section) {
    var heading = section.querySelector('h2');
    var sub = section.querySelector('.final-sub');
    var btn = section.querySelector('.btn');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealSplit(heading);
      return;
    }
    [sub, btn].forEach(function (el, i) {
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity .6s cubic-bezier(.25,.7,.35,1) ' + (i * 150 + 200) + 'ms, transform .6s cubic-bezier(.25,.7,.35,1) ' + (i * 150 + 200) + 'ms';
    });
    var ctaIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        revealSplit(heading);
        requestAnimationFrame(function () {
          if (sub) { sub.style.opacity = '1'; sub.style.transform = 'none'; }
          if (btn) { btn.style.opacity = '1'; btn.style.transform = 'none'; }
        });
        ctaIo.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    ctaIo.observe(section);
  });

  // Process section: trigger the connecting progress-line (see style.css
  // .process-row::before) once the row scrolls into view.
  var processRow = document.querySelector('.process-row');
  if (processRow) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      processRow.classList.add('is-visible');
    } else {
      var procIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            processRow.classList.add('is-visible');
            procIo.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      procIo.observe(processRow);
    }
  }

  /* =========================================================
     Hero entrance sequence.
     Existing markup/content is untouched — this only assigns
     runtime inline transitions to the existing eyebrow/h1/lead/
     CTA elements so they stagger in instead of fading as one
     block. Falls back to the existing instant reveal-load
     behaviour if reduced motion is on.
     ========================================================= */
  (function heroEntrance() {
    var wrap = document.querySelector('.hero .reveal-load');
    if (!wrap || reduceMotion) return;
    var h1 = wrap.querySelector('h1');
    // h1 is handled separately below via the real line-split reveal;
    // everything else fades/rises as before.
    var seq = [
      wrap.querySelector('.eyebrow'),
      wrap.querySelector('.lead'),
      wrap.querySelector('.hero-ctas')
    ].filter(Boolean);

    seq.forEach(function (el, i) {
      var delay = i === 0 ? 0 : (i + 1) * 120; // leave slot 1 (120ms) for h1
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.transition =
        'opacity .6s cubic-bezier(.25,.7,.35,1) ' + delay + 'ms, transform .6s cubic-bezier(.25,.7,.35,1) ' + delay + 'ms';
    });

    var visual = document.querySelector('.hero .hero-visual');
    var totalDelay = (seq.length + 1) * 120;
    if (visual) {
      visual.style.opacity = '0';
      visual.style.transform = 'scale(.94)';
      visual.style.transition =
        'opacity .8s ease ' + totalDelay + 'ms, transform .8s cubic-bezier(.25,.7,.35,1) ' + totalDelay + 'ms';
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        seq.forEach(function (el) { el.style.opacity = '1'; el.style.transform = 'none'; });
        if (visual) { visual.style.opacity = '1'; visual.style.transform = 'none'; }
      });
    });

    // h1 reveals line-by-line in its original stagger slot (120ms in).
    if (h1) {
      setTimeout(function () { revealSplit(h1); }, 120);
    }
  })();

  /* =========================================================
     Hero visual mouse parallax (desktop only, max ~12px).
     Existing dot/ring keyframes reference --px/--py custom
     properties (see style.css), so this only nudges those
     variables — it never touches the existing rotate/pulse
     animations themselves.
     ========================================================= */
  (function heroParallax() {
    var visual = document.querySelector('.hero-visual');
    if (!visual || reduceMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.innerWidth <= 900) return;

    var dot = visual.querySelector('.dot');
    var r1 = visual.querySelector('.r1');
    var r2 = visual.querySelector('.r2');
    var layers = [
      { el: dot, depth: 0.9 },
      { el: r1, depth: 0.6 },
      { el: r2, depth: 0.35 }
    ].filter(function (l) { return l.el; });
    if (!layers.length) return;

    var maxPx = 12;
    visual.addEventListener('mousemove', function (e) {
      var r = visual.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach(function (l) {
        l.el.style.setProperty('--px', (x * maxPx * l.depth).toFixed(1) + 'px');
        l.el.style.setProperty('--py', (y * maxPx * l.depth).toFixed(1) + 'px');
      });
    });
    visual.addEventListener('mouseleave', function () {
      layers.forEach(function (l) {
        l.el.style.setProperty('--px', '0px');
        l.el.style.setProperty('--py', '0px');
      });
    });
  })();

  /* =========================================================
     Hero visual scroll parallax (max ~15px).
     This design has no photographic <img> elements to apply
     the "image parallax" requirement to, so it's applied to
     the large decorative hero-visual box instead — the closest
     existing analog. Starts only after the entrance animation
     above has finished, so the two never write to the same
     inline transform at once.
     ========================================================= */
  (function heroScrollParallax() {
    var visual = document.querySelector('.hero .hero-visual');
    if (!visual || reduceMotion) return;
    if (window.innerWidth <= 900) return; // desktop only, per spec

    setTimeout(function () {
      var ticking = false;
      var maxShift = 15;
      function update() {
        var hero = document.querySelector('.hero');
        var r = hero.getBoundingClientRect();
        var progress = Math.min(Math.max(-r.top / (r.height || 1), 0), 1);
        var shift = (progress - 0.5) * 2 * maxShift;
        visual.style.transform = 'translateY(' + shift.toFixed(1) + 'px)';
        ticking = false;
      }
      window.addEventListener('scroll', function () {
        if (!ticking) { requestAnimationFrame(update); ticking = true; }
      }, { passive: true });
      update();
    }, 1000); // clears the entrance sequence's own transform handoff
  })();

  /* =========================================================
     Custom cursor overlay — desktop only.
     Purely an additive overlay element; it does not hide the
     native cursor (kept for accessibility), never renders on
     touch/coarse-pointer devices, and respects reduced motion.
     ========================================================= */
  (function customCursor() {
    if (reduceMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var cursor = document.createElement('div');
    cursor.className = 'bc-cursor';
    cursor.innerHTML = '<span class="label"></span>';
    document.body.appendChild(cursor);
    var label = cursor.querySelector('.label');

    var ready = false;
    document.addEventListener('mousemove', function (e) {
      if (!ready) { ready = true; cursor.classList.add('is-active'); }
      cursor.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(-50%,-50%)';
    });
    document.addEventListener('mouseleave', function () { cursor.classList.remove('is-active'); });

    // Delegated so dynamically-rendered work/blog cards (loaded via fetch)
    // pick up the same cursor states with no extra rebinding step.
    var hoverMap = [
      { sel: '.case', text: 'VIEW ↗' },
      { sel: '.btn-solid', text: "LET'S TALK" },
      { sel: 'a, button', text: '' }
    ];
    document.addEventListener('mouseover', function (e) {
      for (var i = 0; i < hoverMap.length; i++) {
        var match = e.target.closest(hoverMap[i].sel);
        if (match) {
          cursor.classList.add('is-hover');
          label.textContent = hoverMap[i].text;
          return;
        }
      }
    });
    document.addEventListener('mouseout', function (e) {
      var stillInside = hoverMap.some(function (h) { return e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(h.sel); });
      if (!stillInside) {
        cursor.classList.remove('is-hover');
        label.textContent = '';
      }
    });
  })();
})();

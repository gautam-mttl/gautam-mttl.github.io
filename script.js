/* ═══════════════════════════════════════════════════════════════
   script.js  —  Portfolio Website JavaScript
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   1.  STARFIELD + CONSTELLATION CANVAS
   ══════════════════════════════════════════════════════════════

   Layer stack (back → front):
   A) Always-visible background constellation network
      – Delaunay-style triangulation between nearby stars
      – Low opacity, thin lines, gives the "star map" feel
   B) Moving star dots
   C) Interactive hover constellation
      – Bright lines from cursor → near stars
      – Star-to-star connections among near stars (triangulation)
   ══════════════════════════════════════════════════════════════ */

(function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');

  // ── Canvas sizing ──────────────────────────────────────────
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); buildStars(); });

  // ── Configuration ──────────────────────────────────────────
  const STAR_COUNT = 420;          // more stars for a richer starfield
  const MAX_SPEED = 0.14;         // gentle drift

  // Hover-only constellation — structures form only near the cursor
  const HOVER_RADIUS = 180;    // px — cursor influence zone
  const HOVER_STAR_LINK = 100;    // px — star↔star link distance
  const HOVER_LINE_ALPHA = 0.28;   // line brightness (visible but not harsh)
  const HOVER_BOOST = 0.25;   // star brightness boost near cursor

  let mouse = { x: -9999, y: -9999 };

  // ── Build stars ──────────────────────────────────────────
  let stars = [];

  function makeStar() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * MAX_SPEED * 2,
      vy: (Math.random() - 0.5) * MAX_SPEED * 2,
      r: Math.random() * 0.9 + 0.3,   // fine stars (0.3–1.2px)
      opacity: Math.random() * 0.5 + 0.5,
    };
  }

  function buildStars() {
    stars = Array.from({ length: STAR_COUNT }, makeStar);
  }
  buildStars();

  // ── Mouse tracking ──────────────────────────────────────────
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // ── Helpers ──────────────────────────────────────────
  function dist2(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  const HOVER_R2 = HOVER_RADIUS * HOVER_RADIUS;
  const HOVER_LINK2 = HOVER_STAR_LINK * HOVER_STAR_LINK;

  // ── Draw loop ──────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── A) Move & wrap stars ──────────────────────────────
    for (const s of stars) {
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < -10) s.x = canvas.width + 10;
      if (s.x > canvas.width + 10) s.x = -10;
      if (s.y < -10) s.y = canvas.height + 10;
      if (s.y > canvas.height + 10) s.y = -10;
    }

    // ── B) Hover-reveal constellation ───────────────────────
    // Cursor is NOT a node — it's a reveal zone only.
    // Lines form between stars that are: (a) near the cursor AND (b) near each other.
    const nearStars = [];
    for (const s of stars) {
      if (dist2(s, mouse) < HOVER_R2) nearStars.push(s);
    }

    if (nearStars.length > 1) {
      ctx.lineWidth = 0.45;
      for (let i = 0; i < nearStars.length; i++) {
        for (let j = i + 1; j < nearStars.length; j++) {
          const d2 = dist2(nearStars[i], nearStars[j]);
          if (d2 > HOVER_LINK2) continue;
          const d = Math.sqrt(d2);
          // Fade based on how close the STARS are to each other
          const alpha = HOVER_LINE_ALPHA * (1 - d / HOVER_STAR_LINK);
          ctx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(nearStars[i].x, nearStars[i].y);
          ctx.lineTo(nearStars[j].x, nearStars[j].y);
          ctx.stroke();
        }
      }
    }

    // ── C) Draw star dots ────────────────────────────────
    for (const s of stars) {
      const near = dist2(s, mouse) < HOVER_R2;
      const boost = near ? HOVER_BOOST * (1 - Math.sqrt(dist2(s, mouse)) / HOVER_RADIUS) : 0;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, s.opacity + boost)})`;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  draw();
})();


/* ══════════════════════════════════════════════════════════════
   2.  PANEL OPEN / CLOSE + HASH-BASED ROUTING
   ══════════════════════════════════════════════════════════════

   Behavior:
   • Click "PROJECTS" tab  → URL becomes #projects → panel opens
   • Refresh on #projects  → panel auto-opens on load
   • Share #contact        → recipient lands directly on Contact
   • Close panel (X / Esc / backdrop) → hash cleared → URL resets
   ══════════════════════════════════════════════════════════════ */

(function initPanels() {
  const VALID_PANELS = new Set(['intro', 'experience', 'projects', 'activities', 'contact']);

  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.panel-overlay');

  // ── Core open / close ────────────────────────────────────
  function openPanel(panelId, { updateHash = true } = {}) {
    if (!VALID_PANELS.has(panelId)) return;

    // Visually close any currently open panel first (no hash side-effect)
    _visualClose();

    const tab = document.querySelector(`[data-panel="${panelId}"]`);
    const panel = document.getElementById(`panel-${panelId}`);
    if (!panel) return;

    panel.classList.add('active');
    document.body.classList.add('panel-open');   // hero fades out via CSS
    document.body.style.overflow = 'hidden';
    if (tab) tab.classList.add('active');

    // Sync hash
    if (updateHash && window.location.hash !== `#${panelId}`) {
      history.pushState(null, '', `#${panelId}`);
    }
  }

  function closeAll({ updateHash = true } = {}) {
    _visualClose();

    // Clear hash without adding a history entry
    if (updateHash && window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search);
    }
  }

  function _visualClose() {
    panels.forEach((p) => p.classList.remove('active'));
    tabs.forEach((t) => t.classList.remove('active'));
    document.body.classList.remove('panel-open'); // hero fades back in
    document.body.style.overflow = '';
  }

  // ── Tab button clicks ────────────────────────────────────
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const panelId = tab.dataset.panel;
      if (tab.classList.contains('active')) {
        closeAll();               // toggle off
      } else {
        openPanel(panelId);
      }
    });
  });

  // ── Close buttons (X) ───────────────────────────────────
  document.querySelectorAll('.panel-close').forEach((btn) => {
    btn.addEventListener('click', () => closeAll());
  });

  // ── Backdrop click ──────────────────────────────────────
  panels.forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAll();
    });
  });

  // ── Keyboard: Escape ────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  // ── Hash → panel resolver ────────────────────────────────
  function resolveHash() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    const current = document.querySelector('.panel-overlay.active');

    if (!hash) {
      // No hash: ensure everything is closed visually
      if (current) _visualClose();
      return;
    }

    if (VALID_PANELS.has(hash)) {
      // Only re-open if a different (or no) panel is currently shown
      const currentPanel = current ? current.id.replace('panel-', '') : null;
      if (currentPanel !== hash) {
        openPanel(hash, { updateHash: false });   // hash is already correct
      }
    }
  }

  // ── On page load: restore from hash ─────────────────────
  window.addEventListener('DOMContentLoaded', resolveHash);

  // ── On browser back/forward ──────────────────────────────
  window.addEventListener('hashchange', resolveHash);
})();


/* ══════════════════════════════════════════════
   3.  PROJECTS — Data-driven rendering
   ══════════════════════════════════════════════ */

// CUSTOMIZE: PROJECTS SECTION
// Add your project objects to this array.
// Each object shape:
//   { category, title, description, techStack: [], imageUrl, liveLink, githubLink }
//   'category' is optional — projects with the same category string are grouped together
const projects = [
  // CUSTOMIZE: Project 1
  {
    category: 'Backend',            // CUSTOMIZE: group label
    title: 'VideoTube — Scalable Video Platform',
    description: 'A production-grade backend for a video streaming platform — built to handle real scale. Features authentication, video uploads, comments, subscriptions and a clean modular API architecture, all backed by MongoDB.',
    techStack: ['Node.js', 'Express.js', 'MongoDB', 'JWT', 'REST APIs'],
    imageUrl: '',                           // CUSTOMIZE: 'assets/images/projects/proj1.png'
    liveLink: '#',
    githubLink: 'https://github.com/gautam-mttl/backend-videotube-application',
  },
  // CUSTOMIZE: Project 2
  {
    category: 'AI & Interfaces',
    title: 'AI Chat Assistant — Gemini API',
    description: 'A sleek, interactive AI chat interface powered by Google\'s Gemini API. Features contextual response generation, dynamic message rendering and persistent chat history — built entirely in vanilla JS.',
    techStack: ['JavaScript', 'HTML', 'CSS', 'Gemini API'],
    imageUrl: '',
    liveLink: 'https://gautam-mttl.github.io/gemini-chat-ui/',
    githubLink: 'https://github.com/gautam-mttl/gemini-chat-ui',
  },
  // CUSTOMIZE: Project 3
  {
    category: 'ServiceNow Integrated App',                 // CUSTOMIZE: new category = new section header
    title: 'Enterprise Leave Management System',
    description: 'A fully automated leave management platform built on ServiceNow — complete with custom tables, dynamic UI policies, business rule enforcement and Flow Designer-powered approval pipelines.',
    techStack: ['ServiceNow', 'Flow Designer', 'Business Rules', 'Client Scripts'],
    imageUrl: '',
    liveLink: '#',
  },
  {
    category: 'Research & Development',                 // CUSTOMIZE: new category = new section header
    title: 'Large-Scale Sentiment Analysis',
    description: 'An ML research pipeline that classifies sentiment across 600,000+ labeled reviews. Benchmarked Random Forest, Naive Bayes and Logistic Regression — achieving a peak accuracy of 83% with LR.',
    techStack: ['Python', 'Scikit-learn', 'Pandas', 'NLP'],
    imageUrl: '',
  },
  // CUSTOMIZE: Add more projects here…
];

(function renderProjects() {
  // CUSTOMIZE: load project data here — modify the `projects` array above
  const list = document.getElementById('projects-list');
  if (!list) return;

  if (projects.length === 0) {
    list.innerHTML = `<p style="color:var(--text-dim);font-size:0.9rem;">
      Projects coming soon — add entries to the <code>projects</code> array in script.js
    </p>`;
    return;
  }

  // Group projects by category (preserving insertion order)
  const grouped = {};
  const order = [];
  for (const p of projects) {
    const cat = p.category || 'Projects';
    if (!grouped[cat]) { grouped[cat] = []; order.push(cat); }
    grouped[cat].push(p);
  }

  // Render each category group
  for (const cat of order) {
    const group = document.createElement('div');
    group.className = 'proj-category';

    // Category header
    group.innerHTML = `<h3 class="proj-cat-label">${cat}</h3>`;

    // Projects within category
    for (const proj of grouped[cat]) {
      const item = document.createElement('div');
      item.className = 'proj-item';

      // Full-width image or placeholder
      const imgHtml = proj.imageUrl
        ? `<img src="${proj.imageUrl}" alt="${proj.title}" class="proj-img" loading="lazy" />`
        : `<div class="proj-img-placeholder"><i class="fa-solid fa-code"></i></div>`;

      // Tech tags
      const tagsHtml = proj.techStack
        .map((t) => `<span class="tech-tag">${t}</span>`)
        .join('');

      // Action links
      let linksHtml = '';
      if (proj.liveLink)
        linksHtml += `<a href="${proj.liveLink}" target="_blank" rel="noopener" class="project-link-btn">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Live
        </a>`;
      if (proj.githubLink)
        linksHtml += `<a href="${proj.githubLink}" target="_blank" rel="noopener" class="project-link-btn">
          <i class="fa-brands fa-github"></i> Code
        </a>`;

      item.innerHTML = `
        <h4 class="proj-name">${proj.title}</h4>
        ${imgHtml}
        <p class="proj-desc">${proj.description}</p>
        <div class="proj-meta">
          ${tagsHtml}
          ${linksHtml}
        </div>
      `;

      group.appendChild(item);
    }

    list.appendChild(group);
  }
})();


/* ══════════════════════════════════════════════
   4.  CONTACT FORM (basic UX)
   ══════════════════════════════════════════════ */

(function initContactForm() {
  // CUSTOMIZE: Wire up the form action to Formspree / Netlify Forms / your backend
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = document.getElementById('form-submit');
    if (!btn) return;

    btn.innerHTML = '<i class="fa-solid fa-check"></i>&nbsp; SENT!';
    btn.style.borderColor = 'rgba(100, 220, 140, 0.7)';
    btn.disabled = true;

    setTimeout(() => {
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>&nbsp; SEND';
      btn.style.borderColor = '';
      btn.disabled = false;
      form.reset();
    }, 3000);

    // CUSTOMIZE: Replace with your actual POST endpoint e.g. Formspree:
    // fetch('https://formspree.io/f/YOUR_FORM_ID', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(Object.fromEntries(new FormData(form))),
    // });
  });
})();


/* ══════════════════════════════════════════════
   5.  HERO ENTRANCE — body.loaded class trigger
   ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');
});

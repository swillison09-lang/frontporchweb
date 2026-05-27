/*
  Front Porch Web — Shared scripts
  Runs on every page. Handles: mobile nav toggle, sticky nav shadow,
  scroll-reveal animations, smooth scrolling, and localStorage utilities.
*/

document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  initNavScroll();
  initScrollReveal();
  initSmoothScrolling();
  initTempSetupShortcut(); // TEMP TESTING — remove before launch
});

/*
  TEMP TESTING — global owner-setup shortcut.
  Ctrl+Shift+S (Cmd+Shift+S on Mac) from any page jumps to /setup.html.
  Also: navigating to /portal.html#setup redirects there (handled in portal.js).
  Remove this function and the matching block in portal.js before launch,
  or replace with a real owner-auth gate.
*/
function initTempSetupShortcut() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      // Skip if a setup page is already open
      if (window.location.pathname.endsWith('/setup.html')) return;
      e.preventDefault();
      window.location.href = '/setup.html';
    }
  });
}


/* Mobile hamburger — toggles .open on #navLinks and aria-expanded on button */
function initNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // Close menu when any link is clicked
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !links.contains(e.target)) {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}


/* Add .scrolled to navbar after user scrolls — enables drop shadow in CSS */
function initNavScroll() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load in case page is already scrolled
}


/*
  Scroll reveal — uses IntersectionObserver to add .visible to .reveal
  elements as they enter the viewport. CSS handles the animation.
*/
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // animate once
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
}


/* Smooth-scroll for same-page anchor links */
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href   = anchor.getAttribute('href');
      const target = href !== '#' && document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}


/* ---- localStorage utilities (used by portal.js) ---- */

function getLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
}

function clearLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch { /* storage unavailable */ }
}

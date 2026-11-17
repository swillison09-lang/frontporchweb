const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#menu');

function setMenu(open) {
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
}
menuButton.addEventListener('click', () => setMenu(menu.hidden));
document.addEventListener('click', event => {
  if (!menu.hidden && !menuButton.contains(event.target)) setMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !menu.hidden) {
    setMenu(false);
    menuButton.focus();
  }
});

const rail = document.querySelector('#rail');
if (rail) {
  const sceneButton = document.querySelector('.scene-credit');
  const sceneAction = document.querySelector('#scene-action');
  function showSceneOnly(enabled) {
    document.body.classList.toggle('scene-only', enabled);
    document.querySelector('main').inert = enabled;
    sceneButton.setAttribute('aria-pressed', String(enabled));
    sceneAction.textContent = enabled ? 'Show website ↙' : 'View full scene ↗';
  }
  sceneButton.addEventListener('click', () => showSceneOnly(sceneButton.getAttribute('aria-pressed') === 'false'));
  document.querySelector('.mast').addEventListener('click', event => {
    if (event.target.closest('.nav-scroll,.brand')) showSceneOnly(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') showSceneOnly(false);
  });
  const previous = document.querySelector('#previous');
  const next = document.querySelector('#next');
  const current = () => rail.querySelector('[aria-current="step"]');
  function updateButtons() {
    previous.disabled = !current()?.previousElementSibling;
    next.disabled = !current()?.nextElementSibling;
  }
  previous.addEventListener('click', () => current()?.previousElementSibling?.click());
  next.addEventListener('click', () => current()?.nextElementSibling?.click());
  // The original scene owns the tour position and its navigation buttons.
  // Only update our controls when their current chapter actually changes.
  let activeButton;
  new MutationObserver(() => {
    if (current() !== activeButton) {
      activeButton = current();
      updateButtons();
    }
  }).observe(rail, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  updateButtons();
  const fallback = document.querySelector('#fallback');
  function openStandardView() {
    if (fallback.classList.contains('show')) location.replace('standard.html');
  }
  new MutationObserver(openStandardView).observe(fallback, {attributes: true, attributeFilter: ['class']});
  openStandardView();
}
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.fpwc-launch')?.setAttribute('aria-label', 'Ask the Front Porch Web assistant a question');
});

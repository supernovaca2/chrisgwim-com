// The home page before, and without, the game.
//
// This file is small and imports nothing on purpose: Astro then writes it into
// the page itself instead of a file of its own, so it still runs when the
// game's script never arrives (a dropped connection, a blocked request, a
// deploy that replaced the file mid-visit). For the same reason the game does
// not import it. The two talk through the page:
//
//   <html data-game>      set by the game's script the moment it starts
//   game:failed           dispatched on document by the game when it cannot
//                         run; event.detail is the sentence to show

/**
 * Lane colors arrive as data-color attributes and are applied here, through the
 * style object. The site's content security policy refuses inline style
 * attributes, so the server cannot write them into the markup.
 */
function paintLanes() {
  document.querySelectorAll('[data-color]').forEach((el) => {
    if (/^#[0-9a-f]{6}$/i.test(el.dataset.color)) el.style.setProperty('--c', el.dataset.color);
  });
}

/** Turn the page into its track list: every release, as plain links. */
function showFallback(message) {
  document.body.classList.add('no-gl');
  document.body.classList.remove('booting');      // lift the loading cover: this is the page now
  const sheet = document.getElementById('tracks');
  if (!sheet) return;
  sheet.removeAttribute('inert');
  sheet.classList.add('on');
  document.getElementById('tracks-h').textContent = 'Chris Gwim';
  document.getElementById('tracks-sub').textContent = message;
  const foot = sheet.querySelector('.tl-foot');
  if (foot) foot.hidden = false;
}

paintLanes();
document.addEventListener('game:failed', (event) => showFallback(String(event.detail || '')));
// By now every script on the page has either run or failed to load. No mark from the game
// means it never arrived, and nothing else is going to lift the loading cover.
document.addEventListener('DOMContentLoaded', () => {
  if ('game' in document.documentElement.dataset) return;
  showFallback('The game did not load, so here is every release. ');
  // Usually a dropped connection, so offer the one thing that fixes it.
  const again = document.createElement('a');
  again.href = location.pathname;
  again.textContent = 'Try again';
  document.getElementById('tracks-sub').append(again);
});

// What the home page does when the world cannot run: no WebGL 2, or the game
// threw while starting. Kept apart from the game so it still works when the
// game's own code is the problem.

/**
 * Lane colors arrive as data-color attributes and are applied here, through the
 * style object. The site's content security policy refuses inline style
 * attributes, so the server cannot write them into the markup.
 */
export function paintLanes(root = document) {
  root.querySelectorAll('[data-color]').forEach((el) => {
    if (/^#[0-9a-f]{6}$/i.test(el.dataset.color)) el.style.setProperty('--c', el.dataset.color);
  });
}

/** Turn the page into its track list: every release, as plain links. */
export function showFallback(message) {
  paintLanes();
  document.body.classList.add('no-gl');
  const sheet = document.getElementById('tracks');
  if (!sheet) return;
  sheet.removeAttribute('inert');
  sheet.classList.add('on');
  document.getElementById('tracks-h').textContent = 'Chris Gwim';
  document.getElementById('tracks-sub').textContent = message;
  const foot = sheet.querySelector('.tl-foot');
  if (foot) foot.hidden = false;
}

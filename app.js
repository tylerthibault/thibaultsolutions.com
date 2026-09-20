(() => {
  const buttons = [...document.querySelectorAll('.direction-btn')];
  const directions = [...document.querySelectorAll('.site-direction')];
  const note = document.querySelector('.prototype-note');
  const closeNote = document.querySelector('.prototype-close');

  function activate(index, updateHash = true) {
    const safeIndex = Math.min(5, Math.max(1, Number(index) || 1));
    directions.forEach((page) => page.classList.toggle('is-active', Number(page.dataset.direction) === safeIndex));
    buttons.forEach((button) => {
      const active = Number(button.dataset.style) === safeIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.body.dataset.style = String(safeIndex);
    document.documentElement.scrollTop = 0;
    if (updateHash) history.replaceState(null, '', '#style-' + safeIndex);
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => activate(button.dataset.style));
  });

  window.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const current = Number(document.body.dataset.style || 1);
    const next = event.key === 'ArrowRight' ? (current % 5) + 1 : ((current + 3) % 5) + 1;
    activate(next);
  });

  closeNote?.addEventListener('click', () => note?.remove());

  const match = window.location.hash.match(/style-(\d)/);
  activate(match ? match[1] : 1, false);
})();

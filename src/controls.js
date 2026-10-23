/** Bind native buttons without installing global pointer or keyboard handlers.
 * Controls are outside the canvas, so touching them never grabs the wordmark.
 */
export function bindControls({
  onPause = () => {},
  onSpeed = () => {},
  onReveal = () => {},
  initiallyPaused = false,
  revealAvailable = false,
} = {}) {
  const pause = document.getElementById('pause-control');
  const speed = document.getElementById('speed-control');
  const reveal = document.getElementById('reveal-control');

  if (!pause || !speed || !reveal) {
    throw new Error('Wordmark controls require #pause-control, #speed-control and #reveal-control.');
  }

  const state = {
    paused: Boolean(initiallyPaused),
    speed: 1,
    reveal: Boolean(revealAvailable),
  };
  let available = Boolean(revealAvailable);
  const removers = [];

  function listen(element, type, callback) {
    element.addEventListener(type, callback);
    removers.push(() => element.removeEventListener(type, callback));
  }

  function render() {
    pause.textContent = state.paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-label', state.paused ? 'Play base animation' : 'Pause base animation');
    pause.setAttribute('aria-pressed', String(state.paused));

    speed.textContent = state.speed === 1 ? 'Slow' : 'Fast';
    speed.setAttribute('aria-label', state.speed === 1 ? 'Slow down base animation' : 'Restore normal animation speed');
    speed.setAttribute('aria-pressed', String(state.speed !== 1));

    reveal.textContent = available ? `Reveal ${state.reveal ? 'on' : 'off'}` : 'Reveal unavailable';
    reveal.disabled = !available;
    reveal.setAttribute('aria-pressed', String(state.reveal));
    reveal.setAttribute('aria-label', available ? 'Toggle tattoo artwork reveal' : 'Tattoo artwork has not been supplied');
    reveal.title = available ? 'Show artwork near the configured rotation angle' : 'Requires the original transparent tattoo artwork';
  }

  function setPaused(value) {
    const next = Boolean(value);
    if (next === state.paused) return;
    state.paused = next;
    render();
    onPause(next);
  }

  listen(pause, 'click', () => setPaused(!state.paused));
  listen(speed, 'click', () => {
    state.speed = state.speed === 1 ? 0.5 : 1;
    render();
    onSpeed(state.speed);
  });
  listen(reveal, 'click', () => {
    if (!available) return;
    state.reveal = !state.reveal;
    render();
    onReveal(state.reveal);
  });

  for (const button of [pause, speed, reveal]) {
    button.type = 'button';
    listen(button, 'pointerdown', (event) => event.stopPropagation());
  }

  render();

  return {
    getState: () => ({ ...state }),
    setPaused,
    setRevealAvailable(value) {
      const wasVisible = state.reveal;
      const previouslyAvailable = available;
      available = Boolean(value);
      if (!available) state.reveal = false;
      else if (!previouslyAvailable) state.reveal = true;
      render();
      if (wasVisible !== state.reveal) onReveal(state.reveal);
    },
    destroy() {
      for (const remove of removers) remove();
    },
  };
}

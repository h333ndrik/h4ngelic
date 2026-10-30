import './sound-controls.css';


/** Enhance the existing SOUND button; one document-level controller survives
 * internal routes together with the existing mode/audio controller. */
export function initSoundControls({ doc = document, audio } = {}) {
  const view = doc.defaultView;
  const controls = new Map();
  const timers = new Set();
  let nextId = 0;
  let open = null;

  function close({ restoreFocus = false } = {}) {
    if (!open) return;
    const control = open;
    open = null;
    control.arrow.setAttribute('aria-expanded', 'false');
    control.wrapper.removeAttribute('data-volume-open');
    control.popup.inert = true;
    control.popup.setAttribute('aria-hidden', 'true');
    if (restoreFocus) control.arrow.focus({ preventScroll: true });
    const timer = view.setTimeout(() => {
      timers.delete(timer);
      if (open !== control) control.popup.hidden = true;
    }, view.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
    timers.add(timer);
  }

  function enhance(button) {
    const wrapper = doc.createElement('span');
    wrapper.className = 'sound-control';
    wrapper.setAttribute('data-sound-control', '');
    wrapper.setAttribute('data-corruption-protected', '');
    button.before(wrapper);
    wrapper.append(button);
    const id = `h4-volume-${++nextId}`;
    wrapper.insertAdjacentHTML('beforeend', `<button class="sound-volume-toggle" type="button" data-sound-volume-toggle aria-label="adjust sound volume" aria-expanded="false" aria-controls="${id}"><span aria-hidden="true">⌃</span></button><span class="sound-volume-popup" id="${id}" data-sound-volume-popup role="group" aria-label="sound volume" aria-hidden="true" hidden inert><label class="sr-only" for="${id}-range">sound volume</label><input id="${id}-range" data-sound-volume type="range" min="0" max="100" step="1"><output data-sound-volume-value aria-hidden="true"></output></span>`);
    const control = {
      button, wrapper,
      arrow: wrapper.querySelector('[data-sound-volume-toggle]'),
      popup: wrapper.querySelector('[data-sound-volume-popup]'),
      range: wrapper.querySelector('[data-sound-volume]'),
      value: wrapper.querySelector('[data-sound-volume-value]'),
    };
    controls.set(button, control);
    return control;
  }

  function refresh() {
    for (const [button, control] of controls) if (!button.isConnected) {
      if (open === control) close();
      controls.delete(button);
    }
    for (const button of doc.querySelectorAll('[data-mode-mute]')) {
      const control = controls.get(button) || enhance(button);
      button.textContent = audio.muted ? 'sound off' : 'sound on';
      button.setAttribute('aria-pressed', String(audio.muted));
      button.setAttribute('aria-label', audio.supported ? (audio.muted ? 'turn sound on' : 'turn sound off') : 'sound unavailable');
      button.disabled = !audio.supported;
      control.arrow.disabled = !audio.supported;
      const percent = Math.round(audio.volume * 100);
      control.range.value = String(percent);
      control.range.setAttribute('aria-valuetext', `${percent} percent`);
      control.value.value = `${percent}%`;
      control.value.textContent = `${percent}%`;
    }
    for (const button of doc.querySelectorAll('[data-smash]')) {
      button.disabled = !audio.smashAvailable;
      button.setAttribute('aria-pressed', String(audio.smashPlaying));
      button.setAttribute('aria-label', audio.smashPlaying ? 'stop soundtrack' : 'play soundtrack');
      button.title = audio.smashAvailable ? '' : 'soundtrack unavailable';
    }
  }

  function click(event) {
    const mute = event.target.closest?.('[data-mode-mute]');
    if (mute && !mute.disabled) {
      audio.setMuted(!audio.muted);
      if (!audio.muted) void audio.prime(event).then(refresh);
      return;
    }
    const arrow = event.target.closest?.('[data-sound-volume-toggle]');
    if (arrow && !arrow.disabled) {
      const control = [...controls.values()].find(candidate => candidate.arrow === arrow);
      if (!control) return;
      if (open === control) { close(); return; }
      close();
      open = control;
      control.popup.hidden = false;
      control.popup.inert = false;
      control.popup.setAttribute('aria-hidden', 'false');
      arrow.setAttribute('aria-expanded', 'true');
      // Flush only this tiny popup before the transform/opacity transition.
      void control.popup.offsetHeight;
      control.wrapper.setAttribute('data-volume-open', '');
      if (event.detail === 0) control.range.focus({ preventScroll: true });
      return;
    }
    const smash = event.target.closest?.('[data-smash]');
    if (smash && !smash.disabled) void audio.toggleSmash(event).then(refresh);
  }
  function input(event) {
    if (event.target.matches?.('[data-sound-volume]')) audio.setVolume(Number(event.target.value) / 100);
  }
  function outside(event) { if (open && !open.wrapper.contains(event.target)) close(); }
  function keydown(event) {
    if (event.key === 'Escape' && open) { event.preventDefault(); close({ restoreFocus: true }); }
  }
  function focusout(event) {
    if (open && !open.wrapper.contains(event.relatedTarget)) close();
  }
  const unsubscribe = audio.subscribe(refresh);
  const pagechange = () => { close(); refresh(); };
  doc.addEventListener('click', click);
  doc.addEventListener('input', input);
  doc.addEventListener('pointerdown', outside, { passive: true });
  doc.addEventListener('keydown', keydown);
  doc.addEventListener('focusout', focusout);
  doc.addEventListener('h4:pagechange', pagechange);
  refresh();
  const dispose = () => {
    close();
    unsubscribe();
    for (const timer of timers) view.clearTimeout(timer);
    doc.removeEventListener('click', click);
    doc.removeEventListener('input', input);
    doc.removeEventListener('pointerdown', outside);
    doc.removeEventListener('keydown', keydown);
    doc.removeEventListener('focusout', focusout);
    doc.removeEventListener('h4:pagechange', pagechange);
    for (const { button, wrapper } of controls.values()) { wrapper.before(button); wrapper.remove(); }
    controls.clear();
  };
  dispose.refresh = refresh;
  return dispose;
}

import './sound-controls.css';


/** Enhance the existing SOUND button; one document-level controller survives
 * internal routes together with the existing mode/audio controller. */
export function initSoundControls({ doc = document, audio } = {}) {
  const view = doc.defaultView;
  const reducedMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const perf = Array.isArray(view.__H4_AUDIO_PERF__) ? view.__H4_AUDIO_PERF__ : null;
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
    const started = perf ? performance.now() : 0;
    const wrapper = doc.createElement('span');
    wrapper.className = 'sound-control';
    wrapper.setAttribute('data-sound-control', '');
    wrapper.setAttribute('data-corruption-protected', '');
    button.before(wrapper);
    wrapper.append(button);
    const id = `h4-volume-${++nextId}`;
    wrapper.insertAdjacentHTML('beforeend', `<button class="sound-volume-toggle" type="button" data-sound-volume-toggle aria-label="adjust sound volume" aria-expanded="false" aria-controls="${id}"><span aria-hidden="true">⌃</span></button><span class="sound-volume-popup" id="${id}" data-sound-volume-popup role="group" aria-label="sound volume" aria-hidden="true" hidden inert><label class="sr-only" for="${id}-range">sound volume</label><input id="${id}-range" data-sound-volume type="range" min="0" max="100" step="1"><output data-sound-volume-value aria-hidden="true"></output></span>`);
    button.insertAdjacentHTML('afterend', '<span class="sound-activity" data-sound-activity aria-hidden="true"><i></i><i></i><i></i></span>');
    const control = {
      button, wrapper,
      arrow: wrapper.querySelector('[data-sound-volume-toggle]'),
      popup: wrapper.querySelector('[data-sound-volume-popup]'),
      range: wrapper.querySelector('[data-sound-volume]'),
      value: wrapper.querySelector('[data-sound-volume-value]'),
      activity: wrapper.querySelector('[data-sound-activity]'),
      frame: 0, lastFrame: 0, buffer: null,
    };
    controls.set(button, control);
    if (perf) perf.push({ name: 'indicatorCreate', ms: performance.now() - started, at: performance.now() });
    return control;
  }

  function stopActivity(control) {
    const started = perf ? performance.now() : 0;
    if (control.frame) { view.cancelAnimationFrame(control.frame); control.frame = 0; }
    control.activity.dataset.active = 'false';
    for (const bar of control.activity.children) bar.style.transform = '';
    audio.detachAnalyser();
    if (perf) perf.push({ name: 'indicatorStop', ms: performance.now() - started, at: performance.now() });
  }
  function tickActivity(control, now) {
    control.frame = 0;
    if (!audio.audible) { stopActivity(control); return; }
    if (now - control.lastFrame >= 1000 / 30) {
      control.lastFrame = now;
      const analyser = audio.analyser;
      if (analyser) {
        const started = perf ? performance.now() : 0;
        if (!control.buffer || control.buffer.length !== analyser.frequencyBinCount) control.buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(control.buffer);
        const bins = control.buffer.length;
        const edges = [0, Math.min(2, bins), Math.min(6, bins), bins];
        for (let index = 0; index < 3; index++) {
          let peak = 0;
          for (let bin = edges[index]; bin < edges[index + 1]; bin++) peak = Math.max(peak, control.buffer[bin]);
          const level = Math.max(.12, Math.min(1, peak / 255));
          control.activity.children[index].style.transform = `scaleY(${level.toFixed(3)})`;
        }
        if (perf) perf.push({ name: 'indicatorFrame', ms: performance.now() - started });
      }
    }
    control.frame = view.requestAnimationFrame(next => tickActivity(control, next));
  }
  function startActivity(control) {
    const started = perf ? performance.now() : 0;
    control.activity.dataset.active = 'true';
    if (!reducedMotion?.matches) {
      audio.attachAnalyser();
      if (!control.frame) control.frame = view.requestAnimationFrame(now => tickActivity(control, now));
    }
    if (perf) perf.push({ name: 'indicatorStart', ms: performance.now() - started, at: performance.now() });
  }

  function refresh() {
    for (const [button, control] of controls) if (!button.isConnected) {
      if (open === control) close();
      stopActivity(control);
      controls.delete(button);
    }
    for (const button of doc.querySelectorAll('[data-mode-mute]')) {
      const control = controls.get(button) || enhance(button);
      const needsResume = Boolean(audio.needsResume && !audio.muted);
      // Rewriting textContent replaces the interaction wrapper (and every text
      // node) even when the label is unchanged — that destroys the click target
      // mid-press, so the very first click on MUTE was swallowed by the
      // document-level audio unlock. Only write when the label really changes.
      const label = needsResume ? 'tap to resume' : audio.muted ? 'sound off' : 'sound on';
      if (button.textContent !== label) button.textContent = label;
      if (needsResume) button.setAttribute('data-sound-resume', '');
      else button.removeAttribute('data-sound-resume');
      button.setAttribute('aria-pressed', String(!audio.muted));
      button.setAttribute('aria-label', !audio.supported ? 'sound unavailable'
        : needsResume ? 'tap to resume sound' : 'sound');
      button.disabled = !audio.supported;
      if (audio.audible) startActivity(control);
      else stopActivity(control);
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
      if (audio.needsResume && !audio.muted) {
        void audio.resume(event).then(refresh);
        return;
      }
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
  const typing = target => Boolean(target) && (target.isContentEditable === true
    || /^(input|textarea|select)$/i.test(target.tagName || ''));
  function keydown(event) {
    if (event.key === 'Escape' && open) { event.preventDefault(); close({ restoreFocus: true }); return; }
    // B-F37: "m" toggles the same mute the button toggles. Never while typing
    // (so "mmmail" stays a message), never with a modifier, and never with a
    // preventDefault inside a field.
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() !== 'm') return;
    if (typing(event.target)) return;
    event.preventDefault();
    audio.setMuted(!audio.muted);
    if (!audio.muted) void audio.prime(event).then(refresh);
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
    for (const control of controls.values()) {
      stopActivity(control);
      control.wrapper.before(control.button);
      control.wrapper.remove();
    }
    controls.clear();
  };
  dispose.refresh = refresh;
  return dispose;
}

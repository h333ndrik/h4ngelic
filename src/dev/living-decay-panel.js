import './living-decay-panel.css';
import {
  livingDecayDefaults,
  livingDecaySchema,
  getLivingDecaySettings,
  configureLivingDecay,
  subscribeLivingDecay,
} from '../data/livingDecaySettings.js';

let panelSequence = 0;

/** The caller must import this module only inside import.meta.env.DEV and
 * ?fx=1 guards. Mounting the panel never prepares or activates the renderer.
 */
export function initLivingDecayPanel({ doc = document, getController = () => null } = {}) {
  if (!doc?.body) return () => {};

  const prefix = `living-decay-${++panelSequence}`;
  const listeners = [];
  const controls = new Map();
  let disposed = false;
  let writingSeed = false;
  let currentSeed = null;

  const element = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = `living-decay-panel__${className}`;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback);
    listeners.push(() => target.removeEventListener(type, callback));
  };
  const button = (className, text) => {
    const node = element('button', className, text);
    node.type = 'button';
    return node;
  };

  const panel = element('aside');
  panel.className = 'living-decay-panel';
  panel.setAttribute('aria-label', 'Living decay calibration');
  panel.setAttribute('data-no-mosh', '');
  panel.setAttribute('data-no-ink', '');
  panel.setAttribute('data-corruption-protected', '');

  const header = element('header', 'header');
  const toggle = button('toggle', 'Living decay calibration');
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-controls', `${prefix}-form`);
  const close = button('close', '×');
  close.setAttribute('aria-label', 'Close living decay calibration');
  header.append(toggle, close);

  const form = element('form', 'form');
  form.id = `${prefix}-form`;
  form.setAttribute('aria-label', 'Living decay settings');
  const status = element('p', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const seedCurrent = element('p', 'seed-current');
  const seedCurrentLabel = element('span', null, 'Current seed');
  seedCurrentLabel.id = `${prefix}-current-seed`;
  const seedOutput = element('output', null, '—');
  seedOutput.setAttribute('aria-labelledby', seedCurrentLabel.id);
  seedCurrent.append(seedCurrentLabel, seedOutput);

  const seedField = element('label', 'seed-field');
  const seedLabel = element('span', null, livingDecaySchema.seed.label);
  const seedInput = element('input');
  seedInput.type = 'text';
  seedInput.name = 'seed';
  seedInput.id = `${prefix}-seed`;
  seedInput.autocomplete = 'off';
  seedInput.spellcheck = false;
  seedInput.value = getLivingDecaySettings().seed === livingDecayDefaults.seed
    ? 'auto' : String(getLivingDecaySettings().seed);
  seedInput.dataset.livingSetting = 'seed';
  seedInput.setAttribute('aria-describedby', `${prefix}-seed-help`);
  seedField.htmlFor = seedInput.id;
  seedField.append(seedLabel, seedInput);
  const seedHelp = element('p', 'status', 'Use auto or an integer from 0 to 4294967295.');
  seedHelp.id = `${prefix}-seed-help`;
  const regenerate = button('regenerate', 'Regenerate composition');
  const rangeControls = element('div', 'controls');

  for (const [key, bounds] of Object.entries(livingDecaySchema)) {
    if (key === 'seed') continue;
    const field = element('label', 'control');
    field.dataset.setting = key;
    const label = element('span', 'label', bounds.label);
    const input = element('input');
    input.type = 'range';
    input.id = `${prefix}-${key}`;
    input.name = key;
    input.min = String(bounds.minimum);
    input.max = String(bounds.maximum);
    input.step = String(bounds.step);
    input.dataset.livingSetting = key;
    field.htmlFor = input.id;
    const output = element('output', 'value');
    output.htmlFor = input.id;
    output.setAttribute('aria-hidden', 'true');
    field.append(label, output, input);
    rangeControls.append(field);
    controls.set(key, { input, output, bounds });
  }

  const actions = element('div', 'actions');
  const reset = button('reset', 'Reset defaults');
  actions.append(reset);
  form.append(status, seedCurrent, seedField, seedHelp, regenerate, rangeControls, actions);
  panel.append(header, form);
  doc.body.append(panel);

  function refreshController(event) {
    if (disposed) return;
    const controller = getController();
    const eventSeed = event?.detail?.seed ?? event?.detail?.ambient?.seed;
    const snapshotSeed = controller?.snapshot?.()?.ambient?.seed;
    const seed = Number.isInteger(eventSeed) ? eventSeed : snapshotSeed;
    if (Number.isInteger(seed) && seed >= 0 && seed <= livingDecaySchema.seed.maximum) currentSeed = seed;
    seedOutput.value = currentSeed === null ? '—' : String(currentSeed);
    const otherSide = doc.documentElement.dataset.mode === 'xray';
    regenerate.disabled = !otherSide || typeof controller?.regenerateLivingDecay !== 'function';
    status.textContent = !otherSide
      ? 'Settings are ready for the next Other Side activation.'
      : regenerate.disabled
        ? 'Waiting for the Other Side renderer.'
        : 'Changes apply to the current composition.';
  }

  function renderSettings(settings, detail) {
    if (disposed) return;
    for (const [key, { input, output, bounds }] of controls) {
      input.value = String(settings[key]);
      output.value = Number.isInteger(bounds.step) ? String(settings[key]) : settings[key].toFixed(2);
      input.setAttribute('aria-valuetext', output.value);
    }
    // Runtime seed changes update the separate current-seed output. Keep the
    // user's choice of "auto" or a reproducible seed in this input.
  }

  function readSeed() {
    const text = seedInput.value.trim();
    if (!text || text.toLowerCase() === 'auto') return { valid: true, seed: undefined };
    const seed = Number(text);
    return { valid: /^\d+$/.test(text) && Number.isSafeInteger(seed)
      && seed >= livingDecaySchema.seed.minimum && seed <= livingDecaySchema.seed.maximum, seed };
  }

  function updateSeed() {
    const { valid, seed } = readSeed();
    seedInput.setCustomValidity(valid ? '' : 'Enter auto or an integer from 0 to 4294967295.');
    if (!valid) {
      seedInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    seedInput.removeAttribute('aria-invalid');
    writingSeed = true;
    try { configureLivingDecay({ seed: seed ?? livingDecayDefaults.seed }); }
    finally { writingSeed = false; }
    return true;
  }

  const unsubscribe = subscribeLivingDecay(renderSettings);
  listen(form, 'submit', event => event.preventDefault());
  listen(form, 'input', event => {
    const key = event.target?.dataset?.livingSetting;
    if (key === 'seed') updateSeed();
    else if (controls.has(key)) configureLivingDecay({ [key]: Number(event.target.value) });
  });
  listen(toggle, 'click', () => {
    form.hidden = !form.hidden;
    toggle.setAttribute('aria-expanded', String(!form.hidden));
  });
  listen(close, 'click', dispose);
  listen(reset, 'click', () => {
    writingSeed = true;
    try { configureLivingDecay(livingDecayDefaults); }
    finally { writingSeed = false; }
    seedInput.value = 'auto';
    seedInput.setCustomValidity('');
    seedInput.removeAttribute('aria-invalid');
    refreshController();
  });
  listen(regenerate, 'click', () => {
    refreshController();
    if (regenerate.disabled || !updateSeed()) {
      if (!regenerate.disabled) seedInput.reportValidity();
      return;
    }
    const controller = getController();
    const { seed } = readSeed();
    if (seed === undefined) controller.regenerateLivingDecay();
    else controller.regenerateLivingDecay(seed);
    refreshController();
  });
  for (const type of ['h4:livingseed', 'h4:modechange', 'h4:corruptionready']) listen(doc, type, refreshController);
  renderSettings(getLivingDecaySettings());
  refreshController();

  function dispose() {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    for (const remove of listeners) remove();
    panel.remove();
  }

  return dispose;
}

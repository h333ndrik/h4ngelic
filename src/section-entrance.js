import './section-entrance.css';
import { aboutSectionProgress, sampleAboutItem } from './data/motionSettings.js';

/**
 * Scroll-Einfahrt fuer Archiv-Sections — dieselbe Kurve wie das Frontpage-
 * Element "01 / creative".
 *
 * Die Frontpage-Section `.content-section[data-motion="work"]` wird in
 * src/scroll-choreography.js ueber `aboutSectionProgress` +
 * `sampleAboutItem(progress, 'link', breite)` bewegt. Genau diese beiden
 * Sampler und damit Schwellen (.68/.10), Easing (smoothProgress) und Distanz
 * (min(28px, 4.5vw)) werden hier importiert, nicht kopiert.
 *
 * Das Original ist scroll-gebunden und laeuft beim Zurueckscrollen rueckwaerts
 * (rest-to-rest, ohne Historie). Deshalb uebernimmt die Section dieses
 * Verhalten statt eines einmaligen Time-outs.
 *
 * Loop-Lebenszyklus (Mobil-Akku):
 * - Innerhalb des erweiterten Viewports (ARM_MARGIN) laeuft eine rAF-Schleife,
 *   die sich selbst neu anfordert. Das ist noetig, weil ein blockierter
 *   Main-Thread (GLB-Decode/Upload) Scroll-Events verschluckt und die Pose sonst
 *   einfriert; der Frame-Loop holt sie selbsttaetig nach.
 * - Verlaesst die Section den erweiterten Viewport, stoppt der
 *   IntersectionObserver die Schleife ueber cancelAnimationFrame (gehaltenes
 *   Handle, kein blosses Flag). Die zuletzt gesetzte Pose bleibt stehen.
 * - Im Hintergrund-Tab (document.hidden) pausiert die Schleife ebenfalls und
 *   laeuft beim Zurueckkommen weiter.
 * - prefers-reduced-motion: Endpose sofort, kein Loop, keine Animation.
 */
const ENTRANCE_ROLE = 'link';
// Arm-Fenster: 15 % ueber und unter dem Fold. Bewusst knapp — bei 150 % lag die
// Section auf jeder getesteten Route dauerhaft im Fenster, der Loop lief also
// auch am Seitenanfang ohne sichtbaren Grund. 15 % reichen, damit der erste
// sichtbare Frame schon eine berechnete Pose hat.
const ARM_MARGIN = '15% 0px';

export function initSectionEntrance(root = document, selector = '[data-section-entrance]') {
  const owner = root.ownerDocument || root;
  const targets = [...root.querySelectorAll(selector)].map((element) => ({ element, top: 0, last: '' }));
  if (!targets.length) return () => {};

  const reduced = owner.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = [];
  let frame = 0;
  let disposed = false;
  let armed = false;
  let measured = false;
  let pageHeight = 0;

  function listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    listeners.push(() => target.removeEventListener(name, callback, options));
  }

  function setPose(target, x, opacity) {
    const rounded = `${x.toFixed(2)}:${opacity.toFixed(4)}`;
    if (target.last === rounded) return;
    target.last = rounded;
    target.element.style.setProperty('--entrance-x', `${x.toFixed(2)}px`);
    target.element.style.setProperty('--entrance-opacity', opacity.toFixed(4));
  }

  function settle(target) {
    target.element.style.setProperty('--entrance-x', '0px');
    target.element.style.setProperty('--entrance-opacity', '1');
    target.last = 'settled';
  }

  function measure() {
    measured = true;
    pageHeight = owner.documentElement.scrollHeight;
    const offset = owner.defaultView.scrollY;
    for (const target of targets) target.top = target.element.getBoundingClientRect().top + offset;
  }

  function apply() {
    if (!measured) measure();
    const view = owner.defaultView;
    const width = view.innerWidth;
    for (const target of targets) {
      const progress = aboutSectionProgress(view.scrollY, target.top, view.innerHeight);
      const sample = sampleAboutItem(progress, ENTRANCE_ROLE, width);
      setPose(target, sample.x, sample.opacity);
    }
  }

  function update() {
    // Handle sofort freigeben: ab hier ist kein Frame mehr ausstehend, `stop()`
    // hat also nichts zu tun und darf die laufende Rechnung nicht abbrechen.
    frame = 0;
    if (disposed || !armed) return;
    // Bilder/Fonts verschieben die Section nach dem ersten Layout; dann neu messen.
    // Der Lesevorgang steht vor allen Schreibzugriffen dieses Frames, also ohne
    // erzwungenes Layout.
    if (measured && owner.documentElement.scrollHeight !== pageHeight) measured = false;
    if (reduced.matches) {
      for (const target of targets) settle(target);
      return;
    }
    apply();
    schedule();
  }

  function stop() {
    if (!frame) return;
    owner.defaultView.cancelAnimationFrame(frame);
    frame = 0;
  }

  function schedule() {
    if (frame || disposed || !armed || owner.hidden) return;
    frame = owner.defaultView.requestAnimationFrame(update);
  }

  function onResize() {
    measured = false;
    schedule();
  }

  // Nur im Umfeld des Viewports rechnen; ausserhalb bleibt die Pose stehen.
  const observer = typeof owner.defaultView.IntersectionObserver === 'function'
    ? new owner.defaultView.IntersectionObserver((entries) => {
      armed = entries.some((entry) => entry.isIntersecting);
      measured = false;
      if (armed) schedule();
      else stop();
    }, { rootMargin: ARM_MARGIN })
    : null;
  if (observer) for (const target of targets) observer.observe(target.element);
  else armed = true;

  listen(owner.defaultView, 'scroll', schedule, { passive: true });
  listen(owner.defaultView, 'resize', onResize);
  listen(owner.defaultView, 'load', onResize);
  listen(owner, 'visibilitychange', () => {
    if (owner.hidden) stop();
    else schedule();
  });
  listen(reduced, 'change', () => {
    if (reduced.matches) {
      stop();
      for (const target of targets) settle(target);
    } else schedule();
  });
  // Startpose sofort setzen: Sections unterhalb des Viewports starten unsichtbar,
  // auch bevor der IntersectionObserver den Frame-Loop scharf schaltet.
  // Reduced Motion springt direkt auf die Endpose.
  if (reduced.matches) for (const target of targets) settle(target);
  else apply();
  schedule();

  return () => {
    disposed = true;
    stop();
    observer?.disconnect();
    for (const remove of listeners.splice(0)) remove();
  };
}

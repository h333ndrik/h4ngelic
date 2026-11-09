/**
 * Ziehgeschwindigkeit aus einem Zeitfenster — ohne Three.js, ohne DOM.
 *
 * Die Geschwindigkeit ist die Distanz der Zeigerpositionen im Fenster geteilt
 * durch die Zeitspanne des Fensters. Damit haengt sie weder von der
 * Pointer-Pollrate noch von der Framerate ab: mehr Ereignisse liefern feinere
 * Positionen, nicht mehr Geschwindigkeit.
 *
 * Ausgelagert, damit die Fensterlaenge in Node messbar ist (M4i); der Viewer
 * benutzt genau diese Implementierung.
 */
export function createPointerWindow({ windowMs, stopMs, sensitivity, limit, minDelta }) {
  const samples = [];

  const cutoffFor = (t) => t - windowMs;

  return {
    get size() {
      return samples.length;
    },

    /** Neuer Wisch: Puffer leeren und den Startpunkt setzen. */
    reset({ x, t }) {
      samples.length = 0;
      samples.push({ t, x });
    },

    /** Position einspeisen; alles ausserhalb des Fensters fliegt raus. */
    push({ x, t }) {
      samples.push({ t, x });
      const cutoff = cutoffFor(t);
      while (samples.length > 2 && samples[0].t < cutoff) samples.shift();
    },

    /**
     * Geschwindigkeit in rad/s zum Zeitpunkt `now`.
     *
     * Die Zeitspanne laeuft bis `now`, nicht bis zur letzten Position: wer
     * den Zeiger anhaelt und dann loslaesst, wird dadurch langsamer, je laenger
     * der Stillstand dauert (bei Stillstand >= Fensterlaenge: 0). Weniger als
     * zwei Positionen im Fenster bedeuten ebenfalls Stillstand (0).
     */
    velocity(now) {
      if (samples.length < 2) return 0;
      const lastIndex = samples.length - 1;
      const last = samples[lastIndex];
      // Stillstand: liegt die letzte Position mindestens `stopMs` zurueck, ist
      // die Bewegung vorbei (0) — unabhaengig davon, wie schnell sie war. Das
      // ist eine eigene Regel, nicht die Fensterlaenge: bei 10 fps (ein
      // Ereignis pro Frame) waere ein Fenster von 100 ms sonst immer "Stillstand".
      if (now - last.t >= stopMs) return 0;
      const cutoff = cutoffFor(now);
      // Rueckwaerts ohne Allokation bis zur aeltesten Position im Fenster.
      let firstIndex = lastIndex;
      while (firstIndex > 0 && samples[firstIndex - 1].t >= cutoff) firstIndex -= 1;
      // Mindestens zwei Positionen zaehlen (bei sehr niedriger Bildrate liegt
      // nur eine im Fenster).
      if (firstIndex === lastIndex) firstIndex -= 1;
      const first = samples[firstIndex];
      // Gemessen wird die Bewegung zwischen den Positionen, nicht die Zeit bis
      // zum Loslassen: die Verzoegerung zwischen letztem Ereignis und Release
      // ist Renderlatenz und keine Zeigerbewegung.
      const span = (last.t - first.t) / 1000;
      const pixelsPerSecond = (last.x - first.x) / Math.max(span, minDelta);
      return Math.min(limit, Math.max(-limit, pixelsPerSecond * sensitivity));
    },
  };
}

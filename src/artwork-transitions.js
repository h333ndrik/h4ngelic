import './artwork-transitions.css';

const transitionName = 'h4-artwork';
const visible = (rect) => rect.width > 1 && rect.height > 1 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;

/** The painted photograph's rect, excluding object-fit letterboxing. */
export function artworkRect(image) {
  if (!image?.isConnected || !image.complete || !image.naturalWidth) return null;
  const rect = image.getBoundingClientRect();
  const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const left = rect.left + (rect.width - width) / 2;
  const top = rect.top + (rect.height - height) / 2;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function projectElement(path) {
  return [...document.querySelectorAll('.project[data-project-url]')].find((element) => element.dataset.projectUrl === path);
}

function imageAt(project, index) {
  return [...(project?.querySelectorAll('.project-image img') || [])].find((image) => image.dataset.artworkImage === index)
    || project?.querySelector('.project-image img');
}

/** Name only the matching old/new image during a real URL View Transition. */
export function prepareArtworkTransition(route, trigger, { animate = true, fromHash = '' } = {}) {
  const detail = document.querySelector('.artwork-detail[data-project-url]');
  let project;
  let source;
  let index;
  if (route.kind === 'artwork') {
    project = projectElement(route.canonicalPath);
    if (!project || project.matches('.artwork-detail')) return null;
    const requested = /^#image-(\d+)$/.exec(location.hash);
    source = trigger?.querySelector('img') || imageAt(project, String(Math.max(0, Number(requested?.[1] || 1) - 1)));
  } else if (route.kind === 'work' && detail) {
    project = detail;
    const requested = /^#image-(\d+)$/.exec(fromHash);
    source = document.querySelector('.artwork-dialog[open] .artwork-flight-copy')
      || document.querySelector('.artwork-dialog[open] .artwork-viewer-image')
      || (requested && imageAt(detail, String(Math.max(0, Number(requested[1]) - 1))))
      || [...detail.querySelectorAll('.project-image img')].find((image) => {
        const rect = artworkRect(image); return rect && visible(rect);
      }) || detail.querySelector('.project-image img');
  } else return null;
  if (!source) return null;
  const rect = artworkRect(source);
  const shared = animate && rect && visible(rect) && Number(getComputedStyle(source).opacity) >= .5
    && getComputedStyle(source).visibility !== 'hidden';
  index = source.dataset.artworkImage || '0';
  const path = project.dataset.projectUrl;
  const saved = new Map();
  let disposed = false;
  const name = (image) => {
    saved.set(image, image.style.viewTransitionName);
    image.style.viewTransitionName = transitionName;
  };
  if (shared) name(source);
  return {
    async afterRender() {
      const destination = imageAt(projectElement(path), index);
      if (!destination || disposed) return;
      if (route.kind === 'work') destination.closest('a, button')?.focus({ preventScroll: true });
      if (!shared) return;
      // Image decode progresses while View Transition painting is suspended;
      // requestAnimationFrame does not, so it must not be awaited here.
      if (!destination.complete || !destination.naturalWidth) {
        let timer;
        await Promise.race([
          destination.decode().catch(() => {}),
          new Promise((resolve) => { timer = setTimeout(resolve, 200); }),
        ]);
        clearTimeout(timer);
      }
      if (disposed || !destination.isConnected || !destination.naturalWidth) return;
      const bounds = artworkRect(destination);
      if (!bounds || !visible(bounds)) return;
      destination.closest('.project-image')?.classList.add('is-image-revealed', 'image-reveal-instant');
      name(destination);
    },
    cleanup() {
      if (disposed) return;
      disposed = true;
      for (const [image, previous] of saved) image.style.viewTransitionName = previous;
      saved.clear();
    },
  };
}

/** One decorative FLIP copy in the existing dialog's top layer. */
export function animateArtworkFlight({ from, to, host, direction = 'opening', fromRect }) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof Element.prototype.animate !== 'function') return null;
  const start = fromRect || artworkRect(from);
  const end = artworkRect(to);
  if (!start || !end || !visible(start) || !visible(end)) return null;
  const copy = new Image();
  copy.className = 'artwork-flight-copy';
  copy.dataset.artworkFlightCopy = '';
  copy.alt = '';
  copy.setAttribute('aria-hidden', 'true');
  copy.draggable = false;
  copy.dataset.artworkImage = from.dataset.artworkImage || to.dataset.artworkImage || '0';
  copy.src = direction === 'closing' ? from.currentSrc || from.src : to.currentSrc || to.src;
  Object.assign(copy.style, {
    left: `${end.left}px`, top: `${end.top}px`, width: `${end.width}px`, height: `${end.height}px`,
  });
  const originals = new Map([[from, from.style.visibility], [to, to.style.visibility]]);
  for (const image of originals.keys()) image.style.visibility = 'hidden';
  host.dataset.artworkFlight = direction;
  host.append(copy);
  // A single scale preserves the photograph's proportions at every frame.
  const scale = start.width / end.width;
  const animation = copy.animate([
    { transform: `translate(${start.left - end.left}px, ${start.top - end.top}px) scale(${scale})` },
    { transform: 'translate(0, 0) scale(1)' },
  ], { duration: 360, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'both' });
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    animation.cancel();
    copy.remove();
    delete host.dataset.artworkFlight;
    for (const [image, visibility] of originals) image.style.visibility = visibility;
  };
  return {
    currentRect: () => copy.isConnected ? copy.getBoundingClientRect() : null,
    cancel: cleanup,
    finished: animation.finished.then(() => true, () => false).finally(cleanup),
  };
}

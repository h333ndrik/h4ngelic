import { featuredDigitalArtwork } from './digitalArtworkSettings.js';

/**
 * The portfolio archive. Add real projects here when they are ready to show.
 * Place image files in public/images/ and reference them as /images/filename.
 * The existing tattoo reflection texture is not automatically a portfolio entry.
 *
 * Each project accepts:
 * - id: a unique, lowercase slug.
 * - category: 'tattoos', 'flashes', 'jewellery', 'analog-photography' or 'digital-artworks'.
 *   Legacy 'paintings' projects remain supported. Use leaf categories, never 'more'.
 * - title, description, year: optional project information.
 * - images: [{ src, alt, caption?, width?, height? }]. Supply useful alt text.
 * - details: optional additional information, e.g. { materials: 'silver' }.
 * - mannequin: optional { model: '/models/validated-mannequin.glb', ...placement }
 *   for flashes only; see docs/MANNEQUIN-WORKFLOW.md before publishing a model.
 * - order: optional numeric display order; otherwise keep authored array order.
 * - featured: optional homepage/editorial selection metadata (the homepage
 *   intentionally presents categories, never unsolicited image cards).
 * - cover: optional image src to present first; defaults to the first image.
 * - published: set false to keep a draft out of every gallery.
 *
 * Copyable example (replace every example value with your actual project):
 * {
 *   id: 'your-project-slug',
 *   category: 'tattoos',
 *   title: 'your project title',
 *   year: 2026,
 *   description: 'your description',
 *   images: [
 *     { src: '/images/your-image.webp', alt: 'Describe this artwork.' },
 *     { src: '/images/your-detail.webp', alt: 'Describe this detail.' },
 *   ],
 *   details: {},
 *   published: true,
 * },
 */
// The eight Tattoo photographs are the exact user-supplied JPEG originals,
// kept in ZIP entry order. Titles, dates and descriptions remain empty until
// the artist provides them; these IDs identify photographs, not invented work.
export const suppliedTattooPhotographs = [
  {
    id: "tattoo-01",
    category: 'tattoos',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/tattoos/tattoo-01.jpg",
      alt: "abstract black ink tattoo curving across the lower abdomen.",
      width: 1170,
      height: 1470,
    }],
  },
  {
    id: "tattoo-02",
    category: 'tattoos',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/tattoos/tattoo-02.jpg",
      alt: "fragmented black ink tattoo with flowing forms along the side of the torso.",
      width: 1170,
      height: 1734,
    }],
  },
  {
    id: "tattoo-03",
    category: 'tattoos',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/tattoos/tattoo-03.jpg",
      alt: "textured black ink tattoo extending down the arm.",
      width: 1170,
      height: 1674,
    }],
  },
  {
    id: "tattoo-04",
    category: 'tattoos',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/tattoos/tattoo-04.jpg",
      alt: "flowing black ink tattoo across a bent knee and lower leg.",
      width: 2476,
      height: 3606,
    }],
  },
  {
    id: "tattoo-05",
    category: 'tattoos',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/tattoos/tattoo-05.jpg",
      alt: "large fragmented black ink tattoo across the back and shoulders.",
      width: 2480,
      height: 3307,
    }],
  },
  {
    id: "tattoo-06",
    category: 'tattoos',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/tattoos/tattoo-06.jpg",
      alt: "black ornamental tattoo on the upper arm.",
      width: 2480,
      height: 3308,
    }],
  },
  {
    id: "tattoo-07",
    category: 'tattoos',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/tattoos/tattoo-07.jpg",
      alt: "fragmented black ink tattoo across the side of the abdomen.",
      width: 2480,
      height: 3308,
    }],
  },
  {
    id: "tattoo-08",
    category: 'tattoos',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/tattoos/tattoo-08.jpg",
      alt: "detailed black ink tattoo extending down the forearm.",
      width: 2480,
      height: 3308,
    }],
  },
];

// Fifteen pencil flash sheets supplied on 20.11.2026. Copied once into
// public/images/flashes/ after a single sips pass (905×1280 JPG, quality 60);
// the originals on the artist's machine are untouched.
export const suppliedFlashPhotographs = [
  {
    id: "flash-01",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-01.jpg",
      alt: "pencil flash sheet 01 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-02",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-02.jpg",
      alt: "pencil flash sheet 02 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-03",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-03.jpg",
      alt: "pencil flash sheet 03 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-04",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-04.jpg",
      alt: "pencil flash sheet 04 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-05",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-05.jpg",
      alt: "pencil flash sheet 05 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-06",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-06.jpg",
      alt: "pencil flash sheet 06 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-07",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-07.jpg",
      alt: "pencil flash sheet 07 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-08",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-08.jpg",
      alt: "pencil flash sheet 08 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-09",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-09.jpg",
      alt: "pencil flash sheet 09 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-10",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-10.jpg",
      alt: "pencil flash sheet 10 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-11",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-11.jpg",
      alt: "pencil flash sheet 11 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-12",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-12.jpg",
      alt: "pencil flash sheet 12 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-13",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-13.jpg",
      alt: "pencil flash sheet 13 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-14",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-14.jpg",
      alt: "pencil flash sheet 14 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
  {
    id: "flash-15",
    category: 'flashes',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/flashes/flash-15.jpg",
      alt: "pencil flash sheet 15 — hand-drawn tattoo design on white paper.",
      width: 905,
      height: 1280,
    }],
  },
];

// The actual green/black original stays shared by its archive and detail route.
// Reference textures are not automatically portfolio entries.
// Eight analog photographs supplied on 25.11.2026 from the artist's own
// folder ("website pics analog"). Compressed once with sips (long side 1358 /
// 905 px width for portraits, 1280 px for the one landscape frame, quality
// 50-55) so every file stays below 300 KB; the originals on the artist's
// machine are untouched. Titles and descriptions remain empty.
export const suppliedAnalogPhotographs = [
  {
    id: "analog-01",
    category: 'analog-photography',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/analog-photography/analog-01.jpg",
      alt: "motion-blurred analog photograph of a person on a staircase with a green railing and a red handrail.",
      width: 905,
      height: 1357,
    }],
  },
  {
    id: "analog-02",
    category: 'analog-photography',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/analog-photography/analog-02.jpg",
      alt: "analog photograph of two people on a rooftop terrace, one bending forward in a red sweater, the other standing on the concrete parapet.",
      width: 1280,
      height: 853,
    }],
  },
  {
    id: "analog-03",
    category: 'analog-photography',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/analog-photography/analog-03.jpg",
      alt: "analog photograph of a tall television tower with a red-lit observation deck against a dusky sky.",
      width: 905,
      height: 1357,
    }],
  },
  {
    id: "analog-04",
    category: 'analog-photography',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/analog-photography/analog-04.jpg",
      alt: "analog photograph of a concert crowd in blue stage haze with a singer silhouetted on stage.",
      width: 905,
      height: 1357,
    }],
  },
  {
    id: "analog-05",
    category: 'analog-photography',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/analog-photography/analog-05.jpg",
      alt: "analog photograph of large tropical leaves and palm fronds against a glass roof.",
      width: 905,
      height: 1117,
    }],
  },
  {
    id: "analog-06",
    category: 'analog-photography',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/analog-photography/analog-06.jpg",
      alt: "analog photograph of a car driving through a green-lit stone tunnel, with a traffic light and a direction sign at the right.",
      width: 905,
      height: 1117,
    }],
  },
  {
    id: "analog-07",
    category: 'analog-photography',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/analog-photography/analog-07.jpg",
      alt: "analog photograph of green protective suits hanging under a ceiling with green stripes.",
      width: 905,
      height: 1357,
    }],
  },
  {
    id: "analog-08",
    category: 'analog-photography',
    title: '',
    description: '',
    published: true,
    images: [{
      src: "/images/analog-photography/analog-08.jpg",
      alt: "analog photograph of a snow-covered narrow street between tall buildings, with an upturned white cabinet in the foreground.",
      width: 905,
      height: 1272,
    }],
  },
];

export const artworks = [featuredDigitalArtwork, ...suppliedTattooPhotographs, ...suppliedFlashPhotographs, ...suppliedAnalogPhotographs];

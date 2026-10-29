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

// The actual green/black original stays shared by its archive and detail route.
// Reference textures are not automatically portfolio entries.
export const artworks = [featuredDigitalArtwork, ...suppliedTattooPhotographs];

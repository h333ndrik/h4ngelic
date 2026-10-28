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
// The actual green/black original is shared by the archive and detail route.
// Add further real projects below; no reference texture is a portfolio entry.
export const artworks = [featuredDigitalArtwork];

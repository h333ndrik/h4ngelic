/**
 * The portfolio archive. Add real projects here when they are ready to show.
 * Place image files in public/images/ and reference them as /images/filename.
 * The existing tattoo reflection texture is not automatically a portfolio entry.
 *
 * Each project accepts:
 * - id: a unique, lowercase slug.
 * - category: 'tattoos', 'jewellery' or 'paintings'.
 * - title, description, year: optional project information.
 * - images: [{ src, alt, caption?, width?, height? }]. Supply useful alt text.
 * - details: optional additional information, e.g. { materials: 'silver' }.
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
export const artworks = [];

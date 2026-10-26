/**
 * Edit this file for website copy, categories and contact destinations.
 * Leave a contact value empty until you are ready to publish that link.
 * Use https:// URLs for external links; email is a plain address, not mailto:.
 */
export const siteContent = {
  name: 'h4ngelic',
  artistName: 'Hendrik',
  artistAlias: 'h333ndrik',
  copyrightYear: 2026,
  location: 'berlin, de',

  categories: [
    { id: 'tattoos', label: 'tattoos', group: 'tattoos', presentation: 'drift' },
    { id: 'flashes', label: 'flashes', group: 'tattoos', presentation: 'drift' },
    { id: 'jewellery', label: 'jewellery', presentation: 'existing' },
    { id: 'analog-photography', label: 'analog photography', group: 'more', presentation: 'drift' },
    { id: 'digital-artworks', label: 'digital artworks', group: 'more', presentation: 'ink' },
    // Keep existing painting links and content valid without adding another main rubric.
    { id: 'paintings', label: 'paintings', legacy: true, presentation: 'existing' },
  ],

  // The frontpage remains exactly three horizontal rubrics. Children stay shared
  // with the work archive; changing worlds never mounts a different content tree.
  workGroups: [
    { id: 'tattoos', label: 'tattoos', children: ['tattoos', 'flashes'] },
    { id: 'jewellery', label: 'jewellery', children: ['jewellery'] },
    { id: 'more', label: 'more', children: ['analog-photography', 'digital-artworks'] },
  ],

  home: {
    selectedWorkLabel: '01 / SELECTED WORKS',
    aboutLabel: '02 / ABOUT',
    contactLabel: '03 / CONTACT',
    tagline: 'mixed media',
    aboutPreview: 'mixed media. ink, metal and everything in between.',
    moreAboutLabel: 'MORE ABOUT',
  },

  about: {
    intro: "hi, i'm hendrik.",
    location: 'independent artist based in berlin.',
    paragraphs: [
      'i like making things, breaking things apart, and finding new ways to connect them.',
      'fragments, ornaments, tangled shapes, things that seem unfinished but somehow belong together.',
      "sometimes it's ink, sometimes it's metal, sometimes it's something else entirely.",
      'i see the body as an extension of my work, not just a surface for it. something that moves, changes, and becomes part of the composition.',
      "i'd rather see where they go.",
    ],
    // Optional: { src: '/images/portrait.webp', alt: 'Your portrait description' }
    portrait: null,
    // Optional: [{ title: 'Reference title', url: 'https://example.com' }]
    references: [],
  },

  contact: {
    instagramURL: 'https://www.instagram.com/h4ngelic/',
    email: 'h4ngelic@gmail.com',
    bookingURL: '',
  },
};

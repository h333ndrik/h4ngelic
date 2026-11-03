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
    { id: 'tattoos', label: 'tattoos', archiveLabel: 'on skin', group: 'tattoos', presentation: 'drift' },
    { id: 'flashes', label: 'flashes', group: 'tattoos', presentation: 'drift' },
    { id: 'jewellery', label: 'jewellery', presentation: 'existing' },
    { id: 'analog-photography', label: 'analog photography', group: 'more', presentation: 'drift' },
    { id: 'digital-artworks', label: 'digital artworks', group: 'more', presentation: 'existing' },
    // Keep existing painting links and content valid without adding another main rubric.
    { id: 'paintings', label: 'paintings', legacy: true, presentation: 'existing' },
  ],

  // Four horizontal rubrics stay shared with the work archive. The tools
  // rubric is intentionally external: its cards describe real project URLs.
  workGroups: [
    { id: 'tattoos', label: 'tattoos', archiveLabel: 'on skin', children: ['tattoos', 'flashes'] },
    { id: 'jewellery', label: 'jewellery', children: ['jewellery'] },
    { id: 'tools', label: 'tools', archiveLabel: 'tools', children: ['tools'] },
    { id: 'more', label: 'more', children: ['digital-artworks', 'analog-photography'] },
  ],

  tools: [
    { id: 'm4shlab', title: 'm4shlab', url: 'https://github.com/h333ndrik/m4shlab',
      teaser: 'real h.264 bitstream moshing in the browser. up to 12 clips, five boundary methods, your footage never leaves the device.' },
    { id: 'thr4ce', title: 'thr4ce', url: 'https://h333ndrik.github.io/thr4ce',
      teaser: 'image & stencil editor. black ink or no ink — deterministic morphology brush, print-exact export.' },
  ],

  home: {
    selectedWorkLabel: '01 / creative',
    aboutLabel: '02 / ABOUT',
    contactLabel: '03 / CONTACT',
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

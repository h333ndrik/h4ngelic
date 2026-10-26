/**
 * Edit this file for website copy, categories and contact destinations.
 * Leave a contact value empty until you are ready to publish that link.
 * Use https:// URLs for external links; email is a plain address, not mailto:.
 */
export const siteContent = {
  name: 'h4ngelic',
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
    aboutPreview: 'tattooing, jewellery, painting and everything in between.',
    moreAboutLabel: 'MORE ABOUT',
  },

  about: {
    intro: 'tattooing, jewellery, painting and everything in between.',
    location: 'independent artist based in berlin.',
    paragraphs: [
      'h4ngelic is the creative identity of h333ndrik, an independent artist based in berlin.',
      'working across experimental, figurative blackwork tattooing, jewellery, painting and experimental visual art.',
    ],
    // Optional: { src: '/images/portrait.webp', alt: 'Your portrait description' }
    portrait: null,
    // Optional: [{ title: 'Reference title', url: 'https://example.com' }]
    references: [],
  },

  contact: {
    instagramURL: '',
    email: '',
    bookingURL: '',
  },
};

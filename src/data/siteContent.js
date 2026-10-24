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
    { id: 'tattoos', label: 'tattoos' },
    { id: 'jewellery', label: 'jewellery' },
    { id: 'paintings', label: 'paintings' },
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

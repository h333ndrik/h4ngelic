/**
 * Public metadata. The production domain was confirmed by the artist.
 * Keep previews private from search; enable production explicitly at build time.
 * See docs/SEO.md before changing deployment or crawler policy.
 */
export const seoContent = {
  productionURL: 'https://h4ngelic.com',
  deployment: 'preview',
  siteName: 'h4ngelic',
  language: 'en',
  locale: 'en_GB',
  identity: {
    name: 'h333ndrik',
    alternateName: 'h4ngelic',
    description: 'Independent artist based in Berlin, working across experimental, figurative blackwork tattooing, jewellery, painting and experimental visual art.',
    location: 'Berlin',
  },
  // Optional real, publicly accessible image: { src, alt, width, height }.
  // Leave blank until a suitable image has been supplied. No placeholder image.
  openGraphImage: null,
  pages: {
    home: {
      title: 'h4ngelic — tattoos, jewellery & paintings in berlin',
      description: 'h4ngelic is the creative identity of h333ndrik, an independent Berlin artist working in experimental blackwork tattoos, jewellery and painting.',
    },
    work: {
      title: 'work — h4ngelic',
      description: 'The portfolio of h4ngelic: experimental blackwork tattoos, jewellery and paintings by independent Berlin artist h333ndrik.',
    },
    about: {
      title: 'about h333ndrik / h4ngelic — independent artist in berlin',
      description: 'h4ngelic is the creative identity of h333ndrik, an independent artist based in Berlin, working across tattooing, jewellery, painting and visual art.',
    },
    'not-found': {
      title: 'page not found — h4ngelic',
      description: 'This page could not be found. Explore work by h4ngelic or return to the homepage.',
    },
  },
  categories: {
    tattoos: {
      title: 'experimental blackwork tattoos — h4ngelic, berlin',
      description: 'Experimental, figurative blackwork tattooing by h333ndrik, the independent Berlin artist behind h4ngelic.',
    },
    jewellery: {
      title: 'jewellery — h4ngelic, berlin',
      description: 'Jewellery by h4ngelic, the creative identity of independent Berlin artist h333ndrik.',
    },
    flashes: {
      title: 'tattoo flashes — h4ngelic, berlin',
      description: 'Tattoo flash artwork by h4ngelic, the creative identity of independent Berlin artist h333ndrik.',
    },
    more: {
      title: 'more — analog photography & digital artworks — h4ngelic',
      description: 'Analog photography and digital artwork by independent Berlin artist h333ndrik, working as h4ngelic.',
    },
    'analog-photography': {
      title: 'analog photography — h4ngelic',
      description: 'Analog photography by h4ngelic, the creative identity of independent Berlin artist h333ndrik.',
    },
    'digital-artworks': {
      title: 'digital artworks — h4ngelic',
      description: 'Digital artworks by h4ngelic, the creative identity of independent Berlin artist h333ndrik.',
    },
    paintings: {
      title: 'paintings — h4ngelic, berlin',
      description: 'Painting and experimental visual art by h4ngelic, the creative identity of independent Berlin artist h333ndrik.',
    },
  },
};

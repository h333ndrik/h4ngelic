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
    name: 'Hendrik',
    alternateName: 'h4ngelic',
    description: 'Independent artist based in Berlin, working across tattooing, jewellery, painting and mixed media.',
    location: 'Berlin',
  },
  // Optional real, publicly accessible image: { src, alt, width, height }.
  // Leave blank until a suitable image has been supplied. No placeholder image.
  openGraphImage: null,
  pages: {
    home: {
      title: 'h4ngelic — Hendrik, mixed media artist in berlin',
      description: 'h4ngelic is the creative identity of Hendrik, an independent Berlin artist working across tattooing, jewellery, painting and mixed media.',
    },
    work: {
      title: 'work — h4ngelic',
      description: 'Explore tattoos, jewellery, photography and digital artwork by Hendrik, the independent Berlin artist behind h4ngelic.',
    },
    about: {
      title: 'about Hendrik / h4ngelic — independent artist in berlin',
      description: 'Meet Hendrik, the Berlin-based artist behind h4ngelic, working with ink, metal, painting and mixed media.',
    },
    contact: {
      title: 'contact — h4ngelic',
      description: 'Contact Hendrik at h4ngelic in Berlin for tattoos, jewellery or other projects.',
    },
    'not-found': {
      title: 'page not found — h4ngelic',
      description: 'This page could not be found. Explore work by h4ngelic or return to the homepage.',
    },
  },
  categories: {
    tattoos: {
      title: 'tattoos — h4ngelic, berlin',
      description: 'Tattoo artwork by Hendrik, the independent Berlin artist behind h4ngelic.',
    },
    jewellery: {
      title: 'jewellery — h4ngelic, berlin',
      description: 'Jewellery by h4ngelic, the creative identity of independent Berlin artist Hendrik.',
    },
    flashes: {
      title: 'tattoo flashes — h4ngelic, berlin',
      description: 'Tattoo flash artwork by h4ngelic, the creative identity of independent Berlin artist Hendrik.',
    },
    more: {
      title: 'more — analog photography & digital artworks — h4ngelic',
      description: 'Analog photography and digital artwork by independent Berlin artist Hendrik, working as h4ngelic.',
    },
    'analog-photography': {
      title: 'analog photography — h4ngelic',
      description: 'Analog photography by h4ngelic, the creative identity of independent Berlin artist Hendrik.',
    },
    'digital-artworks': {
      title: 'digital artworks — h4ngelic',
      description: 'Digital artworks by h4ngelic, the creative identity of independent Berlin artist Hendrik.',
    },
    paintings: {
      title: 'paintings — h4ngelic, berlin',
      description: 'Painting and experimental visual art by h4ngelic, the creative identity of independent Berlin artist Hendrik.',
    },
  },
};

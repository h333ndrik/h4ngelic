import { formatIndexedLabel } from '../labels.js';

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
    { id: 'jewellery', label: 'jewellery', presentation: 'drift' },
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
      oneLiner: 'm4shlab — real h.264 bitstream moshing in the browser',
      teaser: 'real h.264 bitstream moshing in the browser. up to 12 clips, five boundary methods, your footage never leaves the device.',
      works: [
        'import footage locally and work with up to 12 clips in one session.',
        'arrange clips, then compose by choosing one of five boundary methods.',
        'export the result while the original files remain untouched.',
      ],
      facts: ['deterministic & reversible', '.m4sh project files', 'offline-ready PWA', 'original files never modified'],
      screens: [
        { state: 'start', src: '/images/tools-source/m4shlab-start.png', alt: 'm4shlab start screen with an empty preview and clip import controls.' },
        { state: 'editor', src: '/images/tools-source/m4shlab-editor.png', alt: 'm4shlab editor with a two-clip sequence and transition controls.' },
        { state: 'export', src: '/images/tools-source/m4shlab-export.png', alt: 'm4shlab export state with the merged preview and export control.' },
      ] },
    { id: 'thr4ce', title: 'thr4ce', url: 'https://h333ndrik.github.io/thr4ce',
      oneLiner: 'thr4ce — image & stencil editor',
      teaser: 'image & stencil editor. black ink or no ink — deterministic morphology brush, print-exact export.',
      works: [
        'import an image and make a stencil with the deterministic morphology brush.',
        'refine the result with dithering methods and presets.',
        'export print-exact artwork at 203 dpi.',
      ],
      facts: ['deterministic & reversible', '.thr4ce project files', 'offline-ready PWA', 'original files never modified'],
      screens: [
        { state: 'start', src: '/images/tools-source/thr4ce-start.png', alt: 'thr4ce start screen with an empty artwork preview.' },
        { state: 'editor', src: '/images/tools-source/thr4ce-editor.png', alt: 'thr4ce editor showing an imported tattoo image and stencil controls.' },
        { state: 'export', src: '/images/tools-source/thr4ce-export.png', alt: 'thr4ce refine and export controls at 203 dpi.' },
      ] },
  ],

  home: {
    selectedWorkLabel: formatIndexedLabel(1, 'creative'),
    aboutLabel: formatIndexedLabel(2, 'more about'),
    contactLabel: formatIndexedLabel(3, 'contact'),
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

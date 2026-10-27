# Digital Artworks: original file and ordinary gallery

The actual original arrived in `90BA527C-F86C-46F7-B5B9-EF625AB7578E.JPG.zip`. Its JPEG bytes are preserved unchanged at:

```
public/images/digital-artworks/green-black-original.jpg
```

Dimensions: **1440×1920**. Size: **836,625 bytes**. SHA-256:
`df0781e4f572ba9e644c3471fbb6060e228c34f02acf32d01f4b0e1dce68132f`.

`featuredDigitalArtwork` in `src/data/digitalArtworkSettings.js` is published and imported by the central `src/data/artworks.js` archive. No title, year or description has been invented. Its alt text describes the visible green/black ripples, white/grey brushstrokes and lower-left signature. The normal pipeline generated 320, 640, 960 and 1440px WebP variants. The original stays intact. The artwork appears under More → Digital Artworks and has its own ordinary detail URL.

## Current presentation

Digital Artworks uses `presentation: 'existing'` in `src/data/siteContent.js` and the ordinary project/image renderer in `src/pages.js`. The image is fully visible when the section is reached. There is no scroll-driven concealment, ink mask, reveal canvas or added sticky scroll distance in the public gallery. The former Digital Ink enhancement and stylesheet are not part of its active page path. Existing source or historical test files for that effect do not mean it remains enabled.

The gallery preserves the supplied image, its aspect ratio and responsive image sizes. Ordinary image controls provide the larger view and project detail context. The accepted Other Side memory-mosh is a separate site effect; removing this artwork's ink reveal does not replace or retune that system.

The shared native horizontal carousel belongs to Tattoos, Flashes and Analog Photography. It is not applied to Digital Artworks or Jewellery. With no published real projects, those carousel categories show their actual empty state, a `0 / 0` counter and disabled navigation. They must not be filled with repeated copies of this digital image, stock images or the logo's reflection material.

## Add or edit real work

Further digital projects use `category: 'digital-artworks'` in `src/data/artworks.js`. Each project can have a unique ID, an optional title, description, year and details, and several genuine images with alt text and optional captions. The same shared data supplies the archive and detail page. `published: false` hides a draft. [CONTENT.md](CONTENT.md) contains a copyable project example and image preparation instructions.

Artist-supplied photographs for the other categories remain necessary before those archives can show actual work. Do not infer missing images or invent project metadata.

An inquiry from a real artwork can carry its ID into the shared Contact form. This does not configure mail delivery: live sending still requires the server/mail setup in [INQUIRY.md](INQUIRY.md). A downloaded standalone HTML preview cannot send an inquiry.

## Verification status

This document records the requested presentation and current content mapping. The previous ink-reveal tests and reference comparison describe the former effect; they do not validate the ordinary gallery or the new carousel/navigation changes. Current build, browser and offline results belong in the final verification report after those checks complete.

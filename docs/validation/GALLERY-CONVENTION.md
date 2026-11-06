# Screenshot Gallery Convention

New fixes store visual evidence under
`docs/validation/<SCOPE>/gallery/`. Existing evidence folders are historical
records and are not retrofitted.

## Required files

- Before/after captures for the affected state at **1440, 390 and 320 px**, made
  from the locally served production build.
- Animation timing fixes include at least one mid-frame capture in addition to
  the final frame.
- A `README.md` with the verified build SHA, the command that produced the
  captures and two or three concrete **“so prüfst du es”** steps for the user.
- Machine-readable measurements belong beside the screenshots as JSON; screenshots
  do not replace assertions.

Use descriptive filenames such as `before-home-1440.png` and
`after-home-320.png`. Never reuse a screenshot from another build as proof.
If a state cannot be exercised, mark it **NICHT PRÜFBAR** and state why instead
of manufacturing a capture.

## Scope

This convention applies to new fixes after 2026-11-04. It applies to visual
fixes and animation contracts; a backend-only change may use text/JSON evidence
if no visual surface changed.

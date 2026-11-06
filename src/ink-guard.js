/** The one list that decides what a press may paint on.
 *
 * Ink is the surface's answer to a press: whatever is not an action leaves a
 * mark. This guard therefore names actions only. A tab stop is not an action —
 * the footer clusters are `role="group"` containers made focusable so their own
 * horizontal overflow can be scrolled from the keyboard, and their empty
 * surface has to stay paintable (B-F19-r4: the band swallowed every press while
 * the strip below it painted normally). Anything else that must stay clean opts
 * out explicitly with `data-no-ink`. */
export const INK_INTERACTIVE_SELECTOR = 'a,button,input,textarea,select,label,form,nav,summary,canvas,dialog,[controls],[draggable="true"],[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="radio"],[role="tab"],[role="menuitem"],[role="combobox"],[role="slider"],[role="spinbutton"],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"]):not([role="group"]),[aria-disabled="true"],.is-unconfigured,[data-no-ink]';

/** Compatibility hook for the form controller. The existing section scroll
 * clock now owns the reversible entrance of its .inquiry-enter parent. The
 * form itself stays immediately usable, with no observer, timer or transition. */
export function initInquiryEntrance(element) {
  if (!element) return () => {};
  element.removeAttribute('data-inquiry-reveal');
  element.removeAttribute('data-inquiry-reveal-immediate');
  return () => {
    element.removeAttribute('data-inquiry-reveal');
    element.removeAttribute('data-inquiry-reveal-immediate');
  };
}

/** Cascade probe for the cursor contract. Injected with page.addInitScript so
 * it survives navigation; it reports which rule actually wins for an element
 * (source, specificity, !important) instead of trusting the computed value. */
export function installCursorCascadeProbe() {
  const splitTop = text => {
    const parts = [];
    let depth = 0, current = '';
    for (const character of text) {
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
      if (character === ',' && depth === 0) { parts.push(current); current = ''; continue; }
      current += character;
    }
    if (current.trim()) parts.push(current);
    return parts;
  };
  const compareSpec = (a, b) => (b[0] - a[0]) || (b[1] - a[1]) || (b[2] - a[2]);
  const specificity = selector => {
    // A selector list scores by its strongest member, never by the sum.
    const parts = splitTop(selector).map(part => {
      const score = [0, 0, 0];
      let text = part, isMatch;
      while ((isMatch = text.match(/:is\(([^()]*)\)/))) {
        const inner = splitTop(isMatch[1]).map(specificity).sort(compareSpec);
        score[0] += inner[0][0]; score[1] += inner[0][1]; score[2] += inner[0][2];
        text = text.replace(isMatch[0], ' ');
      }
      text = text.replace(/::[\w-]+(?:\([^)]*\))?/g, ' ');
      score[0] += (text.match(/#[\w-]+/g) || []).length;
      score[1] += (text.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g) || []).length;
      score[2] += (text.replace(/[\s>+~,]+/g, ' ').match(/(?:^|\s)([a-zA-Z][\w-]*)/g) || []).length;
      return score;
    });
    parts.sort(compareSpec);
    return parts[0] || [0, 0, 0];
  };
  const mediaMatches = query => {
    if (!query) return true;
    try { return matchMedia(query).matches; } catch { return false; }
  };
  const collect = (rules, media, sink) => {
    for (const rule of rules) {
      if (rule.type === CSSRule.MEDIA_RULE) { collect(rule.cssRules, rule.conditionText || rule.media.mediaText, sink); continue; }
      if (rule.type !== CSSRule.STYLE_RULE || !rule.style?.cursor) continue;
      sink.push({ selector: rule.selectorText, value: rule.style.cursor,
        important: rule.style.getPropertyPriority('cursor') === 'important', media });
    }
  };
  const winners = element => {
    const candidates = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      const sink = [];
      collect(rules, '', sink);
      for (const rule of sink) {
        if (!mediaMatches(rule.media)) continue;
        let matches = false;
        try { matches = element.matches(rule.selector); } catch { matches = false; }
        if (!matches) continue;
        const spec = specificity(rule.selector);
        candidates.push({ ...rule, href: sheet.href || 'inline', spec: spec.join(','), weight: spec });
      }
    }
    candidates.sort((a, b) => (Number(b.important) - Number(a.important))
      || (b.weight[0] - a.weight[0]) || (b.weight[1] - a.weight[1]) || (b.weight[2] - a.weight[2]));
    return candidates;
  };
  window.__h4CursorCascade = { winners, specificity };
}

/** A winning rule is a guarantee layer when it is one of the html-body scoped
 * cursor rules from cursor.css (normal or xray). */
export const GUARANTEE_RULE = /(?:^|,\s*)html(?::root)? body|(?:^|,\s*)html\[data-mode=["']?xray["']?\] body/;

export function guaranteeRule(winner) {
  return Boolean(winner && winner.important && GUARANTEE_RULE.test(winner.selector));
}

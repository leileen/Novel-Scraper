/**
 * Generates an optimal, robust, and clean CSS selector for a given DOM Element.
 */

// Common transient or noisy classes to ignore when building selectors
const IGNORED_CLASSES = new Set([
  'active',
  'hover',
  'focus',
  'selected',
  'current',
  'open',
  'closed',
  'disabled',
  'enabled',
  'show',
  'hide',
  'visible',
  'hidden',
  'clearfix',
  'row',
  'col',
  'container',
  'container-fluid'
]);

/**
 * Checks if a class name is likely a dynamically generated hash (e.g. css-1a2b3c, _3xY9).
 */
function isDynamicClass(cls: string): boolean {
  if (cls.length > 25) return true;
  if (/^[a-z0-9_-]{8,}$/i.test(cls) && /\d/.test(cls) && /[a-z]/i.test(cls)) {
    // If it's a random hex or base64-like string
    if (/[0-9a-f]{8,}/i.test(cls)) return true;
  }
  return false;
}

/**
 * Checks if an ID is valid and not dynamically generated (like ":r0:", "ember123", "tmp-482").
 */
function isValidStaticId(id: string): boolean {
  if (!id || id.length > 35) return false;
  if (/^[:0-9]/.test(id)) return false;
  if (/^(tmp|ember|yui|react-|vue-)\d+/i.test(id)) return false;
  if (/\d{4,}/.test(id)) return false; // Contains long numeric sequences
  return true;
}

export function generateSelector(el: Element): string {
  // 1. If element has a valid unique ID
  if (el.id && isValidStaticId(el.id)) {
    const idSelector = `#${CSS.escape(el.id)}`;
    if (document.querySelectorAll(idSelector).length === 1) {
      return idSelector;
    }
  }

  // 2. Try unique meaningful class name
  const classList = Array.from(el.classList).filter(
    (cls) => !IGNORED_CLASSES.has(cls) && !isDynamicClass(cls)
  );

  for (const cls of classList) {
    const classSelector = `.${CSS.escape(cls)}`;
    if (document.querySelectorAll(classSelector).length === 1) {
      return classSelector;
    }
  }

  // Combine top 2 classes if available
  if (classList.length >= 2) {
    const combinedSelector = `.${CSS.escape(classList[0])}.${CSS.escape(classList[1])}`;
    if (document.querySelectorAll(combinedSelector).length === 1) {
      return combinedSelector;
    }
  }

  // 3. Walk up the DOM tree to build a concise hierarchical selector
  const path: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && current.nodeType === Node.ELEMENT_NODE && depth < 4) {
    const tagName = current.tagName.toLowerCase();
    if (tagName === 'body' || tagName === 'html') break;

    let segment = tagName;

    if (current.id && isValidStaticId(current.id)) {
      segment = `#${CSS.escape(current.id)}`;
      path.unshift(segment);
      break; // Unique ID reached
    }

    const currentClasses = Array.from(current.classList).filter(
      (c) => !IGNORED_CLASSES.has(c) && !isDynamicClass(c)
    );
    if (currentClasses.length > 0) {
      segment = `${tagName}.${CSS.escape(currentClasses[0])}`;
    }

    // If there are sibling elements with same tag, use nth-of-type
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === current?.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }

    path.unshift(segment);

    const fullSelector = path.join(' > ');
    if (document.querySelectorAll(fullSelector).length === 1) {
      return fullSelector;
    }

    current = parent;
    depth++;
  }

  return path.join(' > ');
}

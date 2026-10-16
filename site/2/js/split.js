/**
 * split.js — tiny word splitter (no paid SplitText plugin needed).
 * Wraps every word in   <span class="split-word"><span class="split-inner">word</span></span>
 * while keeping nested inline elements (<em>, <span>) and whitespace intact,
 * so screen readers still read the sentence normally.
 * Returns the array of .split-inner elements to animate.
 */
export function splitWords(root) {
  if (!root || root.dataset.splitDone) return [...(root?.querySelectorAll('.split-inner') ?? [])];
  const inners = [];

  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        if (parts.every((p) => !p.trim())) return;
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
          const word = document.createElement('span');
          word.className = 'split-word';
          const inner = document.createElement('span');
          inner.className = 'split-inner';
          inner.textContent = part;
          word.appendChild(inner);
          frag.appendChild(word);
          inners.push(inner);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };

  walk(root);
  root.dataset.splitDone = 'true';
  return inners;
}

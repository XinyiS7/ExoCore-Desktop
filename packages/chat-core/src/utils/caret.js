/**
 * Get pixel coordinates of a character position within a textarea.
 * Uses a hidden mirror div that copies the textarea's styling.
 * Returns coordinates relative to the textarea element.
 */
export function getCaretCoordinates(textarea, charIndex) {
  const style = window.getComputedStyle(textarea);
  const rect = textarea.getBoundingClientRect();

  // Build mirror div
  const mirror = document.createElement('div');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.width = rect.width + 'px';
  mirror.style.font = style.font;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = style.padding;
  mirror.style.paddingTop = style.paddingTop;
  mirror.style.paddingLeft = style.paddingLeft;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;
  document.body.appendChild(mirror);

  // Split text at charIndex — render before + marker
  const text = textarea.value;
  const before = text.slice(0, charIndex);
  // Escape HTML
  const escBefore = before.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  mirror.innerHTML = escBefore + '<span id="__caret_marker__">&#8203;</span>';

  const marker = document.getElementById('__caret_marker__');
  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

  return {
    top: markerRect.top - rect.top,
    left: markerRect.left - rect.left,
    height: markerRect.height,
  };
}

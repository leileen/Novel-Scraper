import { generateSelector } from './selector';

export interface PickerResult {
  targetType: string;
  selector: string;
  previewText: string;
}

let activeOverlay: HTMLDivElement | null = null;
let activeBanner: HTMLDivElement | null = null;
let hoveredElement: Element | null = null;
let cleanupFn: (() => void) | null = null;

function resolveTargetElement(target: Element, targetType: string): Element {
  if (targetType !== 'content') return target;

  let el: Element = target;
  // If target is inline, ascend to its block container
  const inlineTags = new Set(['SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'FONT', 'SMALL', 'SUB', 'SUP', 'MARK', 'LABEL', 'CODE']);
  while (el && inlineTags.has(el.tagName) && el.parentElement && el.parentElement.tagName !== 'BODY') {
    el = el.parentElement;
  }

  // If leaf paragraph or header element, ascend to content container if parent has multiple paragraphs
  if (el && (el.tagName === 'P' || /^H[1-6]$/.test(el.tagName) || el.tagName === 'LI' || el.tagName === 'BLOCKQUOTE')) {
    if (el.parentElement && el.parentElement.tagName !== 'BODY' && el.parentElement.tagName !== 'HTML') {
      const parent = el.parentElement;
      const siblingParas = parent.querySelectorAll('p');
      if (siblingParas.length > 1 || (parent.textContent || '').trim().length > 300) {
        el = parent;
      }
    }
  }
  return el;
}

export function startVisualPicker(
  targetType: string,
  onSelect: (result: PickerResult) => void,
  onCancel: () => void
): void {
  // If already active, clean up previous
  stopVisualPicker();

  // Create highlight box overlay
  activeOverlay = document.createElement('div');
  activeOverlay.id = 'novel-scraper-picker-overlay';
  Object.assign(activeOverlay.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2147483646',
    border: '2px solid #00D2FF',
    backgroundColor: 'rgba(0, 210, 255, 0.15)',
    boxShadow: '0 0 15px rgba(0, 210, 255, 0.6), inset 0 0 10px rgba(0, 210, 255, 0.3)',
    borderRadius: '4px',
    transition: 'all 0.08s ease-out',
    display: 'none'
  });

  // Create tag tooltip inside overlay
  const tagTooltip = document.createElement('div');
  tagTooltip.id = 'novel-scraper-picker-tooltip';
  Object.assign(tagTooltip.style, {
    position: 'absolute',
    top: '-26px',
    left: '0',
    backgroundColor: '#00D2FF',
    color: '#0b1329',
    fontSize: '11px',
    fontWeight: 'bold',
    fontFamily: 'system-ui, sans-serif',
    padding: '2px 8px',
    borderRadius: '3px 3px 0 0',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
  });
  activeOverlay.appendChild(tagTooltip);
  document.body.appendChild(activeOverlay);

  // Create top floating instruction banner
  activeBanner = document.createElement('div');
  activeBanner.id = 'novel-scraper-picker-banner';
  Object.assign(activeBanner.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    background: 'rgba(11, 19, 41, 0.92)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(0, 210, 255, 0.4)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 210, 255, 0.2)',
    color: '#ffffff',
    padding: '10px 20px',
    borderRadius: '30px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    userSelect: 'none'
  });

  const targetLabel =
    targetType === 'content'
      ? 'Khung nội dung (Content)'
      : targetType === 'title'
      ? 'Tiêu đề chương (Title)'
      : targetType === 'next'
      ? 'Nút chương sau (Next Button)'
      : targetType;

  // Build banner content safely with DOM API (zero innerHTML)
  const iconSpan = document.createElement('span');
  iconSpan.textContent = '🎯 ';
  iconSpan.style.fontSize = '16px';

  const labelSpan = document.createElement('span');
  labelSpan.textContent = `Đang chọn: ${targetLabel}`;
  labelSpan.style.color = '#00D2FF';
  labelSpan.style.fontWeight = 'bold';

  const escHintSpan = document.createElement('span');
  escHintSpan.textContent = '| Nhấn ESC để hủy';
  escHintSpan.style.color = 'rgba(255,255,255,0.6)';
  escHintSpan.style.fontSize = '12px';

  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'novel-scraper-cancel-btn';
  cancelBtn.textContent = 'Hủy';
  Object.assign(cancelBtn.style, {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    padding: '4px 12px',
    borderRadius: '14px',
    fontSize: '12px',
    cursor: 'pointer'
  });

  activeBanner.appendChild(iconSpan);
  activeBanner.appendChild(labelSpan);
  activeBanner.appendChild(escHintSpan);
  activeBanner.appendChild(cancelBtn);

  document.body.appendChild(activeBanner);

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    stopVisualPicker();
    onCancel();
  });

  // Handle Mouse Movement
  const onMouseMove = (e: MouseEvent) => {
    const rawTarget = document.elementFromPoint(e.clientX, e.clientY);
    if (!rawTarget || rawTarget === activeOverlay || activeBanner?.contains(rawTarget)) {
      if (activeOverlay && activeBanner?.contains(rawTarget)) {
        activeOverlay.style.display = 'none';
      }
      return;
    }

    const target = resolveTargetElement(rawTarget, targetType);
    hoveredElement = target;
    const rect = target.getBoundingClientRect();

    if (activeOverlay) {
      activeOverlay.style.display = 'block';
      activeOverlay.style.top = `${rect.top}px`;
      activeOverlay.style.left = `${rect.left}px`;
      activeOverlay.style.width = `${rect.width}px`;
      activeOverlay.style.height = `${rect.height}px`;

      const selectorCandidate = generateSelector(target);
      tagTooltip.textContent = `${target.tagName.toLowerCase()} → ${selectorCandidate}`;
    }
  };

  // Handle Click
  const onClick = (e: MouseEvent) => {
    // If the click is inside the banner (e.g. clicking the cancel button), allow it to propagate to banner controls
    const targetNode = e.target as Node | null;
    if (activeBanner && targetNode && (activeBanner === targetNode || activeBanner.contains(targetNode))) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (!hoveredElement || hoveredElement === activeOverlay || activeBanner?.contains(hoveredElement)) {
      return;
    }

    const finalTarget = resolveTargetElement(hoveredElement, targetType);
    const selector = generateSelector(finalTarget);
    const previewText = (finalTarget.textContent || '').trim().slice(0, 100);

    stopVisualPicker();
    onSelect({
      targetType,
      selector,
      previewText
    });
  };

  // Handle Keydown (ESC to cancel)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      stopVisualPicker();
      onCancel();
    }
  };

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  cleanupFn = () => {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  };
}

export function stopVisualPicker(): void {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
  if (activeBanner) {
    activeBanner.remove();
    activeBanner = null;
  }
  hoveredElement = null;
}

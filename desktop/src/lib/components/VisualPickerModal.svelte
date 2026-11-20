<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import {
    X,
    Crosshair,
    Check,
    Globe,
    MousePointerClick,
    Copy,
    Sparkles
  } from '@lucide/svelte';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onApplySelector?: (selector: string) => void;
  }

  let { isOpen, onClose, onApplySelector }: Props = $props();

  let targetUrl = $state('https://metruyenchu.com.vn/truyen/co-vo-dang-nhap');
  let selectedTargetElement = $state<'title' | 'content' | 'author' | 'chapters' | 'cover'>('content');
  let hoveredTag = $state<string>('#chapter-c');
  let generatedSelector = $state<string>('#chapter-c, .reading-content');

  const simulatedDomElements = [
    {
      id: 'elem-title',
      name: 'Tiêu đề truyện',
      tag: 'h1.truyen-title',
      selector: 'h1.truyen-title',
      text: 'Cô Võ Đăng Nhập: Ta Trở Thành Đạo Sư Thế Giới'
    },
    {
      id: 'elem-author',
      name: 'Tác giả',
      tag: 'a.author-name',
      selector: '.author-name',
      text: 'Thái Cổ Tinh Thần'
    },
    {
      id: 'elem-cover',
      name: 'Ảnh bìa',
      tag: 'img.book-cover',
      selector: '.book-cover img',
      text: '[Ảnh bìa truyện - 200x300]'
    },
    {
      id: 'elem-content',
      name: 'Nội dung chương (Chapter Content)',
      tag: 'div#chapter-c.reading-content',
      selector: '#chapter-c, .reading-content',
      text: 'Bầu trời thành phố Giang Nam bỗng nhiên kéo đến từng tầng mây đen nghìn dặm...'
    },
    {
      id: 'elem-toc',
      name: 'Mục lục chương',
      tag: 'ul.list-chapter > li > a',
      selector: '#list-chapter a.chapter-item',
      text: 'Chương 1: Bắt đầu; Chương 2: Đột phá...'
    }
  ];

  function selectSimulatedElement(item: typeof simulatedDomElements[0]) {
    hoveredTag = item.tag;
    generatedSelector = item.selector;
  }

  function applySelector() {
    if (onApplySelector) {
      onApplySelector(generatedSelector);
    }
    appState.showToast(`Đã áp dụng bộ chọn CSS: ${generatedSelector}`, 'success');
    onClose();
  }

  function copySelector() {
    navigator.clipboard.writeText(generatedSelector);
    appState.showToast('Đã sao chép CSS Selector vào bộ nhớ tạm', 'info');
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-backdrop" onclick={onClose}>
    <div class="picker-dialog" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="picker-header">
        <div class="header-title">
          <Crosshair size={18} class="cyan-icon" />
          <span>VISUAL ELEMENT PICKER (BỘ CHỌN THẺ TRỰC QUAN)</span>
        </div>
        <button class="close-btn" onclick={onClose} title="Đóng">
          <X size={16} />
        </button>
      </div>

      <!-- Top URL Bar -->
      <div class="url-bar">
        <Globe size={15} class="url-icon" />
        <input type="text" bind:value={targetUrl} placeholder="Nhập URL website nguồn..." />
        <button class="load-url-btn" onclick={() => appState.showToast('Đang tải cấu trúc DOM trang web...', 'info')}>
          Tải lại DOM
        </button>
      </div>

      <!-- Main Inspector Sandbox -->
      <div class="picker-sandbox">
        <div class="sandbox-instructions">
          <MousePointerClick size={16} class="cyan-icon" />
          <span>Rê chuột và click vào thành phần văn bản bên dưới để trích xuất tự động mã CSS Selector:</span>
        </div>

        <div class="mock-webpage-container">
          <div class="mock-browser-header">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
            <span class="mock-url">{targetUrl}</span>
          </div>

          <div class="mock-page-body">
            {#each simulatedDomElements as item}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="inspectable-element"
                class:highlighted={generatedSelector === item.selector}
                onmouseenter={() => (hoveredTag = item.tag)}
                onclick={() => selectSimulatedElement(item)}
              >
                <div class="tag-badge">{item.name} ({item.tag})</div>
                <div class="element-text">{item.text}</div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Bottom Selector Bar -->
      <div class="picker-footer">
        <div class="selector-display">
          <span class="selector-label">Mã Selector được sinh:</span>
          <code class="selector-code">{generatedSelector}</code>
        </div>
        <div class="footer-actions">
          <button class="copy-btn" onclick={copySelector}>
            <Copy size={14} /> Sao chép
          </button>
          <button class="apply-btn" onclick={applySelector}>
            <Check size={15} /> Áp dụng vào Rule
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .picker-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .picker-dialog {
    width: 900px;
    max-width: 94vw;
    height: 85vh;
    background-color: var(--bg-card);
    border: 1px solid rgba(0, 210, 255, 0.3);
    border-radius: var(--radius-lg);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background-color: #111520;
    border-bottom: var(--border-subtle);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: var(--text-main);
  }

  :global(.cyan-icon) {
    color: var(--accent-cyan);
  }

  .close-btn {
    color: var(--text-muted);
    padding: 4px;
    border-radius: 4px;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.1);
  }

  .url-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    background-color: #161b29;
    border-bottom: var(--border-subtle);
  }

  :global(.url-icon) {
    color: var(--text-muted);
  }

  .url-bar input {
    flex: 1;
    height: 36px;
    padding: 0 12px;
    background-color: #111520;
    font-size: 13px;
  }

  .load-url-btn {
    padding: 0 14px;
    height: 36px;
    background-color: rgba(0, 210, 255, 0.1);
    color: var(--accent-cyan);
    font-size: 12px;
    font-weight: 600;
    border-radius: var(--radius-md);
  }

  .load-url-btn:hover {
    background-color: rgba(0, 210, 255, 0.2);
  }

  .picker-sandbox {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background-color: #141824;
  }

  .sandbox-instructions {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: #94a3b8;
  }

  .mock-webpage-container {
    background-color: #1a2233;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .mock-browser-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background-color: #111520;
    border-bottom: var(--border-subtle);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.red { background-color: #ff5f56; }
  .dot.yellow { background-color: #ffbd2e; }
  .dot.green { background-color: #27c93f; }

  .mock-url {
    font-size: 11px;
    color: var(--text-dim);
    margin-left: 10px;
  }

  .mock-page-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .inspectable-element {
    padding: 12px 14px;
    background-color: rgba(255, 255, 255, 0.03);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .inspectable-element:hover {
    border-color: var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.06);
  }

  .inspectable-element.highlighted {
    border: 2px solid var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.12);
    box-shadow: 0 0 12px rgba(0, 210, 255, 0.25);
  }

  .tag-badge {
    font-size: 10.5px;
    font-family: monospace;
    color: var(--accent-cyan);
    font-weight: 700;
    margin-bottom: 4px;
  }

  .element-text {
    font-size: 13px;
    color: var(--text-main);
  }

  .picker-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background-color: #111520;
    border-top: var(--border-subtle);
  }

  .selector-display {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .selector-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .selector-code {
    font-family: monospace;
    font-size: 13px;
    color: var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.1);
    padding: 4px 10px;
    border-radius: 4px;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    font-size: 12.5px;
    border-radius: var(--radius-md);
  }

  .apply-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    background: linear-gradient(135deg, #00d2ff, #00b4db);
    color: #0b1320;
    font-size: 12.5px;
    font-weight: 700;
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 210, 255, 0.3);
  }
</style>

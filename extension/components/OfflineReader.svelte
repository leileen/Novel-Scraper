<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../lib/db';
  import type { Novel, Chapter } from '../lib/types';
  import { 
    ArrowLeft, 
    ChevronLeft, 
    ChevronRight, 
    Bookmark,
    Minus,
    Plus,
    Palette
  } from '@lucide/svelte';

  let { 
    novel, 
    onClose 
  } = $props<{
    novel: Novel;
    onClose: () => void;
  }>();

  let chapters = $state<Chapter[]>([]);
  let currentChapterIndex = $state(0);
  let isLoading = $state(true);

  // Reader Preferences (persisted in localStorage)
  let fontSize = $state(15);
  let fontMode = $state<'serif' | 'sans'>('sans');
  let colorTheme = $state<'dark' | 'sepia' | 'light'>('dark');
  let showControls = $state(false);

  onMount(async () => {
    // Load preferences
    const savedFontSize = localStorage.getItem('novel_reader_font_size');
    if (savedFontSize) fontSize = parseInt(savedFontSize, 10) || 15;

    const savedFontMode = localStorage.getItem('novel_reader_font_mode');
    if (savedFontMode === 'serif' || savedFontMode === 'sans') fontMode = savedFontMode;

    const savedColorTheme = localStorage.getItem('novel_reader_color_theme');
    if (savedColorTheme === 'dark' || savedColorTheme === 'sepia' || savedColorTheme === 'light') {
      colorTheme = savedColorTheme;
    }

    await loadChapters();
  });

  async function loadChapters() {
    if (!novel.id) return;
    isLoading = true;

    chapters = await db.chapters
      .where('novelId')
      .equals(novel.id)
      .sortBy('chapterNumber');

    // Restore last read chapter
    const lastRead = localStorage.getItem(`novel_last_read_${novel.id}`);
    if (lastRead && chapters.length > 0) {
      const idx = chapters.findIndex((c) => String(c.id) === lastRead || String(c.chapterNumber) === lastRead);
      if (idx !== -1) {
        currentChapterIndex = idx;
      }
    }

    isLoading = false;
  }

  function changeChapter(idx: number) {
    if (idx >= 0 && idx < chapters.length) {
      currentChapterIndex = idx;
      const targetChap = chapters[idx];
      if (targetChap?.id && novel.id) {
        localStorage.setItem(`novel_last_read_${novel.id}`, String(targetChap.id));
      }
      // Scroll reader to top
      const scrollEl = document.getElementById('offline-reader-scroll');
      if (scrollEl) scrollEl.scrollTop = 0;
    }
  }

  function updateFontSize(delta: number) {
    fontSize = Math.min(26, Math.max(12, fontSize + delta));
    localStorage.setItem('novel_reader_font_size', String(fontSize));
  }

  function toggleFontMode() {
    fontMode = fontMode === 'serif' ? 'sans' : 'serif';
    localStorage.setItem('novel_reader_font_mode', fontMode);
  }

  function changeColorTheme(theme: 'dark' | 'sepia' | 'light') {
    colorTheme = theme;
    localStorage.setItem('novel_reader_color_theme', theme);
  }

  const currentChapter = $derived(chapters[currentChapterIndex] || null);

  const paragraphs = $derived(
    currentChapter?.content
      ? currentChapter.content.split('\n\n').filter((p) => p.trim().length > 0)
      : []
  );
</script>

<div class="offline-reader-wrap theme-{colorTheme} font-{fontMode}">
  <!-- Top Reader Navigation Bar -->
  <header class="reader-header">
    <button class="icon-btn back-btn" onclick={onClose} title="Quay lại kho truyện">
      <ArrowLeft size={16} />
      <span>Kho</span>
    </button>

    <div class="reader-title-box">
      <span class="novel-name" title={novel.title}>{novel.title}</span>
      {#if chapters.length > 0}
        <select 
          class="chapter-select"
          bind:value={currentChapterIndex}
          onchange={(e) => changeChapter(parseInt((e.target as HTMLSelectElement).value, 10))}
        >
          {#each chapters as chap, idx}
            <option value={idx}>
              {chap.title || `Chương ${chap.chapterNumber}`}
            </option>
          {/each}
        </select>
      {/if}
    </div>

    <button 
      class="icon-btn theme-toggle-btn"
      class:active={showControls}
      onclick={() => (showControls = !showControls)}
      title="Tùy chỉnh đọc"
    >
      <Palette size={16} />
    </button>
  </header>

  <!-- Reader Customization Drawer -->
  {#if showControls}
    <div class="reader-controls-bar">
      <!-- Font Size -->
      <div class="ctrl-group">
        <span class="ctrl-label">Cỡ chữ:</span>
        <div class="pill-group">
          <button class="btn-ctrl" onclick={() => updateFontSize(-1)} title="Giảm cỡ chữ">
            <Minus size={12} />
          </button>
          <span class="font-size-val">{fontSize}px</span>
          <button class="btn-ctrl" onclick={() => updateFontSize(1)} title="Tăng cỡ chữ">
            <Plus size={12} />
          </button>
        </div>
      </div>

      <!-- Font Type -->
      <div class="ctrl-group">
        <span class="ctrl-label">Phông:</span>
        <button class="btn-ctrl font-btn" onclick={toggleFontMode}>
          {fontMode === 'serif' ? 'Có chân (Serif)' : 'Không chân (Sans)'}
        </button>
      </div>

      <!-- Color Theme -->
      <div class="ctrl-group">
        <span class="ctrl-label">Màu nền:</span>
        <div class="theme-swatches">
          <button 
            class="swatch dark" 
            class:selected={colorTheme === 'dark'}
            onclick={() => changeColorTheme('dark')}
            title="Tối (Dark)"
          ></button>
          <button 
            class="swatch sepia" 
            class:selected={colorTheme === 'sepia'}
            onclick={() => changeColorTheme('sepia')}
            title="Ấm (Sepia)"
          ></button>
          <button 
            class="swatch light" 
            class:selected={colorTheme === 'light'}
            onclick={() => changeColorTheme('light')}
            title="Sáng (Light)"
          ></button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Reader Body Scroll Container -->
  <main id="offline-reader-scroll" class="reader-content-body" style="font-size: {fontSize}px;">
    {#if isLoading}
      <div class="reader-loading">Đang mở truyện...</div>
    {:else if !currentChapter}
      <div class="reader-empty">Chưa có chương nào trong bộ truyện này.</div>
    {:else}
      <article class="chapter-article">
        <h2 class="reader-chapter-title">{currentChapter.title}</h2>
        <div class="chapter-meta-line">
          <span>{currentChapter.wordCount || 0} từ</span>
          <span>•</span>
          <span>Chương {currentChapterIndex + 1} / {chapters.length}</span>
        </div>

        {#if paragraphs.length > 0}
          <div class="paragraphs-list">
            {#each paragraphs as p}
              <p>{p}</p>
            {/each}
          </div>
        {:else if currentChapter.status === 'locked'}
          <div class="notice-box locked">
            🔒 Chương này là nội dung VIP / Bị khóa trên web nguồn.
          </div>
        {:else}
          <div class="notice-box empty">
            Nội dung chương này chưa có hoặc trống.
          </div>
        {/if}

        <!-- Bottom Prev / Next Navigation -->
        <footer class="chapter-bottom-nav">
          <button 
            class="nav-btn prev"
            disabled={currentChapterIndex === 0}
            onclick={() => changeChapter(currentChapterIndex - 1)}
          >
            <ChevronLeft size={16} />
            <span>Chương trước</span>
          </button>

          <span class="chap-indicator">
            {currentChapterIndex + 1} / {chapters.length}
          </span>

          <button 
            class="nav-btn next"
            disabled={currentChapterIndex >= chapters.length - 1}
            onclick={() => changeChapter(currentChapterIndex + 1)}
          >
            <span>Chương sau</span>
            <ChevronRight size={16} />
          </button>
        </footer>
      </article>
    {/if}
  </main>
</div>

<style>
  .offline-reader-wrap {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 50;
    transition: background-color 0.2s, color 0.2s;
  }

  /* Themes */
  .offline-reader-wrap.theme-dark {
    background-color: #0D1625;
    color: #E2E8F0;
  }
  .offline-reader-wrap.theme-sepia {
    background-color: #F4ECD8;
    color: #433422;
  }
  .offline-reader-wrap.theme-light {
    background-color: #F6F3F7;
    color: #1A283B;
  }

  /* Fonts */
  .offline-reader-wrap.font-serif {
    font-family: "Times New Roman", Georgia, Cambria, serif;
  }
  .offline-reader-wrap.font-sans {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  /* Header */
  .reader-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: inherit;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .theme-sepia .reader-header,
  .theme-light .reader-header {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 6px 8px;
    border-radius: 6px;
    opacity: 0.8;
  }
  .icon-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.08);
  }
  .theme-sepia .icon-btn:hover,
  .theme-light .icon-btn:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .reader-title-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .novel-name {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.7;
  }

  .chapter-select {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    outline: none;
    max-width: 100%;
    text-overflow: ellipsis;
    font-family: inherit;
  }
  .theme-dark .chapter-select option {
    background: #0b1329;
    color: #e2e8f0;
  }
  .theme-sepia .chapter-select option {
    background: #f4ecd8;
    color: #433422;
  }
  .theme-light .chapter-select option {
    background: #ffffff;
    color: #1e293b;
  }

  /* Controls Drawer */
  .reader-controls-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    font-size: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
  }
  .theme-sepia .reader-controls-bar,
  .theme-light .reader-controls-bar {
    background: rgba(0, 0, 0, 0.03);
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .ctrl-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ctrl-label {
    opacity: 0.7;
    font-size: 11px;
  }
  .pill-group {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 2px 6px;
  }
  .theme-sepia .pill-group,
  .theme-light .pill-group {
    background: rgba(0, 0, 0, 0.05);
  }

  .btn-ctrl {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .font-size-val {
    font-size: 11px;
    font-weight: bold;
    min-width: 32px;
    text-align: center;
  }
  .font-btn {
    font-size: 11px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .theme-swatches {
    display: flex;
    gap: 6px;
  }
  .swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
  }
  .swatch.dark { background: #0b1329; }
  .swatch.sepia { background: #f4ecd8; }
  .swatch.light { background: #ffffff; }
  .swatch.selected {
    border-color: #A77693;
    box-shadow: 0 0 8px rgba(167, 118, 147, 0.7);
  }

  /* Body Content */
  .reader-content-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px 60px 24px;
    line-height: 1.75;
  }
  .chapter-article {
    max-width: 680px;
    margin: 0 auto;
  }
  .reader-chapter-title {
    font-size: 1.4em;
    font-weight: bold;
    margin-bottom: 6px;
    line-height: 1.3;
  }
  .chapter-meta-line {
    font-size: 0.8em;
    opacity: 0.6;
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }

  .paragraphs-list p {
    margin: 0 0 1.2em 0;
    text-indent: 1.5em;
    text-align: justify;
    word-break: break-word;
  }

  .notice-box {
    padding: 16px;
    border-radius: 8px;
    text-align: center;
    font-style: italic;
    opacity: 0.7;
    margin: 20px 0;
    border: 1px dashed rgba(255, 255, 255, 0.2);
  }

  /* Bottom Nav */
  .chapter-bottom-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .nav-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: inherit;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }
  .nav-btn:hover:not(:disabled) {
    background: rgba(167, 118, 147, 0.22);
    border-color: #A77693;
  }
  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .chap-indicator {
    font-size: 12px;
    opacity: 0.6;
  }
</style>

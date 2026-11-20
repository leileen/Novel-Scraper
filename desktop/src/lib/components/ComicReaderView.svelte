<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import type { Novel, ComicSettings } from '../types';
  import {
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    Maximize2,
    Minimize2,
    ZoomIn,
    ZoomOut,
    Sliders,
    Sun,
    Layers,
    BookOpen,
    Eye,
    RotateCw,
    X,
    Check
  } from '@lucide/svelte';
  import { onMount, onDestroy } from 'svelte';

  const novel = $derived(appState.activeReaderNovel);
  const pages = $derived(appState.activeReaderComicPages);
  const totalPages = $derived(pages.length);
  const currentPage = $derived(appState.activeComicPage);

  const firstIdx = $derived((currentPage - 1) % 2 === 0 ? currentPage - 1 : currentPage - 2);
  const p1 = $derived(pages[Math.max(0, firstIdx)]);
  const p2 = $derived(pages[Math.max(0, firstIdx) + 1]);

  let comicSettings = $state<ComicSettings>({
    mode: novel?.comicSettings?.mode || 'webtoon',
    isRTL: novel?.comicSettings?.isRTL || false,
    fit: novel?.comicSettings?.fit || 'width',
    gap: novel?.comicSettings?.gap || 8,
    zoom: novel?.comicSettings?.zoom || 100,
    preloadCount: novel?.comicSettings?.preloadCount || 3,
    brightness: novel?.comicSettings?.brightness || 100
  });

  let showControls = $state(true);
  let showSettingsModal = $state(false);
  let showThumbnailDrawer = $state(false);
  let isFullscreen = $state(false);
  let containerEl = $state<HTMLElement | null>(null);
  let hideControlsTimer: any = null;

  // Preload upcoming pages to avoid jank
  $effect(() => {
    if (pages.length === 0) return;
    const preloadAhead = comicSettings.preloadCount || 3;
    const currentIdx = currentPage - 1;

    for (let i = 1; i <= preloadAhead; i++) {
      const nextIdx = currentIdx + i;
      if (nextIdx < pages.length && pages[nextIdx]?.dataUrl) {
        const img = new Image();
        img.src = pages[nextIdx].dataUrl;
      }
    }
  });

  function resetHideTimer() {
    showControls = true;
    if (hideControlsTimer) clearTimeout(hideControlsTimer);
    hideControlsTimer = setTimeout(() => {
      if (!showSettingsModal && !showThumbnailDrawer) {
        showControls = false;
      }
    }, 4000);
  }

  function handleMouseMove() {
    resetHideTimer();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      isFullscreen = true;
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      isFullscreen = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (showSettingsModal || showThumbnailDrawer) return;

    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      if (comicSettings.mode === 'webtoon') {
        window.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });
      } else {
        if (comicSettings.isRTL) {
          void appState.prevChapter();
        } else {
          void appState.nextChapter();
        }
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      if (comicSettings.mode === 'webtoon') {
        window.scrollBy({ top: -window.innerHeight * 0.7, behavior: 'smooth' });
      } else {
        if (comicSettings.isRTL) {
          void appState.nextChapter();
        } else {
          void appState.prevChapter();
        }
      }
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    } else if (e.key === 'Escape') {
      if (showSettingsModal) showSettingsModal = false;
      else if (showThumbnailDrawer) showThumbnailDrawer = false;
      else appState.closeReader();
    }
  }

  function updateSetting<K extends keyof ComicSettings>(key: K, value: ComicSettings[K]) {
    comicSettings[key] = value;
    appState.setComicSettings({ [key]: value });
  }

  function jumpToPage(pageIndex: number) {
    void appState.setComicPage(pageIndex);
    if (comicSettings.mode === 'webtoon') {
      const el = document.getElementById(`comic-page-${pageIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    showThumbnailDrawer = false;
  }

  // Handle visible page tracking in webtoon mode via IntersectionObserver
  onMount(() => {
    resetHideTimer();
    window.addEventListener('keydown', handleKeydown);

    let observer: IntersectionObserver | null = null;
    if (comicSettings.mode === 'webtoon') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const pIdx = Number(entry.target.getAttribute('data-page-index'));
              if (pIdx && pIdx !== currentPage) {
                void appState.setComicPage(pIdx);
              }
            }
          }
        },
        { threshold: 0.5 }
      );

      const pageEls = document.querySelectorAll('.webtoon-page-item');
      pageEls.forEach((el) => observer?.observe(el));
    }

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (observer) observer.disconnect();
      if (hideControlsTimer) clearTimeout(hideControlsTimer);
    };
  });
</script>

<div
  class="comic-reader-container"
  bind:this={containerEl}
  onmousemove={handleMouseMove}
  style="filter: brightness({comicSettings.brightness}%);"
>
  <!-- Top Navigation & Floating Action Bar -->
  <header class="comic-top-bar" class:hidden={!showControls}>
    <div class="top-bar-left">
      <button class="icon-btn" onclick={() => appState.closeReader()} title="Trở về thư viện (Esc)">
        <ArrowLeft size={18} />
      </button>
      <div class="book-meta">
        <h3 class="comic-title truncate">{novel?.title || 'Đang đọc truyện tranh'}</h3>
        <span class="comic-counter">
          Trang {currentPage} / {totalPages}
          {#if comicSettings.isRTL && comicSettings.mode !== 'webtoon'}
            <span class="rtl-tag">RTL (Manga)</span>
          {/if}
        </span>
      </div>
    </div>

    <div class="top-bar-center">
      <!-- Quick Mode Switcher -->
      <div class="mode-switcher">
        <button
          class="switch-btn"
          class:active={comicSettings.mode === 'webtoon'}
          onclick={() => updateSetting('mode', 'webtoon')}
          title="Cuộn dọc liên tục (Webtoon Hàn/Trung)"
        >
          Dọc (Webtoon)
        </button>
        <button
          class="switch-btn"
          class:active={comicSettings.mode === 'single'}
          onclick={() => updateSetting('mode', 'single')}
          title="Từng trang một (Single Page)"
        >
          Trang đơn
        </button>
        <button
          class="switch-btn"
          class:active={comicSettings.mode === 'double'}
          onclick={() => updateSetting('mode', 'double')}
          title="Trang đôi 2 trang song song (Double Spread)"
        >
          Trang đôi
        </button>
      </div>

      <!-- RTL Toggle for Manga -->
      {#if comicSettings.mode !== 'webtoon'}
        <button
          class="switch-btn rtl-toggle"
          class:active={comicSettings.isRTL}
          onclick={() => updateSetting('isRTL', !comicSettings.isRTL)}
          title="Đọc từ Phải sang Trái (Phong cách truyện tranh Manga Nhật Bản)"
        >
          Phải sang Trái
        </button>
      {/if}
    </div>

    <div class="top-bar-right">
      <button
        class="icon-btn"
        onclick={() => (showThumbnailDrawer = !showThumbnailDrawer)}
        title="Danh sách trang & Thumbnail"
      >
        <Layers size={18} />
      </button>
      <button
        class="icon-btn"
        onclick={() => (showSettingsModal = !showSettingsModal)}
        title="Cài đặt hiển thị truyện tranh"
      >
        <Sliders size={18} />
      </button>
      <button class="icon-btn" onclick={toggleFullscreen} title="Toàn màn hình (F)">
        {#if isFullscreen}
          <Minimize2 size={18} />
        {:else}
          <Maximize2 size={18} />
        {/if}
      </button>
    </div>
  </header>

  <!-- Reading Viewports by Mode -->
  {#if comicSettings.mode === 'webtoon'}
    <!-- 1. Webtoon Continuous Vertical Strip -->
    <div
      class="webtoon-strip-container"
      style="
        gap: {comicSettings.gap}px;
        max-width: {comicSettings.fit === 'width' ? '920px' : comicSettings.fit === 'original' ? '100%' : '1100px'};
        transform: scale({comicSettings.zoom / 100});
        transform-origin: top center;
      "
    >
      {#each pages as page (page.key || page.pageIndex)}
        <div
          id="comic-page-{page.pageIndex}"
          class="webtoon-page-item"
          data-page-index={page.pageIndex}
        >
          <img
            src={page.dataUrl}
            alt="Trang {page.pageIndex}"
            class="webtoon-img"
            loading="lazy"
            decoding="async"
          />
        </div>
      {/each}
    </div>
  {:else if comicSettings.mode === 'single'}
    <!-- 2. Single Page Mode -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="paged-view-container"
      role="region"
      aria-label="Khung đọc trang đơn"
    >
      <!-- Click Zones for fast navigation -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="click-zone left-zone"
        onclick={() => (comicSettings.isRTL ? appState.nextChapter() : appState.prevChapter())}
        role="button"
        tabindex="0"
        title="Lật sang trang trước"
      >
        <div class="hover-hint"><ChevronLeft size={36} /></div>
      </div>

      <div
        class="page-stage"
        style="
          transform: scale({comicSettings.zoom / 100});
          transform-origin: center center;
        "
      >
        {#if pages[currentPage - 1]}
          <img
            src={pages[currentPage - 1].dataUrl}
            alt="Trang {currentPage}"
            class="paged-img"
            class:fit-height={comicSettings.fit === 'height'}
            class:fit-width={comicSettings.fit === 'width'}
          />
        {/if}
      </div>

      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="click-zone right-zone"
        onclick={() => (comicSettings.isRTL ? appState.prevChapter() : appState.nextChapter())}
        role="button"
        tabindex="0"
        title="Lật sang trang kế tiếp"
      >
        <div class="hover-hint"><ChevronRight size={36} /></div>
      </div>
    </div>
  {:else if comicSettings.mode === 'double'}
    <!-- 3. Double Page Spread Mode (Left & Right) with RTL support -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="paged-view-container double-spread"
      role="region"
      aria-label="Khung đọc trang đôi"
    >
      <!-- Click Zones for fast navigation -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="click-zone left-zone"
        onclick={() => (comicSettings.isRTL ? appState.nextChapter() : appState.prevChapter())}
        role="button"
        tabindex="0"
        title="Lật sang trang trước"
      >
        <div class="hover-hint"><ChevronLeft size={36} /></div>
      </div>

      <div
        class="double-stage"
        class:is-rtl={comicSettings.isRTL}
        style="
          transform: scale({comicSettings.zoom / 100});
          transform-origin: center center;
          gap: {comicSettings.gap}px;
        "
      >
        {#if comicSettings.isRTL}
          <!-- In Japanese Manga: Page 2 is LEFT, Page 1 is RIGHT -->
          {#if p2}
            <div class="double-half">
              <img src={p2.dataUrl} alt="Trang {firstIdx + 2}" class="paged-img" />
              <span class="double-page-tag">Trang {firstIdx + 2}</span>
            </div>
          {/if}
          {#if p1}
            <div class="double-half">
              <img src={p1.dataUrl} alt="Trang {firstIdx + 1}" class="paged-img" />
              <span class="double-page-tag">Trang {firstIdx + 1}</span>
            </div>
          {/if}
        {:else}
          <!-- In Western Comics: Page 1 is LEFT, Page 2 is RIGHT -->
          {#if p1}
            <div class="double-half">
              <img src={p1.dataUrl} alt="Trang {firstIdx + 1}" class="paged-img" />
              <span class="double-page-tag">Trang {firstIdx + 1}</span>
            </div>
          {/if}
          {#if p2}
            <div class="double-half">
              <img src={p2.dataUrl} alt="Trang {firstIdx + 2}" class="paged-img" />
              <span class="double-page-tag">Trang {firstIdx + 2}</span>
            </div>
          {/if}
        {/if}
      </div>

      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="click-zone right-zone"
        onclick={() => (comicSettings.isRTL ? appState.prevChapter() : appState.nextChapter())}
        role="button"
        tabindex="0"
        title="Lật sang trang kế tiếp"
      >
        <div class="hover-hint"><ChevronRight size={36} /></div>
      </div>
    </div>
  {/if}

  <!-- Bottom Floating Progress Bar & Quick Page Slider -->
  <footer class="comic-bottom-bar" class:hidden={!showControls}>
    <button
      class="nav-btn"
      onclick={() => (comicSettings.isRTL ? appState.nextChapter() : appState.prevChapter())}
      disabled={currentPage <= 1}
      title="Trang trước"
    >
      <ChevronLeft size={18} />
    </button>

    <div class="slider-wrapper">
      <input
        type="range"
        min="1"
        max={totalPages || 1}
        value={currentPage}
        oninput={(e) => jumpToPage(Number((e.target as HTMLInputElement).value))}
        class="page-slider"
      />
      <span class="slider-info">
        {currentPage} / {totalPages} ({Math.round((currentPage / Math.max(1, totalPages)) * 100)}%)
      </span>
    </div>

    <button
      class="nav-btn"
      onclick={() => (comicSettings.isRTL ? appState.prevChapter() : appState.nextChapter())}
      disabled={currentPage >= totalPages}
      title="Trang kế tiếp"
    >
      <ChevronRight size={18} />
    </button>
  </footer>

  <!-- Thumbnail Sidebar Drawer -->
  {#if showThumbnailDrawer}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="drawer-backdrop" onclick={() => (showThumbnailDrawer = false)} role="button" tabindex="0">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <aside class="thumbnail-drawer" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
        <div class="drawer-header">
          <h4>Danh sách trang ({totalPages} trang)</h4>
          <button class="icon-btn" onclick={() => (showThumbnailDrawer = false)}>
            <X size={16} />
          </button>
        </div>
        <div class="thumbnail-grid custom-scrollbar">
          {#each pages as page}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="thumb-item"
              class:active={page.pageIndex === currentPage}
              onclick={() => jumpToPage(page.pageIndex)}
              role="button"
              tabindex="0"
            >
              <img src={page.dataUrl} alt="Trang {page.pageIndex}" class="thumb-img" loading="lazy" />
              <span class="thumb-label">Trang {page.pageIndex}</span>
            </div>
          {/each}
        </div>
      </aside>
    </div>
  {/if}

  <!-- Comic Display Settings Modal -->
  {#if showSettingsModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-backdrop" onclick={() => (showSettingsModal = false)} role="button" tabindex="0">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="comic-settings-card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
        <div class="card-header">
          <div class="title-with-icon">
            <Sliders size={18} class="accent-cyan" />
            <h4>Cài đặt trình đọc truyện tranh</h4>
          </div>
          <button class="icon-btn" onclick={() => (showSettingsModal = false)}>
            <X size={16} />
          </button>
        </div>

        <div class="card-body">
          <!-- Reading Mode -->
          <div class="setting-group">
            <label class="setting-label">Chế độ đọc</label>
            <div class="btn-group">
              <button
                class="option-btn"
                class:selected={comicSettings.mode === 'webtoon'}
                onclick={() => updateSetting('mode', 'webtoon')}
              >
                Webtoon (Cuộn dọc)
              </button>
              <button
                class="option-btn"
                class:selected={comicSettings.mode === 'single'}
                onclick={() => updateSetting('mode', 'single')}
              >
                Trang đơn
              </button>
              <button
                class="option-btn"
                class:selected={comicSettings.mode === 'double'}
                onclick={() => updateSetting('mode', 'double')}
              >
                Trang đôi
              </button>
            </div>
          </div>

          <!-- Fit Mode -->
          <div class="setting-group">
            <label class="setting-label">Căn chỉnh kích thước ảnh</label>
            <div class="btn-group">
              <button
                class="option-btn"
                class:selected={comicSettings.fit === 'width'}
                onclick={() => updateSetting('fit', 'width')}
              >
                Vừa chiều ngang
              </button>
              <button
                class="option-btn"
                class:selected={comicSettings.fit === 'height'}
                onclick={() => updateSetting('fit', 'height')}
              >
                Vừa chiều cao
              </button>
              <button
                class="option-btn"
                class:selected={comicSettings.fit === 'original'}
                onclick={() => updateSetting('fit', 'original')}
              >
                100% Gốc
              </button>
            </div>
          </div>

          <!-- RTL Switch -->
          <div class="setting-row">
            <div>
              <span class="setting-name">Đọc từ Phải sang Trái (RTL Manga)</span>
              <p class="setting-sub">Thích hợp đọc truyện tranh Manga Nhật Bản truyền thống</p>
            </div>
            <input
              type="checkbox"
              checked={comicSettings.isRTL}
              onchange={(e) => updateSetting('isRTL', (e.target as HTMLInputElement).checked)}
              class="custom-toggle"
            />
          </div>

          <!-- Brightness -->
          <div class="setting-group">
            <div class="slider-header">
              <span class="setting-label">Độ sáng hình ảnh</span>
              <span class="slider-val">{comicSettings.brightness}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={comicSettings.brightness}
              oninput={(e) => updateSetting('brightness', Number((e.target as HTMLInputElement).value))}
              class="custom-range"
            />
          </div>

          <!-- Gap in Webtoon -->
          {#if comicSettings.mode === 'webtoon'}
            <div class="setting-group">
              <div class="slider-header">
                <span class="setting-label">Khoảng cách giữa các trang (Gap)</span>
                <span class="slider-val">{comicSettings.gap}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                value={comicSettings.gap}
                oninput={(e) => updateSetting('gap', Number((e.target as HTMLInputElement).value))}
                class="custom-range"
              />
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .comic-reader-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #0b0f19;
    color: #e2e8f0;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 1000;
  }

  /* Top Navigation Bar */
  .comic-top-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 54px;
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    z-index: 1050;
    transition: transform 0.28s ease, opacity 0.28s ease;
  }

  .comic-top-bar.hidden {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .top-bar-left,
  .top-bar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .book-meta {
    display: flex;
    flex-direction: column;
  }

  .comic-title {
    font-size: 14px;
    font-weight: 600;
    color: #f8fafc;
    max-width: 280px;
  }

  .comic-counter {
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rtl-tag {
    background: rgba(236, 72, 153, 0.2);
    color: #f472b6;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
  }

  .mode-switcher {
    display: flex;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }

  .switch-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .switch-btn:hover {
    color: #f1f5f9;
  }

  .switch-btn.active {
    background: #0284c7;
    color: #fff;
    box-shadow: 0 1px 4px rgba(2, 132, 199, 0.35);
  }

  .switch-btn.rtl-toggle {
    margin-left: 8px;
    border: 1px solid rgba(236, 72, 153, 0.3);
    color: #f472b6;
  }

  .switch-btn.rtl-toggle.active {
    background: #db2777;
    color: #fff;
  }

  .icon-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    width: 34px;
    height: 34px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #38bdf8;
  }

  /* 1. Webtoon Strip */
  .webtoon-strip-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin-top: 54px;
    margin-bottom: 70px;
    transition: transform 0.2s ease-out;
  }

  .webtoon-page-item {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .webtoon-img {
    width: 100%;
    height: auto;
    display: block;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }

  /* 2. Paged Modes (Single & Double) */
  .paged-view-container {
    position: absolute;
    top: 54px;
    bottom: 60px;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .page-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    pointer-events: none;
  }

  .paged-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }

  .paged-img.fit-height {
    height: 100%;
    width: auto;
  }

  .paged-img.fit-width {
    width: 100%;
    height: auto;
  }

  /* Double Spread */
  .double-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    max-width: 1600px;
    padding: 0 16px;
  }

  .double-half {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .double-page-tag {
    position: absolute;
    bottom: 8px;
    background: rgba(0, 0, 0, 0.65);
    color: #94a3b8;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Click zones for turning page */
  .click-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 25%;
    display: flex;
    align-items: center;
    cursor: pointer;
    z-index: 1020;
  }

  .left-zone {
    left: 0;
    justify-content: flex-start;
    padding-left: 16px;
  }

  .right-zone {
    right: 0;
    justify-content: flex-end;
    padding-right: 16px;
  }

  .hover-hint {
    background: rgba(15, 23, 42, 0.7);
    color: #38bdf8;
    border-radius: 50%;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .click-zone:hover .hover-hint {
    opacity: 0.85;
  }

  /* Bottom Controls Bar */
  .comic-bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 52px;
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 0 24px;
    z-index: 1050;
    transition: transform 0.28s ease, opacity 0.28s ease;
  }

  .comic-bottom-bar.hidden {
    transform: translateY(100%);
    opacity: 0;
    pointer-events: none;
  }

  .nav-btn {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #f1f5f9;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
  }

  .nav-btn:hover:not(:disabled) {
    background: #0284c7;
  }

  .nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .slider-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    max-width: 500px;
  }

  .page-slider {
    flex: 1;
    accent-color: #0284c7;
    cursor: pointer;
  }

  .slider-info {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
  }

  /* Modals & Drawers */
  .drawer-backdrop,
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .thumbnail-drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 340px;
    background: #111827;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    z-index: 1110;
  }

  .drawer-header {
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .thumbnail-grid {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .thumb-item {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    text-align: center;
    transition: transform 0.2s, border-color 0.2s;
  }

  .thumb-item:hover {
    transform: translateY(-2px);
    border-color: #38bdf8;
  }

  .thumb-item.active {
    border-color: #0284c7;
    outline: 2px solid #0284c7;
  }

  .thumb-img {
    width: 100%;
    height: 120px;
    object-fit: cover;
  }

  .thumb-label {
    display: block;
    padding: 4px;
    font-size: 11px;
    color: #94a3b8;
  }

  /* Comic Settings Card */
  .comic-settings-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: 440px;
    padding: 20px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .accent-cyan {
    color: #38bdf8;
  }

  .setting-group {
    margin-bottom: 16px;
  }

  .setting-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #cbd5e1;
    margin-bottom: 8px;
  }

  .btn-group {
    display: flex;
    gap: 6px;
  }

  .option-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 12px;
    padding: 7px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .option-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .option-btn.selected {
    background: #0284c7;
    border-color: #38bdf8;
    color: #fff;
    font-weight: 600;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 16px;
  }

  .setting-name {
    font-size: 13px;
    font-weight: 500;
    color: #f1f5f9;
  }

  .setting-sub {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
  }

  .custom-toggle {
    width: 18px;
    height: 18px;
    accent-color: #db2777;
    cursor: pointer;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .slider-val {
    font-size: 12px;
    color: #38bdf8;
  }

  .custom-range {
    width: 100%;
    accent-color: #0284c7;
  }
</style>

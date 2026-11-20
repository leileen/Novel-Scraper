<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import { extractRealChapterNumber } from '../crawler';
  import { ttsPlayer } from '../tts/audio';
  import { translateWithLocalLLM } from '../ai/llm';
  import type { ReaderTheme, ReaderFontFamily } from '../types';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import {
    ArrowLeft,
    ListFilter,
    Settings,
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Sun,
    Moon,
    BookOpen,
    Volume2,
    VolumeX,
    Languages,
    Loader2,
    Search,
    X,
    CheckCircle2,
    Bookmark,
    Sparkles,
    Columns2,
    AlignJustify,
    AlignLeft,
    Maximize2,
    Minimize2,
    Plus,
    Trash2,
    Keyboard,
    Sliders
  } from '@lucide/svelte';

  import ComicReaderView from './ComicReaderView.svelte';
  import CalibreActionBar from './CalibreActionBar.svelte';
  import CalibrePreferencesModal from './CalibrePreferencesModal.svelte';
  import CalibreStatsModal from './CalibreStatsModal.svelte';
  import { offlineStore } from '../db/offlineStore';

  let showQuickSettings = $state(false);
  let showCalibreMenu = $state(false);
  let showCalibrePreferences = $state(false);
  let showCalibreStats = $state(false);
  let showFontSizePopup = $state(false);
  let showTocDrawer = $state(false);
  let tocDrawerTab = $state<'chapters' | 'bookmarks'>('chapters');
  let showSearchReplacePanel = $state(false);
  let searchReplaceTab = $state<'find' | 'replace'>('find');
  let showShortcutsModal = $state(false);
  let isHoveringTop = $state(false);
  let isFullscreen = $state(false);

  let tocSearchQuery = $state('');
  let quickJumpNumber = $state('');
  let selectedRangeIndex = $state(0);

  // In-chapter search & replace inputs
  let inChapterQuery = $state('');
  let newRuleFind = $state('');
  let newRuleReplace = $state('');
  let newRuleRegex = $state(false);

  let readerContainer = $state<HTMLElement | null>(null);
  let tocListContainer = $state<HTMLDivElement | null>(null);
  let autoScrollInterval: number | null = null;
  let isTTSPlaying = $state(false);
  let isTranslating = $state(false);
  let scrollPercent = $state(0);

  const currentTheme = $derived(appState.readerSettings.theme);
  const isAutoScrolling = $derived(appState.readerSettings.autoScroll);
  const activeNovel = $derived(appState.activeReaderNovel || appState.novels[0] || null);
  const allChapters = $derived(activeNovel ? appState.getNovelChapters(activeNovel.id) : []);
  const novelBookmarks = $derived(activeNovel ? appState.getNovelBookmarks(activeNovel.id) : []);

  let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1200);

  function handleWindowResize() {
    if (typeof window !== 'undefined') {
      windowWidth = window.innerWidth;
    }
  }

  // OS Window Title Management: "${novelTitle} [EPUB] — E-book viewer"
  $effect(() => {
    const novelTitle = activeNovel?.title || 'E-book';
    const newTitle = `${novelTitle} [EPUB] — E-book viewer`;
    if (typeof document !== 'undefined') {
      document.title = newTitle;
    }
    try {
      const appWin = getCurrentWindow();
      void appWin.setTitle(newTitle);
    } catch (_) {}

    return () => {
      const defaultTitle = "LMT's Novel - Comic - Book Manager and Downloader";
      if (typeof document !== 'undefined') {
        document.title = defaultTitle;
      }
      try {
        const appWin = getCurrentWindow();
        void appWin.setTitle(defaultTitle);
      } catch (_) {}
    };
  });

  // Auto-sync currentChapter if activeNovel doesn't match currentChapter.novelId
  $effect(() => {
    if (activeNovel && String(appState.currentChapter.novelId) !== activeNovel.id) {
      void appState.selectChapter(activeNovel.id, 1);
    }
  });

  // Exact array position (1-based) in allChapters
  const currentArrayIndex = $derived.by(() => {
    if (allChapters.length === 0) return appState.currentChapter.index || 1;
    const pos = allChapters.findIndex(
      (c) =>
        (c.id && c.id === appState.currentChapter.id) ||
        (c.url && c.url === appState.currentChapter.url) ||
        c.index === appState.currentChapter.index
    );
    return pos >= 0 ? pos + 1 : appState.currentChapter.index || 1;
  });

  // Synchronized Real Chapter Number (matches the chapter heading, e.g. Chương 1558 -> 1558)
  const displayChapNum = $derived(
    extractRealChapterNumber(
      appState.currentChapter.title || '',
      appState.currentChapter.url || '',
      appState.currentChapter.chapterNumber || currentArrayIndex
    )
  );

  // Synchronized Maximum Chapter Number of the novel (e.g. 1574)
  const displayMaxChapNum = $derived.by(() => {
    const lastChap = allChapters[allChapters.length - 1];
    const lastRealNum = lastChap
      ? extractRealChapterNumber(
          lastChap.title || '',
          lastChap.url || '',
          lastChap.chapterNumber || allChapters.length
        )
      : 0;
    return Math.max(
      displayChapNum,
      lastRealNum,
      activeNovel?.maxChapterNumber || 0,
      allChapters.length || activeNovel?.totalChapters || 1
    );
  });

  const isCurrentBookmarked = $derived(
    activeNovel ? appState.isChapterBookmarked(activeNovel.id, currentArrayIndex) : false
  );

  // Group chapters into ranges of 100, labeled by their ACTUAL chapter numbers
  const RANGE_SIZE = 100;
  const chapterRanges = $derived.by(() => {
    const total = allChapters.length;
    if (total <= RANGE_SIZE) return [];
    const ranges: Array<{ label: string; startIdx: number; endIdx: number }> = [];
    for (let i = 0; i < total; i += RANGE_SIZE) {
      const endIdx = Math.min(total, i + RANGE_SIZE);
      const firstChap = allChapters[i];
      const lastChap = allChapters[endIdx - 1];
      const firstNum = firstChap
        ? extractRealChapterNumber(firstChap.title, firstChap.url, firstChap.chapterNumber || i + 1)
        : i + 1;
      const lastNum = lastChap
        ? extractRealChapterNumber(lastChap.title, lastChap.url, lastChap.chapterNumber || endIdx)
        : endIdx;
      ranges.push({
        label: `${firstNum} - ${lastNum}`,
        startIdx: i,
        endIdx
      });
    }
    return ranges;
  });

  const displayedTocChapters = $derived.by(() => {
    const q = tocSearchQuery.trim().toLowerCase();
    if (q) {
      return allChapters.filter((c, idx) => {
        const realNum = extractRealChapterNumber(c.title, c.url, c.chapterNumber || idx + 1);
        return (
          c.title.toLowerCase().includes(q) ||
          String(realNum).includes(q) ||
          String(c.index || idx + 1).includes(q)
        );
      });
    }
    if (chapterRanges.length === 0) {
      return allChapters;
    }
    const range = chapterRanges[selectedRangeIndex] || chapterRanges[0];
    if (!range) return allChapters.slice(0, RANGE_SIZE);
    return allChapters.slice(range.startIdx, range.endIdx);
  });

  // Processed chapter paragraphs with custom Replace Rules + Unicode NFC normalization
  const processedParagraphs = $derived.by(() => {
    const raw = (appState.currentChapter.content || '').normalize('NFC');
    const replaced = appState.applyReplaceRules(raw);
    return replaced
      .split('\n\n')
      .map((p) => p.trim())
      .filter(Boolean);
  });

  // Responsive Column Count matching Calibre's 3 breakpoints
  const effectiveCols = $derived.by(() => {
    if (appState.readerSettings.readingMode === 'single' || appState.readerSettings.columnsCount === 1) {
      return 1;
    }
    if (appState.readerSettings.readingMode === 'two_column' || appState.readerSettings.columnsCount === 2) {
      return 2;
    }
    if (appState.readerSettings.readingMode === 'three_column' || appState.readerSettings.columnsCount === 3) {
      return 3;
    }
    // Default auto_responsive (matches user's 3 Calibre screenshots):
    // < 900px: 1 column
    // 900px - 1400px: 2 columns
    // >= 1400px: 3 columns
    if (windowWidth < 900) return 1;
    if (windowWidth < 1400) return 2;
    return 3;
  });

  // Paginated Reading State
  let currentPageIndex = $state(0);
  let isFlipping = $state(false);
  let flipDirection = $state<'next' | 'prev'>('next');

  // Compute pages for Calibre Responsive Multi-Column Mode
  const paginatedPages = $derived.by(() => {
    if (processedParagraphs.length === 0) return [[]];
    const pages: string[][] = [];
    let curPage: string[] = [];
    let curChars = 0;

    const cols = effectiveCols;
    const targetParasPerCol = 5;
    const targetCharsPerCol = 850;

    for (let i = 0; i < processedParagraphs.length; i++) {
      const para = processedParagraphs[i];
      const isFirstPage = pages.length === 0;
      const maxParas = isFirstPage ? Math.max(3, cols * targetParasPerCol - 1) : cols * targetParasPerCol;
      const maxChars = isFirstPage ? Math.max(500, cols * targetCharsPerCol - 250) : cols * targetCharsPerCol;

      if (curPage.length > 0 && (curChars + para.length > maxChars || curPage.length >= maxParas)) {
        pages.push(curPage);
        curPage = [para];
        curChars = para.length;
      } else {
        curPage.push(para);
        curChars += para.length;
      }
    }
    if (curPage.length > 0) {
      pages.push(curPage);
    }
    return pages.length > 0 ? pages : [[]];
  });

  const currentPageParagraphs = $derived(
    paginatedPages[currentPageIndex] || []
  );

  const displayPercent = $derived.by(() => {
    if (appState.readerSettings.readingMode === 'continuous') {
      return Math.max(1, scrollPercent);
    }
    if (paginatedPages.length <= 1) return 1;
    return Math.max(1, Math.min(100, Math.round(((currentPageIndex + 1) / paginatedPages.length) * 100)));
  });

  $effect(() => {
    const _chId = appState.currentChapter.id || appState.currentChapter.index;
    currentPageIndex = 0;
    if (readerContainer) {
      readerContainer.scrollTop = 0;
    }
  });

  function turnNextPage() {
    if (isFlipping) return;
    if (currentPageIndex < paginatedPages.length - 1) {
      flipDirection = 'next';
      isFlipping = true;
      setTimeout(() => {
        currentPageIndex++;
        isFlipping = false;
      }, 150);
    } else {
      void handleNextChapter();
    }
  }

  function turnPrevPage() {
    if (isFlipping) return;
    if (currentPageIndex > 0) {
      flipDirection = 'prev';
      isFlipping = true;
      setTimeout(() => {
        currentPageIndex--;
        isFlipping = false;
      }, 150);
    } else {
      void handlePrevChapter();
    }
  }

  let lastWheelTime = 0;
  function handleStageWheel(e: WheelEvent) {
    if (appState.readerSettings.readingMode === 'continuous') return;
    const now = Date.now();
    if (now - lastWheelTime < 200) return;
    if (Math.abs(e.deltaY) > 15) {
      lastWheelTime = now;
      if (e.deltaY > 0) {
        turnNextPage();
      } else {
        turnPrevPage();
      }
    }
  }

  const wordCount = $derived.by(() => {
    if (appState.currentChapter.wordCount && appState.currentChapter.wordCount > 50) {
      return appState.currentChapter.wordCount;
    }
    const text = appState.currentChapter.content || '';
    return Math.max(100, text.split(/\s+/).filter(Boolean).length);
  });

  const estimatedMinutes = $derived(Math.max(1, Math.round(wordCount / 240)));

  // Count in-chapter search matches
  const searchMatchesCount = $derived.by(() => {
    const q = inChapterQuery.trim().toLowerCase();
    if (!q) return 0;
    let count = 0;
    for (const p of processedParagraphs) {
      const lower = p.toLowerCase();
      let pos = 0;
      while ((pos = lower.indexOf(q, pos)) !== -1) {
        count++;
        pos += q.length;
      }
    }
    return count;
  });

  function openTocDrawer(tab: 'chapters' | 'bookmarks' = 'chapters') {
    selectedRangeIndex = Math.floor((currentArrayIndex - 1) / RANGE_SIZE);
    tocSearchQuery = '';
    tocDrawerTab = tab;
    showTocDrawer = true;
    showQuickSettings = false;
    showSearchReplacePanel = false;

    // Auto-scroll active chapter into center of TOC drawer
    setTimeout(() => {
      const activeEl = tocListContainer?.querySelector('.toc-chap-item.current');
      activeEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  }

  function setTheme(t: ReaderTheme) {
    appState.readerSettings.theme = t;
    appState.persistState();
  }

  function setFontFamily(f: ReaderFontFamily) {
    appState.readerSettings.fontFamily = f;
    appState.persistState();
  }

  function getFontFamilyCss(f: ReaderFontFamily): string {
    if (f === 'serif') return '"Palatino Linotype", "Times New Roman", "Cambria", serif';
    if (f === 'literata') return '"Cambria", "Times New Roman", "Palatino Linotype", serif';
    if (f === 'mono') return '"Consolas", "Cascadia Mono", "Courier New", monospace';
    return '"Segoe UI", "Inter", -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif';
  }

  function handleScroll() {
    if (!readerContainer) return;
    const maxScroll = readerContainer.scrollHeight - readerContainer.clientHeight;
    if (maxScroll <= 0) {
      scrollPercent = 100;
      return;
    }
    scrollPercent = Math.min(100, Math.max(0, Math.round((readerContainer.scrollTop / maxScroll) * 100)));

    // Continuous scroll mode or auto-advance: auto load next chapter when scrolling near bottom
    if (
      (appState.readerSettings.readingMode === 'continuous' || appState.readerSettings.autoNextChapter) &&
      scrollPercent >= 96 &&
      !appState.isChapterLoading &&
      currentArrayIndex < allChapters.length
    ) {
      void handleNextChapter();
    }
  }

  function toggleAutoScroll() {
    appState.readerSettings.autoScroll = !appState.readerSettings.autoScroll;
    if (appState.readerSettings.autoScroll) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }

  function startAutoScroll() {
    stopAutoScroll();
    autoScrollInterval = window.setInterval(() => {
      if (readerContainer) {
        readerContainer.scrollTop += appState.readerSettings.autoScrollSpeed;
        const maxScroll = readerContainer.scrollHeight - readerContainer.clientHeight;
        if (maxScroll > 20 && readerContainer.scrollTop >= maxScroll - 2) {
          if (appState.readerSettings.autoNextChapter && currentArrayIndex < allChapters.length) {
            void handleNextChapter();
          } else {
            stopAutoScroll();
            appState.readerSettings.autoScroll = false;
          }
        }
      }
    }, 50);
  }

  function stopAutoScroll() {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  }

  function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      isFullscreen = true;
    } else {
      document.exitFullscreen?.().catch(() => {});
      isFullscreen = false;
    }
  }

  function toggleTTS() {
    if (isTTSPlaying) {
      ttsPlayer.stop();
      isTTSPlaying = false;
      appState.showToast('Đã dừng đọc giọng nói Audio', 'info');
    } else {
      const content = processedParagraphs.join('\n\n');
      if (!content) return;
      isTTSPlaying = true;
      appState.showToast(
        `Đang phát Audio TTS (${appState.readerSettings.ttsRate}x)...`,
        'info'
      );
      ttsPlayer.rate = appState.readerSettings.ttsRate;
      ttsPlayer.speak(
        content,
        undefined,
        () => {
          isTTSPlaying = false;
          if (appState.readerSettings.autoNextTTS && currentArrayIndex < allChapters.length) {
            appState.showToast('Đã đọc xong chương, tự động chuyển sang chương tiếp theo...', 'info');
            void handleNextChapter().then((ok) => {
              if (ok) {
                setTimeout(() => toggleTTS(), 600);
              }
            });
          } else {
            appState.showToast('Đã đọc xong chương!', 'success');
          }
        },
        (err) => {
          isTTSPlaying = false;
          appState.showToast(`Lỗi Audio TTS: ${err}`, 'error');
        }
      );
    }
  }

  async function translateChapterWithAI() {
    if (isTranslating) return;
    const rawContent = appState.currentChapter.content || '';
    if (!rawContent) return;

    isTranslating = true;
    appState.showToast('Đang kết nối Local LLM (LM Studio / Ollama) để dịch chương...', 'info');

    try {
      const translated = await translateWithLocalLLM(rawContent);
      if (translated) {
        appState.currentChapter.content = translated;
        appState.showToast('Đã dịch chương thành công bằng Local LLM AI!', 'success');
      }
    } catch (err) {
      appState.showToast((err as Error).message, 'error');
    } finally {
      isTranslating = false;
    }
  }

  function scrollToTop() {
    if (readerContainer) {
      readerContainer.scrollTo({ top: 0, behavior: 'smooth' });
      scrollPercent = 0;
    }
  }

  async function handlePrevChapter(): Promise<boolean> {
    if (isTTSPlaying) {
      ttsPlayer.stop();
      isTTSPlaying = false;
    }
    const changed = await appState.prevChapter();
    if (changed) {
      scrollToTop();
    }
    return changed;
  }

  async function handleNextChapter(): Promise<boolean> {
    if (isTTSPlaying) {
      ttsPlayer.stop();
      isTTSPlaying = false;
    }
    const changed = await appState.nextChapter();
    if (changed) {
      scrollToTop();
    }
    return changed;
  }

  async function handleSelectChapter(idx: number) {
    if (isTTSPlaying) {
      ttsPlayer.stop();
      isTTSPlaying = false;
    }
    showTocDrawer = false;
    const changed = await appState.goToChapter(idx);
    if (changed) {
      scrollToTop();
    }
  }

  async function handleQuickJumpSubmit(e: Event) {
    e.preventDefault();
    const num = parseInt(quickJumpNumber.trim(), 10);
    if (isNaN(num) || num <= 0) return;
    showTocDrawer = false;
    const ok = await appState.jumpToChapterNumber(num);
    if (ok) {
      quickJumpNumber = '';
      scrollToTop();
    }
  }

  function handleAddReplaceRule(e: Event) {
    e.preventDefault();
    if (!newRuleFind.trim()) return;
    appState.addReplaceRule(newRuleFind, newRuleReplace, newRuleRegex);
    newRuleFind = '';
    newRuleReplace = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      showSearchReplacePanel = !showSearchReplacePanel;
      searchReplaceTab = 'find';
      showQuickSettings = false;
      showTocDrawer = false;
      return;
    }

    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
      e.preventDefault();
      if (appState.readerSettings.readingMode === 'paginated') {
        turnPrevPage();
      } else {
        void handlePrevChapter();
      }
    } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (appState.readerSettings.readingMode === 'paginated') {
        turnNextPage();
      } else {
        void handleNextChapter();
      }
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      showCalibrePreferences = !showCalibrePreferences;
    } else if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      showTocDrawer ? (showTocDrawer = false) : openTocDrawer('chapters');
    } else if (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 's') {
      e.preventDefault();
      showCalibrePreferences = !showCalibrePreferences;
    } else if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      appState.toggleBookmark(displayPercent);
    } else if (e.key === ' ' && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      if (appState.readerSettings.readingMode === 'continuous') {
        toggleAutoScroll();
      } else {
        turnNextPage();
      }
    } else if (e.altKey && e.key === '1') {
      e.preventDefault();
      appState.readerSettings.readingMode = 'single';
      appState.persistState();
    } else if (e.altKey && e.key === '2') {
      e.preventDefault();
      appState.readerSettings.readingMode = 'two_column';
      appState.persistState();
    } else if (e.altKey && e.key === '3') {
      e.preventDefault();
      appState.readerSettings.readingMode = 'three_column';
      appState.persistState();
    } else if (e.altKey && e.key === '4') {
      e.preventDefault();
      appState.readerSettings.readingMode = 'auto_responsive';
      appState.persistState();
    } else if (e.key === '+' || e.key === '=') {
      appState.readerSettings.fontSize = Math.min(32, appState.readerSettings.fontSize + 1);
      appState.persistState();
    } else if (e.key === '-') {
      appState.readerSettings.fontSize = Math.max(14, appState.readerSettings.fontSize - 1);
      appState.persistState();
    }
  }

  function cycleCalibreTheme() {
    const themes: ReaderTheme[] = ['pure_white', 'sepia', 'dark', 'oled', 'mint'];
    const curIdx = themes.indexOf(appState.readerSettings.theme);
    const nextTheme = themes[(curIdx + 1) % themes.length];
    appState.readerSettings.theme = nextTheme;
    appState.persistState();
    appState.showToast(`Bảng màu giao diện: ${nextTheme}`, 'info');
  }

  function resetToCalibreDefaults() {
    appState.readerSettings = {
      ...appState.readerSettings,
      theme: 'pure_white',
      columnsCount: 'auto',
      twoColumn: false,
      fontSize: 18,
      lineHeight: 1.72,
      fontFamily: 'serif',
      fontWeight: 400,
      firstLineIndentEm: 1.8,
      textAlign: 'justify',
      showCalibreHeader: false,
      showCalibreFooter: true,
      showReaderHeader: false,
      showReaderFooter: true,
      marginTop: 26,
      marginBottom: 26,
      marginLeftRight: 48,
      columnGap: 44,
      readingMode: 'auto_responsive',
      pinToolbar: false
    };
    appState.persistState();
    appState.showToast('Đã khôi phục giao diện đọc chuẩn 3 cột tự động!', 'success');
  }
</script>

<svelte:window onkeydown={handleKeydown} onresize={handleWindowResize} />

{#if activeNovel?.contentType === 'comic'}
  <ComicReaderView />
{:else}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="immersive-reader-container theme-{currentTheme}"
  onmousemove={(e) => {
    isHoveringTop = e.clientY < 48;
  }}
>
  <!-- Top Reading Scroll Progress Line (Shown only when toolbar is pinned) -->
  {#if appState.readerSettings.pinToolbar}
    <div class="reading-progress-line">
      <div class="reading-progress-fill" style="width: {displayPercent}%;"></div>
    </div>
  {/if}

  <!-- Top Floating Reader Toolbar (Hidden by default, slides down on hover near top edge) -->
  <div
    class="reader-top-toolbar"
    class:hidden-toolbar={!isHoveringTop && !showQuickSettings && !showSearchReplacePanel && !showCalibrePreferences && !showTocDrawer && !showShortcutsModal && !appState.readerSettings.pinToolbar}
  >
    <div class="toolbar-left">
      <button class="toolbar-btn" onclick={() => appState.closeReader()} title="Quay lại Thư viện (Esc)">
        <ArrowLeft size={16} />
        <span>Thư viện</span>
      </button>

      {#if activeNovel}
        <span class="novel-badge truncate" title={activeNovel.title}>
          {activeNovel.title}
        </span>
      {/if}
    </div>

    <!-- Center Synchronized Chapter Navigator -->
    <div class="toolbar-center">
      <button
        class="nav-pill-btn"
        onclick={handlePrevChapter}
        disabled={currentArrayIndex <= 1 || appState.isChapterLoading}
        title="Chương trước (Phím ← hoặc A)"
      >
        <ChevronLeft size={16} />
        <span>Trước</span>
      </button>

      <button
        class="toc-trigger-btn"
        class:active={showTocDrawer}
        onclick={() => (showTocDrawer ? (showTocDrawer = false) : openTocDrawer('chapters'))}
        title="{appState.currentChapter.title} — Nhấn để mở Danh sách chương (Phím T)"
      >
        <ListFilter size={15} />
        <span class="toc-trigger-text truncate">
          Chương {displayChapNum} / {displayMaxChapNum}
        </span>
      </button>

      <button
        class="nav-pill-btn"
        onclick={handleNextChapter}
        disabled={currentArrayIndex >= allChapters.length || appState.isChapterLoading}
        title="Chương sau (Phím → hoặc D)"
      >
        <span>Sau</span>
        <ChevronRight size={16} />
      </button>
    </div>

    <!-- Right Actions -->
    <div class="toolbar-right">
      <button
        class="toolbar-btn icon-only"
        class:active={isCurrentBookmarked}
        onclick={() => appState.toggleBookmark(displayPercent)}
        title="Đánh dấu trang hiện tại (Phím B)"
      >
        <Bookmark size={15} />
      </button>

      <button
        class="toolbar-btn icon-only"
        class:active={showSearchReplacePanel}
        onclick={() => {
          showSearchReplacePanel = !showSearchReplacePanel;
          if (showSearchReplacePanel) {
            showQuickSettings = false;
            showTocDrawer = false;
          }
        }}
        title="Tìm kiếm & Thay thế trong chương (Ctrl+F)"
      >
        <Search size={15} />
      </button>

      <button
        class="toolbar-btn"
        class:active={isTTSPlaying}
        onclick={toggleTTS}
        title="Nghe truyện bằng giọng đọc Audio AI ({appState.readerSettings.ttsRate}x)"
      >
        {#if isTTSPlaying}
          <VolumeX size={15} />
          <span>Dừng</span>
        {:else}
          <Volume2 size={15} />
          <span>Audio TTS</span>
        {/if}
      </button>

      <button
        class="toolbar-btn"
        class:active={isTranslating}
        onclick={translateChapterWithAI}
        title="Dịch chương bằng Local LLM AI (Ollama / LM Studio)"
      >
        {#if isTranslating}
          <Loader2 size={15} class="spin" />
          <span>Đang dịch...</span>
        {:else}
          <Languages size={15} />
          <span>Dịch AI</span>
        {/if}
      </button>

      <button
        class="toolbar-btn"
        class:active={isAutoScrolling}
        onclick={toggleAutoScroll}
        title="Tự động cuộn trang (Phím Space)"
      >
        {#if isAutoScrolling}
          <Pause size={15} />
        {:else}
          <Play size={15} />
        {/if}
        <span>Auto-scroll</span>
      </button>

      <button
        class="toolbar-btn icon-only"
        onclick={toggleFullscreen}
        title="Chế độ toàn màn hình (F11)"
      >
        {#if isFullscreen}
          <Minimize2 size={15} />
        {:else}
          <Maximize2 size={15} />
        {/if}
      </button>

      <button
        class="toolbar-btn icon-only"
        class:active={showShortcutsModal}
        onclick={() => (showShortcutsModal = !showShortcutsModal)}
        title="Xem bảng phím tắt"
      >
        <Keyboard size={15} />
      </button>

      <button
        class="toolbar-btn"
        class:active={showCalibrePreferences}
        onclick={() => {
          showCalibrePreferences = !showCalibrePreferences;
          showQuickSettings = false;
          showSearchReplacePanel = false;
        }}
        title="Cài đặt trình đọc chuyên sâu (Phím P hoặc S)"
      >
        <Settings size={15} />
        <span>Cài đặt</span>
      </button>
    </div>
  </div>

  <!-- In-Chapter Search & Live Text Replacement Panel -->
  {#if showSearchReplacePanel}
    <div class="floating-search-panel">
      <div class="search-panel-header">
        <div class="search-tabs">
          <button
            class="search-tab-btn"
            class:active={searchReplaceTab === 'find'}
            onclick={() => (searchReplaceTab = 'find')}
          >
            <Search size={13} /> Tìm trong chương
          </button>
          <button
            class="search-tab-btn"
            class:active={searchReplaceTab === 'replace'}
            onclick={() => (searchReplaceTab = 'replace')}
          >
            <Sparkles size={13} /> Thay thế từ / Tên riêng ({appState.replaceRules.length})
          </button>
        </div>
        <button class="panel-close-btn" onclick={() => (showSearchReplacePanel = false)}>
          <X size={15} />
        </button>
      </div>

      {#if searchReplaceTab === 'find'}
        <div class="find-box-row">
          <input
            type="text"
            placeholder="Nhập từ khóa cần tìm trong chương hiện tại..."
            bind:value={inChapterQuery}
          />
          <span class="match-count-badge">
            {inChapterQuery.trim() ? `${searchMatchesCount} kết quả` : 'Gõ để tìm'}
          </span>
        </div>
      {:else}
        <form class="replace-form" onsubmit={handleAddReplaceRule}>
          <div class="replace-inputs">
            <input
              type="text"
              placeholder="Từ gốc (VD: trương mục)..."
              bind:value={newRuleFind}
            />
            <input
              type="text"
              placeholder="Thay bằng (VD: Trương Mục)..."
              bind:value={newRuleReplace}
            />
            <button type="submit" class="add-rule-btn" title="Thêm quy tắc">
              <Plus size={15} /> Thêm
            </button>
          </div>
          <label class="regex-check">
            <input type="checkbox" bind:checked={newRuleRegex} />
            <span>Sử dụng biểu thức chính quy (Regex)</span>
          </label>
        </form>

        <div class="replace-rules-list">
          {#each appState.replaceRules as rule (rule.id)}
            <div class="replace-rule-item">
              <input
                type="checkbox"
                checked={rule.enabled}
                onchange={() => appState.toggleReplaceRule(rule.id)}
              />
              <span class="rule-pair truncate">
                <code>{rule.find}</code> → <strong>{rule.replace || '(Xóa)'}</strong>
              </span>
              <button
                class="rule-del-btn"
                onclick={() => appState.removeReplaceRule(rule.id)}
                title="Xóa quy tắc"
              >
                <Trash2 size={13} />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Keyboard Shortcuts Modal -->
  {#if showShortcutsModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="toc-backdrop" onclick={() => (showShortcutsModal = false)}>
      <div class="shortcuts-modal" onclick={(e) => e.stopPropagation()}>
        <div class="shortcuts-header">
          <h4><Keyboard size={16} /> Phím tắt Trình đọc Nâng cao</h4>
          <button class="panel-close-btn" onclick={() => (showShortcutsModal = false)}>
            <X size={16} />
          </button>
        </div>
        <div class="shortcuts-grid">
          <div class="shortcut-row"><kbd>←</kbd> hoặc <kbd>A</kbd> <span>Chương trước</span></div>
          <div class="shortcut-row"><kbd>→</kbd> hoặc <kbd>D</kbd> <span>Chương tiếp theo</span></div>
          <div class="shortcut-row"><kbd>M</kbd> <span>Mở / Đóng Danh sách chương (TOC)</span></div>
          <div class="shortcut-row"><kbd>B</kbd> <span>Đánh dấu trang (Bookmark) chương đang đọc</span></div>
          <div class="shortcut-row"><kbd>Ctrl + F</kbd> <span>Tìm kiếm & Thay thế từ trong chương</span></div>
          <div class="shortcut-row"><kbd>Space</kbd> <span>Bật / Tạm dừng tự động cuộn (Auto-scroll)</span></div>
          <div class="shortcut-row"><kbd>+</kbd> / <kbd>-</kbd> <span>Tăng / Giảm nhanh cỡ chữ</span></div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Table of Contents (TOC) & Bookmarks Drawer -->
  {#if showTocDrawer}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="toc-backdrop" onclick={() => (showTocDrawer = false)}>
      <div class="toc-drawer" onclick={(e) => e.stopPropagation()}>
        <div class="toc-drawer-header">
          <div>
            <h3 class="toc-novel-title truncate">{activeNovel?.title || 'Danh sách chương'}</h3>
            <p class="toc-subtitle">
              Đang đọc <strong>Chương {displayChapNum} / {displayMaxChapNum}</strong> ({allChapters.length} mục lục)
            </p>
          </div>
          <button class="toc-close-btn" onclick={() => (showTocDrawer = false)} title="Đóng">
            <X size={18} />
          </button>
        </div>

        <!-- Drawer Tabs: Mục lục vs Đánh dấu -->
        <div class="toc-drawer-tabs">
          <button
            class="toc-tab-btn"
            class:active={tocDrawerTab === 'chapters'}
            onclick={() => (tocDrawerTab = 'chapters')}
          >
            <ListFilter size={14} /> Danh sách chương ({allChapters.length})
          </button>
          <button
            class="toc-tab-btn"
            class:active={tocDrawerTab === 'bookmarks'}
            onclick={() => (tocDrawerTab = 'bookmarks')}
          >
            <Bookmark size={14} /> Đánh dấu ({novelBookmarks.length})
          </button>
        </div>

        {#if tocDrawerTab === 'chapters'}
          <!-- Search & Quick Jump by Chapter Number -->
          <div class="toc-controls-row">
            <div class="toc-search-bar">
              <Search size={14} class="toc-search-icon" />
              <input
                type="text"
                placeholder="Tìm tên hoặc số chương (VD: 1558)..."
                bind:value={tocSearchQuery}
              />
            </div>

            <form class="quick-jump-form" onsubmit={handleQuickJumpSubmit}>
              <input
                type="number"
                min="1"
                max={displayMaxChapNum}
                placeholder="Số #"
                bind:value={quickJumpNumber}
              />
              <button type="submit" title="Nhảy thẳng đến số chương">Đi</button>
            </form>
          </div>

          <!-- Synchronized Range Pagination Tabs -->
          {#if !tocSearchQuery.trim() && chapterRanges.length > 1}
            <div class="toc-ranges-bar">
              {#each chapterRanges as range, idx}
                <button
                  class="range-chip"
                  class:active={selectedRangeIndex === idx}
                  onclick={() => (selectedRangeIndex = idx)}
                >
                  {range.label}
                </button>
              {/each}
            </div>
          {/if}

          <!-- Chapter List -->
          <div class="toc-chapter-list" bind:this={tocListContainer}>
            {#if displayedTocChapters.length === 0}
              <div class="toc-empty">Không tìm thấy chương phù hợp với "{tocSearchQuery}"</div>
            {:else}
              {#each displayedTocChapters as chap (chap.id || chap.index)}
                {@const chapIdx = chap.index || 1}
                {@const isCurrent = chapIdx === currentArrayIndex}
                {@const isCached = Boolean(chap.content && chap.content.length > 60)}
                <button
                  class="toc-chap-item"
                  class:current={isCurrent}
                  onclick={() => handleSelectChapter(chapIdx)}
                >
                  <span class="toc-chap-title truncate">{chap.title}</span>
                  {#if isCurrent}
                    <span class="toc-status-badge reading">Đang đọc</span>
                  {:else if isCached}
                    <span class="toc-status-badge cached">
                      <CheckCircle2 size={12} /> Đã lưu
                    </span>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        {:else}
          <!-- Bookmarks Tab -->
          <div class="toc-chapter-list">
            {#if novelBookmarks.length === 0}
              <div class="toc-empty">
                Chưa có đánh dấu trang nào. Nhấn biểu tượng Bookmark (hoặc phím B) khi đang đọc để lưu vị trí!
              </div>
            {:else}
              {#each novelBookmarks as bm (bm.id)}
                <div class="bookmark-card">
                  <button
                    class="bookmark-main"
                    onclick={() => handleSelectChapter(bm.chapterIndex)}
                  >
                    <span class="bm-title">{bm.chapterTitle}</span>
                    <span class="bm-excerpt">{bm.excerpt}</span>
                    <span class="bm-meta">Vị trí cuộn: {bm.scrollPercent}%</span>
                  </button>
                  <button
                    class="bm-del-btn"
                    onclick={() => appState.removeBookmark(bm.id)}
                    title="Xóa đánh dấu"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Floating Power-User Quick Settings Panel -->
  {#if showQuickSettings}
    <div class="floating-settings-panel">
      <div class="settings-panel-top">
        <h4 class="panel-heading">Cài đặt trình đọc chuyên sâu</h4>
        <button class="panel-close-btn" onclick={() => (showQuickSettings = false)}>
          <X size={15} />
        </button>
      </div>

      <!-- 5 Reading Themes -->
      <div class="setting-group">
        <span class="group-label">Chế độ màu nền (5 Themes bảo vệ mắt)</span>
        <div class="theme-options-5">
          <button
            class="theme-btn dark-btn"
            class:active={currentTheme === 'dark'}
            onclick={() => setTheme('dark')}
          >
            <Moon size={13} /> Ban đêm
          </button>
          <button
            class="theme-btn oled-btn"
            class:active={currentTheme === 'oled'}
            onclick={() => setTheme('oled')}
          >
            OLED Đen
          </button>
          <button
            class="theme-btn sepia-btn"
            class:active={currentTheme === 'sepia'}
            onclick={() => setTheme('sepia')}
          >
            <BookOpen size={13} /> Giấy cũ
          </button>
          <button
            class="theme-btn mint-btn"
            class:active={currentTheme === 'mint'}
            onclick={() => setTheme('mint')}
          >
            Xanh dịu
          </button>
          <button
            class="theme-btn light-btn"
            class:active={currentTheme === 'light'}
            onclick={() => setTheme('light')}
          >
            <Sun size={13} /> Ban ngày
          </button>
        </div>
      </div>

      <!-- 4 Font Families -->
      <div class="setting-group">
        <span class="group-label">Phông chữ hiển thị</span>
        <div class="font-grid-4">
          <button
            class="font-btn"
            class:active={appState.readerSettings.fontFamily === 'sans'}
            onclick={() => setFontFamily('sans')}
          >
            Sans (Hiện đại)
          </button>
          <button
            class="font-btn serif"
            class:active={appState.readerSettings.fontFamily === 'serif'}
            onclick={() => setFontFamily('serif')}
          >
            Palatino (Sách in)
          </button>
          <button
            class="font-btn literata"
            class:active={appState.readerSettings.fontFamily === 'literata'}
            onclick={() => setFontFamily('literata')}
          >
            Cambria (Cổ điển)
          </button>
          <button
            class="font-btn mono"
            class:active={appState.readerSettings.fontFamily === 'mono'}
            onclick={() => setFontFamily('mono')}
          >
            Monospace
          </button>
        </div>
      </div>

      <!-- Font Size & Font Weight -->
      <div class="setting-row-2">
        <div class="setting-group">
          <div class="slider-header">
            <span class="group-label">Cỡ chữ</span>
            <span class="slider-val">{appState.readerSettings.fontSize}px</span>
          </div>
          <input
            type="range"
            min="14"
            max="32"
            bind:value={appState.readerSettings.fontSize}
            onchange={() => appState.persistState()}
          />
        </div>

        <div class="setting-group">
          <div class="slider-header">
            <span class="group-label">Độ đậm chữ</span>
            <span class="slider-val">{appState.readerSettings.fontWeight}</span>
          </div>
          <input
            type="range"
            min="400"
            max="600"
            step="100"
            bind:value={appState.readerSettings.fontWeight}
            onchange={() => appState.persistState()}
          />
        </div>
      </div>

      <!-- Line Height & Paragraph Spacing -->
      <div class="setting-row-2">
        <div class="setting-group">
          <div class="slider-header">
            <span class="group-label">Giãn dòng</span>
            <span class="slider-val">{appState.readerSettings.lineHeight}</span>
          </div>
          <input
            type="range"
            min="1.4"
            max="2.4"
            step="0.05"
            bind:value={appState.readerSettings.lineHeight}
            onchange={() => appState.persistState()}
          />
        </div>

        <div class="setting-group">
          <div class="slider-header">
            <span class="group-label">Cách đoạn</span>
            <span class="slider-val">{appState.readerSettings.paragraphSpacing}em</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="2.2"
            step="0.1"
            bind:value={appState.readerSettings.paragraphSpacing}
            onchange={() => appState.persistState()}
          />
        </div>
      </div>

      <!-- Max Page Width Slider -->
      <div class="setting-group">
        <div class="slider-header">
          <span class="group-label">Độ rộng khung văn bản</span>
          <span class="slider-val">{appState.readerSettings.maxWidth}px</span>
        </div>
        <input
          type="range"
          min="600"
          max="1280"
          step="20"
          bind:value={appState.readerSettings.maxWidth}
          onchange={() => appState.persistState()}
        />
      </div>

      <!-- Layout & Alignment Toggles -->
      <div class="setting-group">
        <span class="group-label">Bố cục trang & Đoạn văn</span>
        <div class="layout-toggles-grid">
          <button
            class="toggle-chip"
            class:active={appState.readerSettings.textAlign === 'justify'}
            onclick={() => {
              appState.readerSettings.textAlign =
                appState.readerSettings.textAlign === 'justify' ? 'left' : 'justify';
              appState.persistState();
            }}
          >
            {#if appState.readerSettings.textAlign === 'justify'}
              <AlignJustify size={13} /> Căn đều 2 bên
            {:else}
              <AlignLeft size={13} /> Căn lề trái
            {/if}
          </button>

          <button
            class="toggle-chip"
            class:active={appState.readerSettings.textIndent}
            onclick={() => {
              appState.readerSettings.textIndent = !appState.readerSettings.textIndent;
              appState.persistState();
            }}
          >
            Thụt đầu dòng: {appState.readerSettings.textIndent ? 'Bật' : 'Tắt'}
          </button>

          <button
            class="toggle-chip"
            class:active={appState.readerSettings.pinToolbar}
            onclick={() => {
              appState.readerSettings.pinToolbar = !appState.readerSettings.pinToolbar;
              appState.persistState();
            }}
          >
            {appState.readerSettings.pinToolbar ? 'Ghim thanh menu' : 'Menu tự ẩn (Zen)'}
          </button>
        </div>
      </div>

      <!-- Reading Mode Selector (4 modes) -->
      <div class="setting-group">
        <span class="group-label">Chế độ giao diện đọc (4 kiểu)</span>
        <div class="reading-mode-grid">
          <button
            class="mode-chip"
            class:active={appState.readerSettings.readingMode === 'single'}
            onclick={() => {
              appState.readerSettings.readingMode = 'single';
              appState.readerSettings.twoColumn = false;
              appState.persistState();
            }}
          >
            1 Cột dọc
          </button>
          <button
            class="mode-chip"
            class:active={appState.readerSettings.readingMode === 'two_column'}
            onclick={() => {
              appState.readerSettings.readingMode = 'two_column';
              appState.readerSettings.twoColumn = true;
              appState.persistState();
            }}
          >
            2 Cột mở
          </button>
          <button
            class="mode-chip"
            class:active={appState.readerSettings.readingMode === 'paginated'}
            onclick={() => {
              appState.readerSettings.readingMode = 'paginated';
              appState.readerSettings.twoColumn = false;
              appState.persistState();
            }}
          >
            Sang trang (3D)
          </button>
          <button
            class="mode-chip"
            class:active={appState.readerSettings.readingMode === 'continuous'}
            onclick={() => {
              appState.readerSettings.readingMode = 'continuous';
              appState.readerSettings.twoColumn = false;
              appState.persistState();
            }}
          >
            Cuộn liên tục
          </button>
        </div>
      </div>

      <!-- Page Flip Animation Setting (when Paginated Mode is active) -->
      {#if appState.readerSettings.readingMode === 'paginated'}
        <div class="setting-group">
          <span class="group-label">Hiệu ứng lật trang</span>
          <div class="reading-mode-grid">
            <button
              class="mode-chip"
              class:active={appState.readerSettings.pageTurnEffect === 'flip_3d'}
              onclick={() => {
                appState.readerSettings.pageTurnEffect = 'flip_3d';
                appState.persistState();
              }}
            >
              Lật sách 3D
            </button>
            <button
              class="mode-chip"
              class:active={appState.readerSettings.pageTurnEffect === 'slide'}
              onclick={() => {
                appState.readerSettings.pageTurnEffect = 'slide';
                appState.persistState();
              }}
            >
              Trượt ngang
            </button>
            <button
              class="mode-chip"
              class:active={appState.readerSettings.pageTurnEffect === 'fade'}
              onclick={() => {
                appState.readerSettings.pageTurnEffect = 'fade';
                appState.persistState();
              }}
            >
              Mờ dần
            </button>
            <button
              class="mode-chip"
              class:active={appState.readerSettings.pageTurnEffect === 'instant'}
              onclick={() => {
                appState.readerSettings.pageTurnEffect = 'instant';
                appState.persistState();
              }}
            >
              Tức thì
            </button>
          </div>
        </div>
      {/if}

      <!-- Auto Scroll & TTS Speed -->
      <div class="setting-row-2">
        <div class="setting-group">
          <div class="slider-header">
            <span class="group-label">Tốc độ cuộn</span>
            <span class="slider-val">{appState.readerSettings.autoScrollSpeed} px</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            bind:value={appState.readerSettings.autoScrollSpeed}
            onchange={() => appState.persistState()}
          />
        </div>

        <div class="setting-group">
          <div class="slider-header">
            <span class="group-label">Tốc độ giọng TTS</span>
            <span class="slider-val">{appState.readerSettings.ttsRate}x</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="2.0"
            step="0.1"
            bind:value={appState.readerSettings.ttsRate}
            onchange={() => appState.persistState()}
          />
        </div>
      </div>

      <label class="auto-next-check">
        <input
          type="checkbox"
          bind:checked={appState.readerSettings.autoNextChapter}
          onchange={() => appState.persistState()}
        />
        <span>Tự động qua chương mới khi Auto-scroll cuộn chạm đáy</span>
      </label>
    </div>
  {/if}

  {#if appState.readerSettings.readingMode === 'continuous'}
    <!-- Continuous Vertical Scroll Mode -->
    <div
      class="calibre-continuous-viewport"
      bind:this={readerContainer}
      onscroll={handleScroll}
      style="
        font-size: {appState.readerSettings.fontSize}px;
        font-weight: {appState.readerSettings.fontWeight};
        line-height: {appState.readerSettings.lineHeight};
        font-family: {getFontFamilyCss(appState.readerSettings.fontFamily)};
      "
    >
      <article
        class="calibre-continuous-article"
        style="
          max-width: {effectiveCols === 3 ? '1480px' : effectiveCols === 2 ? '1140px' : `${appState.readerSettings.maxWidth}px`};
          margin-top: {appState.readerSettings.marginTop || 26}px;
          margin-bottom: {appState.readerSettings.marginBottom || 26}px;
          padding-left: {appState.readerSettings.marginLeftRight || 48}px;
          padding-right: {appState.readerSettings.marginLeftRight || 48}px;
        "
      >
        <div class="calibre-chapter-heading-box cols-{effectiveCols}">
          <h1 class="calibre-chapter-title">{appState.currentChapter.title}</h1>
          {#if effectiveCols > 1}
            <div class="calibre-title-divider"></div>
          {/if}
        </div>

        {#if appState.isChapterLoading}
          <div class="chapter-loading-box">
            <Loader2 size={28} class="spin cyan-icon" />
            <p>Đang tải nội dung "{appState.currentChapter.title}" từ nguồn...</p>
          </div>
        {:else}
          <div
            class="calibre-continuous-body cols-{effectiveCols}"
            style="
              gap: {appState.readerSettings.paragraphSpacing || 0.35}em;
              column-gap: {appState.readerSettings.columnGap || 44}px;
            "
          >
            {#each processedParagraphs as paragraph, idx}
              {@const isMatch =
                inChapterQuery.trim().length > 0 &&
                paragraph.toLowerCase().includes(inChapterQuery.trim().toLowerCase())}
              <p
                class="calibre-novel-para"
                class:no-indent={!appState.readerSettings.textIndent}
                class:align-left={appState.readerSettings.textAlign === 'left'}
                class:search-highlight={isMatch}
                class:drop-cap={appState.readerSettings.dropCaps && idx === 0}
              >
                {#if appState.readerSettings.referenceMode}
                  <span class="ref-para-num" title="Đoạn văn {idx + 1}">¶{idx + 1}</span>
                {/if}
                {paragraph}
              </p>
            {/each}
          </div>
        {/if}

        <!-- Bottom Chapter Navigation -->
        <nav class="chapter-nav-footer">
          <button
            class="nav-btn"
            onclick={handlePrevChapter}
            disabled={currentArrayIndex <= 1 || appState.isChapterLoading}
          >
            <ChevronLeft size={18} /> Chương trước
          </button>

          <button class="nav-btn toc-btn" onclick={() => openTocDrawer('chapters')}>
            <ListFilter size={17} />
            <span>Danh sách chương ({displayChapNum}/{displayMaxChapNum})</span>
          </button>

          <button
            class="nav-btn primary"
            onclick={handleNextChapter}
            disabled={currentArrayIndex >= allChapters.length || appState.isChapterLoading}
          >
            Chương sau <ChevronRight size={18} />
          </button>
        </nav>
      </article>

      <!-- Minimal Progress Footer -->
      <footer class="calibre-minimal-footer">
        <span>{scrollPercent}%</span>
      </footer>
    </div>
  {:else}
    <!-- 100% Calibre Responsive Paged Mode (Matches 1-col, 2-col, 3-col layouts) -->
    <main
      class="calibre-reading-stage"
      bind:this={readerContainer}
      onwheel={handleStageWheel}
      style="
        font-size: {appState.readerSettings.fontSize}px;
        font-weight: {appState.readerSettings.fontWeight};
        line-height: {appState.readerSettings.lineHeight};
        font-family: {getFontFamilyCss(appState.readerSettings.fontFamily)};
      "
    >
      <!-- Invisible Left & Right Click Turn Zones for Calibre Paging -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="calibre-page-turn-zone left"
        onclick={turnPrevPage}
        title="Trang trước (← hoặc Click trái)"
        role="button"
        tabindex="0"
      ></div>

      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="calibre-page-turn-zone right"
        onclick={turnNextPage}
        title="Trang sau (→ hoặc Click phải)"
        role="button"
        tabindex="0"
      ></div>

      <!-- Calibre Book Sheet -->
      <div
        class="calibre-book-sheet cols-{effectiveCols}"
        style="
          --cols: {effectiveCols};
          --col-gap: {appState.readerSettings.columnGap || 44}px;
          padding-top: {appState.readerSettings.marginTop || 26}px;
          padding-bottom: {appState.readerSettings.marginBottom || 26}px;
          padding-left: {appState.readerSettings.marginLeftRight || 48}px;
          padding-right: {appState.readerSettings.marginLeftRight || 48}px;
        "
      >
        {#if appState.isChapterLoading}
          <div class="chapter-loading-box">
            <Loader2 size={28} class="spin cyan-icon" />
            <p>Đang tải nội dung "{appState.currentChapter.title}" từ nguồn...</p>
          </div>
        {:else}
          <div
            class="calibre-columns-flow"
            class:is-flipping={isFlipping}
          >
            {#if currentPageIndex === 0}
              <div class="calibre-chapter-heading-box cols-{effectiveCols}">
                <h1 class="calibre-chapter-title">{appState.currentChapter.title}</h1>
                {#if effectiveCols > 1}
                  <div class="calibre-title-divider"></div>
                {/if}
              </div>
            {/if}

            {#if currentPageParagraphs.length === 0}
              <p class="calibre-novel-para">Trang này không có nội dung.</p>
            {:else}
              {#each currentPageParagraphs as paragraph, idx}
                {@const isMatch =
                  inChapterQuery.trim().length > 0 &&
                  paragraph.toLowerCase().includes(inChapterQuery.trim().toLowerCase())}
                <p
                  class="calibre-novel-para"
                  class:no-indent={!appState.readerSettings.textIndent}
                  class:align-left={appState.readerSettings.textAlign === 'left'}
                  class:search-highlight={isMatch}
                  class:drop-cap={appState.readerSettings.dropCaps && currentPageIndex === 0 && idx === 0}
                >
                  {#if appState.readerSettings.referenceMode}
                    <span class="ref-para-num" title="Đoạn văn">¶{idx + 1}</span>
                  {/if}
                  {paragraph}
                </p>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Minimal Calibre Progress Footer: e.g. "1%" at bottom right -->
      <footer class="calibre-minimal-footer">
        <span>{displayPercent}%</span>
      </footer>
    </main>
  {/if}

  {#if showCalibreMenu}
    <CalibreActionBar
      onClose={() => (showCalibreMenu = false)}
      onPrev={handlePrevChapter}
      onNext={handleNextChapter}
      onSearch={() => { showSearchReplacePanel = true; searchReplaceTab = 'find'; showCalibreMenu = false; }}
      onGoTo={() => { openTocDrawer('chapters'); showCalibreMenu = false; }}
      onOpenBook={() => { appState.closeReader(); }}
      onReload={() => { if (activeNovel) void appState.selectChapter(activeNovel.id, currentArrayIndex); showCalibreMenu = false; }}
      onEditBook={() => { showSearchReplacePanel = true; searchReplaceTab = 'replace'; showCalibreMenu = false; }}
      onToc={() => { openTocDrawer('chapters'); showCalibreMenu = false; }}
      onToggleReference={() => { appState.readerSettings.referenceMode = !appState.readerSettings.referenceMode; appState.persistState(); }}
      onHighlights={() => { appState.showToast('Gợi ý: Bạn có thể chọn văn bản để sao chép hoặc tra cứu từ điển!', 'info'); }}
      onBookmarks={() => { openTocDrawer('bookmarks'); showCalibreMenu = false; }}
      onStats={() => { showCalibreStats = true; showCalibreMenu = false; }}
      onFontSize={() => { showFontSizePopup = !showFontSizePopup; }}
      onPreferences={() => { showCalibrePreferences = true; showCalibreMenu = false; }}
      onReadAloud={() => { toggleTTS(); showCalibreMenu = false; }}
      onProfiles={() => { cycleCalibreTheme(); }}
      onFullscreen={() => { toggleFullscreen(); showCalibreMenu = false; }}
      onPrint={() => { window.print(); showCalibreMenu = false; }}
      onInspector={async () => {
        const stats = await offlineStore.getStorageStats();
        appState.showToast(`IndexedDB Inspector: ${stats.totalChapters} chương & ${stats.totalComicPages} trang truyện offline.`, 'info');
      }}
      onResetInterface={() => { resetToCalibreDefaults(); }}
      onQuit={() => { appState.closeReader(); }}
    />
  {/if}

  {#if showCalibrePreferences}
    <CalibrePreferencesModal onClose={() => (showCalibrePreferences = false)} />
  {/if}

  {#if showCalibreStats}
    <CalibreStatsModal onClose={() => (showCalibreStats = false)} />
  {/if}

  {#if showFontSizePopup}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="calibre-menu-backdrop" onclick={() => (showFontSizePopup = false)} role="button" tabindex="0">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="font-size-popup-card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
        <div class="popup-hdr">
          <span>Aa Cỡ chữ & Phông chữ</span>
          <button class="close-btn" onclick={() => (showFontSizePopup = false)}><X size={14} /></button>
        </div>
        <div class="popup-body">
          <div class="size-stepper">
            <button class="step-btn" onclick={() => { appState.readerSettings.fontSize = Math.max(12, appState.readerSettings.fontSize - 1); appState.persistState(); }}>A -</button>
            <span class="size-val">{appState.readerSettings.fontSize}px</span>
            <button class="step-btn" onclick={() => { appState.readerSettings.fontSize = Math.min(36, appState.readerSettings.fontSize + 1); appState.persistState(); }}>A +</button>
          </div>
          <input
            type="range"
            min="12"
            max="36"
            value={appState.readerSettings.fontSize}
            oninput={(e) => { appState.readerSettings.fontSize = Number((e.target as HTMLInputElement).value); appState.persistState(); }}
          />
        </div>
      </div>
    </div>
  {/if}
</div>
{/if}

<style>
  .immersive-reader-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: background-color 0.25s ease, color 0.25s ease;
  }

  /* 5 Reading Themes */
  .theme-pure_white,
  .theme-calibre_white,
  .theme-light {
    background-color: #ffffff;
    color: #111111;
  }

  .theme-sepia {
    background-color: #fcf6eb;
    color: #3b2c1d;
  }

  .theme-dark {
    background-color: #161a22;
    color: #cbd5e1;
  }

  .theme-oled {
    background-color: #000000;
    color: #cccccc;
  }

  .theme-mint {
    background-color: #e2ede0;
    color: #273829;
  }

  /* Top Reading Progress Bar */
  .reading-progress-line {
    height: 3px;
    width: 100%;
    background-color: rgba(128, 128, 128, 0.12);
    z-index: 65;
    flex-shrink: 0;
  }

  .reading-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00d2ff, #38bdf8);
    box-shadow: 0 0 8px rgba(0, 210, 255, 0.6);
    transition: width 0.15s ease-out;
  }

  /* Top Toolbar (Floating & Auto-Hiding) */
  .reader-top-toolbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 48px;
    background-color: rgba(17, 21, 32, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    gap: 10px;
    z-index: 70;
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .reader-top-toolbar.hidden-toolbar {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .toolbar-center {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: rgba(255, 255, 255, 0.05);
    padding: 4px 6px;
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .nav-pill-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    background-color: rgba(255, 255, 255, 0.07);
    color: #e2e8f0;
    font-size: 12.5px;
    font-weight: 600;
  }

  .nav-pill-btn:hover:not(:disabled) {
    background-color: rgba(0, 210, 255, 0.18);
    color: var(--accent-cyan);
  }

  .nav-pill-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .toc-trigger-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: var(--radius-sm);
    background-color: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.28);
    color: var(--accent-cyan);
    font-size: 12.5px;
    font-weight: 600;
    max-width: 240px;
  }

  .toc-trigger-btn:hover,
  .toc-trigger-btn.active {
    background-color: var(--accent-cyan);
    color: #0b1320;
  }

  .toc-trigger-text {
    max-width: 190px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    border-radius: var(--radius-md);
    background-color: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
    font-size: 12px;
    font-weight: 500;
  }

  .toolbar-btn.icon-only {
    padding: 6px 8px;
  }

  .toolbar-btn:hover {
    background-color: rgba(0, 210, 255, 0.15);
    color: var(--accent-cyan);
  }

  .toolbar-btn.active {
    background-color: var(--accent-cyan);
    color: #0b1320;
    font-weight: 600;
  }

  .novel-badge {
    font-size: 13px;
    font-weight: 600;
    color: #cbd5e1;
    max-width: 190px;
  }

  /* Floating In-Chapter Search & Replace Panel */
  .floating-search-panel {
    position: absolute;
    top: 62px;
    right: 24px;
    width: 400px;
    max-width: 92vw;
    background-color: #182032;
    border: 1px solid rgba(0, 210, 255, 0.25);
    border-radius: var(--radius-lg);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 65;
    color: #f8fafc;
  }

  .search-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 8px;
  }

  .search-tabs {
    display: flex;
    gap: 6px;
  }

  .search-tab-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
  }

  .search-tab-btn.active {
    background: var(--accent-cyan);
    color: #0b1320;
  }

  .panel-close-btn {
    color: #94a3b8;
    padding: 4px;
    border-radius: 4px;
  }

  .panel-close-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  .find-box-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .find-box-row input {
    flex: 1;
    height: 34px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    background: #0e131f;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f8fafc;
    font-size: 12.5px;
  }

  .match-count-badge {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--accent-cyan);
    white-space: nowrap;
  }

  .replace-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .replace-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 6px;
  }

  .replace-inputs input {
    height: 32px;
    padding: 0 8px;
    border-radius: var(--radius-sm);
    background: #0e131f;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f8fafc;
    font-size: 12px;
  }

  .add-rule-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    background: var(--accent-cyan);
    color: #0b1320;
    font-size: 12px;
    font-weight: 700;
  }

  .regex-check,
  .auto-next-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: #94a3b8;
    cursor: pointer;
  }

  .replace-rules-list {
    max-height: 150px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .replace-rule-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-sm);
    font-size: 12px;
  }

  .rule-pair {
    flex: 1;
    color: #cbd5e1;
  }

  .rule-del-btn {
    color: #ef4444;
    padding: 2px 4px;
  }

  /* Shortcuts Modal */
  .shortcuts-modal {
    margin: auto;
    width: 440px;
    max-width: 90vw;
    background: #161d2e;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-lg);
    padding: 20px;
    color: #f8fafc;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
  }

  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .shortcuts-header h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14.5px;
  }

  .shortcuts-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: #cbd5e1;
  }

  kbd {
    background: #0d121d;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11.5px;
    color: var(--accent-cyan);
    font-family: var(--font-mono);
  }

  /* Table of Contents (TOC) Drawer */
  .toc-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(3px);
    z-index: 80;
    display: flex;
    justify-content: flex-start;
  }

  .toc-drawer {
    width: 460px;
    max-width: 92vw;
    height: 100%;
    background-color: #141926;
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 12px 0 36px rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    color: #f8fafc;
  }

  .toc-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    background-color: #192030;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .toc-novel-title {
    font-size: 15px;
    font-weight: 700;
    color: #f8fafc;
    max-width: 350px;
  }

  .toc-subtitle {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 3px;
  }

  .toc-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toc-drawer-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #171d2c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .toc-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    font-size: 12.5px;
    font-weight: 600;
    color: #94a3b8;
    border-bottom: 2px solid transparent;
  }

  .toc-tab-btn.active {
    color: var(--accent-cyan);
    border-bottom-color: var(--accent-cyan);
    background: rgba(0, 210, 255, 0.05);
  }

  .toc-controls-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 18px 10px;
  }

  .toc-search-bar {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    background-color: #0e131d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
  }

  :global(.toc-search-icon) {
    color: #64748b;
  }

  .toc-search-bar input {
    width: 100%;
    height: 34px;
    background: transparent;
    border: none;
    color: #f8fafc;
    font-size: 12.5px;
  }

  .quick-jump-form {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .quick-jump-form input {
    width: 72px;
    height: 34px;
    padding: 0 8px;
    background: #0e131d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    color: #f8fafc;
    font-size: 12.5px;
  }

  .quick-jump-form button {
    height: 34px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    background: var(--accent-cyan);
    color: #0b1320;
    font-size: 12px;
    font-weight: 700;
  }

  .toc-ranges-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 18px 10px;
    overflow-x: auto;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .range-chip {
    padding: 4px 10px;
    border-radius: var(--radius-full);
    background-color: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .range-chip.active {
    background-color: var(--accent-cyan);
    color: #0b1320;
  }

  .toc-chapter-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toc-chap-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    color: #cbd5e1;
    font-size: 13px;
    text-align: left;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
  }

  .toc-chap-item:hover {
    background-color: rgba(0, 210, 255, 0.08);
    border-color: rgba(0, 210, 255, 0.2);
    color: #ffffff;
  }

  .toc-chap-item.current {
    background-color: rgba(0, 210, 255, 0.15);
    border-color: var(--accent-cyan);
    color: var(--accent-cyan);
    font-weight: 600;
  }

  .toc-chap-title {
    flex: 1;
    min-width: 0;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toc-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 2px 7px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .toc-status-badge.reading {
    background-color: var(--accent-cyan);
    color: #0b1320;
    font-weight: 700;
  }

  .toc-status-badge.cached {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .bookmark-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
  }

  .bookmark-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }

  .bm-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent-cyan);
  }

  .bm-excerpt {
    font-size: 12px;
    color: #94a3b8;
  }

  .bm-meta {
    font-size: 11px;
    color: #64748b;
  }

  .bm-del-btn {
    color: #ef4444;
    padding: 6px;
  }

  .toc-empty {
    padding: 32px 16px;
    text-align: center;
    color: #64748b;
    font-size: 13px;
  }

  /* Floating Power-User Quick Settings Panel */
  .floating-settings-panel {
    position: absolute;
    top: 62px;
    right: 20px;
    width: 370px;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    background-color: #182032;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-lg);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65);
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    z-index: 65;
  }

  .settings-panel-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 8px;
  }

  .panel-heading {
    font-size: 14px;
    font-weight: 700;
    color: #f8fafc;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .setting-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .group-label {
    font-size: 11.5px;
    font-weight: 600;
    color: #94a3b8;
  }

  .theme-options-5 {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 5px;
  }

  .font-grid-4,
  .layout-toggles-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .theme-btn,
  .font-btn,
  .toggle-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 4px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 600;
    border: 1px solid transparent;
  }

  .dark-btn {
    background-color: #111520;
    color: #d1d5db;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .oled-btn {
    background-color: #05070b;
    color: #e2e8f0;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .light-btn {
    background-color: #fafafa;
    color: #1f2937;
  }

  .sepia-btn {
    background-color: #f4ecd8;
    color: #5b4636;
  }

  .mint-btn {
    background-color: #dce8d5;
    color: #2c3e2e;
  }

  .theme-btn.active,
  .font-btn.active,
  .toggle-chip.active {
    outline: 2px solid var(--accent-cyan);
  }

  .font-btn,
  .toggle-chip {
    background-color: rgba(255, 255, 255, 0.07);
    color: #f8fafc;
  }

  .font-btn.serif {
    font-family: "Palatino Linotype", "Times New Roman", serif;
  }

  .font-btn.literata {
    font-family: "Cambria", "Times New Roman", serif;
  }

  .font-btn.mono {
    font-family: "Consolas", "Cascadia Mono", "Courier New", monospace;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .slider-val {
    font-size: 11px;
    color: var(--accent-cyan);
    font-weight: 600;
  }

  /* Calibre Responsive Reading Stage */
  .calibre-reading-stage {
    flex: 1;
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    cursor: default;
    user-select: text;
  }

  /* Left & Right Click Turn Zones */
  .calibre-page-turn-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 18%;
    max-width: 220px;
    z-index: 15;
    cursor: pointer;
  }

  .calibre-page-turn-zone.left {
    left: 0;
  }

  .calibre-page-turn-zone.right {
    right: 0;
  }

  /* Book Sheet */
  .calibre-book-sheet {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 5;
  }

  /* Columns Flow */
  .calibre-columns-flow {
    width: 100%;
    height: 100%;
    column-count: var(--cols);
    column-gap: var(--col-gap);
    column-fill: balance;
    overflow: hidden;
    box-sizing: border-box;
    transition: opacity 0.15s ease;
  }

  .calibre-columns-flow.is-flipping {
    opacity: 0.6;
  }

  /* Chapter Title & Divider */
  .calibre-chapter-heading-box {
    text-align: center;
    break-inside: avoid;
    box-sizing: border-box;
  }

  .calibre-chapter-heading-box.cols-1 {
    margin-bottom: 28px;
    padding-top: 10px;
  }

  .calibre-chapter-heading-box.cols-2,
  .calibre-chapter-heading-box.cols-3 {
    margin-bottom: 18px;
    padding-top: 4px;
  }

  .calibre-chapter-title {
    font-size: 1.48em;
    font-weight: 700;
    line-height: 1.35;
    margin: 0;
    color: inherit;
    font-family: inherit;
  }

  .calibre-title-divider {
    width: 100%;
    height: 1px;
    background-color: rgba(0, 0, 0, 0.12);
    margin-top: 14px;
    margin-bottom: 18px;
  }

  .theme-sepia .calibre-title-divider {
    background-color: rgba(56, 42, 30, 0.14);
  }

  .theme-dark .calibre-title-divider,
  .theme-oled .calibre-title-divider {
    background-color: rgba(255, 255, 255, 0.14);
  }

  .theme-mint .calibre-title-divider {
    background-color: rgba(39, 56, 41, 0.14);
  }

  /* Paragraphs */
  .calibre-novel-para {
    text-indent: 1.8em;
    text-align: justify;
    line-height: 1.72;
    margin: 0 0 0.35em 0;
    break-inside: auto;
    word-break: break-word;
    font-size: 1em;
    color: inherit;
    font-family: inherit;
  }

  .calibre-novel-para.no-indent {
    text-indent: 0;
    margin-bottom: 0.85em;
  }

  .calibre-novel-para.align-left {
    text-align: left;
  }

  .calibre-novel-para.search-highlight {
    background-color: rgba(0, 210, 255, 0.2);
    outline: 2px solid var(--accent-cyan);
    border-radius: 2px;
  }

  .calibre-novel-para.drop-cap::first-letter {
    font-size: 3em;
    float: left;
    line-height: 0.85;
    margin-right: 8px;
    font-weight: 700;
    color: inherit;
  }

  /* Minimal Footer at bottom right (Images 2, 3, 4: e.g. "1%") */
  .calibre-minimal-footer {
    position: absolute;
    bottom: 8px;
    right: 22px;
    font-size: 11.5px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: inherit;
    opacity: 0.55;
    pointer-events: none;
    user-select: none;
    z-index: 20;
    font-variant-numeric: tabular-nums;
  }

  /* Continuous Scroll Mode */
  .calibre-continuous-viewport {
    flex: 1;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    position: relative;
    padding-bottom: 40px;
  }

  .calibre-continuous-article {
    width: 100%;
    box-sizing: border-box;
  }

  .calibre-continuous-body.cols-3 {
    display: block;
    column-count: 3;
  }

  .calibre-continuous-body.cols-2 {
    display: block;
    column-count: 2;
  }

  .calibre-continuous-body.cols-1 {
    display: block;
    column-count: 1;
  }

  .chapter-loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 64px 20px;
    opacity: 0.85;
  }

  .chapter-nav-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px dashed rgba(128, 128, 128, 0.25);
  }

  .ref-para-num {
    display: inline-block;
    font-size: 10px;
    opacity: 0.45;
    color: inherit;
    margin-right: 6px;
    user-select: none;
    font-family: monospace;
    vertical-align: super;
  }

  /* Font size popup */
  .font-size-popup-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    width: 260px;
    padding: 16px;
    color: #f1f5f9;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .popup-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .size-stepper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .step-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #f1f5f9;
    padding: 4px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }

  .step-btn:hover {
    background: #0284c7;
  }

  .size-val {
    font-size: 14px;
    font-weight: 700;
    color: #38bdf8;
  }

  .novel-para.no-indent {
    text-indent: 0;
  }

  .novel-para.align-left {
    text-align: left;
  }

  .novel-para.search-highlight {
    background-color: rgba(0, 210, 255, 0.16);
    border-left: 3px solid var(--accent-cyan);
    padding: 4px 10px;
    border-radius: 4px;
  }

  .chapter-nav-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 56px;
    padding-top: 24px;
    border-top: 1px dashed rgba(128, 128, 128, 0.25);
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border-radius: var(--radius-lg);
    background-color: rgba(128, 128, 128, 0.16);
    color: inherit;
    font-weight: 600;
    font-size: 0.88em;
  }

  .nav-btn:hover:not(:disabled) {
    background-color: rgba(0, 210, 255, 0.18);
  }

  .nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .nav-btn.toc-btn {
    border: 1px solid rgba(128, 128, 128, 0.25);
  }

  .nav-btn.primary {
    background: linear-gradient(135deg, #00d2ff, #00b4db);
    color: #0b1320;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Reading Mode Switcher & 3D Paginated Styles */
  .reading-mode-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .mode-chip {
    padding: 7px 6px;
    border-radius: var(--radius-sm);
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .mode-chip:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
  }

  .mode-chip.active {
    background-color: rgba(0, 210, 255, 0.15);
    border-color: rgba(0, 210, 255, 0.4);
    color: var(--accent-cyan);
    font-weight: 700;
  }

  /* 3D Paginated Book Stage */
  .paginated-book-stage {
    flex: 1;
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    perspective: 2000px;
    perspective-origin: center center;
  }

  .paginated-nav-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 18%;
    max-width: 200px;
    z-index: 20;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s, background 0.2s;
  }

  .paginated-nav-zone:hover {
    opacity: 1;
    background: linear-gradient(to right, rgba(0, 210, 255, 0.04), transparent);
  }

  .paginated-nav-zone.left {
    left: 0;
  }

  .paginated-nav-zone.right {
    right: 0;
  }

  .paginated-nav-zone.right:hover {
    background: linear-gradient(to left, rgba(0, 210, 255, 0.04), transparent);
  }

  .zone-hint {
    background: rgba(0, 210, 255, 0.15);
    border: 1px solid rgba(0, 210, 255, 0.3);
    color: var(--accent-cyan);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }

  /* 3D Page Sheet */
  .paginated-sheet {
    width: 100%;
    height: calc(100vh - 110px);
    display: flex;
    flex-direction: column;
    padding: 30px 48px;
    box-sizing: border-box;
    position: relative;
    background: inherit;
    border-radius: 6px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(128, 128, 128, 0.12);
    transform-style: preserve-3d;
    transform-origin: left center;
    transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.35s ease, box-shadow 0.4s ease;
  }

  .sheet-spine-shadow {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 25px;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.18), transparent);
    pointer-events: none;
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
  }

  /* 3D Page Flip Transitions */
  .paginated-sheet.flip_3d.flipping-next {
    transform: rotateY(-95deg) scale(0.96);
    box-shadow: -25px 0 50px rgba(0, 0, 0, 0.6);
    opacity: 0.2;
  }

  .paginated-sheet.flip_3d.flipping-prev {
    transform: rotateY(95deg) scale(0.96);
    box-shadow: 25px 0 50px rgba(0, 0, 0, 0.6);
    opacity: 0.2;
  }

  /* Slide Transitions */
  .paginated-sheet.slide.flipping-next {
    transform: translateX(-60px);
    opacity: 0;
  }

  .paginated-sheet.slide.flipping-prev {
    transform: translateX(60px);
    opacity: 0;
  }

  /* Fade Transitions */
  .paginated-sheet.fade.flipping-next,
  .paginated-sheet.fade.flipping-prev {
    opacity: 0;
  }

  .paginated-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11.5px;
    color: var(--text-muted);
    padding-bottom: 14px;
    border-bottom: 1px dashed rgba(128, 128, 128, 0.2);
    margin-bottom: 18px;
    flex-shrink: 0;
  }

  .novel-title-mini {
    font-weight: 600;
    max-width: 45%;
  }

  .chap-title-mini {
    color: var(--accent-cyan);
    max-width: 45%;
  }

  .paginated-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .paginated-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 14px;
    border-top: 1px dashed rgba(128, 128, 128, 0.2);
    font-size: 11.5px;
    color: var(--text-muted);
    flex-shrink: 0;
    margin-top: 14px;
  }

  .pag-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .pag-btn:hover {
    color: var(--accent-cyan);
    background: rgba(0, 210, 255, 0.08);
  }

  .page-indicator {
    font-weight: 600;
    letter-spacing: 0.3px;
  }
</style>

<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { appState } from '$lib/stores/appState.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import BookDetailModal from '$lib/components/BookDetailModal.svelte';
  import WelcomeModal from '$lib/components/WelcomeModal.svelte';
  import WhatsNewModal from '$lib/components/WhatsNewModal.svelte';

  let { children } = $props();

  onMount(() => {
    if (typeof window !== 'undefined') {
      (window as any).__appState = appState;
    }

    // Responsive sidebar collapse under 900px
    const handleResize = () => {
      appState.isSidebarCollapsed = window.innerWidth < 900;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Global keyboard shortcuts (Ctrl+F for search, Space for pause/resume active download)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        appState.activeTab = 'library';
      }
      if (e.key === 'F1') {
        e.preventDefault();
        appState.activeTab = 'library';
      } else if (e.key === 'F2') {
        e.preventDefault();
        appState.readerSettings.columnsCount = 'auto';
        appState.readerSettings.readingMode = 'auto_responsive';
        const first = appState.novels[0];
        if (first) {
          void appState.openReader(first);
        } else {
          appState.activeTab = 'reader';
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        appState.openWhatsNew();
      }
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        const firstTask = appState.downloadQueue[0];
        if (firstTask) {
          appState.togglePause(firstTask.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<div class="app-layout">
  <!-- When reader is active in Zen Mode, sidebar is hidden -->
  {#if appState.activeTab !== 'reader'}
    <Sidebar />
  {/if}

  <main class="main-content-viewport" class:fullscreen={appState.activeTab === 'reader'}>
    {@render children()}
  </main>

  <!-- Global Book Details Modal -->
  <BookDetailModal />

  <!-- First-Time Welcome & User Guide Modal -->
  <WelcomeModal />

  <!-- What's New v1.1 Release Notes Modal -->
  {#if appState.showWhatsNew}
    <WhatsNewModal onClose={() => appState.completeWhatsNew()} />
  {/if}

  <!-- Global Toast Notifications -->
  <ToastContainer />
</div>

<style>
  .app-layout {
    display: flex;
    width: 100vw;
    height: 100vh;
    background-color: var(--bg-main);
    overflow: hidden;
  }

  .main-content-viewport {
    flex: 1;
    height: 100%;
    min-width: 0;
    background-color: var(--bg-main);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .main-content-viewport.fullscreen {
    width: 100vw;
  }
</style>

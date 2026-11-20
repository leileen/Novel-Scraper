<script lang="ts">
  import { t, setLanguage } from '../lib/i18n';
  import { Moon, Sun, BookOpen } from '@lucide/svelte';

  let { 
    currentLang = 'vi', 
    currentTheme = 'dark', 
    onLangChange, 
    onThemeToggle 
  } = $props<{
    currentLang: 'vi' | 'en';
    currentTheme: 'dark' | 'light';
    onLangChange: (lang: 'vi' | 'en') => void;
    onThemeToggle: () => void;
  }>();

  function toggleLang() {
    const next = currentLang === 'vi' ? 'en' : 'vi';
    setLanguage(next);
    onLangChange(next);
  }
</script>

<header class="header-container">
  <div class="brand">
    <div class="logo-orb">
      <BookOpen size={14} strokeWidth={2.3} />
    </div>
    <h1 class="brand-name">Novel Scraper</h1>
  </div>

  <div class="controls">
    <button class="liquid-ctrl-pill" onclick={toggleLang} title={t('language')}>
      <span>{currentLang === 'vi' ? 'VI' : 'EN'}</span>
    </button>

    <button class="liquid-ctrl-circle" onclick={onThemeToggle} title={currentTheme === 'dark' ? t('lightMode') : t('darkMode')}>
      {#if currentTheme === 'dark'}
        <Sun size={13} />
      {:else}
        <Moon size={13} />
      {/if}
    </button>
  </div>
</header>

<style>
  .header-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px 6px 14px;
    position: sticky;
    top: 0;
    z-index: 100;
    background: transparent;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-orb {
    width: 26px;
    height: 26px;
    border-radius: 9px;
    background: var(--gradient-03-vivid);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: var(--liquid-pill-shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFFFFF;
    flex-shrink: 0;
  }

  .brand-name {
    font-size: 13.5px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: var(--text-primary);
    margin: 0;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .liquid-ctrl-pill {
    height: 26px;
    padding: 0 10px;
    border-radius: var(--radius-full);
    background: var(--surface-glass-card);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: var(--text-secondary);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .liquid-ctrl-pill:hover {
    background: var(--surface-glass-hover);
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
  }

  .liquid-ctrl-circle {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-glass-card);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .liquid-ctrl-circle:hover {
    background: var(--surface-glass-hover);
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
    transform: rotate(12deg);
  }
</style>

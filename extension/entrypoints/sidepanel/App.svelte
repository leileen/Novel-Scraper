<script lang="ts">
  import { onMount } from 'svelte';
  import './theme.css';
  import Header from '../../components/Header.svelte';
  import Tabs from '../../components/Tabs.svelte';
  import ScraperTab from '../../components/ScraperTab.svelte';
  import LibraryTab from '../../components/LibraryTab.svelte';
  import RulesTab from '../../components/RulesTab.svelte';
  import SettingsTab from '../../components/SettingsTab.svelte';
  import { initDatabase } from '../../lib/db';
  import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../../lib/storage/settings';
  import { setLanguage, getInitialLanguage } from '../../lib/i18n';
  import type { AppSettings } from '../../lib/types';

  let activeTab = $state<'scraper' | 'library' | 'rules' | 'settings'>('scraper');
  let settings = $state<AppSettings>(DEFAULT_SETTINGS);
  let isReady = $state(false);

  onMount(async () => {
    await initDatabase();
    const loadedSettings = await getSettings();
    if (!loadedSettings.language) {
      loadedSettings.language = getInitialLanguage();
    }
    settings = loadedSettings;
    setLanguage(settings.language);
    applyTheme(settings.theme);
    isReady = true;
  });

  function applyTheme(theme: 'dark' | 'light') {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function handleLangChange(lang: 'vi' | 'en') {
    settings.language = lang;
    saveSettings(settings);
  }

  function handleThemeToggle() {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    settings.theme = nextTheme;
    applyTheme(nextTheme);
    saveSettings(settings);
  }

  function handleSettingsUpdated(updated: AppSettings) {
    settings = updated;
    applyTheme(settings.theme);
  }
</script>

<div class="app-layout">
  <!-- Ambient Gradient 03 Refractive Orbs -->
  <div class="glow-orb orb-rose"></div>
  <div class="glow-orb orb-ocean"></div>

  {#if isReady}
    <Header
      currentLang={settings.language}
      currentTheme={settings.theme}
      onLangChange={handleLangChange}
      onThemeToggle={handleThemeToggle}
    />

    <Tabs
      {activeTab}
      onTabChange={(tab) => activeTab = tab}
    />

    <main class="main-content">
      {#if activeTab === 'scraper'}
        <ScraperTab {settings} />
      {:else if activeTab === 'library'}
        <LibraryTab {settings} />
      {:else if activeTab === 'rules'}
        <RulesTab />
      {:else if activeTab === 'settings'}
        <SettingsTab bind:settings onSettingsUpdated={handleSettingsUpdated} />
      {/if}
    </main>
  {:else}
    <div class="init-loader">
      <div class="init-spinner"></div>
    </div>
  {/if}
</div>

<style>
  .app-layout {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  .glow-orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(85px);
    pointer-events: none;
    z-index: 0;
    opacity: 0.38;
  }

  .orb-rose {
    width: 260px;
    height: 260px;
    background: #A77693;
    top: -60px;
    left: -60px;
  }

  .orb-ocean {
    width: 280px;
    height: 280px;
    background: #174871;
    bottom: 30px;
    right: -70px;
  }

  [data-theme="light"] .glow-orb {
    opacity: 0.25;
  }

  .main-content {
    position: relative;
    z-index: 1;
    flex: 1;
  }

  .init-loader {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }

  .init-spinner {
    width: 28px;
    height: 28px;
    border: 2.5px solid rgba(167, 118, 147, 0.25);
    border-top-color: #A77693;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

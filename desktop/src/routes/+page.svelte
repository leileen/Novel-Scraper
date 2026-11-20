<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import DashboardView from '$lib/components/DashboardView.svelte';
  import LibraryView from '$lib/components/LibraryView.svelte';
  import ReaderView from '$lib/components/ReaderView.svelte';
  import RulesView from '$lib/components/RulesView.svelte';
  import SettingsView from '$lib/components/SettingsView.svelte';
</script>

<svelte:head>
  <title>LMT's Novel - Comic - Book Manager and Downloader</title>
</svelte:head>

{#if appState.activeTab === 'dashboard'}
  <DashboardView />
{:else if appState.activeTab === 'library'}
  <LibraryView />
{:else if appState.activeTab === 'reader'}
  <ReaderView />
{:else if appState.activeTab === 'rules'}
  <RulesView />
{:else if appState.activeTab === 'settings'}
  <SettingsView />
{/if}

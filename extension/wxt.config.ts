import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: ({ browser }) => {
    const isFirefox = browser === 'firefox';
    return {
      name: '__MSG_extName__',
      description: '__MSG_extDesc__',
      default_locale: 'vi',
      permissions: [
        'storage',
        'activeTab',
        'tabs',
        'scripting',
        'downloads',
        ...(isFirefox ? [] : ['sidePanel'])
      ],
      host_permissions: ['<all_urls>'],
      commands: {
        ...(isFirefox
          ? {
              _execute_sidebar_action: {
                suggested_key: {
                  default: 'Alt+Shift+N',
                  mac: 'Alt+Shift+N'
                },
                description: 'Mở thanh bên Novel Scraper'
              }
            }
          : {
              _execute_action: {
                suggested_key: {
                  default: 'Alt+Shift+N',
                  mac: 'Alt+Shift+N'
                },
                description: 'Mở thanh bên Novel Scraper'
              }
            })
      },
      ...(isFirefox
        ? {
            sidebar_action: {
              default_panel: 'sidepanel.html',
              default_icon: {
                '16': 'icon/16.png',
                '32': 'icon/32.png',
                '48': 'icon/48.png',
                '128': 'icon/128.png'
              },
              default_title: '__MSG_extName__'
            },
            browser_specific_settings: {
              gecko: {
                id: 'novel-scraper@antigravity.local',
                strict_min_version: '142.0',
                data_collection_permissions: {
                  required: ['none']
                }
              }
            }
          }
        : {
            side_panel: {
              default_path: 'sidepanel.html'
            },
            action: {
              default_title: '__MSG_extName__',
              default_icon: {
                '16': 'icon/16.png',
                '32': 'icon/32.png',
                '48': 'icon/48.png',
                '128': 'icon/128.png'
              }
            }
          })
    };
  }
});

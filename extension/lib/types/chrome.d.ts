/**
 * Global ambient declarations for Chrome Extension APIs.
 * Guarantees zero-error TypeScript checking under strict mode.
 */
declare namespace chrome {
  export namespace runtime {
    export interface MessageSender {
      id?: string;
      url?: string;
      tab?: any;
      frameId?: number;
    }
    export const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => boolean | void | Promise<any>
      ): void;
      removeListener(callback: (...args: any[]) => void): void;
    };
    export function sendMessage(message: any, responseCallback?: (response: any) => void): Promise<any>;
    export const onInstalled: {
      addListener(callback: (details: { reason: string; previousVersion?: string }) => void): void;
      removeListener(callback: (...args: any[]) => void): void;
    };
  }

  export namespace storage {
    export interface StorageArea {
      get(keys?: string | string[] | Record<string, any> | null): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }
    export const local: StorageArea;
    export const sync: StorageArea;
  }

  export namespace i18n {
    export function getUILanguage(): string;
    export function getMessage(messageName: string, substitutions?: any): string;
  }

  export namespace sidePanel {
    export function setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>;
  }

  export namespace tabs {
    export interface Tab {
      id?: number;
      index: number;
      windowId: number;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      url?: string;
      title?: string;
      favIconUrl?: string;
      status?: string;
      incognito: boolean;
      width?: number;
      height?: number;
    }
    export function query(queryInfo: Record<string, any>): Promise<Tab[]>;
    export function sendMessage(tabId: number, message: any): Promise<any>;
  }
}

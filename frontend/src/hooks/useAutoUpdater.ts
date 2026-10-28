import { useEffect } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
import { useAppSettings } from './useAppSettings';

const UPDATE_TOAST = 'app-update';
// Long-running sessions still hear about releases published after startup.
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function installUpdate(update: Update) {
  let downloaded = 0;
  let contentLength = 0;
  toast.loading(`Downloading IFROG ${update.version}…`, { id: UPDATE_TOAST, duration: Infinity });
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        contentLength = event.data.contentLength || 0;
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength;
        if (contentLength) {
          const percent = Math.min(100, Math.round((downloaded / contentLength) * 100));
          toast.loading(`Downloading IFROG ${update.version}… ${percent}%`, { id: UPDATE_TOAST, duration: Infinity });
        }
      }
    });
    toast.success('Update installed. Restarting…', { id: UPDATE_TOAST, duration: Infinity });
    await relaunch();
  } catch (err) {
    console.error('Failed to install update:', err);
    toast.error('Update failed', {
      id: UPDATE_TOAST,
      description: err instanceof Error ? err.message : String(err),
      duration: Infinity,
      action: { label: 'Retry', onClick: () => void installUpdate(update) },
    });
  }
}

function announceUpdate(update: Update) {
  toast.info(`IFROG ${update.version} is available`, {
    id: UPDATE_TOAST,
    description: update.body?.trim() || 'A new version is ready to install.',
    duration: Infinity,
    action: { label: 'Update now', onClick: () => void installUpdate(update) },
    cancel: { label: 'Later', onClick: () => {} },
  });
}

export function useAutoUpdater() {
  const { settings } = useAppSettings();
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window) || !settings.checkUpdatesOnStartup) return;
    async function checkForUpdates() {
      try {
        const update = await check();
        if (update) announceUpdate(update);
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    }

    // Slight delay so it doesn't block initial render
    const timer = setTimeout(checkForUpdates, 2000);
    const interval = setInterval(checkForUpdates, RECHECK_INTERVAL_MS);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [settings.checkUpdatesOnStartup]);
}

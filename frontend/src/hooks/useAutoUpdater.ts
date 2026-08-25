import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

export function useAutoUpdater() {
  useEffect(() => {
    async function checkForUpdates() {
      try {
        // For testing purposes in development mode, we'll simulate the update dialog
        // since the real updater requires signed production builds.
        if (false) {
          const yes = await ask(
            `Update to v1.0.1 is available!\\n\\nRelease notes: This is a simulated update for testing the UI.\\n\\nDo you want to install it now?`,
            { title: 'Update Available', kind: 'info', okLabel: 'Update', cancelLabel: 'Later' }
          );
          if (yes) {
            await message('In a production build, this would download the new version and restart automatically. Simulation complete!', { title: 'Update Simulation', kind: 'info' });
          }
          return;
        }

        const update = await check();
        if (update) {
          const yes = await ask(
            `Update to ${update.version} is available!\\n\\nRelease notes: ${update.body}\\n\\nDo you want to install it now?`,
            { title: 'Update Available', kind: 'info', okLabel: 'Update', cancelLabel: 'Later' }
          );
          if (yes) {
            let downloaded = 0;
            let contentLength = 0;
            await update.downloadAndInstall((event) => {
              switch (event.event) {
                case 'Started':
                  contentLength = event.data.contentLength || 0;
                  console.log(`Started downloading ${contentLength} bytes`);
                  break;
                case 'Progress':
                  downloaded += event.data.chunkLength;
                  console.log(`Downloaded ${downloaded} of ${contentLength} bytes`);
                  break;
                case 'Finished':
                  console.log('Download finished!');
                  break;
              }
            });
            await message('Update installed successfully! The app will now restart.', { title: 'Update Complete', kind: 'info' });
            await relaunch();
          }
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    }
    
    // Slight delay so it doesn't block initial render
    setTimeout(checkForUpdates, 2000);
  }, []);
}

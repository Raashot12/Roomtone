import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, X } from 'lucide-react';

function isStandaloneDisplay() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOSDevice() {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export default function PWAControls({ busy = false, onToast }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [manualInstallAvailable, setManualInstallAvailable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onOfflineReady: () => onToast('Roomtone is ready to open offline on this device.'),
  });

  useEffect(() => {
    const updateStandaloneState = () => {
      const installed = isStandaloneDisplay();
      setIsInstalled(installed);
      setManualInstallAvailable(!installed && isIOSDevice());
    };
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setManualInstallAvailable(false);
      onToast('Roomtone has been installed.');
    };
    const displayMode = window.matchMedia?.('(display-mode: standalone)');

    updateStandaloneState();
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    displayMode?.addEventListener?.('change', updateStandaloneState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayMode?.removeEventListener?.('change', updateStandaloneState);
    };
  }, [onToast]);

  const handleInstall = async () => {
    if (!installPrompt) {
      onToast('In Safari, tap Share, then choose Add to Home Screen.');
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') onToast('Roomtone is being installed.');
    } catch {
      onToast('The install prompt could not be opened. Use your browser menu to install Roomtone.');
    } finally {
      setInstallPrompt(null);
    }
  };

  const handleUpdate = async () => {
    try {
      await updateServiceWorker();
    } catch {
      onToast('The update could not be applied. Try reloading Roomtone.');
    }
  };

  return (
    <>
      {!isInstalled && (installPrompt || manualInstallAvailable) && (
        <button
          type="button"
          className="install-app-button"
          onClick={handleInstall}
          aria-label="Install Roomtone app"
          title="Install Roomtone app"
        >
          <Download size={15} />
          <span>Install app</span>
        </button>
      )}

      {needRefresh && (
        <div className="pwa-update-banner" role="status" aria-live="polite">
          <div className="pwa-update-copy">
            <strong>Roomtone update ready</strong>
            <span>Reload the app when you are ready to apply it.</span>
          </div>
          <button type="button" className="button button-primary" onClick={handleUpdate} disabled={busy}>
            <RefreshCw size={14} /> Reload app
          </button>
          <button
            type="button"
            className="pwa-dismiss-button"
            onClick={() => setNeedRefresh(false)}
            aria-label="Dismiss update notice"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt if user hasn't dismissed it recently
      const dismissed = localStorage.getItem('pwa-prompt-dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 z-[9999] bg-slate-800 border border-slate-700 shadow-lg rounded-lg p-4 flex items-center gap-4 max-w-sm w-[calc(100%-2rem)] md:w-auto animate-in fade-in slide-in-from-bottom-4">
      <div className="flex-shrink-0 bg-slate-700 p-2 rounded-md">
        <Download className="w-6 h-6 text-sky-400" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-white">Installer l'application</h3>
        <p className="text-xs text-slate-400 mt-0.5">Accès rapide depuis votre écran d'accueil.</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          className="text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded transition-colors"
        >
          Installer
        </button>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

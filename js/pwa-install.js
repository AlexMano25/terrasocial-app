// ── PWA Install Prompt ──────────────────────────────────────────────────────
// Shared across all dashboards (client, owner, manager, super-admin)
// Shows "Install app" banner when the browser supports PWA installation

(function initPWAInstall() {
  var deferredPrompt = null;
  var banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    banner.style.display = 'flex';
  });

  // Global install function called by onclick
  window.installPWA = async function() {
    if (!deferredPrompt) {
      // Fallback: guide manual install
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert('Pour installer TERRASOCIAL :\n\n1. Appuyez sur le bouton Partager (⬆️)\n2. Sélectionnez "Sur l\'écran d\'accueil"\n3. Confirmez l\'ajout');
      } else {
        alert('Pour installer TERRASOCIAL :\n\n1. Ouvrez le menu du navigateur (⋮)\n2. Sélectionnez "Installer l\'application"\n   ou "Ajouter à l\'écran d\'accueil"');
      }
      return;
    }

    deferredPrompt.prompt();
    var result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      banner.style.display = 'none';
    }
    deferredPrompt = null;
  };

  // Hide banner if already installed
  window.addEventListener('appinstalled', function() {
    banner.style.display = 'none';
    deferredPrompt = null;
  });

  // On iOS, show the banner with manual instructions (no beforeinstallprompt)
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isIOS && !isStandalone) {
    banner.style.display = 'flex';
    var btn = document.getElementById('pwa-install-btn');
    if (btn) btn.textContent = 'Ajouter à l\'accueil';
  }

  // On Android, if not installed and no prompt after 3s, show anyway
  if (!isIOS && !isStandalone) {
    setTimeout(function() {
      if (!deferredPrompt) {
        // Show banner with manual instructions
        banner.style.display = 'flex';
      }
    }, 3000);
  }
})();

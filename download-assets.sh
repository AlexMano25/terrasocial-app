#!/bin/bash
# =============================================================================
# TERRASOCIAL — Téléchargement des assets tiers en local
# Objectif : réduire la dépendance aux CDN externes pour les dashboards
# Exécuter depuis la racine du projet : bash download-assets.sh
# =============================================================================

set -e

JS_DIR="$(dirname "$0")/js"
mkdir -p "$JS_DIR"

echo "📦 Téléchargement des assets JavaScript en local..."

# ── Chart.js (utilisé dans dashboard-super-admin.html) ─────────────────────
CHART_FILE="$JS_DIR/chart.umd.min.js"
if [ -f "$CHART_FILE" ]; then
    echo "  ✅ Chart.js déjà présent : $CHART_FILE"
else
    echo "  ⬇️  Téléchargement de Chart.js 4.4.4..."
    curl -fsSL "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js" \
         -o "$CHART_FILE"
    echo "  ✅ Chart.js téléchargé : $CHART_FILE"
fi

echo ""
echo "✅ Tous les assets sont disponibles localement."
echo "   Le dashboard utilisera désormais les fichiers locaux."
echo "   En cas d'absence, le CDN prend automatiquement le relais (fallback onerror)."

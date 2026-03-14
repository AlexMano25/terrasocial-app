#!/usr/bin/env python3
"""
TERRASOCIAL — Patcher de déploiement
Corrige le simulateur + applique les fichiers HTML + git push
"""
import subprocess, sys, os, base64, zlib
from pathlib import Path

HERE = Path(__file__).parent.resolve()
os.chdir(HERE)
print("\n🌿 TERRASOCIAL — Déploiement complet")

# ── 1. Supprimer le git lock si présent ──
lock = HERE / '.git' / 'index.lock'
if lock.exists():
    lock.unlink()
    print("✅ Git lock supprimé")

# ── 2. Git pull --rebase ──
print("\n📥 Git pull --rebase...")
r = subprocess.run(['git', 'pull', '--rebase'], capture_output=True, text=True)
if r.returncode != 0:
    print(f"⚠️  git pull: {r.stderr[:200]}")
else:
    print(r.stdout.strip() or "À jour")

# ── 3. Patcher index.html (correction simulateur) ──
print("\n🔧 Correction simulateur index.html...")
idx = HERE / 'index.html'
txt = idx.read_text(encoding='utf-8')

OLD_CALC = """        // Payment simulator — synchronisé avec API lots, modes mensuel & journalier
        function calculatePayment() {
            const select = document.getElementById('lot-price');
            const price = parseInt(select.value) || 500000;"""

NEW_CALC = """        // Payment simulator — synchronisé avec API lots, modes mensuel & journalier
        function calculatePayment() {
            const select = document.getElementById('lot-price');
            if (!select) return;
            const price = parseInt(select.value) || 500000;"""

OLD_DUR = """            const duration = parseInt(document.getElementById('duration').value) || apiDuration || 24;

            // ── Nouveau modèle : pas d'acompte %, frais de dossier 10 000 FCFA fixes ──
            // La mensualité porte sur le PRIX TOTAL du lot (les 10 000 Fr sont des frais séparés)
            const MIN_DAILY = 1500;
            const monthly = apiMonthly || Math.ceil(price / duration);
            const versementsParMois = Math.ceil(monthly / MIN_DAILY);"""

NEW_DUR = """            // Synchroniser le select durée avec la durée contractuelle du lot sélectionné
            const durationSel = document.getElementById('duration');
            if (durationSel && apiDuration > 0) {
                const opts = Array.from(durationSel.options).map(o => parseInt(o.value));
                if (opts.includes(apiDuration)) durationSel.value = String(apiDuration);
            }
            const duration = (durationSel ? parseInt(durationSel.value) : 0) || apiDuration || 24;

            const MIN_DAILY = 1500;
            const monthly = apiMonthly || Math.ceil(price / duration);
            const versementsParMois = Math.ceil(monthly / MIN_DAILY);
            const joursMois = versementsParMois;"""

OLD_DAILY_EQ = """            const dailyCountEl = document.getElementById('daily-count');
            if (dailyCountEl) {
                dailyCountEl.textContent = `🍺🍺 ${versementsParMois} versements de 1 500 Fr = 1 mois payé`;
            }

            // ── Résultat journalier ──
            const dailyDetailEl = document.getElementById('daily-detail');
            if (dailyDetailEl) {
                dailyDetailEl.innerHTML = `
                    <strong>${versementsParMois} versements de 1 500 Fr</strong> couvrent la mensualité de ${monthly.toLocaleString(locale)} FCFA<br>
                    <span style="font-size:13px; color:var(--gray-text);">Payez autant de jours en avance que vous voulez — chaque franc compte !</span>`;
            }"""

NEW_DAILY_EQ = """            const dailyCountEl = document.getElementById('daily-count');
            if (dailyCountEl) {
                dailyCountEl.textContent = `🍺🍺 ${joursMois} versements de 1 500 Fr = 1 mois payé`;
            }

            // ── Résultat journalier ──
            const dailyEquivEl = document.getElementById('daily-equiv');
            if (dailyEquivEl) dailyEquivEl.textContent = '1 500 FCFA/jour';
            const dailyDetailEl = document.getElementById('daily-detail');
            if (dailyDetailEl) {
                dailyDetailEl.innerHTML =
                    `<strong>${joursMois} versements de 1 500 Fr</strong> couvrent la mensualité de ${monthly.toLocaleString(locale)} FCFA<br>` +
                    `<span style="font-size:13px; color:var(--gray-text);">Payez autant de jours en avance que vous voulez — chaque franc compte !</span>`;
            }"""

OLD_SELLEN = """                const simSelect = document.getElementById('lot-price');
                if (simSelect) {
                    simSelect.innerHTML = lots.map((lot) => {
                        const price   = Number(lot.price || 0);
                        const monthly = Number(lot.monthly_amount || 0);
                        const dur     = Number(lot.duration_months || 24);
                        const label   = `${price.toLocaleString('fr-FR')} FCFA — ${lot.title}`;
                        return `<option value="${price}" data-monthly="${monthly}" data-duration="${dur}">${label}</option>`;
                    }).join('');
                    calculatePayment();
                }"""

NEW_SELLEN = """                const simSelect = document.getElementById('lot-price');
                if (simSelect && lots.length > 0) {
                    simSelect.innerHTML = lots.map((lot) => {
                        const price   = Number(lot.price || 0);
                        const monthly = Number(lot.monthly_amount || 0);
                        const dur     = Number(lot.duration_months || 24);
                        const label   = `${price.toLocaleString('fr-FR')} FCFA — ${lot.title}`;
                        return `<option value="${price}" data-monthly="${monthly}" data-duration="${dur}">${label}</option>`;
                    }).join('');
                    const durationSel = document.getElementById('duration');
                    if (durationSel) {
                        lots.forEach(lot => {
                            const dur = Number(lot.duration_months || 0);
                            if (dur > 0 && !Array.from(durationSel.options).some(o => parseInt(o.value) === dur)) {
                                const opt = document.createElement('option');
                                opt.value = dur; opt.textContent = `${dur} mois`;
                                durationSel.appendChild(opt);
                            }
                        });
                        const sorted = Array.from(durationSel.options).sort((a,b)=>parseInt(a.value)-parseInt(b.value));
                        durationSel.innerHTML = ''; sorted.forEach(o=>durationSel.appendChild(o));
                    }
                    calculatePayment();
                }"""

changes = 0
for old, new in [(OLD_CALC, NEW_CALC), (OLD_DUR, NEW_DUR), (OLD_DAILY_EQ, NEW_DAILY_EQ), (OLD_SELLEN, NEW_SELLEN)]:
    if old in txt:
        txt = txt.replace(old, new, 1)
        changes += 1
    else:
        # Essayer une correspondance plus souple
        import re
        # Chercher juste le début pour détecter si déjà patché
        first_line = old.strip().split('\n')[0].strip()
        if first_line in txt:
            print(f"  ⚠️  Déjà patché ou légèrement différent: {first_line[:60]}")
        else:
            print(f"  ❌ Pattern non trouvé: {first_line[:60]}")

idx.write_text(txt, encoding='utf-8')
print(f"  ✅ {changes}/4 corrections appliquées à index.html")

# ── 4. Appliquer cgv.html, politique-paiement.html, dashboard-super-admin.html ──
print("\n📄 Application des fichiers HTML mis à jour...")
HTML_FILES = {
    'cgv.html': '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',
    'politique-paiement.html': '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',
    'dashboard-super-admin.html': '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',
    'package.json': 'eNqVUjtPwzAQ3vsrrMzETfqghYkKMSAhIbXMSI5zCW4T27KdUlT1v3Nx7DZiY4u+l+++y3lCSCJZC8kjSRwYw6zigjXpNxTJXU9qI47M9bwzHXjoCMYKJXtLTjOaDcISLDdCu8DsHHOCk8oo6UCWpOhEU5IvaDS6SaUM+XjZbje79+fXzVtM0KgEyQVYjDgj1qOKn/rAzwe6pLlXIvpkO80KZmEaP9K99bIZXa7oIuoKbn60u1ILOo8MVyaia7qMaKlw2qPH83uUXwk4aQN2cCzoLKezP0xqsKa0Ea1wXrTCcbOowb1bGPD1tTLE91ZJrNqpA8iwZHZLbpWp2YDnNB/Z2q7BY4XpRwZdVofwfEbz1Yiow9u41DxB7OIbHy42KttfqZdKVQIJ9LQGCX4700knWki5kpWoKdYa8vGX4NCk/7b3k0wuk18Wd7Jp',
}
import zlib, base64 as b64m
for name, enc in HTML_FILES.items():
    Path(name).write_bytes(zlib.decompress(b64m.b64decode(enc)))
    print(f"  ✅ {name}")

# ── 5. Git add + commit + push ──
print("\n📤 Git commit & push...")
files_to_add = ['index.html', 'cgv.html', 'politique-paiement.html',
                'dashboard-super-admin.html', 'package.json', 'update_documents.py']
files_existing = [f for f in files_to_add if Path(f).exists()]
subprocess.run(['git', 'add'] + files_existing, check=True)

msg = "fix: simulateur paiement — sync API lots, daily-equiv, durées dynamiques, frais dossier 10K FCFA"
r = subprocess.run(['git', 'commit', '-m', msg], capture_output=True, text=True)
if r.returncode == 0:
    print(f"  ✅ Commit: {r.stdout.strip()}")
else:
    print(f"  ℹ️  {r.stdout.strip() or r.stderr.strip()}")

r = subprocess.run(['git', 'push'], capture_output=True, text=True)
if r.returncode == 0:
    print(f"  ✅ Push réussi !")
else:
    print(f"  ❌ Push échoué: {r.stderr[:300]}")
    print("  💡 Lancez manuellement: git push")

print("\n✅ DÉPLOIEMENT TERMINÉ")
print("🌐 Vérifiez: https://social.manovende.com")

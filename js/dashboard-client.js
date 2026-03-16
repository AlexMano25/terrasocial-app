(function initClientDashboard() {
  const userRaw = localStorage.getItem('ts_user');
  if (!userRaw || !TSApi.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(userRaw);
  if (user.role !== 'client' && user.role !== 'admin') {
    window.location.href = 'dashboard-owner.html';
    return;
  }

  // ── Utilitaires ──────────────────────────────────────────────────────────
  function xaf(value) {
    return Number(value || 0).toLocaleString('fr-FR') + ' FCFA';
  }

  function flash(message, type) {
    document.getElementById('flash').innerHTML = '<div class="flash ' + type + '">' + message + '</div>';
  }

  function setList(id, items, render) {
    const el = document.getElementById(id);
    el.innerHTML = items.length ? items.map(render).join('') : '<li class="small">Aucune donnée</li>';
  }

  function statusBadge(status) {
    var cls = status === 'paid' ? 'badge-ok' : status === 'late' ? 'badge-late' : 'badge-pending';
    var label = status === 'paid' ? 'Payé' : status === 'late' ? 'En retard' : 'À venir';
    return '<span class="' + cls + '">' + label + '</span>';
  }

  function formatMethod(m) {
    var names = { orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', virement: 'Virement', carte: 'Carte' };
    return names[m] || m;
  }

  function formatDate(d) {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('fr-FR'); } catch (e) { return d; }
  }

  // ── Chargement principal ─────────────────────────────────────────────────
  async function load() {
    try {
      const data = await TSApi.request('/api/client/dashboard');

      // Métriques
      document.getElementById('m-commitment').textContent = xaf(data.metrics.commitment_total);
      document.getElementById('m-paid').textContent = xaf(data.metrics.paid_total);
      document.getElementById('m-remaining').textContent = xaf(data.metrics.remaining_total);
      document.getElementById('m-score').textContent = 'Score de fiabilité: ' + data.metrics.reliability_score + '/100';

      // Barre de progression
      var progress = data.metrics.commitment_total > 0
        ? Math.round((data.metrics.paid_total / data.metrics.commitment_total) * 100) : 0;
      document.getElementById('m-progress').innerHTML =
        '<div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%">' + progress + '%</div></div>';

      // Retards
      var lateEl = document.getElementById('m-late');
      if (data.metrics.late_amount > 0) {
        lateEl.innerHTML = '<span class="badge-late">\u26A0 ' + data.metrics.late_months_count + ' mois en retard (' + xaf(data.metrics.late_amount) + ')</span>';
        document.getElementById('card-remaining').style.borderLeft = '4px solid #C62828';
      } else {
        lateEl.innerHTML = '<span class="badge-ok">\u2713 À jour</span>';
        document.getElementById('card-remaining').style.borderLeft = '4px solid #2E7D32';
      }

      // Police d'assurance
      var hasReservation = data.reservations && data.reservations.length > 0;
      document.getElementById('btn-insurance').disabled = !hasReservation;
      document.getElementById('insurance-note').style.display = hasReservation ? 'none' : 'block';

      // Sélecteur réservation pour versement
      var selectRes = document.getElementById('v-reservation');
      selectRes.innerHTML = '';
      if (data.reservations.length === 0) {
        selectRes.innerHTML = '<option value="">Aucune réservation</option>';
      } else {
        data.reservations.forEach(function(r) {
          var opt = document.createElement('option');
          opt.value = r.reservation_id;
          opt.textContent = r.lot_type.toUpperCase() + ' \u2014 ' + xaf(r.lot_price) +
            ' (' + r.duration_months + ' mois) \u2014 reste: ' + xaf(r.remaining_total);
          opt.dataset.monthly = r.monthly_amount;
          opt.dataset.remaining = r.remaining_total;
          selectRes.appendChild(opt);
        });
        updateMinAmount();
      }

      // Échéancier
      renderSchedule(data.reservations);

      // Historique versements
      document.getElementById('payments-body').innerHTML = data.payments.length
        ? data.payments.map(function(p) {
            return '<tr><td>' + (p.reference || '-') + '</td><td>' + xaf(p.amount) +
              '</td><td>' + formatMethod(p.method) + '</td><td>' + formatDate(p.paid_at) +
              '</td><td>' + statusBadge(p.status) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="5" class="small">Aucun versement enregistré</td></tr>';

      // Contrats et PV
      setList('contracts-list', data.contracts, function(c) {
        return '<li>' + c.contract_number + ' \u2014 ' + statusBadge(c.status) + '</li>';
      });
      setList('pv-list', data.possession, function(p) {
        return '<li>' + p.pv_number + ' \u2014 ' + statusBadge(p.status) + '</li>';
      });

      // Documents
      var docs = await TSApi.request('/api/documents');
      setList('documents-list', docs.documents, function(d) {
        var link = d.public_url ? ' \u2014 <a href="' + d.public_url + '" target="_blank">ouvrir</a>' : '';
        return '<li>' + d.document_type + ' \u2014 ' + d.file_name + link + '</li>';
      });
    } catch (error) {
      flash(error.message, 'err');
    }
  }

  // ── Montant minimum dynamique ────────────────────────────────────────────
  function updateMinAmount() {
    var sel = document.getElementById('v-reservation');
    var opt = sel.options[sel.selectedIndex];
    var input = document.getElementById('v-amount');
    var label = document.getElementById('v-min-label');
    if (opt && opt.dataset.monthly) {
      var min = Number(opt.dataset.monthly);
      input.min = min;
      input.placeholder = min.toLocaleString('fr-FR');
      label.textContent = '(min: ' + min.toLocaleString('fr-FR') + ')';
    }
  }
  document.getElementById('v-reservation').addEventListener('change', updateMinAmount);

  // ── Rendu échéancier ─────────────────────────────────────────────────────
  function renderSchedule(reservations) {
    var container = document.getElementById('schedule-container');
    if (!reservations || reservations.length === 0) {
      container.innerHTML = '<p class="small">Aucune réservation active.</p>';
      return;
    }
    var html = '';
    reservations.forEach(function(r) {
      html += '<div style="margin-bottom:20px">';
      html += '<h3 style="margin-bottom:4px">' + r.lot_type.toUpperCase() + ' \u2014 ' + xaf(r.lot_price) + '</h3>';
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">';
      html += '<span class="small">Mensualité: <strong>' + xaf(r.monthly_amount) + '</strong></span>';
      html += '<span class="small">Avancement: <strong>' + r.progress_percent + '%</strong></span>';
      if (r.can_get_possession) html += '<span class="badge-ok">\uD83C\uDFE0 Éligible PV de jouissance</span>';
      if (r.late_months_count > 0) html += '<span class="badge-late">\u26A0 ' + r.late_months_count + ' mois en retard</span>';
      html += '</div>';
      html += '<div class="progress-bar"><div class="progress-fill" style="width:' + r.progress_percent + '%">' + r.progress_percent + '%</div></div>';

      if (r.schedule && r.schedule.length > 0) {
        html += '<div class="table-wrap"><table class="schedule-table">';
        html += '<thead><tr><th>Mois</th><th>Échéance</th><th>Dû</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead><tbody>';
        r.schedule.forEach(function(m) {
          html += '<tr class="' + m.status + '"><td>' + m.month + '</td><td>' + formatDate(m.due_date) +
            '</td><td>' + xaf(m.amount_due) + '</td><td>' + xaf(m.amount_paid) + '</td><td>' + xaf(m.remaining) +
            '</td><td>' + statusBadge(m.status) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // ── Événements ───────────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', function() {
    TSApi.clearSession();
    window.location.href = 'login.html';
  });

  // Police d'assurance
  document.getElementById('btn-insurance').addEventListener('click', function() {
    var apiBase = window.TERRASOCIAL_API_BASE || '';
    var token = TSApi.getToken();
    window.open(apiBase + '/api/client/insurance-policy?token=' + encodeURIComponent(token), '_blank');
  });

  // Versement
  document.getElementById('versement-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var resId = document.getElementById('v-reservation').value;
    var amount = Number(document.getElementById('v-amount').value);
    var method = document.getElementById('v-method').value;
    if (!resId) { flash('Sélectionnez une réservation.', 'err'); return; }
    try {
      var result = await TSApi.request('/api/client/versement', {
        method: 'POST',
        body: JSON.stringify({ reservation_id: Number(resId), amount: amount, method: method })
      });
      flash('Versement enregistré ! Réf: ' + result.reference + ' \u2014 Score: ' + result.reliability_score + '/100', 'ok');
      e.target.reset();
      await load();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  // Réservation
  document.getElementById('reservation-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    try {
      await TSApi.request('/api/client/reservations', {
        method: 'POST',
        body: JSON.stringify({
          lot_type: document.getElementById('lot_type').value,
          lot_price: Number(document.getElementById('lot_price').value),
          duration_months: Number(document.getElementById('duration_months').value),
          source: 'dashboard-client'
        })
      });
      flash('Réservation enregistrée.', 'ok');
      await load();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  // Document
  document.getElementById('document-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var file = document.getElementById('document-file').files[0];
    if (!file) { flash('Sélectionnez un fichier.', 'err'); return; }
    var formData = new FormData();
    formData.append('document_type', document.getElementById('document-type').value);
    formData.append('file', file);
    try {
      await TSApi.request('/api/documents', { method: 'POST', body: formData });
      flash('Document envoyé.', 'ok');
      e.target.reset();
      await load();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  load();
})();

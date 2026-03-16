(function initClientDashboard() {
  var userRaw = localStorage.getItem('ts_user');
  if (!userRaw || !TSApi.getToken()) { window.location.href = 'login.html'; return; }
  var user = JSON.parse(userRaw);
  if (user.role !== 'client' && user.role !== 'admin') { window.location.href = 'dashboard-owner.html'; return; }

  // ── Config Endpoints ────────────────────────────────────────────────────
  var CAMPAY_ENDPOINT = 'https://tbwbzbedlghodzlhtjbo.supabase.co/functions/v1/campay-pay';

  // ── Utilitaires ──────────────────────────────────────────────────────────
  function xaf(v) { return Number(v || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function flash(msg, type) { document.getElementById('flash').innerHTML = '<div class="flash ' + type + '">' + msg + '</div>'; }
  function setList(id, items, fn) {
    var el = document.getElementById(id);
    el.innerHTML = items.length ? items.map(fn).join('') : '<li class="small">Aucune donn\u00e9e</li>';
  }
  function statusBadge(s) {
    var c = s === 'paid' ? 'badge-ok' : s === 'late' ? 'badge-late' : 'badge-pending';
    var l = s === 'paid' ? 'Pay\u00e9' : s === 'late' ? 'En retard' : s === 'pending' ? 'En attente' : '\u00c0 venir';
    return '<span class="' + c + '">' + l + '</span>';
  }
  function fmtMethod(m) { return {orange_money:'Orange Money',mtn_momo:'MTN MoMo',virement:'Virement',carte:'Carte'}[m]||m; }
  function fmtDate(d) { if(!d) return '-'; try{return new Date(d).toLocaleDateString('fr-FR');}catch(e){return d;} }

  // ── State ────────────────────────────────────────────────────────────────
  var currentFreq = 'daily';
  var pendingPaymentId = null;
  var cachedReservations = []; // store reservation summaries for insurance persons UI

  // ── Chargement ───────────────────────────────────────────────────────────
  async function load() {
    try {
      var data = await TSApi.request('/api/client/dashboard');
      cachedReservations = data.reservations || [];

      document.getElementById('m-commitment').textContent = xaf(data.metrics.commitment_total);
      document.getElementById('m-paid').textContent = xaf(data.metrics.paid_total);
      document.getElementById('m-remaining').textContent = xaf(data.metrics.remaining_total);
      document.getElementById('m-score').textContent = 'Score de fiabilit\u00e9: ' + data.metrics.reliability_score + '/100';

      // Nombre de lots actifs
      var lotsEl = document.getElementById('m-lots');
      if (data.metrics.total_active_lots > 0) {
        lotsEl.textContent = data.metrics.total_active_lots + ' lot(s) souscrit(s)';
      }

      var progress = data.metrics.commitment_total > 0 ? Math.round((data.metrics.paid_total / data.metrics.commitment_total) * 100) : 0;
      document.getElementById('m-progress').innerHTML = '<div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%">' + progress + '%</div></div>';

      var lateEl = document.getElementById('m-late');
      if (data.metrics.late_amount > 0) {
        lateEl.innerHTML = '<span class="badge-late">\u26A0 ' + data.metrics.late_months_count + ' mois en retard (' + xaf(data.metrics.late_amount) + ')</span>';
        document.getElementById('card-remaining').style.borderLeft = '4px solid #C62828';
      } else {
        lateEl.innerHTML = '<span class="badge-ok">\u2713 \u00c0 jour</span>';
        document.getElementById('card-remaining').style.borderLeft = '4px solid #2E7D32';
      }

      // Résumé journalier
      renderDailySummary(data.metrics, data.reservations);

      // Police d'assurance
      var hasRes = data.reservations && data.reservations.length > 0;
      document.getElementById('btn-insurance').disabled = !hasRes;
      document.getElementById('insurance-note').style.display = hasRes ? 'none' : 'block';

      // Section personnes assurées
      renderInsurancePersonsSection(data.reservations);

      // Sélecteur réservation pour versement
      var sel = document.getElementById('v-reservation');
      sel.innerHTML = '';
      if (!data.reservations.length) {
        sel.innerHTML = '<option value="">Aucune r\u00e9servation</option>';
      } else {
        data.reservations.forEach(function(r) {
          var opt = document.createElement('option');
          opt.value = r.reservation_id;
          opt.textContent = r.lot_type.toUpperCase() + ' ' + (r.lot_size_m2 || 200) + 'm\u00b2 \u2014 ' + xaf(r.lot_price) + ' \u2014 reste: ' + xaf(r.remaining_total);
          opt.dataset.dailyTotal = r.daily_total || 1500;
          opt.dataset.dailyLot = r.daily_amount || 1500;
          opt.dataset.dailyInsurance = r.daily_insurance || 0;
          opt.dataset.monthly = r.monthly_amount;
          opt.dataset.remaining = r.remaining_total;
          opt.dataset.lotType = r.lot_type || '';
          sel.appendChild(opt);
        });
      }
      updateAmountFromFreq();

      renderSchedule(data.reservations);

      // Historique — uniquement les paiements liés aux réservations actives
      var activeResIds = data.reservations.map(function(r) { return r.reservation_id; });
      var filteredPayments = data.payments.filter(function(p) {
        return activeResIds.indexOf(p.reservation_id) !== -1 || !p.reservation_id;
      });

      document.getElementById('payments-body').innerHTML = filteredPayments.length
        ? filteredPayments.map(function(p) {
          var lotLabel = '-';
          var matchRes = data.reservations.find(function(r) { return r.reservation_id === p.reservation_id; });
          if (matchRes) lotLabel = matchRes.lot_type.toUpperCase() + ' ' + (matchRes.lot_size_m2 || 200) + 'm\u00b2';
          return '<tr><td>' + (p.reference||'-') + '</td><td>' + lotLabel + '</td><td>' + xaf(p.amount) + '</td><td>' + fmtMethod(p.method) + '</td><td>' + fmtDate(p.paid_at) + '</td><td>' + statusBadge(p.status) + '</td></tr>';
        }).join('')
        : '<tr><td colspan="6" class="small">Aucun versement</td></tr>';

      setList('contracts-list', data.contracts, function(c) { return '<li>' + c.contract_number + ' \u2014 ' + statusBadge(c.status) + '</li>'; });
      setList('pv-list', data.possession, function(p) { return '<li>' + p.pv_number + ' \u2014 ' + statusBadge(p.status) + '</li>'; });

      var docs = await TSApi.request('/api/documents');
      setList('documents-list', docs.documents, function(d) {
        var lnk = d.public_url ? ' \u2014 <a href="' + d.public_url + '" target="_blank">ouvrir</a>' : '';
        return '<li>' + d.document_type + ' \u2014 ' + d.file_name + lnk + '</li>';
      });
    } catch (e) { flash(e.message, 'err'); }
  }

  // ── Résumé journalier ──────────────────────────────────────────────────
  function renderDailySummary(metrics, reservations) {
    var section = document.getElementById('daily-summary-section');
    if (!reservations || !reservations.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    var breakdown = document.getElementById('daily-breakdown');
    var h = '';
    reservations.forEach(function(r) {
      h += '<div class="daily-row"><span>' + r.lot_type.toUpperCase() + ' ' + (r.lot_size_m2 || 200) + 'm\u00b2</span><span>' + xaf(r.daily_amount) + '/jour</span></div>';
      if (r.insurance_persons > 0) {
        h += '<div class="daily-row"><span>\u00a0\u00a0\u00a0+ Assurance (' + r.insurance_persons + ' pers.)</span><span>' + xaf(r.daily_insurance) + '/jour</span></div>';
      }
    });
    breakdown.innerHTML = h;
    document.getElementById('daily-total-display').textContent = 'Total quotidien: ' + xaf(metrics.total_daily_amount);
  }

  // ── Section personnes assurées ─────────────────────────────────────────
  function renderInsurancePersonsSection(reservations) {
    var section = document.getElementById('insurance-persons-section');
    if (!reservations || !reservations.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    var sel = document.getElementById('insurance-res-select');
    sel.innerHTML = '';
    reservations.forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r.reservation_id;
      opt.textContent = r.lot_type.toUpperCase() + ' ' + (r.lot_size_m2 || 200) + 'm\u00b2';
      opt.dataset.persons = r.insurance_persons || 0;
      sel.appendChild(opt);
    });

    updateInsuranceDisplay();
  }

  function updateInsuranceDisplay() {
    var sel = document.getElementById('insurance-res-select');
    var opt = sel.options[sel.selectedIndex];
    var count = opt ? Number(opt.dataset.persons || 0) : 0;
    document.getElementById('persons-count').textContent = count;
    document.getElementById('insurance-daily-cost').textContent = xaf(count * 350) + '/jour';
  }

  document.getElementById('insurance-res-select').addEventListener('change', updateInsuranceDisplay);

  document.getElementById('persons-plus').addEventListener('click', async function() {
    var sel = document.getElementById('insurance-res-select');
    var opt = sel.options[sel.selectedIndex];
    if (!opt) return;
    var newCount = Number(opt.dataset.persons || 0) + 1;
    try {
      await TSApi.request('/api/client/reservations/' + opt.value + '/insurance-persons', {
        method: 'POST',
        body: JSON.stringify({ count: newCount })
      });
      opt.dataset.persons = newCount;
      updateInsuranceDisplay();
      await load(); // Refresh all data
    } catch (e) { flash(e.message, 'err'); }
  });

  document.getElementById('persons-minus').addEventListener('click', async function() {
    var sel = document.getElementById('insurance-res-select');
    var opt = sel.options[sel.selectedIndex];
    if (!opt) return;
    var current = Number(opt.dataset.persons || 0);
    if (current <= 0) return;
    var newCount = current - 1;
    try {
      await TSApi.request('/api/client/reservations/' + opt.value + '/insurance-persons', {
        method: 'POST',
        body: JSON.stringify({ count: newCount })
      });
      opt.dataset.persons = newCount;
      updateInsuranceDisplay();
      await load(); // Refresh all data
    } catch (e) { flash(e.message, 'err'); }
  });

  // ── Fréquence de versement ───────────────────────────────────────────────
  document.querySelectorAll('.freq-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.freq-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFreq = btn.dataset.freq;
      updateAmountFromFreq();
    });
  });

  var freqMultipliers = { daily: 1, hebdomadaire: 7, bimensuel: 14, mensuel: 30, semestriel: 180 };
  var freqLabels = { daily: '/jour', hebdomadaire: '/semaine', bimensuel: '/2 sem.', mensuel: '/mois', semestriel: '/semestre', custom: '' };

  function updateAmountFromFreq() {
    var sel = document.getElementById('v-reservation');
    var opt = sel.options[sel.selectedIndex];
    var input = document.getElementById('v-amount');
    var label = document.getElementById('v-min-label');
    var dailyTotal = opt && opt.dataset.dailyTotal ? Number(opt.dataset.dailyTotal) : 1500;
    var lotType = opt && opt.dataset.lotType ? opt.dataset.lotType : '';
    var isStarter = lotType === 'starter';

    var multiplier = freqMultipliers[currentFreq] || 1;

    if (currentFreq === 'custom') {
      input.value = '';
      input.min = dailyTotal;
      label.textContent = '(min: ' + dailyTotal.toLocaleString('fr-FR') + ')';
    } else {
      var amount = dailyTotal * multiplier;
      input.value = amount;
      input.min = dailyTotal;
      label.textContent = '(min: ' + amount.toLocaleString('fr-FR') + ' ' + (freqLabels[currentFreq] || '') + ')';
    }

    // Activer/désactiver fréquences selon le type de lot
    document.querySelectorAll('.freq-btn').forEach(function(btn) {
      var freq = btn.dataset.freq;
      var available = isStarter ? (freq === 'daily' || freq === 'custom') : true;
      btn.style.opacity = available ? '1' : '0.4';
      btn.style.pointerEvents = available ? 'auto' : 'none';
    });

    // Si Starter et fréquence non-quotidien, forcer quotidien
    if (isStarter && currentFreq !== 'daily' && currentFreq !== 'custom') {
      currentFreq = 'daily';
      document.querySelectorAll('.freq-btn').forEach(function(b) { b.classList.remove('active'); });
      var dailyBtn = document.querySelector('.freq-btn[data-freq="daily"]');
      if (dailyBtn) dailyBtn.classList.add('active');
      updateAmountFromFreq();
    }
  }

  document.getElementById('v-reservation').addEventListener('change', updateAmountFromFreq);

  // Afficher le champ téléphone pour Orange Money et MTN MoMo
  document.getElementById('v-method').addEventListener('change', function() {
    var m = this.value;
    var showPhone = (m === 'orange_money' || m === 'mtn_momo');
    document.getElementById('phone-field').style.display = showPhone ? 'block' : 'none';
  });

  // ── Échéancier ───────────────────────────────────────────────────────────
  function renderSchedule(reservations) {
    var c = document.getElementById('schedule-container');
    if (!reservations || !reservations.length) { c.innerHTML = '<p class="small">Aucune r\u00e9servation active.</p>'; return; }
    var h = '';
    reservations.forEach(function(r) {
      h += '<div style="margin-bottom:20px"><h3>' + r.lot_type.toUpperCase() + ' ' + (r.lot_size_m2 || 200) + 'm\u00b2 \u2014 ' + xaf(r.lot_price) + '</h3>';
      h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">';
      h += '<span class="small">Journalier: <strong>' + xaf(r.daily_total) + '</strong></span>';
      if (r.insurance_persons > 0) h += '<span class="small">(dont assurance: ' + xaf(r.daily_insurance) + ')</span>';
      h += '<span class="small">Avancement: <strong>' + r.progress_percent + '%</strong></span>';
      if (r.can_get_possession) h += '<span class="badge-ok">\uD83C\uDFE0 \u00c9ligible PV de jouissance</span>';
      if (r.late_months_count > 0) h += '<span class="badge-late">\u26A0 ' + r.late_months_count + ' mois en retard</span>';
      h += '</div><div class="progress-bar"><div class="progress-fill" style="width:' + r.progress_percent + '%">' + r.progress_percent + '%</div></div>';
      if (r.schedule && r.schedule.length) {
        h += '<div class="table-wrap"><table class="schedule-table"><thead><tr><th>Mois</th><th>\u00c9ch\u00e9ance</th><th>D\u00fb</th><th>Pay\u00e9</th><th>Reste</th><th>Statut</th></tr></thead><tbody>';
        r.schedule.forEach(function(m) {
          h += '<tr class="' + m.status + '"><td>' + m.month + '</td><td>' + fmtDate(m.due_date) + '</td><td>' + xaf(m.amount_due) + '</td><td>' + xaf(m.amount_paid) + '</td><td>' + xaf(m.remaining) + '</td><td>' + statusBadge(m.status) + '</td></tr>';
        });
        h += '</tbody></table></div>';
      }
      h += '</div>';
    });
    c.innerHTML = h;
  }

  // ── Flux CamPay ──────────────────────────────────────────────────────────
  function showModal(step) {
    document.getElementById('campay-processing').style.display = step === 'processing' ? 'block' : 'none';
    document.getElementById('campay-success').style.display = step === 'success' ? 'block' : 'none';
    document.getElementById('campay-failed').style.display = step === 'failed' ? 'block' : 'none';
    document.getElementById('campay-modal').classList.add('show');
  }
  function hideModal() { document.getElementById('campay-modal').classList.remove('show'); }

  async function initiatePayment(paymentData) {
    var method = paymentData.method;

    showModal('processing');
    document.getElementById('campay-ref').textContent = paymentData.reference;
    document.getElementById('campay-amount').textContent = xaf(paymentData.amount);

    // ── Mobile Money (MTN MoMo ou Orange Money) via CamPay ───────────────
    if (method === 'mtn_momo' || method === 'orange_money') {
      var isMtn = method === 'mtn_momo';
      document.getElementById('campay-instructions').textContent = isMtn
        ? 'Validez le paiement avec votre code secret MTN MoMo.'
        : 'Composez #150*50# sur votre t\u00e9l\u00e9phone pour valider.';

      try {
        var resp = await fetch(CAMPAY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'initiate',
            provider: isMtn ? 'mtn_momo' : 'orange_money',
            amount: paymentData.amount,
            phone: paymentData.user_phone,
            name: paymentData.user_name,
            email: paymentData.user_email || '',
            lot_type: 'versement',
            external_reference: paymentData.reference
          })
        });
        var result = await resp.json();

        if (!result.success) {
          showModal('failed');
          document.getElementById('campay-error-msg').textContent = result.error || (isMtn ? 'Erreur MTN MoMo' : 'Erreur Orange Money');
          await cancelPendingPayment(paymentData.id);
          return;
        }

        pollCamPayStatus(result.order_id, result.reference, paymentData);
      } catch (err) {
        showModal('failed');
        document.getElementById('campay-error-msg').textContent = 'Erreur de connexion ' + (isMtn ? 'MTN MoMo' : 'Orange Money');
        await cancelPendingPayment(paymentData.id);
      }
      return;
    }

    // ── Carte bancaire via CamPay ────────────────────────────────────────
    document.getElementById('campay-instructions').textContent = 'Redirection vers la page de paiement s\u00e9curis\u00e9e\u2026';
    try {
      var resp3 = await fetch(CAMPAY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate',
          provider: 'card',
          amount: paymentData.amount,
          name: paymentData.user_name,
          email: paymentData.user_email || '',
          lot_type: 'versement',
          external_reference: paymentData.reference
        })
      });
      var result3 = await resp3.json();

      if (result3.success && result3.payment_link) {
        localStorage.setItem('pending_versement', JSON.stringify(paymentData));
        window.location.href = result3.payment_link;
      } else {
        showModal('failed');
        document.getElementById('campay-error-msg').textContent = result3.error || 'Erreur Carte';
        await cancelPendingPayment(paymentData.id);
      }
    } catch (err) {
      showModal('failed');
      document.getElementById('campay-error-msg').textContent = 'Erreur de connexion Carte';
      await cancelPendingPayment(paymentData.id);
    }
  }

  async function pollCamPayStatus(orderId, reference, paymentData) {
    var attempts = 0;
    var maxAttempts = 30; // 5 minutes
    var interval = setInterval(async function() {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        showModal('failed');
        document.getElementById('campay-error-msg').textContent = 'D\u00e9lai d\u00e9pass\u00e9. V\u00e9rifiez votre t\u00e9l\u00e9phone et r\u00e9essayez.';
        await cancelPendingPayment(paymentData.id);
        return;
      }
      try {
        var resp = await fetch(CAMPAY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', order_id: orderId, reference: reference })
        });
        var result = await resp.json();

        if (result.status === 'success') {
          clearInterval(interval);
          // Confirmer le paiement côté backend
          await TSApi.request('/api/client/versement/' + paymentData.id + '/confirm', {
            method: 'POST',
            body: JSON.stringify({ campay_reference: reference })
          });
          showModal('success');
        } else if (result.status === 'failed') {
          clearInterval(interval);
          showModal('failed');
          document.getElementById('campay-error-msg').textContent = 'Le paiement a \u00e9t\u00e9 refus\u00e9.';
          await cancelPendingPayment(paymentData.id);
        }
      } catch (e) { /* continue polling */ }
    }, 10000);
  }

  async function cancelPendingPayment(id) {
    try {
      await TSApi.request('/api/client/versement/' + id + '/cancel', { method: 'POST' });
    } catch (e) { /* silent */ }
  }

  // Vérifier retour carte bancaire
  (function checkCardReturn() {
    var params = new URLSearchParams(window.location.search);
    var pending = localStorage.getItem('pending_versement');
    if (params.get('payment') === 'success' && pending) {
      try {
        var pd = JSON.parse(pending);
        TSApi.request('/api/client/versement/' + pd.id + '/confirm', {
          method: 'POST',
          body: JSON.stringify({ campay_reference: params.get('ref') || pd.reference })
        }).then(function() {
          flash('Paiement par carte confirm\u00e9 ! R\u00e9f: ' + pd.reference, 'ok');
          load();
        });
      } catch (e) {}
      localStorage.removeItem('pending_versement');
      history.replaceState(null, '', 'dashboard-client.html');
    } else if (params.get('payment') === 'failed' && pending) {
      try {
        var pd2 = JSON.parse(pending);
        cancelPendingPayment(pd2.id);
      } catch (e) {}
      flash('Le paiement par carte a \u00e9chou\u00e9.', 'err');
      localStorage.removeItem('pending_versement');
      history.replaceState(null, '', 'dashboard-client.html');
    }
  })();

  // ── Événements ───────────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', function() { TSApi.clearSession(); window.location.href = 'login.html'; });

  document.getElementById('btn-insurance').addEventListener('click', function() {
    var apiBase = window.TERRASOCIAL_API_BASE || '';
    window.open(apiBase + '/api/client/insurance-policy?token=' + encodeURIComponent(TSApi.getToken()), '_blank');
  });

  document.getElementById('campay-close').addEventListener('click', function() { hideModal(); load(); });
  document.getElementById('campay-done').addEventListener('click', function() { hideModal(); load(); });
  document.getElementById('campay-retry').addEventListener('click', function() { hideModal(); });

  // Formulaire versement → CamPay
  document.getElementById('versement-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var resId = document.getElementById('v-reservation').value;
    var amount = Number(document.getElementById('v-amount').value);
    var method = document.getElementById('v-method').value;
    var phone = document.getElementById('v-phone').value || '';

    if (!resId) { flash('S\u00e9lectionnez une r\u00e9servation.', 'err'); return; }

    // Vérifier téléphone pour mobile money
    if ((method === 'orange_money' || method === 'mtn_momo') && !phone) {
      flash('Veuillez saisir votre num\u00e9ro de t\u00e9l\u00e9phone pour le paiement mobile.', 'err');
      document.getElementById('phone-field').style.display = 'block';
      return;
    }

    try {
      // 1. Créer le paiement PENDING côté backend
      var payment = await TSApi.request('/api/client/versement', {
        method: 'POST',
        body: JSON.stringify({ reservation_id: Number(resId), amount: amount, method: method, phone: phone })
      });

      pendingPaymentId = payment.id;

      // 2. Initier le paiement via CamPay (MTN, Orange, Carte)
      await initiatePayment(payment);
    } catch (err) {
      flash(err.message, 'err');
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
      flash('R\u00e9servation enregistr\u00e9e.', 'ok');
      await load();
    } catch (e2) { flash(e2.message, 'err'); }
  });

  // Document
  document.getElementById('document-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var file = document.getElementById('document-file').files[0];
    if (!file) { flash('S\u00e9lectionnez un fichier.', 'err'); return; }
    var fd = new FormData();
    fd.append('document_type', document.getElementById('document-type').value);
    fd.append('file', file);
    try {
      await TSApi.request('/api/documents', { method: 'POST', body: fd });
      flash('Document envoy\u00e9.', 'ok');
      e.target.reset();
      await load();
    } catch (e3) { flash(e3.message, 'err'); }
  });

  // Show phone field by default for first option (orange_money)
  document.getElementById('phone-field').style.display = 'block';

  load();
})();

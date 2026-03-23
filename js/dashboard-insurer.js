(function initInsurerDashboard() {
  'use strict';

  var userRaw = localStorage.getItem('ts_user');
  if (!userRaw || !TSApi.getToken()) { window.location.href = 'login.html'; return; }
  var user = JSON.parse(userRaw);
  if (!user.is_insurer) { window.location.href = 'login.html'; return; }

  var esc = TSUtils.escapeHtml;

  // ── Flash messages ──
  function flash(msg, type) {
    document.getElementById('flash').innerHTML = '<div class="flash ' + type + '">' + esc(msg) + '</div>';
    setTimeout(function() { document.getElementById('flash').innerHTML = ''; }, 3500);
  }

  // ── Panel switching ──
  var panelNames = ['dashboard', 'subscribers', 'contracts', 'insured', 'analytics', 'hospitals', 'profile'];

  function switchPanel(name) {
    panelNames.forEach(function(p) {
      var el = document.getElementById('panel-' + p);
      var nav = document.getElementById('nav-' + p);
      if (el) el.classList.toggle('active', p === name);
      if (nav) nav.classList.toggle('active', p === name);
    });
  }

  panelNames.forEach(function(p) {
    var nav = document.getElementById('nav-' + p);
    if (nav) {
      nav.addEventListener('click', function() { switchPanel(p); });
    }
  });

  // ── State ──
  var state = { subscribers: [], contracts: [], persons: [] };

  // ── Load dashboard KPIs ──
  async function loadDashboard() {
    var data = await TSApi.request('/api/insurer/dashboard');
    document.getElementById('kpi-subscribers').textContent = data.stats.total_subscribers;
    document.getElementById('kpi-active-contracts').textContent = data.stats.active_contracts;
    document.getElementById('kpi-signed-contracts').textContent = data.stats.signed_contracts;
    document.getElementById('kpi-persons').textContent = data.stats.total_insured_persons;
    document.getElementById('insurer-meta').textContent =
      esc(data.insurer.company_name) + ' — ' + esc(user.email || user.phone || '');
  }

  // ── Subscribers ──
  async function loadSubscribers() {
    var data = await TSApi.request('/api/insurer/subscribers');
    state.subscribers = data.subscribers || [];
    renderSubscribers();
  }

  function renderSubscribers() {
    var tbody = document.getElementById('subscribers-tbody');
    if (!state.subscribers.length) {
      tbody.innerHTML = '<tr><td colspan="8">Aucun souscripteur</td></tr>';
      return;
    }
    tbody.innerHTML = state.subscribers.map(function(s) {
      return '<tr>' +
        '<td>' + esc(s.full_name || '-') + '</td>' +
        '<td>' + esc(s.email || '-') + '</td>' +
        '<td>' + esc(s.phone || '-') + '</td>' +
        '<td>' + esc((s.lot_type || '').toUpperCase()) + '</td>' +
        '<td>' + Number(s.lot_price || 0).toLocaleString('fr-FR') + ' FCFA</td>' +
        '<td>' + (s.insurance_persons || 0) + '</td>' +
        '<td><span class="badge badge-pending">' + esc(s.reservation_status || '-') + '</span></td>' +
        '<td>' + (s.subscription_date ? new Date(s.subscription_date).toLocaleDateString('fr-FR') : '-') + '</td>' +
        '</tr>';
    }).join('');
  }

  // ── Contracts ──
  async function loadContracts() {
    var data = await TSApi.request('/api/insurer/subscribers');
    state.contracts = data.contracts || [];
    renderContracts();
  }

  function renderContracts() {
    var tbody = document.getElementById('contracts-tbody');
    if (!state.contracts.length) {
      tbody.innerHTML = '<tr><td colspan="4">Aucun contrat</td></tr>';
      return;
    }
    tbody.innerHTML = state.contracts.map(function(c) {
      var statusBadge;
      if (c.status === 'signed') {
        statusBadge = '<span class="badge badge-ok">Signe</span>';
      } else if (c.status === 'pending_signature') {
        statusBadge = '<span class="badge badge-pending">En attente</span>';
      } else {
        statusBadge = '<span class="badge badge-paid">' + esc(c.status || 'brouillon') + '</span>';
      }

      var actions = '';
      if (c.status !== 'signed') {
        actions += '<button class="btn-sm btn-orange" data-action="request-signature" data-id="' + esc(String(c.id)) + '">Demander signature</button> ';
        actions += '<button class="btn-sm btn-green" data-action="mark-signed" data-id="' + esc(String(c.id)) + '">Marquer signe</button>';
      } else {
        actions = '<span style="color:#1B5E20;font-weight:600;">Termine</span>';
      }

      return '<tr>' +
        '<td style="font-family:monospace;">' + esc(c.contract_number || c.id || '-') + '</td>' +
        '<td>' + esc(c.subscriber_name || '-') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');
  }

  // Contract table actions (request signature / mark signed)
  document.getElementById('contracts-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    var action = btn.dataset.action;
    var id = btn.dataset.id;

    if (action === 'request-signature') {
      try {
        await TSApi.request('/api/insurer/contracts/' + id + '/request-signature', { method: 'POST' });
        flash('Demande de signature envoyee.', 'ok');
        await loadContracts();
      } catch (err) { flash(err.message, 'err'); }
    }

    if (action === 'mark-signed') {
      if (!confirm('Confirmer que ce contrat est signe ?')) return;
      try {
        await TSApi.request('/api/insurer/contracts/' + id + '/request-signature', {
          method: 'POST',
          body: JSON.stringify({ mark_signed: true })
        });
        flash('Contrat marque comme signe.', 'ok');
        await loadContracts();
      } catch (err) { flash(err.message, 'err'); }
    }
  });

  // ── Upload contract template ──
  document.getElementById('upload-template-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var resultEl = document.getElementById('upload-result');
    var fileInput = document.getElementById('contract-file');
    var reservationId = document.getElementById('contract-reservation-id').value.trim();
    var userId = document.getElementById('contract-user-id').value.trim();

    if (!fileInput.files.length) { flash('Veuillez selectionner un fichier.', 'err'); return; }
    if (!reservationId || !userId) { flash('Veuillez remplir tous les champs.', 'err'); return; }

    resultEl.innerHTML = '<span style="color:#666;">Envoi en cours...</span>';

    var formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('reservation_id', reservationId);
    formData.append('user_id', userId);

    try {
      await TSApi.request('/api/insurer/contracts/upload-template', {
        method: 'POST',
        body: formData
      });
      resultEl.innerHTML = '<span style="color:#1B5E20;font-weight:600;">Contrat envoye avec succes</span>';
      fileInput.value = '';
      document.getElementById('contract-reservation-id').value = '';
      document.getElementById('contract-user-id').value = '';
      await loadContracts();
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#C62828;">' + esc(err.message) + '</span>';
    }
  });

  // ── Insured persons ──
  async function loadPersons() {
    var data = await TSApi.request('/api/insurer/insured-persons');
    state.persons = data.persons || [];
    renderPersons();
  }

  function renderPersons() {
    var tbody = document.getElementById('persons-tbody');
    if (!state.persons.length) {
      tbody.innerHTML = '<tr><td colspan="6">Aucun assure</td></tr>';
      return;
    }
    tbody.innerHTML = state.persons.map(function(p) {
      var qrBadge = p.qr_code_data
        ? '<span style="color:#1B5E20;font-weight:600;">QR</span>'
        : '<span style="color:#888;">—</span>';

      return '<tr>' +
        '<td>' + esc(p.full_name || '-') + '</td>' +
        '<td>' + esc(p.subscriber_name || '-') + '</td>' +
        '<td>' + esc(p.date_of_birth || '-') + '</td>' +
        '<td>' + esc(p.id_number || '-') + '</td>' +
        '<td>' + qrBadge + '</td>' +
        '<td>' +
          '<button class="btn-sm btn-green" data-action="generate-card" data-id="' + esc(String(p.id)) + '">Carte</button> ' +
          '<a class="btn-sm btn-blue" style="text-decoration:none;display:inline-block;" href="' + esc(TSApi.API_BASE + '/api/insurer/insured-persons/' + p.id + '/card') + '" target="_blank">PDF</a>' +
        '</td>' +
        '</tr>';
    }).join('');
  }

  // Persons table actions (generate card)
  document.getElementById('persons-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.action === 'generate-card') {
      try {
        await TSApi.request('/api/insurer/insured-persons/' + btn.dataset.id + '/generate-card', { method: 'POST' });
        flash('Carte generee avec succes.', 'ok');
        await loadPersons();
      } catch (err) { flash(err.message, 'err'); }
    }
  });

  // ── Profile ──
  async function loadProfile() {
    try {
      var data = await TSApi.request('/api/insurer/profile');
      var p = data.profile || data.insurer || {};
      document.getElementById('ip-company-name').value = p.company_name || '';
      document.getElementById('ip-license-number').value = p.license_number || '';
      document.getElementById('ip-phone').value = p.phone || '';
      document.getElementById('ip-email').value = p.email || '';
      document.getElementById('ip-daily-premium').value = p.daily_premium_cost || '';
    } catch (e) { /* silencieux */ }
  }

  document.getElementById('insurer-profile-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var resultEl = document.getElementById('profile-result');
    resultEl.innerHTML = '<span style="color:#666;">Enregistrement...</span>';
    try {
      var body = {
        company_name: document.getElementById('ip-company-name').value,
        license_number: document.getElementById('ip-license-number').value,
        phone: document.getElementById('ip-phone').value,
        email: document.getElementById('ip-email').value,
        daily_premium_cost: Number(document.getElementById('ip-daily-premium').value) || null
      };
      await TSApi.request('/api/insurer/profile', {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      resultEl.innerHTML = '<span style="color:#1B5E20;font-weight:600;">Profil mis a jour</span>';
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#C62828;">' + esc(err.message) + '</span>';
    }
  });

  // ── Analytics ──
  async function loadAnalytics() {
    var params = new URLSearchParams();
    var dateFrom = document.getElementById('filter-date-from').value;
    var dateTo = document.getElementById('filter-date-to').value;
    var city = document.getElementById('filter-city').value;
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (city) params.set('city', city);

    var qs = params.toString() ? '?' + params.toString() : '';
    var data = await TSApi.request('/api/insurer/analytics' + qs);

    // Primes
    var xaf = function(v) { return Number(v || 0).toLocaleString('fr-FR') + ' FCFA'; };
    document.getElementById('prime-daily').textContent = xaf(data.primes.daily_premium_cost) + '/pers.';
    document.getElementById('prime-monthly').textContent = xaf(data.primes.monthly_revenue);
    document.getElementById('prime-annual').textContent = xaf(data.primes.annual_revenue);
    document.getElementById('prime-margin').textContent = xaf(data.primes.mano_verde_monthly_margin);

    // Geo
    var geoTbody = document.getElementById('geo-tbody');
    geoTbody.innerHTML = data.stats.by_city.length ? data.stats.by_city.map(function(c) {
      return '<tr><td>' + esc(c.city) + '</td><td>' + c.subscriber_count + '</td><td>' + c.persons_count + '</td></tr>';
    }).join('') : '<tr><td colspan="3">Aucune donnee</td></tr>';

    // Monthly
    var monthTbody = document.getElementById('monthly-tbody');
    monthTbody.innerHTML = data.stats.by_month.length ? data.stats.by_month.map(function(m) {
      return '<tr><td>' + esc(m.month) + '</td><td>' + m.count + '</td></tr>';
    }).join('') : '<tr><td colspan="2">Aucune donnee</td></tr>';

    // Filtered subscribers
    document.getElementById('analytics-count').textContent = data.subscribers.length;
    var aTbody = document.getElementById('analytics-tbody');
    aTbody.innerHTML = data.subscribers.length ? data.subscribers.map(function(s) {
      var persons = Number(s.insurance_persons || 1);
      var dailyCost = Number(data.primes.daily_premium_cost);
      var primeMonthly = persons * dailyCost * 30;
      var primeAnnual = persons * dailyCost * 365;
      var since = s.insured_since ? new Date(s.insured_since).toLocaleDateString('fr-FR') : '-';
      return '<tr><td>' + esc(s.full_name) + '</td><td>' + esc(s.city || '-') + '</td><td>' + esc((s.lot_type || '').toUpperCase()) + '</td><td>' + persons + '</td><td>' + xaf(primeMonthly) + '</td><td>' + xaf(primeAnnual) + '</td><td>' + since + '</td></tr>';
    }).join('') : '<tr><td colspan="7">Aucun souscripteur</td></tr>';
  }

  document.getElementById('btn-filter-analytics').addEventListener('click', function() {
    loadAnalytics();
  });

  // ── Hospitals ──
  async function loadHospitals() {
    var data = await TSApi.request('/api/insurer/hospitals');
    var tbody = document.getElementById('hospitals-tbody');
    tbody.innerHTML = data.hospitals.length ? data.hospitals.map(function(h) {
      return '<tr><td>' + esc(h.name) + '</td><td>' + esc(h.city) + '</td><td>' + esc(h.address || '-') + '</td><td>' + esc(h.phone || '-') + '</td><td>' + esc(h.specialty || '-') + '</td><td><button class="btn-sm btn-orange" data-action="remove-hospital" data-id="' + h.id + '">Retirer</button></td></tr>';
    }).join('') : '<tr><td colspan="6">Aucun hopital partenaire</td></tr>';
  }

  document.getElementById('hospital-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    try {
      await TSApi.request('/api/insurer/hospitals', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('h-name').value,
          city: document.getElementById('h-city').value,
          address: document.getElementById('h-address').value,
          phone: document.getElementById('h-phone').value,
          specialty: document.getElementById('h-specialty').value
        })
      });
      flash('Hopital ajoute avec succes.', 'ok');
      document.getElementById('hospital-form').reset();
      await loadHospitals();
    } catch (err) { flash(err.message, 'err'); }
  });

  document.getElementById('hospitals-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'remove-hospital') return;
    if (!confirm('Retirer cet hopital partenaire ?')) return;
    try {
      await TSApi.request('/api/insurer/hospitals/' + btn.dataset.id, { method: 'DELETE' });
      flash('Hopital retire.', 'ok');
      await loadHospitals();
    } catch (err) { flash(err.message, 'err'); }
  });

  // ── Logout ──
  document.getElementById('logout-btn').addEventListener('click', function() {
    TSApi.clearSession();
    window.location.href = 'login.html';
  });

  // ── Initial load ──
  async function loadAll() {
    try {
      await Promise.all([loadDashboard(), loadSubscribers(), loadContracts(), loadPersons(), loadProfile(), loadAnalytics(), loadHospitals()]);
    } catch (err) {
      flash(err.message, 'err');
    }
  }

  loadAll();
})();

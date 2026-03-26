(function initSuperAdmin() {
  const rawUser = localStorage.getItem('ts_user');
  if (!rawUser || !TSApi.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(rawUser);
  if (!user.is_super_admin) {
    window.location.href = user.role === 'owner' ? 'dashboard-owner.html' : 'dashboard-client.html';
    return;
  }

  const state = {
    users: [],
    lots: [],
    documents: [],
    messages: [],
    reservations: [],
    agents: [],
    sources: [],
    charts: { users: null, revenue: null }
  };

  const sections = {
    overview: document.getElementById('panel-overview'),
    users: document.getElementById('panel-users'),
    reservations: document.getElementById('panel-reservations'),
    messages: document.getElementById('panel-messages'),
    agents: document.getElementById('panel-agents'),
    lots: document.getElementById('panel-lots'),
    documents: document.getElementById('panel-documents'),
    roadmap: document.getElementById('panel-roadmap'),
    sources: document.getElementById('panel-sources')
  };

  function formatMoney(amount) {
    return `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;
  }

  function flash(message, type) {
    document.getElementById('flash').innerHTML = `<div class="flash ${type}">${TSUtils.escapeHtml(message)}</div>`;
    setTimeout(() => {
      document.getElementById('flash').innerHTML = '';
    }, 3500);
  }

  function switchPanel(name) {
    Object.entries(sections).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
    document.querySelectorAll('.side-nav button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.panel === name);
    });
  }

  function buildCharts(monthlyUsers, monthlyRevenue) {
    if (typeof Chart === 'undefined') return; // Chart.js not loaded yet
    if (state.charts.users) state.charts.users.destroy();
    if (state.charts.revenue) state.charts.revenue.destroy();

    state.charts.users = new Chart(document.getElementById('users-chart'), {
      type: 'line',
      data: {
        labels: monthlyUsers.map((x) => x.month),
        datasets: [{ label: 'Nouveaux users', data: monthlyUsers.map((x) => Number(x.total || 0)), borderColor: '#0ea5e9', tension: 0.35 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });

    state.charts.revenue = new Chart(document.getElementById('revenue-chart'), {
      type: 'bar',
      data: {
        labels: monthlyRevenue.map((x) => x.month),
        datasets: [{ label: 'Revenus', data: monthlyRevenue.map((x) => Number(x.amount || 0)), backgroundColor: '#0f766e' }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  function renderUsers() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = state.users.length ? state.users.map((u) => `
      <tr>
        <td>${TSUtils.escapeHtml(String(u.id))}</td>
        <td>${TSUtils.escapeHtml(u.full_name)}</td>
        <td><span class="status-pill">${TSUtils.escapeHtml(u.role)}</span></td>
        <td>${TSUtils.escapeHtml(u.email)}</td>
        <td>${TSUtils.escapeHtml(String(u.reliability_score))}</td>
        <td>
          <button class="btn" data-action="history" data-id="${TSUtils.escapeHtml(String(u.id))}">Historique</button>
          <button class="btn" data-action="delete-user" data-id="${TSUtils.escapeHtml(String(u.id))}">Supprimer</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6">Aucun utilisateur</td></tr>';

    // Mettre à jour le sélecteur d'utilisateurs dans la messagerie
    var userSelect = document.getElementById('msg-user-id');
    if (userSelect && userSelect.tagName === 'SELECT') {
      var current = userSelect.value;
      userSelect.innerHTML = '<option value="">-- Choisir un utilisateur --</option>' +
        state.users.map(function(u) {
          return '<option value="' + TSUtils.escapeHtml(String(u.id)) + '">#' + TSUtils.escapeHtml(String(u.id)) + ' — ' + TSUtils.escapeHtml(u.full_name) + ' (' + TSUtils.escapeHtml(u.email) + ')</option>';
        }).join('');
      if (current) userSelect.value = current;
    }
  }

  function renderMessages() {
    const tbody = document.getElementById('messages-tbody');
    tbody.innerHTML = state.messages.length ? state.messages.map((m) => `
      <tr>
        <td>${TSUtils.escapeHtml(m.target_scope)}${m.target_role ? ` (${TSUtils.escapeHtml(m.target_role)})` : ''}</td>
        <td>${TSUtils.escapeHtml(m.channels)}</td>
        <td>${TSUtils.escapeHtml(m.status)}</td>
        <td>${TSUtils.escapeHtml(m.created_at || '-')}</td>
      </tr>
    `).join('') : '<tr><td colspan="4">Aucun message</td></tr>';
  }

  function renderDocs() {
    var tbody = document.getElementById('docs-tbody');
    var countEl = document.getElementById('doc-count');
    if (countEl) countEl.textContent = state.documents.length + ' document(s)';

    var typeBadge = function(t) {
      var colors = { contrat_signe: '#1B5E20', titre_foncier: '#1565C0', pv_jouissance: '#6A1B9A', cni: '#E65100', facture: '#00695C', autre: '#555' };
      var c = colors[t] || '#555';
      return '<span style="background:' + c + ';color:#fff;padding:2px 8px;border-radius:6px;font-size:11px;">' + TSUtils.escapeHtml(t || '-') + '</span>';
    };

    var fmtDate = function(d) {
      if (!d) return '-';
      try { return new Date(d).toLocaleDateString('fr-FR'); } catch(e) { return d; }
    };

    tbody.innerHTML = state.documents.length ? state.documents.map(function(d) {
      var userName = TSUtils.escapeHtml(d.user_name || ('User #' + d.user_id));
      var userContact = TSUtils.escapeHtml(d.user_email || d.user_phone || '-');
      var userRole = d.user_role ? '<span style="font-size:10px;color:#888;">(' + TSUtils.escapeHtml(d.user_role) + ')</span>' : '';
      var storageBadge = d.storage_mode === 'supabase'
        ? '<span style="background:#1565C0;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;">cloud</span>'
        : '<span style="background:#888;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;">local</span>';

      return '<tr>' +
        '<td>' + TSUtils.escapeHtml(String(d.id)) + '</td>' +
        '<td>' + typeBadge(d.document_type) + '</td>' +
        '<td style="font-size:12px;">' + TSUtils.escapeHtml(d.file_name) + '</td>' +
        '<td><strong>' + userName + '</strong> ' + userRole + '</td>' +
        '<td style="font-size:12px;">' + userContact + '</td>' +
        '<td style="font-size:12px;">' + fmtDate(d.uploaded_at) + '</td>' +
        '<td>' + storageBadge + '</td>' +
        '<td>' +
          '<button class="btn" data-action="download-doc" data-id="' + TSUtils.escapeHtml(String(d.id)) + '" data-name="' + TSUtils.escapeHtml(d.file_name) + '">Télécharger</button>' +
          '<button class="btn" data-action="edit-doc" data-id="' + TSUtils.escapeHtml(String(d.id)) + '">Renommer</button>' +
          '<button class="btn" data-action="delete-doc" data-id="' + TSUtils.escapeHtml(String(d.id)) + '">Supprimer</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="8">Aucun document</td></tr>';
  }

  function lotFormReset() {
    document.getElementById('lot-id').value = '';
    document.getElementById('lot-title').value = '';
    document.getElementById('lot-location').value = '';
    document.getElementById('lot-size').value = '';
    document.getElementById('lot-price').value = '';
    document.getElementById('lot-monthly').value = '';
    document.getElementById('lot-duration').value = '';
    document.getElementById('lot-icon').value = '';
    document.getElementById('lot-status').value = 'available';
    document.getElementById('lot-order').value = '';
    document.getElementById('lot-features').value = '';
  }

  function fillLotForm(lot) {
    document.getElementById('lot-id').value = lot.id;
    document.getElementById('lot-title').value = lot.title || '';
    document.getElementById('lot-location').value = lot.location || '';
    document.getElementById('lot-size').value = lot.size_m2 || '';
    document.getElementById('lot-price').value = lot.price || '';
    document.getElementById('lot-monthly').value = lot.monthly_amount || '';
    document.getElementById('lot-duration').value = lot.duration_months || '';
    document.getElementById('lot-icon').value = lot.icon || '';
    document.getElementById('lot-status').value = lot.status || 'available';
    document.getElementById('lot-order').value = lot.display_order || 0;
    document.getElementById('lot-features').value = Array.isArray(lot.features) ? lot.features.join('\n') : '';
  }

  function renderLots() {
    const tbody = document.getElementById('lots-tbody');
    tbody.innerHTML = state.lots.length ? state.lots.map((lot) => `
      <tr>
        <td>${TSUtils.escapeHtml(String(lot.id))}</td>
        <td>${TSUtils.escapeHtml(lot.title)}</td>
        <td>${formatMoney(lot.price)}/m²</td>
        <td><span class="status-pill">${TSUtils.escapeHtml(lot.status)}</span></td>
        <td>
          <button class="btn" data-action="edit-lot" data-id="${TSUtils.escapeHtml(String(lot.id))}">Éditer</button>
          <button class="btn" data-action="delete-lot" data-id="${TSUtils.escapeHtml(String(lot.id))}">Supprimer</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5">Aucun lot</td></tr>';
  }

  async function loadOverview() {
    const data = await TSApi.request('/api/super-admin/overview');

    const usersTotal = (data.users_by_role || []).reduce((acc, x) => acc + Number(x.total || 0), 0);
    document.getElementById('kpi-revenue').textContent = formatMoney(data.revenue_total);
    document.getElementById('kpi-payments').textContent = data.payments_count;
    document.getElementById('kpi-users').textContent = usersTotal;
    document.getElementById('kpi-pending').textContent = data.pending_reservations;

    buildCharts(data.monthly_users || [], data.monthly_revenue || []);

    if (data.roadmap) {
      document.getElementById('roadmap-version').value = data.roadmap.version_label || '';
      document.getElementById('roadmap-deploy').value = data.roadmap.deployment_status || '';
      document.getElementById('roadmap-notes').value = data.roadmap.notes || '';
    }
  }

  async function loadUsers() {
    const q = document.getElementById('filter-q').value.trim();
    const role = document.getElementById('filter-role').value;
    const status = document.getElementById('filter-status').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (status) params.set('status', status);

    const data = await TSApi.request(`/api/super-admin/users?${params.toString()}`);
    state.users = data.users || [];
    renderUsers();
  }

  async function loadMessages() {
    const data = await TSApi.request('/api/super-admin/messages');
    state.messages = data.messages || [];
    renderMessages();
  }

  async function loadDocuments(filters) {
    var params = new URLSearchParams();
    if (filters) {
      if (filters.type) params.set('type', filters.type);
      if (filters.q) params.set('q', filters.q);
    }
    var qs = params.toString() ? '?' + params.toString() : '';
    var data = await TSApi.request('/api/super-admin/documents' + qs);
    state.documents = data.documents || [];
    renderDocs();

    // Remplir le filtre des types (une seule fois)
    var typeSelect = document.getElementById('doc-type-filter');
    if (typeSelect && data.document_types && typeSelect.options.length <= 1) {
      (data.document_types || []).forEach(function(t) {
        var opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
      });
    }
  }

  async function loadLots() {
    const data = await TSApi.request('/api/super-admin/lots');
    state.lots = data.lots || [];
    renderLots();
  }

  // ── Réservations / Leads ──────────────────────────────────────────────────
  async function loadReservations(status) {
    const qs = status ? '?status=' + encodeURIComponent(status) : '';
    const data = await TSApi.request('/api/super-admin/reservations' + qs);
    state.reservations = data.reservations || [];
    renderReservations();
  }

  function resStatusBadge(s) {
    var map = {
      lead: '<span style="background:#FFF3E0;color:#E65100;padding:3px 8px;border-radius:6px;font-size:12px;">🟡 Lead</span>',
      pending: '<span style="background:#FFF8E1;color:#F57F17;padding:3px 8px;border-radius:6px;font-size:12px;">🟠 En attente</span>',
      active: '<span style="background:#E8F5E9;color:#1B5E20;padding:3px 8px;border-radius:6px;font-size:12px;">🟢 Active</span>',
      completed: '<span style="background:#E0F7FA;color:#006064;padding:3px 8px;border-radius:6px;font-size:12px;">✅ Complétée</span>',
      cancelled: '<span style="background:#FFEBEE;color:#B71C1C;padding:3px 8px;border-radius:6px;font-size:12px;">❌ Annulée</span>'
    };
    return map[s] || s;
  }

  function renderReservations() {
    var tbody = document.getElementById('res-tbody');
    var countEl = document.getElementById('res-count');
    countEl.textContent = state.reservations.length + ' réservation(s)';

    tbody.innerHTML = state.reservations.map(function(r) {
      var clientName = TSUtils.escapeHtml(r.client_name || r.lead_name || r.source || 'Lead anonyme');
      var leadPhone = r.client_phone || r.lead_phone || '';
      var leadEmail = r.client_email || r.lead_email || '';
      var contact = TSUtils.escapeHtml(leadPhone || leadEmail || '-');
      if (leadPhone && leadEmail) contact = TSUtils.escapeHtml(leadPhone) + '<br><span style="color:#888;">' + TSUtils.escapeHtml(leadEmail) + '</span>';
      var leadCity = r.lead_city || '';
      var price = TSUtils.escapeHtml(Number(r.lot_price || 0).toLocaleString('fr-FR') + ' FCFA');
      var date = r.created_at ? TSUtils.escapeHtml(new Date(r.created_at).toLocaleDateString('fr-FR')) : '-';
      var lotLabel = TSUtils.escapeHtml((r.lot_type || '-').toUpperCase());

      var actions = '';
      if (r.status === 'lead' || r.status === 'pending') {
        actions += '<button data-action="validate" data-id="' + TSUtils.escapeHtml(String(r.id)) + '" data-name="' + TSUtils.escapeHtml(r.client_name || r.lead_name || '') + '" data-phone="' + TSUtils.escapeHtml(r.client_phone || r.lead_phone || '') + '" data-email="' + TSUtils.escapeHtml(r.client_email || r.lead_email || '') + '" data-city="' + TSUtils.escapeHtml(leadCity) + '" style="background:#1B5E20;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">Valider</button>';
        actions += '<button data-action="reject" data-id="' + TSUtils.escapeHtml(String(r.id)) + '" style="background:#C62828;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">Rejeter</button>';
      }
      if (r.status === 'active' || r.status === 'completed') {
        actions += '<button data-action="contract" data-id="' + TSUtils.escapeHtml(String(r.id)) + '" style="background:#1565C0;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">📄 Contrat</button>';
        actions += '<button data-action="send-welcome" data-id="' + TSUtils.escapeHtml(String(r.id)) + '" style="background:#FF8F00;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">📧 Envoyer</button>';
      }
      actions += '<button data-action="details" data-id="' + TSUtils.escapeHtml(String(r.id)) + '" style="background:#eee;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">Détails</button>';

      return '<tr><td>' + TSUtils.escapeHtml(String(r.id)) + '</td><td>' + clientName + '</td><td style="font-size:12px;">' + contact + '</td><td>' + lotLabel + '</td><td>' + price + '</td><td>' + resStatusBadge(r.status) + '</td><td style="font-size:12px;">' + date + '</td><td>' + actions + '</td></tr>';
    }).join('');
  }

  // Event delegation pour les actions réservations
  document.getElementById('res-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var action = btn.dataset.action;
    var id = btn.dataset.id;

    if (action === 'validate') {
      var modal = document.getElementById('validate-modal');
      document.getElementById('val-res-id').value = id;
      document.getElementById('val-name').value = btn.dataset.name || '';
      document.getElementById('val-phone').value = btn.dataset.phone || '';
      document.getElementById('val-email').value = btn.dataset.email || '';
      document.getElementById('val-city').value = btn.dataset.city || '';
      document.getElementById('val-result').innerHTML = '';
      modal.style.display = 'flex';
    }

    if (action === 'reject') {
      if (!confirm('Rejeter cette réservation #' + id + ' ?')) return;
      try {
        await TSApi.request('/api/super-admin/reservations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason: 'Rejeté par admin' }) });
        flash('Réservation #' + id + ' rejetée', 'ok');
        await loadReservations();
      } catch (err) { flash(err.message, 'err'); }
    }

    if (action === 'contract') {
      fetch(TSApi.API_BASE + '/api/super-admin/reservations/' + id + '/contract-pdf', {
        headers: { 'Authorization': 'Bearer ' + TSApi.getToken() }
      }).then(function(resp) {
        if (!resp.ok) throw new Error('Erreur téléchargement');
        return resp.blob();
      }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'contrat-reservation-' + id + '.pdf';
        a.click();
        URL.revokeObjectURL(url);
      }).catch(function(err) { flash(err.message, 'err'); });
    }

    if (action === 'send-welcome') {
      try {
        btn.disabled = true;
        btn.textContent = '⏳...';
        var result = await TSApi.request('/api/super-admin/reservations/' + id + '/send-welcome', { method: 'POST' });
        if (result.email_sent) {
          flash('✅ Email de bienvenue envoyé à ' + result.recipient + ' avec contrat ' + result.contract_number, 'ok');
        } else {
          flash('⚠️ ' + (result.error || 'Email non envoyé'), 'err');
        }
        btn.textContent = '📧 Envoyer';
        btn.disabled = false;
      } catch (err) {
        flash(err.message, 'err');
        btn.textContent = '📧 Envoyer';
        btn.disabled = false;
      }
    }

    if (action === 'details') {
      try {
        var data = await TSApi.request('/api/super-admin/reservations/' + id);
        var r = data.reservation;
        var payments = data.payments || [];
        var contract = data.contract;
        var msg = 'RÉSERVATION #' + r.id + '\n';
        msg += 'Client: ' + (r.client_name || 'Non lié') + '\n';
        msg += 'Email: ' + (r.client_email || '-') + '\n';
        msg += 'Tél: ' + (r.client_phone || '-') + '\n';
        msg += 'Lot: ' + (r.lot_type || '-').toUpperCase() + ' — ' + Number(r.lot_price || 0).toLocaleString('fr-FR') + ' FCFA\n';
        msg += 'Surface: ' + (r.lot_size_m2 || 200) + ' m²\n';
        msg += 'Durée: ' + (r.duration_months || '-') + ' mois\n';
        msg += 'Statut: ' + r.status + '\n';
        msg += 'Paiements: ' + payments.length + '\n';
        if (contract) msg += 'Contrat: ' + contract.contract_number + ' (' + contract.status + ')\n';
        alert(msg);
      } catch (err) { flash(err.message, 'err'); }
    }
  });

  // Validation modal
  document.getElementById('val-confirm-btn').addEventListener('click', async function() {
    var resId = document.getElementById('val-res-id').value;
    var resultEl = document.getElementById('val-result');
    resultEl.innerHTML = '<span style="color:#666;">Validation en cours...</span>';

    try {
      var data = await TSApi.request('/api/super-admin/reservations/' + resId + '/validate', {
        method: 'POST',
        body: JSON.stringify({
          full_name: document.getElementById('val-name').value,
          phone: document.getElementById('val-phone').value,
          email: document.getElementById('val-email').value,
          city: document.getElementById('val-city').value
        })
      });

      var html = '<div style="background:#E8F5E9;padding:12px;border-radius:8px;">';
      html += '<strong>✅ Réservation validée !</strong><br>';
      html += 'Client: ' + TSUtils.escapeHtml(data.user.full_name) + '<br>';
      html += 'Email: ' + TSUtils.escapeHtml(data.user.email) + '<br>';
      html += 'Contrat: ' + TSUtils.escapeHtml(data.contract_number) + '<br>';
      if (data.temp_password) {
        html += '<br><strong style="color:#C62828;">⚠️ Mot de passe temporaire : ' + TSUtils.escapeHtml(data.temp_password) + '</strong><br>';
        html += '<span style="font-size:12px;">Communiquez-le au client pour qu\'il puisse se connecter.</span>';
      }
      html += '</div>';
      resultEl.innerHTML = html;

      await loadReservations();
      try { await loadOverview(); } catch (e) { /* Chart.js may not be ready */ }
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#C62828;">❌ ' + TSUtils.escapeHtml(err.message) + '</span>';
    }
  });

  document.getElementById('val-cancel-btn').addEventListener('click', function() {
    document.getElementById('validate-modal').style.display = 'none';
  });

  document.getElementById('res-filter-btn').addEventListener('click', function() {
    var status = document.getElementById('res-status-filter').value;
    loadReservations(status).catch(function(e) { flash(e.message, 'err'); });
  });

  // ── Agents / Partenaires ──────────────────────────────────────────────────
  async function loadAgents(status) {
    var qs = status ? '?status=' + encodeURIComponent(status) : '';
    var data = await TSApi.request('/api/super-admin/agents' + qs);
    state.agents = data.agents || [];
    renderAgents();
  }

  function agentStatusBadge(s) {
    var map = {
      pending: '<span style="background:#FFF3E0;color:#E65100;padding:3px 8px;border-radius:6px;font-size:12px;">🟡 En attente</span>',
      active: '<span style="background:#E8F5E9;color:#1B5E20;padding:3px 8px;border-radius:6px;font-size:12px;">🟢 Actif</span>',
      suspended: '<span style="background:#FFF8E1;color:#F57F17;padding:3px 8px;border-radius:6px;font-size:12px;">🟠 Suspendu</span>',
      rejected: '<span style="background:#FFEBEE;color:#B71C1C;padding:3px 8px;border-radius:6px;font-size:12px;">❌ Rejeté</span>'
    };
    return map[s] || (s || '-');
  }

  function renderAgents() {
    var tbody = document.getElementById('agents-tbody');
    var countEl = document.getElementById('agent-count');
    if (countEl) countEl.textContent = state.agents.length + ' agent(s)';

    tbody.innerHTML = state.agents.length ? state.agents.map(function(a) {
      var name = TSUtils.escapeHtml(a.full_name || '-');
      var contact = TSUtils.escapeHtml(a.email || '') + (a.phone ? '<br>' + TSUtils.escapeHtml(a.phone) : '');
      var company = TSUtils.escapeHtml(a.company_name || '-');
      var status = a.status || (a.is_active ? 'active' : 'pending');
      var date = a.created_at ? TSUtils.escapeHtml(new Date(a.created_at).toLocaleDateString('fr-FR')) : '-';

      var actions = '';
      if (status === 'pending') {
        actions += '<button data-action="approve-agent" data-id="' + TSUtils.escapeHtml(String(a.id)) + '" style="background:#1B5E20;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">Approuver</button>';
        actions += '<button data-action="reject-agent" data-id="' + TSUtils.escapeHtml(String(a.id)) + '" style="background:#C62828;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">Rejeter</button>';
      } else if (status === 'active') {
        actions += '<button data-action="suspend-agent" data-id="' + TSUtils.escapeHtml(String(a.id)) + '" style="background:#F57F17;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">Suspendre</button>';
      } else if (status === 'suspended' || status === 'rejected') {
        actions += '<button data-action="approve-agent" data-id="' + TSUtils.escapeHtml(String(a.id)) + '" style="background:#1B5E20;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin:2px;">Réactiver</button>';
      }

      return '<tr><td style="font-weight:600;">' + TSUtils.escapeHtml(a.agent_code || '-') + '</td><td>' + name + '</td><td style="font-size:12px;">' + contact + '</td><td>' + company + '</td><td>' + agentStatusBadge(status) + '</td><td style="font-size:12px;">' + date + '</td><td>' + actions + '</td></tr>';
    }).join('') : '<tr><td colspan="7">Aucun agent</td></tr>';
  }

  // Event delegation agents
  document.getElementById('agents-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var action = btn.dataset.action;
    var id = btn.dataset.id;

    try {
      if (action === 'approve-agent') {
        await TSApi.request('/api/super-admin/agents/' + id + '/approve', { method: 'POST' });
        flash('Agent approuvé et email envoyé !', 'ok');
        await loadAgents();
      }
      if (action === 'reject-agent') {
        if (!confirm('Rejeter cet agent ?')) return;
        await TSApi.request('/api/super-admin/agents/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason: 'Rejeté par admin' }) });
        flash('Agent rejeté.', 'ok');
        await loadAgents();
      }
      if (action === 'suspend-agent') {
        if (!confirm('Suspendre cet agent ?')) return;
        await TSApi.request('/api/super-admin/agents/' + id + '/suspend', { method: 'POST' });
        flash('Agent suspendu.', 'ok');
        await loadAgents();
      }
    } catch (err) { flash(err.message, 'err'); }
  });

  document.getElementById('agent-filter-btn').addEventListener('click', function() {
    var status = document.getElementById('agent-status-filter').value;
    loadAgents(status).catch(function(e) { flash(e.message, 'err'); });
  });

  // ═══ SOURCES DE CONNAISSANCES ═══

  async function loadSources() {
    var data = await TSApi.request('/api/super-admin/sources');
    state.sources = data.sources || [];
    renderSources();
  }

  function renderSources() {
    var tbody = document.getElementById('sources-tbody');
    if (!state.sources.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Aucune source enregistrée</td></tr>';
      return;
    }
    tbody.innerHTML = state.sources.map(function(s) {
      var dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : '-';
      var nameDisplay = s.source_type === 'url'
        ? '<a href="' + TSUtils.escapeHtml(s.url || '') + '" target="_blank" rel="noopener">' + TSUtils.escapeHtml(s.name) + '</a>'
        : TSUtils.escapeHtml(s.name);
      return '<tr>'
        + '<td>' + nameDisplay + '</td>'
        + '<td>' + TSUtils.escapeHtml(s.content_type || '-') + '</td>'
        + '<td>' + TSUtils.escapeHtml(s.file_format || '-') + '</td>'
        + '<td>' + TSUtils.escapeHtml(s.description || '-') + '</td>'
        + '<td>' + TSUtils.escapeHtml(dateStr) + '</td>'
        + '<td><button class="btn-sm" data-action="delete-source" data-id="' + s.id + '" style="background:#c62828;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;">Supprimer</button></td>'
        + '</tr>';
    }).join('');
  }

  document.getElementById('btn-upload-source').addEventListener('click', async function() {
    var fileInput = document.getElementById('source-file');
    var file = fileInput.files[0];
    if (!file) { flash('Veuillez sélectionner un fichier.', 'err'); return; }

    var formData = new FormData();
    formData.append('file', file);
    formData.append('content_type', document.getElementById('source-file-type').value);
    formData.append('description', document.getElementById('source-file-desc').value);

    try {
      var token = TSApi.getToken();
      var baseUrl = (typeof TS_API_BASE !== 'undefined' && TS_API_BASE) ? TS_API_BASE : '';
      var resp = await fetch(baseUrl + '/api/super-admin/sources/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erreur upload');
      flash(data.message || 'Document uploadé.', 'ok');
      fileInput.value = '';
      document.getElementById('source-file-desc').value = '';
      await loadSources();
    } catch (err) { flash(err.message, 'err'); }
  });

  document.getElementById('btn-add-source-url').addEventListener('click', async function() {
    var url = document.getElementById('source-url').value.trim();
    var name = document.getElementById('source-url-title').value.trim();
    var contentType = document.getElementById('source-url-type').value;

    if (!url) { flash('Veuillez saisir une URL.', 'err'); return; }

    try {
      var data = await TSApi.request('/api/super-admin/sources/url', {
        method: 'POST',
        body: JSON.stringify({ url: url, name: name || url, content_type: contentType })
      });
      flash(data.message || 'URL ajoutée.', 'ok');
      document.getElementById('source-url').value = '';
      document.getElementById('source-url-title').value = '';
      await loadSources();
    } catch (err) { flash(err.message, 'err'); }
  });

  document.getElementById('sources-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'delete-source') return;
    var id = btn.dataset.id;
    if (!confirm('Supprimer cette source de connaissances ?')) return;
    try {
      await TSApi.request('/api/super-admin/sources/' + id, { method: 'DELETE' });
      flash('Source supprimée.', 'ok');
      await loadSources();
    } catch (err) { flash(err.message, 'err'); }
  });

  async function loadAll() {
    document.getElementById('admin-meta').textContent = `${user.full_name} (${user.email})`;

    var loaders = [loadOverview, loadUsers, loadMessages, loadLots, loadDocuments, loadReservations, loadAgents, loadSources];
    await Promise.allSettled(loaders.map(function(fn) {
      return fn().catch(function(e) { console.warn(fn.name + ':', e.message); });
    }));
  }

  document.querySelectorAll('.side-nav button').forEach((btn) => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  document.getElementById('btn-refresh-users').addEventListener('click', () => {
    loadUsers().catch((e) => flash(e.message, 'err'));
  });

  document.getElementById('users-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const userId = btn.dataset.id;

    try {
      if (btn.dataset.action === 'history') {
        const data = await TSApi.request(`/api/super-admin/users/${userId}/history`);
        flash(`Historique #${userId}: ${data.logs.length} logs, ${data.payments.length} paiements`, 'ok');
        return;
      }
      if (btn.dataset.action === 'delete-user') {
        if (!confirm(`Supprimer utilisateur #${userId} ?`)) return;
        await TSApi.request(`/api/super-admin/users/${userId}`, { method: 'DELETE' });
        flash('Utilisateur supprimé.', 'ok');
        await loadUsers();
      }
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  document.getElementById('btn-send-msg').addEventListener('click', async () => {
    try {
      const channels = [];
      if (document.getElementById('msg-ch-inapp').checked) channels.push('in_app');
      if (document.getElementById('msg-ch-email').checked) channels.push('email');
      if (document.getElementById('msg-ch-push').checked) channels.push('push');

      const body = {
        target_scope: document.getElementById('msg-scope').value,
        target_role: document.getElementById('msg-role').value,
        target_user_id: document.getElementById('msg-user-id').value || null,
        content: document.getElementById('msg-content').value,
        channels
      };

      var result = await TSApi.request('/api/super-admin/messages', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      document.getElementById('msg-content').value = '';
      var msg = result.emails_sent > 0
        ? '✅ ' + result.emails_sent + ' email(s) envoyé(s) sur ' + result.recipients_count + ' destinataire(s)'
        : 'Message enregistré (statut: ' + result.status + ')';
      if (result.errors && result.errors.length) msg += ' — Erreurs: ' + result.errors.join(', ');
      flash(msg, result.emails_sent > 0 ? 'ok' : 'warn');
      await loadMessages();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  document.getElementById('docs-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const docId = btn.dataset.id;

    try {
      if (btn.dataset.action === 'download-doc') {
        const fileName = btn.dataset.name || `document-${docId}`;
        flash(`Téléchargement de "${fileName}"…`, 'ok');
        const response = await fetch(`${TSApi.API_BASE}/api/super-admin/documents/${docId}/download`, {
          headers: { Authorization: `Bearer ${TSApi.getToken()}` }
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        // Si le serveur redirige vers Supabase, response.redirected sera true
        if (response.redirected) {
          window.open(response.url, '_blank');
          return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      if (btn.dataset.action === 'edit-doc') {
        const nextType = prompt('Nouveau type de document:');
        if (!nextType) return;
        await TSApi.request(`/api/super-admin/documents/${docId}`, {
          method: 'PUT',
          body: JSON.stringify({ document_type: nextType })
        });
        await loadDocuments();
        flash('Document mis à jour.', 'ok');
      }
      if (btn.dataset.action === 'delete-doc') {
        if (!confirm('Supprimer ce document ?')) return;
        await TSApi.request(`/api/super-admin/documents/${docId}`, { method: 'DELETE' });
        await loadDocuments();
        flash('Document supprimé.', 'ok');
      }
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  // Filtre documents
  document.getElementById('doc-filter-btn').addEventListener('click', function() {
    var type = document.getElementById('doc-type-filter').value;
    var q = document.getElementById('doc-search').value.trim();
    loadDocuments({ type: type, q: q }).catch(function(e) { flash(e.message, 'err'); });
  });
  document.getElementById('doc-search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') document.getElementById('doc-filter-btn').click();
  });

  document.getElementById('lots-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const lotId = Number(btn.dataset.id);
    const lot = state.lots.find((item) => Number(item.id) === lotId);
    if (!lot) return;

    try {
      if (btn.dataset.action === 'edit-lot') {
        fillLotForm(lot);
        switchPanel('lots');
        return;
      }
      if (btn.dataset.action === 'delete-lot') {
        if (!confirm(`Supprimer le lot #${lotId} ?`)) return;
        await TSApi.request(`/api/super-admin/lots/${lotId}`, { method: 'DELETE' });
        await loadLots();
        flash('Lot supprimé.', 'ok');
      }
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  document.getElementById('btn-save-lot').addEventListener('click', async () => {
    try {
      const id = document.getElementById('lot-id').value.trim();
      const features = document.getElementById('lot-features').value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const body = {
        title: document.getElementById('lot-title').value,
        location: document.getElementById('lot-location').value,
        size_m2: Number(document.getElementById('lot-size').value),
        price: Number(document.getElementById('lot-price').value),
        monthly_amount: Number(document.getElementById('lot-monthly').value) || null,
        duration_months: Number(document.getElementById('lot-duration').value) || null,
        icon: document.getElementById('lot-icon').value || '🏡',
        status: document.getElementById('lot-status').value,
        display_order: Number(document.getElementById('lot-order').value) || 0,
        features
      };

      if (id) {
        await TSApi.request(`/api/super-admin/lots/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        flash('Lot mis à jour.', 'ok');
      } else {
        await TSApi.request('/api/super-admin/lots', { method: 'POST', body: JSON.stringify(body) });
        flash('Lot créé.', 'ok');
      }

      lotFormReset();
      await loadLots();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  document.getElementById('btn-clear-lot').addEventListener('click', () => {
    lotFormReset();
  });

  document.getElementById('btn-save-roadmap').addEventListener('click', async () => {
    try {
      await TSApi.request('/api/super-admin/roadmap', {
        method: 'PUT',
        body: JSON.stringify({
          version_label: document.getElementById('roadmap-version').value,
          deployment_status: document.getElementById('roadmap-deploy').value,
          notes: document.getElementById('roadmap-notes').value
        })
      });
      flash('Roadmap mise à jour.', 'ok');
      await loadOverview();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  document.getElementById('btn-export-pdf').addEventListener('click', () => {
    const userId = document.getElementById('pdf-user-id').value;
    if (!userId) {
      flash('Indique un ID client.', 'err');
      return;
    }
    fetch(`${TSApi.API_BASE}/api/super-admin/payments/${userId}/export-pdf`, {
      headers: {
        Authorization: `Bearer ${TSApi.getToken()}`
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historique-paiements-${userId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => flash(error.message, 'err'));
  });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('ts_super_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    TSApi.clearSession();
    window.location.href = 'login.html';
  });

  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  function runSearch(text) {
    const q = text.toLowerCase().trim();
    if (!q) {
      results.innerHTML = '';
      return;
    }

    const userMatches = state.users
      .filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map((u) => ({ type: 'user', label: `${u.full_name} (${u.email})`, action: () => switchPanel('users') }));

    const docMatches = state.documents
      .filter((d) => `${d.file_name} ${d.document_type}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map((d) => ({ type: 'doc', label: `${d.file_name} [${d.document_type}]`, action: () => switchPanel('documents') }));

    const lotMatches = state.lots
      .filter((l) => `${l.title} ${l.location}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map((l) => ({ type: 'lot', label: `${l.title} (${l.location})`, action: () => switchPanel('lots') }));

    const staticItems = [
      { type: 'section', label: 'Overview analytics', action: () => switchPanel('overview') },
      { type: 'section', label: 'Roadmap & status', action: () => switchPanel('roadmap') }
    ].filter((x) => x.label.toLowerCase().includes(q));

    const merged = [...userMatches, ...docMatches, ...lotMatches, ...staticItems];
    results.innerHTML = merged.length ? merged.map((r, idx) =>
      `<div class="search-item" data-idx="${idx}">${TSUtils.escapeHtml(r.type.toUpperCase())} - ${TSUtils.escapeHtml(r.label)}</div>`
    ).join('') : '<div class="search-item">Aucun résultat</div>';

    results.querySelectorAll('.search-item').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.dataset.idx);
        if (!Number.isNaN(i) && merged[i]) merged[i].action();
        overlay.classList.remove('open');
      });
    });
  }

  function openSearch() {
    overlay.classList.add('open');
    input.focus();
    input.select();
  }

  document.getElementById('search-open').addEventListener('click', openSearch);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
  input.addEventListener('input', () => runSearch(input.value));

  document.addEventListener('keydown', (e) => {
    const cmd = navigator.platform.toLowerCase().includes('mac') ? e.metaKey : e.ctrlKey;
    if (cmd && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape') {
      overlay.classList.remove('open');
    }
  });

  if (localStorage.getItem('ts_super_theme') === 'dark') {
    document.body.classList.add('dark');
  }

  loadAll();
})();

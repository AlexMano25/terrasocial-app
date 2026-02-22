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
    charts: { users: null, revenue: null }
  };

  const sections = {
    overview: document.getElementById('panel-overview'),
    users: document.getElementById('panel-users'),
    messages: document.getElementById('panel-messages'),
    lots: document.getElementById('panel-lots'),
    documents: document.getElementById('panel-documents'),
    roadmap: document.getElementById('panel-roadmap')
  };

  function formatMoney(amount) {
    return `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;
  }

  function flash(message, type) {
    document.getElementById('flash').innerHTML = `<div class="flash ${type}">${message}</div>`;
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
        <td>${u.id}</td>
        <td>${u.full_name}</td>
        <td><span class="status-pill">${u.role}</span></td>
        <td>${u.email}</td>
        <td>${u.reliability_score}</td>
        <td>
          <button class="btn" data-action="history" data-id="${u.id}">Historique</button>
          <button class="btn" data-action="delete-user" data-id="${u.id}">Supprimer</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6">Aucun utilisateur</td></tr>';
  }

  function renderMessages() {
    const tbody = document.getElementById('messages-tbody');
    tbody.innerHTML = state.messages.length ? state.messages.map((m) => `
      <tr>
        <td>${m.target_scope}${m.target_role ? ` (${m.target_role})` : ''}</td>
        <td>${m.channels}</td>
        <td>${m.status}</td>
        <td>${m.created_at || '-'}</td>
      </tr>
    `).join('') : '<tr><td colspan="4">Aucun message</td></tr>';
  }

  function renderDocs() {
    const tbody = document.getElementById('docs-tbody');
    tbody.innerHTML = state.documents.length ? state.documents.map((d) => `
      <tr>
        <td>${d.id}</td>
        <td>${d.document_type}</td>
        <td>${d.file_name}</td>
        <td>${d.user_id}</td>
        <td><span class="status-pill">${d.storage_mode || 'local'}</span></td>
        <td>
          <button class="btn" data-action="download-doc" data-id="${d.id}" data-name="${d.file_name}">Télécharger</button>
          <button class="btn" data-action="edit-doc" data-id="${d.id}">Renommer type</button>
          <button class="btn" data-action="delete-doc" data-id="${d.id}">Supprimer</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6">Aucun document</td></tr>';
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
        <td>${lot.id}</td>
        <td>${lot.title}</td>
        <td>${formatMoney(lot.price)}</td>
        <td><span class="status-pill">${lot.status}</span></td>
        <td>
          <button class="btn" data-action="edit-lot" data-id="${lot.id}">Éditer</button>
          <button class="btn" data-action="delete-lot" data-id="${lot.id}">Supprimer</button>
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

  async function loadDocuments() {
    const data = await TSApi.request('/api/super-admin/documents');
    state.documents = data.documents || [];
    renderDocs();
  }

  async function loadLots() {
    const data = await TSApi.request('/api/super-admin/lots');
    state.lots = data.lots || [];
    renderLots();
  }

  async function loadAll() {
    try {
      await Promise.all([loadOverview(), loadUsers(), loadMessages(), loadLots(), loadDocuments()]);
      document.getElementById('admin-meta').textContent = `${user.full_name} (${user.email})`; 
    } catch (error) {
      flash(error.message, 'err');
    }
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

      await TSApi.request('/api/super-admin/messages', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      document.getElementById('msg-content').value = '';
      flash('Message planifié.', 'ok');
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
      `<div class="search-item" data-idx="${idx}">${r.type.toUpperCase()} - ${r.label}</div>`
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

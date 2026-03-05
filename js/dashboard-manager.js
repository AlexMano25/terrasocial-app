(function initManager() {
  const rawUser = localStorage.getItem('ts_user');
  if (!rawUser || !TSApi.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(rawUser);
  if (!user.is_manager) {
    if (user.is_super_admin) {
      window.location.href = 'dashboard-super-admin.html';
    } else if (user.role === 'owner') {
      window.location.href = 'dashboard-owner.html';
    } else {
      window.location.href = 'dashboard-client.html';
    }
    return;
  }

  const state = {
    users: [],
    reservations: [],
    documents: [],
    messages: []
  };

  const sections = {
    overview: document.getElementById('panel-overview'),
    users: document.getElementById('panel-users'),
    reservations: document.getElementById('panel-reservations'),
    documents: document.getElementById('panel-documents'),
    messages: document.getElementById('panel-messages')
  };

  function flash(message, type) {
    const el = document.getElementById('flash');
    el.innerHTML = `<div class="flash ${type}">${message}</div>`;
    setTimeout(() => { el.innerHTML = ''; }, 3500);
  }

  function switchPanel(name) {
    Object.entries(sections).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
    document.querySelectorAll('.side-nav button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.panel === name);
    });
  }

  // ── RENDER FUNCTIONS ────────────────────────────────────────────────────────

  function renderUsers() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = state.users.length ? state.users.map((u) => `
      <tr>
        <td>${u.id}</td>
        <td>${u.full_name || '-'}</td>
        <td><span class="status-pill">${u.role}</span></td>
        <td>${u.email || '-'}</td>
        <td>${u.phone || '-'}</td>
        <td>${u.city || '-'}</td>
        <td>
          <button class="btn" data-action="edit-user" data-id="${u.id}">Modifier</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="7">Aucun utilisateur</td></tr>';
  }

  function renderReservations() {
    const tbody = document.getElementById('reservations-tbody');
    tbody.innerHTML = state.reservations.length ? state.reservations.map((r) => `
      <tr>
        <td>${r.id}</td>
        <td>${r.client_name || r.user_id}</td>
        <td>${r.lot_title || r.lot_id}</td>
        <td><span class="status-pill">${r.status}</span></td>
        <td>${r.monthly_amount ? Number(r.monthly_amount).toLocaleString('fr-FR') + ' FCFA' : '-'}</td>
        <td>${r.created_at ? r.created_at.substring(0, 10) : '-'}</td>
        <td>
          <button class="btn" data-action="view-res" data-id="${r.id}">Voir</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="7">Aucune réservation</td></tr>';
  }

  function renderDocuments() {
    const tbody = document.getElementById('docs-tbody');
    tbody.innerHTML = state.documents.length ? state.documents.map((d) => `
      <tr>
        <td>${d.id}</td>
        <td>${d.document_type}</td>
        <td>${d.file_name}</td>
        <td>${d.user_id}</td>
        <td>${d.created_at ? d.created_at.substring(0, 10) : '-'}</td>
        <td>
          <button class="btn" data-action="download-doc" data-id="${d.id}" data-name="${d.file_name}">Télécharger</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6">Aucun document</td></tr>';
  }

  function renderMessages() {
    const tbody = document.getElementById('messages-tbody');
    tbody.innerHTML = state.messages.length ? state.messages.map((m) => `
      <tr>
        <td>${m.target_scope}${m.target_role ? ` (${m.target_role})` : ''}</td>
        <td>${m.channels}</td>
        <td>${m.status}</td>
        <td>${m.created_at ? m.created_at.substring(0, 10) : '-'}</td>
      </tr>
    `).join('') : '<tr><td colspan="4">Aucun message</td></tr>';
  }

  function renderOverviewActivity() {
    // Activité récente construite depuis les données chargées
    const items = [];
    state.reservations.slice(0, 5).forEach((r) => {
      items.push({ type: 'Réservation', desc: `#${r.id} — ${r.client_name || r.user_id} — ${r.status}`, date: r.created_at });
    });
    state.documents.slice(0, 5).forEach((d) => {
      items.push({ type: 'Document', desc: `${d.file_name} (${d.document_type})`, date: d.created_at });
    });
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const tbody = document.getElementById('activity-tbody');
    tbody.innerHTML = items.length ? items.slice(0, 10).map((i) => `
      <tr>
        <td><span class="status-pill">${i.type}</span></td>
        <td>${i.desc}</td>
        <td>${i.date ? i.date.substring(0, 10) : '-'}</td>
      </tr>
    `).join('') : '<tr><td colspan="3" style="color:var(--muted)">Aucune activité récente</td></tr>';
  }

  // ── LOAD FUNCTIONS ───────────────────────────────────────────────────────────

  async function loadOverview() {
    const data = await TSApi.request('/api/manager/overview');
    const usersTotal = (data.users_by_role || []).reduce((acc, x) => acc + Number(x.total || 0), 0);
    document.getElementById('kpi-users').textContent = usersTotal;
    document.getElementById('kpi-pending').textContent = data.pending_reservations || 0;
    document.getElementById('kpi-docs').textContent = data.documents_count || 0;
    document.getElementById('kpi-messages').textContent = data.messages_count || 0;
  }

  async function loadUsers() {
    const q = document.getElementById('filter-q').value.trim();
    const role = document.getElementById('filter-role').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    const data = await TSApi.request(`/api/manager/users?${params.toString()}`);
    state.users = data.users || [];
    renderUsers();
  }

  async function loadReservations() {
    const status = document.getElementById('filter-res-status').value;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const data = await TSApi.request(`/api/manager/reservations?${params.toString()}`);
    state.reservations = data.reservations || [];
    renderReservations();
  }

  async function loadDocuments() {
    const data = await TSApi.request('/api/manager/documents');
    state.documents = data.documents || [];
    renderDocuments();
  }

  async function loadMessages() {
    const data = await TSApi.request('/api/manager/messages');
    state.messages = data.messages || [];
    renderMessages();
  }

  async function loadAll() {
    try {
      await Promise.all([loadOverview(), loadUsers(), loadReservations(), loadDocuments(), loadMessages()]);
      renderOverviewActivity();
      document.getElementById('admin-meta').textContent =
        `${user.full_name} — ${user.email || user.phone || ''} (Manager)`;
    } catch (error) {
      flash(error.message, 'err');
    }
  }

  // ── EVENT LISTENERS ──────────────────────────────────────────────────────────

  document.querySelectorAll('.side-nav button').forEach((btn) => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  document.getElementById('btn-filter-users').addEventListener('click', () => {
    loadUsers().catch((e) => flash(e.message, 'err'));
  });

  document.getElementById('btn-filter-res').addEventListener('click', () => {
    loadReservations().catch((e) => flash(e.message, 'err'));
  });

  // Utilisateurs — Modifier
  document.getElementById('users-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'edit-user') return;
    const userId = Number(btn.dataset.id);
    const u = state.users.find((x) => Number(x.id) === userId);
    if (!u) return;

    document.getElementById('edit-user-id').value = u.id;
    document.getElementById('edit-user-name').value = u.full_name || '';
    document.getElementById('edit-user-city').value = u.city || '';
    document.getElementById('edit-user-phone').value = u.phone || '';
    document.getElementById('edit-user-email').value = u.email || '';

    document.getElementById('user-edit-panel').style.display = 'block';
    document.getElementById('user-edit-panel').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btn-save-user').addEventListener('click', async () => {
    const userId = document.getElementById('edit-user-id').value;
    if (!userId) return;
    try {
      await TSApi.request(`/api/manager/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: document.getElementById('edit-user-name').value,
          city: document.getElementById('edit-user-city').value,
          phone: document.getElementById('edit-user-phone').value || undefined,
          email: document.getElementById('edit-user-email').value || undefined
        })
      });
      flash('Utilisateur mis à jour.', 'ok');
      document.getElementById('user-edit-panel').style.display = 'none';
      await loadUsers();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    document.getElementById('user-edit-panel').style.display = 'none';
  });

  // Réservations — Voir détails
  document.getElementById('reservations-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'view-res') return;
    const resId = btn.dataset.id;
    try {
      const data = await TSApi.request(`/api/manager/reservations/${resId}`);
      const r = data.reservation || data;
      flash(
        `Réservation #${r.id} | Client: ${r.client_name || r.user_id} | Lot: ${r.lot_title || r.lot_id} | Statut: ${r.status} | Mensualité: ${r.monthly_amount ? Number(r.monthly_amount).toLocaleString('fr-FR') + ' FCFA' : 'N/A'}`,
        'ok'
      );
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  // Documents — Télécharger
  document.getElementById('docs-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'download-doc') return;
    const docId = btn.dataset.id;
    const fileName = btn.dataset.name || `document-${docId}`;
    try {
      flash(`Téléchargement de "${fileName}"…`, 'ok');
      const response = await fetch(`${TSApi.API_BASE}/api/manager/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${TSApi.getToken()}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
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
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  // Messagerie — Envoyer
  document.getElementById('btn-send-msg').addEventListener('click', async () => {
    try {
      const channels = [];
      if (document.getElementById('msg-ch-inapp').checked) channels.push('in_app');
      if (document.getElementById('msg-ch-email').checked) channels.push('email');

      const content = document.getElementById('msg-content').value.trim();
      if (!content) {
        flash('Le message ne peut pas être vide.', 'err');
        return;
      }

      const body = {
        target_scope: document.getElementById('msg-scope').value,
        target_role: document.getElementById('msg-role').value,
        target_user_id: document.getElementById('msg-user-id').value || null,
        content,
        channels
      };

      await TSApi.request('/api/manager/messages', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      document.getElementById('msg-content').value = '';
      flash('Message envoyé.', 'ok');
      await loadMessages();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  // Thème
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('ts_manager_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });

  // Déconnexion
  document.getElementById('logout-btn').addEventListener('click', () => {
    TSApi.clearSession();
    window.location.href = 'login.html';
  });

  // Init thème
  if (localStorage.getItem('ts_manager_theme') === 'dark') {
    document.body.classList.add('dark');
  }

  // Chargement initial
  loadAll();
})();

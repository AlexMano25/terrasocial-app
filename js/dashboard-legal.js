(function initLegalDashboard() {
  'use strict';

  var userRaw = localStorage.getItem('ts_user');
  if (!userRaw || !TSApi.getToken()) { window.location.href = 'login.html'; return; }
  var user = JSON.parse(userRaw);
  if (!user.is_legal) { window.location.href = 'login.html'; return; }

  var esc = TSUtils.escapeHtml;
  // ── Flash messages ──
  function flash(msg, type) {
    document.getElementById('flash').innerHTML = '<div class="flash ' + type + '">' + esc(msg) + '</div>';
    setTimeout(function() { document.getElementById('flash').innerHTML = ''; }, 3500);
  }

  // ── Panel switching ──
  var panelNames = ['dashboard', 'reviews', 'documents', 'messages', 'billing', 'collaborators', 'profile'];

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
  var state = {
    reviews: [],
    documents: [],
    templates: [],
    conversations: [],
    currentConversation: null,
    messages: [],
    invoices: [],
    collaborators: [],
    currentReview: null
  };

  // ── Helpers ──
  function xaf(v) { return Number(v || 0).toLocaleString('fr-FR') + ' FCFA'; }

  function statusBadge(status) {
    var map = {
      pending: '<span class="badge badge-pending">En attente</span>',
      in_review: '<span class="badge badge-review">En revision</span>',
      approved: '<span class="badge badge-approved">Approuve</span>',
      rejected: '<span class="badge badge-rejected">Rejete</span>'
    };
    return map[status] || '<span class="badge badge-pending">' + esc(status || '-') + '</span>';
  }

  function roleBadge(role) {
    var map = {
      partner: '<span class="badge badge-partner">Associe</span>',
      associate: '<span class="badge badge-associate">Collaborateur</span>',
      paralegal: '<span class="badge badge-paralegal">Parajuriste</span>',
      secretary: '<span class="badge badge-secretary">Secretaire</span>'
    };
    return map[role] || '<span class="badge badge-pending">' + esc(role || '-') + '</span>';
  }

  function typeLabelFr(type) {
    var map = { inscription: 'Inscription', contract: 'Contrat', amendment: 'Amendement', dispute: 'Litige' };
    return map[type] || type || '-';
  }

  // ── Load Dashboard KPIs ──
  async function loadDashboard() {
    var data = await TSApi.request('/api/legal/dashboard');
    var s = data.stats || {};
    document.getElementById('kpi-active').textContent = s.active_reviews || 0;
    document.getElementById('kpi-pending').textContent = s.pending_reviews || 0;
    document.getElementById('kpi-approved').textContent = s.approved_reviews || 0;
    document.getElementById('kpi-rejected').textContent = s.rejected_reviews || 0;
    document.getElementById('kpi-total-billed').textContent = xaf(s.total_billed);
    document.getElementById('kpi-pending-amount').textContent = xaf(s.pending_amount);

    // Meta
    var firm = data.firm || {};
    document.getElementById('legal-meta').textContent =
      esc(firm.firm_name || 'Cabinet') + ' — ' + esc(user.email || user.phone || '');

    // Recent activity
    var actList = document.getElementById('recent-activity');
    var activities = data.recent_activity || [];
    if (!activities.length) {
      actList.innerHTML = '<li style="color:#999;padding:8px 0;">Aucune activite recente</li>';
    } else {
      actList.innerHTML = activities.map(function(a) {
        return '<li style="padding:8px 0;border-bottom:1px solid #f0f0f0;">' +
          '<strong style="color:#1a237e;">' + esc(a.action || '') + '</strong> — ' +
          esc(a.description || '') +
          '<span style="float:right;font-size:12px;color:#999;">' +
          (a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR') : '') +
          '</span></li>';
      }).join('');
    }
  }

  // ── Reviews (Dossiers) ──
  async function loadReviews() {
    var params = new URLSearchParams();
    var statusFilter = document.getElementById('filter-review-status').value;
    var typeFilter = document.getElementById('filter-review-type').value;
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    var qs = params.toString() ? '?' + params.toString() : '';

    var data = await TSApi.request('/api/legal/reviews' + qs);
    state.reviews = data.reviews || [];
    renderReviews();
  }

  function renderReviews() {
    var tbody = document.getElementById('reviews-tbody');
    if (!state.reviews.length) {
      tbody.innerHTML = '<tr><td colspan="8">Aucun dossier</td></tr>';
      return;
    }
    tbody.innerHTML = state.reviews.map(function(r) {
      return '<tr>' +
        '<td style="font-family:monospace;">' + esc(r.review_number || r.id || '-') + '</td>' +
        '<td>' + esc(r.client_name || '-') + '</td>' +
        '<td>' + esc(typeLabelFr(r.type)) + '</td>' +
        '<td>' + esc(r.lot_reference || '-') + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td>' + esc(r.assigned_to || '-') + '</td>' +
        '<td>' + (r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '-') + '</td>' +
        '<td>' +
          '<button class="btn-sm btn-navy" data-action="view-review" data-id="' + esc(String(r.id)) + '">Voir</button> ' +
          '<button class="btn-sm btn-orange" data-action="process-review" data-id="' + esc(String(r.id)) + '">Traiter</button>' +
        '</td>' +
        '</tr>';
    }).join('');
  }

  document.getElementById('btn-filter-reviews').addEventListener('click', function() {
    loadReviews();
  });

  // Reviews table actions (event delegation)
  document.getElementById('reviews-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    var action = btn.dataset.action;
    var id = btn.dataset.id;

    if (action === 'view-review' || action === 'process-review') {
      openReviewModal(id);
    }
  });

  // ── Review Modal ──
  async function openReviewModal(reviewId) {
    try {
      var data = await TSApi.request('/api/legal/reviews/' + reviewId);
      var r = data.review || {};
      state.currentReview = r;

      document.getElementById('modal-review-number').textContent = esc(r.review_number || r.id || '');
      document.getElementById('modal-client-info').innerHTML =
        '<div style="background:#f9f9f9;padding:10px;border-radius:6px;font-size:13px;">' +
        '<strong>Client:</strong> ' + esc(r.client_name || '-') + ' | ' +
        '<strong>Email:</strong> ' + esc(r.client_email || '-') + ' | ' +
        '<strong>Tel:</strong> ' + esc(r.client_phone || '-') +
        '</div>';
      document.getElementById('modal-reservation-info').innerHTML =
        '<div style="background:#f9f9f9;padding:10px;border-radius:6px;font-size:13px;">' +
        '<strong>Lot:</strong> ' + esc(r.lot_reference || '-') + ' | ' +
        '<strong>Type:</strong> ' + esc(typeLabelFr(r.type)) + ' | ' +
        '<strong>Date:</strong> ' + (r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '-') +
        '</div>';
      document.getElementById('modal-legal-opinion').value = r.legal_opinion || '';
      document.getElementById('modal-status').value = r.status || 'pending';
      document.getElementById('modal-notes').value = r.notes || '';
      document.getElementById('modal-message').value = '';

      // Documents
      var docList = document.getElementById('modal-documents');
      var docs = (r.documents || []).map(function(d) {
        d.filename = d.filename || d.file_name || null;
        d.url = d.url || d.file_url || null;
        return d;
      });
      if (!docs.length) {
        docList.innerHTML = '<li style="color:#999;">Aucun document associe</li>';
      } else {
        docList.innerHTML = docs.map(function(d) {
          return '<li><a href="' + esc(d.url || '#') + '" target="_blank">' + esc(d.filename || 'Document') + '</a>' +
            ' <span style="color:#999;">(' + esc(d.document_type || '') + ')</span></li>';
        }).join('');
      }

      document.getElementById('review-modal').classList.add('active');
    } catch (err) {
      flash(err.message, 'err');
    }
  }

  document.getElementById('modal-close').addEventListener('click', function() {
    document.getElementById('review-modal').classList.remove('active');
    state.currentReview = null;
  });

  document.getElementById('review-modal').addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.remove('active');
      state.currentReview = null;
    }
  });

  document.getElementById('modal-save').addEventListener('click', async function() {
    if (!state.currentReview) return;
    try {
      await TSApi.request('/api/legal/reviews/' + state.currentReview.id, {
        method: 'PUT',
        body: JSON.stringify({
          legal_opinion: document.getElementById('modal-legal-opinion').value,
          status: document.getElementById('modal-status').value,
          notes: document.getElementById('modal-notes').value
        })
      });
      flash('Dossier mis a jour avec succes.', 'ok');
      document.getElementById('review-modal').classList.remove('active');
      state.currentReview = null;
      await Promise.all([loadDashboard(), loadReviews()]);
    } catch (err) {
      flash(err.message, 'err');
    }
  });

  document.getElementById('modal-send-msg').addEventListener('click', async function() {
    if (!state.currentReview) return;
    var msgBody = document.getElementById('modal-message').value.trim();
    if (!msgBody) { flash('Veuillez saisir un message.', 'err'); return; }
    try {
      await TSApi.request('/api/legal/messages', {
        method: 'POST',
        body: JSON.stringify({
          review_id: state.currentReview.id,
          recipient_id: state.currentReview.client_id,
          subject: 'Re: Dossier ' + (state.currentReview.review_number || ''),
          body: msgBody
        })
      });
      flash('Message envoye au client.', 'ok');
      document.getElementById('modal-message').value = '';
    } catch (err) {
      flash(err.message, 'err');
    }
  });

  // ── Documents ──
  async function loadDocuments() {
    var data = await TSApi.request('/api/legal/documents');
    // Normalize DB column names (file_name/file_url) to frontend names (filename/url)
    var docs = (data.documents || []).map(function(d) {
      d.filename = d.filename || d.file_name || null;
      d.url = d.url || d.file_url || null;
      d.review_number = d.review_number || null;
      return d;
    });
    state.documents = docs.filter(function(d) { return !d.is_template; });
    state.templates = docs.filter(function(d) { return d.is_template; });
    renderDocuments();
    renderTemplates();
    populateReviewSelect();
  }

  function renderDocuments() {
    var tbody = document.getElementById('documents-tbody');
    if (!state.documents.length) {
      tbody.innerHTML = '<tr><td colspan="6">Aucun document</td></tr>';
      return;
    }
    tbody.innerHTML = state.documents.map(function(d) {
      var docStatus = d.status || 'pending';
      var badge = statusBadge(docStatus);
      var actions = '';
      if (docStatus === 'pending' || docStatus === 'in_review') {
        actions = '<button class="btn-sm btn-green" data-action="approve-doc" data-id="' + esc(String(d.id)) + '">Approuver</button> ' +
          '<button class="btn-sm btn-red" data-action="reject-doc" data-id="' + esc(String(d.id)) + '">Rejeter</button>';
      } else {
        actions = '<span style="color:#999;font-size:12px;">Traite</span>';
      }
      return '<tr>' +
        '<td>' + esc(d.filename || '-') + '</td>' +
        '<td>' + esc(d.document_type || '-') + '</td>' +
        '<td>' + esc(d.review_number || '-') + '</td>' +
        '<td>' + badge + '</td>' +
        '<td>' + (d.url ? '<a class="btn-sm btn-blue" style="text-decoration:none;display:inline-block;" href="' + esc(d.url) + '" target="_blank">Telecharger</a>' : '-') + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderTemplates() {
    var container = document.getElementById('templates-list');
    if (!state.templates.length) {
      container.innerHTML = '<p style="color:#999;">Aucun modele disponible</p>';
      return;
    }
    container.innerHTML = state.templates.map(function(t) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;">' +
        '<div><strong>' + esc(t.filename || 'Modele') + '</strong> <span style="color:#999;font-size:12px;">(' + esc(t.document_type || '') + ')</span></div>' +
        '<div>' +
          (t.url ? '<a class="btn-sm btn-blue" style="text-decoration:none;display:inline-block;margin-right:4px;" href="' + esc(t.url) + '" target="_blank">Telecharger</a>' : '') +
          '<button class="btn-sm btn-navy" data-action="use-template" data-id="' + esc(String(t.id)) + '">Utiliser ce modele</button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  function populateReviewSelect() {
    var sel = document.getElementById('doc-review-id');
    var opts = '<option value="">Aucun</option>';
    state.reviews.forEach(function(r) {
      opts += '<option value="' + esc(String(r.id)) + '">' + esc(r.review_number || r.id || '-') + ' - ' + esc(r.client_name || '') + '</option>';
    });
    sel.innerHTML = opts;
  }

  // Document tabs
  document.getElementById('doc-tab-all').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('doc-tab-templates').classList.remove('active');
    document.getElementById('doc-section-all').style.display = '';
    document.getElementById('doc-section-templates').style.display = 'none';
  });
  document.getElementById('doc-tab-templates').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('doc-tab-all').classList.remove('active');
    document.getElementById('doc-section-all').style.display = 'none';
    document.getElementById('doc-section-templates').style.display = '';
  });

  // Upload document
  document.getElementById('upload-doc-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var resultEl = document.getElementById('doc-upload-result');
    var fileInput = document.getElementById('doc-file');
    if (!fileInput.files.length) { flash('Veuillez selectionner un fichier.', 'err'); return; }

    resultEl.innerHTML = '<span style="color:#666;">Envoi en cours...</span>';

    var formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('document_type', document.getElementById('doc-type').value);
    var reviewId = document.getElementById('doc-review-id').value;
    if (reviewId) formData.append('review_id', reviewId);
    formData.append('is_template', document.getElementById('doc-is-template').checked ? 'true' : 'false');

    try {
      await TSApi.request('/api/legal/documents/upload', {
        method: 'POST',
        body: formData
      });
      resultEl.innerHTML = '<span style="color:#1B5E20;font-weight:600;">Document telecharge avec succes</span>';
      fileInput.value = '';
      await loadDocuments();
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#C62828;">' + esc(err.message) + '</span>';
    }
  });

  // Document table actions (event delegation)
  document.getElementById('documents-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    var action = btn.dataset.action;
    var id = btn.dataset.id;

    if (action === 'approve-doc') {
      try {
        await TSApi.request('/api/legal/documents/' + id + '/approve', { method: 'POST' });
        flash('Document approuve.', 'ok');
        await loadDocuments();
      } catch (err) { flash(err.message, 'err'); }
    }

    if (action === 'reject-doc') {
      try {
        await TSApi.request('/api/legal/documents/' + id + '/reject', { method: 'POST' });
        flash('Document rejete.', 'ok');
        await loadDocuments();
      } catch (err) { flash(err.message, 'err'); }
    }
  });

  // Template actions (event delegation)
  document.getElementById('templates-list').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'use-template') return;
    try {
      var data = await TSApi.request('/api/legal/documents/' + btn.dataset.id + '/use-template', { method: 'POST' });
      flash('Modele applique avec succes.', 'ok');
      if (data.url) window.open(data.url, '_blank');
    } catch (err) { flash(err.message, 'err'); }
  });

  // ── Messagerie ──
  async function loadConversations() {
    var params = new URLSearchParams();
    var recipientFilter = document.getElementById('filter-msg-recipient').value;
    if (recipientFilter) params.set('recipient_type', recipientFilter);
    var qs = params.toString() ? '?' + params.toString() : '';

    var data = await TSApi.request('/api/legal/conversations' + qs);
    state.conversations = data.conversations || [];
    renderConversations();
  }

  function renderConversations() {
    var container = document.getElementById('msg-conversations');
    if (!state.conversations.length) {
      container.innerHTML = '<p style="color:#999;font-size:13px;">Aucune conversation</p>';
      return;
    }
    container.innerHTML = state.conversations.map(function(c) {
      var unread = c.unread_count ? '<span class="msg-unread">' + c.unread_count + '</span>' : '';
      var activeClass = state.currentConversation && state.currentConversation.id === c.id ? ' active' : '';
      return '<div class="msg-conv-item' + activeClass + '" data-conversation-id="' + esc(String(c.id)) + '" data-review-id="' + esc(String(c.review_id || '')) + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span class="conv-title">' + esc(c.subject || 'Dossier ' + (c.review_number || '')) + '</span>' +
          unread +
        '</div>' +
        '<div class="conv-preview">' + esc(c.last_message || '') + '</div>' +
        '<div style="font-size:11px;color:#aaa;margin-top:2px;">' + esc(c.participant_name || '') + '</div>' +
        '</div>';
    }).join('');
  }

  document.getElementById('msg-conversations').addEventListener('click', async function(e) {
    var item = e.target.closest('.msg-conv-item');
    if (!item) return;

    var convId = item.dataset.conversationId;
    var conv = state.conversations.find(function(c) { return String(c.id) === convId; });
    if (!conv) return;

    state.currentConversation = conv;
    renderConversations();

    try {
      var data = await TSApi.request('/api/legal/conversations/' + convId + '/messages');
      state.messages = data.messages || [];
      renderMessages();
      document.getElementById('msg-input-area').style.display = '';
    } catch (err) { flash(err.message, 'err'); }
  });

  function renderMessages() {
    var container = document.getElementById('msg-thread-messages');
    if (!state.messages.length) {
      container.innerHTML = '<p style="color:#999;font-size:13px;text-align:center;margin-top:40px;">Aucun message</p>';
      return;
    }
    container.innerHTML = state.messages.map(function(m) {
      var isSent = m.sender_id === user.id;
      var cls = isSent ? 'sent' : 'received';
      return '<div class="msg-bubble ' + cls + '">' +
        '<div>' + esc(m.body || '') + '</div>' +
        '<div class="msg-meta">' + esc(m.sender_name || '') + ' - ' +
        (m.created_at ? new Date(m.created_at).toLocaleString('fr-FR') : '') + '</div>' +
        (m.attachment_url ? '<div style="margin-top:4px;"><a href="' + esc(m.attachment_url) + '" target="_blank" style="color:inherit;font-size:12px;">Piece jointe</a></div>' : '') +
        '</div>';
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  document.getElementById('btn-send-msg').addEventListener('click', async function() {
    if (!state.currentConversation) { flash('Selectionnez une conversation.', 'err'); return; }
    var body = document.getElementById('msg-body').value.trim();
    if (!body) { flash('Veuillez saisir un message.', 'err'); return; }

    var formData = new FormData();
    formData.append('conversation_id', state.currentConversation.id);
    formData.append('subject', document.getElementById('msg-subject').value || '');
    formData.append('body', body);
    if (state.currentConversation.review_id) {
      formData.append('review_id', state.currentConversation.review_id);
    }
    var attachment = document.getElementById('msg-attachment').files[0];
    if (attachment) formData.append('file', attachment);

    try {
      await TSApi.request('/api/legal/messages', {
        method: 'POST',
        body: formData
      });
      document.getElementById('msg-subject').value = '';
      document.getElementById('msg-body').value = '';
      document.getElementById('msg-attachment').value = '';

      // Reload thread
      var data = await TSApi.request('/api/legal/conversations/' + state.currentConversation.id + '/messages');
      state.messages = data.messages || [];
      renderMessages();
      flash('Message envoye.', 'ok');
    } catch (err) { flash(err.message, 'err'); }
  });

  document.getElementById('filter-msg-recipient').addEventListener('change', function() {
    loadConversations();
  });

  // ── Facturation ──
  async function loadBilling() {
    var data = await TSApi.request('/api/legal/billing');
    var stats = data.stats || {};
    document.getElementById('billing-total').textContent = xaf(stats.total_billed);
    document.getElementById('billing-pending').textContent = xaf(stats.pending_amount);
    document.getElementById('billing-paid').textContent = xaf(stats.paid_amount);

    state.invoices = data.invoices || [];
    renderInvoices();
  }

  function renderInvoices() {
    var tbody = document.getElementById('billing-tbody');
    if (!state.invoices.length) {
      tbody.innerHTML = '<tr><td colspan="7">Aucune facture</td></tr>';
      return;
    }
    tbody.innerHTML = state.invoices.map(function(inv) {
      var badge = inv.status === 'paid'
        ? '<span class="badge badge-paid">Paye</span>'
        : '<span class="badge badge-unpaid">En attente</span>';
      var actions = inv.status !== 'paid'
        ? '<button class="btn-sm btn-orange" data-action="request-payment" data-id="' + esc(String(inv.id)) + '">Demander paiement</button>'
        : '<span style="color:#1B5E20;font-weight:600;font-size:12px;">Regle</span>';
      return '<tr>' +
        '<td style="font-family:monospace;">' + esc(inv.invoice_number || inv.id || '-') + '</td>' +
        '<td>' + esc(inv.client_name || '-') + '</td>' +
        '<td>' + esc(inv.period || '-') + '</td>' +
        '<td>' + (inv.days || 0) + '</td>' +
        '<td>' + xaf(inv.amount) + '</td>' +
        '<td>' + badge + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');
  }

  document.getElementById('btn-generate-invoices').addEventListener('click', async function() {
    if (!confirm('Generer les factures du mois en cours ?')) return;
    try {
      await TSApi.request('/api/legal/billing/generate', { method: 'POST' });
      flash('Factures generees avec succes.', 'ok');
      await loadBilling();
    } catch (err) { flash(err.message, 'err'); }
  });

  document.getElementById('billing-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'request-payment') return;
    try {
      await TSApi.request('/api/legal/billing/' + btn.dataset.id + '/request-payment', { method: 'POST' });
      flash('Demande de paiement envoyee.', 'ok');
      await loadBilling();
    } catch (err) { flash(err.message, 'err'); }
  });

  // ── Collaborateurs ──
  async function loadCollaborators() {
    var data = await TSApi.request('/api/legal/collaborators');
    state.collaborators = data.collaborators || [];
    renderCollaborators();
  }

  function renderCollaborators() {
    var tbody = document.getElementById('collaborators-tbody');
    if (!state.collaborators.length) {
      tbody.innerHTML = '<tr><td colspan="6">Aucun collaborateur</td></tr>';
      return;
    }
    tbody.innerHTML = state.collaborators.map(function(c) {
      var activeLabel = c.is_active !== false
        ? '<span style="color:#1B5E20;font-weight:600;">Oui</span>'
        : '<span style="color:#C62828;font-weight:600;">Non</span>';
      return '<tr>' +
        '<td>' + esc(c.full_name || '-') + '</td>' +
        '<td>' + esc(c.email || '-') + '</td>' +
        '<td>' + roleBadge(c.role) + '</td>' +
        '<td>' + esc(c.permissions || '-') + '</td>' +
        '<td>' + activeLabel + '</td>' +
        '<td>' +
          '<button class="btn-sm btn-navy" data-action="edit-collab" data-id="' + esc(String(c.id)) + '">Modifier</button> ' +
          (c.is_active !== false
            ? '<button class="btn-sm btn-red" data-action="deactivate-collab" data-id="' + esc(String(c.id)) + '">Desactiver</button>'
            : '<button class="btn-sm btn-green" data-action="activate-collab" data-id="' + esc(String(c.id)) + '">Activer</button>') +
        '</td>' +
        '</tr>';
    }).join('');
  }

  document.getElementById('collab-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    try {
      await TSApi.request('/api/legal/collaborators', {
        method: 'POST',
        body: JSON.stringify({
          full_name: document.getElementById('collab-name').value,
          email: document.getElementById('collab-email').value,
          phone: document.getElementById('collab-phone').value,
          role: document.getElementById('collab-role').value,
          permissions: document.getElementById('collab-permissions').value
        })
      });
      flash('Collaborateur ajoute avec succes.', 'ok');
      document.getElementById('collab-form').reset();
      await loadCollaborators();
    } catch (err) { flash(err.message, 'err'); }
  });

  document.getElementById('collaborators-tbody').addEventListener('click', async function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    var action = btn.dataset.action;
    var id = btn.dataset.id;

    if (action === 'deactivate-collab') {
      if (!confirm('Desactiver ce collaborateur ?')) return;
      try {
        await TSApi.request('/api/legal/collaborators/' + id, {
          method: 'PUT',
          body: JSON.stringify({ is_active: false })
        });
        flash('Collaborateur desactive.', 'ok');
        await loadCollaborators();
      } catch (err) { flash(err.message, 'err'); }
    }

    if (action === 'activate-collab') {
      try {
        await TSApi.request('/api/legal/collaborators/' + id, {
          method: 'PUT',
          body: JSON.stringify({ is_active: true })
        });
        flash('Collaborateur active.', 'ok');
        await loadCollaborators();
      } catch (err) { flash(err.message, 'err'); }
    }

    if (action === 'edit-collab') {
      var collab = state.collaborators.find(function(c) { return String(c.id) === id; });
      if (!collab) return;
      var newRole = prompt('Role actuel: ' + (collab.role || '') + '\nNouveau role (partner/associate/paralegal/secretary):', collab.role || '');
      if (!newRole) return;
      var newPerms = prompt('Permissions actuelles: ' + (collab.permissions || '') + '\nNouvelles permissions (read/write/admin):', collab.permissions || '');
      if (!newPerms) return;
      try {
        await TSApi.request('/api/legal/collaborators/' + id, {
          method: 'PUT',
          body: JSON.stringify({ role: newRole, permissions: newPerms })
        });
        flash('Collaborateur mis a jour.', 'ok');
        await loadCollaborators();
      } catch (err) { flash(err.message, 'err'); }
    }
  });

  // ── Profil ──
  async function loadProfile() {
    try {
      var data = await TSApi.request('/api/legal/profile');
      var p = data.profile || data.firm || {};
      document.getElementById('lp-firm-name').value = p.firm_name || '';
      document.getElementById('lp-license-number').value = p.license_number || '';
      document.getElementById('lp-address').value = p.address || '';
      document.getElementById('lp-phone').value = p.phone || '';
      document.getElementById('lp-email').value = p.email || '';
      document.getElementById('lp-specialties').value = p.specialties || '';
      document.getElementById('lp-daily-fee').value = p.daily_legal_fee || '';
    } catch (e) { /* silencieux */ }
  }

  document.getElementById('legal-profile-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var resultEl = document.getElementById('profile-result');
    resultEl.innerHTML = '<span style="color:#666;">Enregistrement...</span>';
    try {
      var body = {
        firm_name: document.getElementById('lp-firm-name').value,
        license_number: document.getElementById('lp-license-number').value,
        address: document.getElementById('lp-address').value,
        phone: document.getElementById('lp-phone').value,
        email: document.getElementById('lp-email').value,
        specialties: document.getElementById('lp-specialties').value,
        daily_legal_fee: Number(document.getElementById('lp-daily-fee').value) || null
      };
      await TSApi.request('/api/legal/profile', {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      resultEl.innerHTML = '<span style="color:#1B5E20;font-weight:600;">Profil mis a jour</span>';
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#C62828;">' + esc(err.message) + '</span>';
    }
  });

  // ── Logout ──
  document.getElementById('logout-btn').addEventListener('click', function() {
    TSApi.clearSession();
    window.location.href = 'login.html';
  });

  // ── Initial load ──
  async function loadAll() {
    try {
      await Promise.all([
        loadDashboard(),
        loadReviews(),
        loadDocuments(),
        loadConversations(),
        loadBilling(),
        loadCollaborators(),
        loadProfile()
      ]);
    } catch (err) {
      flash(err.message, 'err');
    }
  }

  loadAll();
})();

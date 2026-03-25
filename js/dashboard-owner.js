(function initOwnerDashboard() {
  const userRaw = localStorage.getItem('ts_user');
  if (!userRaw || !TSApi.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(userRaw);
  if (user.role !== 'owner' && user.role !== 'admin') {
    window.location.href = 'dashboard-client.html';
    return;
  }

  function xaf(value) {
    return Number(value || 0).toLocaleString('fr-FR') + ' FCFA';
  }

  function flash(message, type) {
    document.getElementById('flash').innerHTML = `<div class="flash ${type}">${TSUtils.escapeHtml(message)}</div>`;
  }

  function setDocs(docs) {
    const el = document.getElementById('documents-list');
    el.innerHTML = docs.length
      ? docs.map((d) => {
        const link = d.public_url
          ? ` - <a href="${TSUtils.escapeHtml(d.public_url)}" target="_blank" rel="noopener noreferrer">ouvrir</a>`
          : '';
        return `<li>${TSUtils.escapeHtml(d.document_type)} - ${TSUtils.escapeHtml(d.file_name)}${link}</li>`;
      }).join('')
      : '<li class="small">Aucun document</li>';
  }

  async function load() {
    try {
      const data = await TSApi.request('/api/owner/dashboard');
      const propertySelect = document.getElementById('owner-payment-property');
      propertySelect.innerHTML = data.properties.length
        ? data.properties.map((p) => `<option value="${TSUtils.escapeHtml(String(p.id))}">${TSUtils.escapeHtml(p.property_title)} (${TSUtils.escapeHtml(p.location)})</option>`).join('')
        : '<option value="">Aucun terrain</option>';

      document.getElementById('properties-body').innerHTML = data.properties.length
        ? data.properties.map((p) => `
          <tr>
            <td>${TSUtils.escapeHtml(p.property_title)}</td>
            <td>${TSUtils.escapeHtml(p.location)}</td>
            <td>${xaf(p.expected_price)}</td>
            <td><span class="status ${TSUtils.escapeHtml(p.status)}">${TSUtils.escapeHtml(p.status)}</span></td>
          </tr>
        `).join('')
        : '<tr><td colspan="4" class="small">Aucun terrain déclaré</td></tr>';

      document.getElementById('payments-body').innerHTML = data.payments.length
        ? data.payments.map((p) => `
          <tr>
            <td>${TSUtils.escapeHtml(p.reference || '-')}</td>
            <td>${xaf(p.amount)}</td>
            <td>${TSUtils.escapeHtml(p.method)}</td>
            <td>${TSUtils.escapeHtml(p.paid_at || '-')}</td>
            <td><span class="status ${TSUtils.escapeHtml(p.status)}">${TSUtils.escapeHtml(p.status)}</span></td>
          </tr>
        `).join('')
        : '<tr><td colspan="5" class="small">Aucun paiement</td></tr>';

      const docs = await TSApi.request('/api/documents');
      setDocs(docs.documents);
    } catch (error) {
      flash(error.message, 'err');
    }
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    TSApi.clearSession();
    window.location.href = 'login.html';
  });

  document.getElementById('property-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await TSApi.request('/api/owner/properties', {
        method: 'POST',
        body: JSON.stringify({
          property_title: document.getElementById('property-title').value,
          location: document.getElementById('property-location').value,
          size_m2: Number(document.getElementById('property-size').value) || null,
          expected_price: Number(document.getElementById('property-price').value) || null,
          preferred_payment_mode: document.getElementById('property-payment-mode').value,
          payment_calendar: document.getElementById('property-calendar').value
        })
      });
      flash('Terrain enregistré.', 'ok');
      e.target.reset();
      await load();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  document.getElementById('document-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('document-file').files[0];
    if (!file) {
      flash('Sélectionnez un fichier.', 'err');
      return;
    }

    const formData = new FormData();
    formData.append('document_type', document.getElementById('document-type').value);
    formData.append('file', file);

    try {
      await TSApi.request('/api/documents', { method: 'POST', body: formData });
      flash('Document transmis.', 'ok');
      e.target.reset();
      await load();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  document.getElementById('owner-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ownerPropertyId = document.getElementById('owner-payment-property').value;
    if (!ownerPropertyId) {
      flash("Ajoutez d'abord un terrain.", 'err');
      return;
    }

    try {
      await TSApi.request('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          owner_property_id: Number(ownerPropertyId),
          amount: Number(document.getElementById('owner-payment-amount').value),
          method: document.getElementById('owner-payment-method').value,
          due_date: document.getElementById('owner-payment-due-date').value || null,
          status: 'paid'
        })
      });
      flash('Paiement propriétaire enregistré.', 'ok');
      e.target.reset();
      await load();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  // ── Service Juridique ──

  async function loadLegalMessages() {
    try {
      var data = await TSApi.request('/api/owner/legal-messages');
      var messages = data.messages || [];
      var container = document.getElementById('legal-msgs-container');
      if (!messages.length) {
        container.innerHTML = '<p style="color:#999;font-size:13px;">Aucun message juridique</p>';
        return;
      }
      container.innerHTML = messages.map(function(m) {
        var isSent = m.sender_type === 'owner';
        var cls = isSent ? 'sent' : 'received';
        var bgColor = isSent ? '#e8eaf6' : '#fff8e1';
        return '<div style="background:' + bgColor + ';padding:10px;border-radius:8px;margin-bottom:8px;" class="' + cls + '">' +
          '<div style="font-weight:600;font-size:13px;">' + TSUtils.escapeHtml(m.subject || 'Sans objet') + '</div>' +
          '<div style="margin-top:4px;">' + TSUtils.escapeHtml(m.body || '') + '</div>' +
          '<div style="font-size:11px;color:#999;margin-top:4px;">' +
            TSUtils.escapeHtml(m.sender_name || (isSent ? 'Vous' : 'Cabinet')) + ' — ' +
            (m.created_at ? new Date(m.created_at).toLocaleString('fr-FR') : '') +
          '</div>' +
        '</div>';
      }).join('');
    } catch (err) {
      flash(err.message, 'err');
    }
  }

  async function loadLegalDocuments() {
    try {
      var data = await TSApi.request('/api/owner/legal-documents');
      var docs = data.documents || [];
      var tbody = document.getElementById('legal-docs-tbody');
      if (!docs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="small">Aucun document juridique</td></tr>';
        return;
      }
      tbody.innerHTML = docs.map(function(d) {
        var url = d.public_url || d.file_url || d.url || '';
        var link = url
          ? '<a href="' + TSUtils.escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Ouvrir</a>'
          : '-';
        return '<tr>' +
          '<td>' + TSUtils.escapeHtml(d.document_type || '-') + '</td>' +
          '<td>' + TSUtils.escapeHtml(d.file_name || d.filename || '-') + '</td>' +
          '<td><span class="status ' + TSUtils.escapeHtml(d.status || 'pending') + '">' + TSUtils.escapeHtml(d.status || 'pending') + '</span></td>' +
          '<td>' + (d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '-') + '</td>' +
          '<td>' + link + '</td>' +
        '</tr>';
      }).join('');
    } catch (err) {
      flash(err.message, 'err');
    }
  }

  document.getElementById('btn-show-legal-msgs').addEventListener('click', function() {
    var msgList = document.getElementById('legal-messages-list');
    var docList = document.getElementById('legal-documents-list');
    docList.style.display = 'none';
    msgList.style.display = msgList.style.display === 'none' ? '' : 'none';
    if (msgList.style.display !== 'none') {
      loadLegalMessages();
    }
  });

  document.getElementById('btn-show-legal-docs').addEventListener('click', function() {
    var msgList = document.getElementById('legal-messages-list');
    var docList = document.getElementById('legal-documents-list');
    msgList.style.display = 'none';
    docList.style.display = docList.style.display === 'none' ? '' : 'none';
    if (docList.style.display !== 'none') {
      loadLegalDocuments();
    }
  });

  document.getElementById('btn-send-legal-msg').addEventListener('click', async function() {
    var subject = document.getElementById('legal-msg-subject').value.trim();
    var body = document.getElementById('legal-msg-body').value.trim();
    var resultEl = document.getElementById('legal-msg-result');

    if (!body) {
      resultEl.innerHTML = '<span style="color:#C62828;">Veuillez saisir un message.</span>';
      return;
    }

    resultEl.innerHTML = '<span style="color:#666;">Envoi en cours...</span>';

    try {
      await TSApi.request('/api/owner/legal-messages', {
        method: 'POST',
        body: JSON.stringify({
          subject: subject,
          body: body,
          sender_type: 'owner'
        })
      });
      resultEl.innerHTML = '<span style="color:#1B5E20;font-weight:600;">Message envoyé avec succès</span>';
      document.getElementById('legal-msg-subject').value = '';
      document.getElementById('legal-msg-body').value = '';
      // Refresh messages if visible
      if (document.getElementById('legal-messages-list').style.display !== 'none') {
        loadLegalMessages();
      }
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#C62828;">' + TSUtils.escapeHtml(err.message) + '</span>';
    }
  });

  load();
})();

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
    document.getElementById('flash').innerHTML = `<div class="flash ${type}">${message}</div>`;
  }

  function setDocs(docs) {
    const el = document.getElementById('documents-list');
    el.innerHTML = docs.length
      ? docs.map((d) => {
        const link = d.public_url
          ? ` - <a href=\"${d.public_url}\" target=\"_blank\" rel=\"noopener noreferrer\">ouvrir</a>`
          : '';
        return `<li>${d.document_type} - ${d.file_name}${link}</li>`;
      }).join('')
      : '<li class="small">Aucun document</li>';
  }

  async function load() {
    try {
      const data = await TSApi.request('/api/owner/dashboard');
      const propertySelect = document.getElementById('owner-payment-property');
      propertySelect.innerHTML = data.properties.length
        ? data.properties.map((p) => `<option value="${p.id}">${p.property_title} (${p.location})</option>`).join('')
        : '<option value="">Aucun terrain</option>';

      document.getElementById('properties-body').innerHTML = data.properties.length
        ? data.properties.map((p) => `
          <tr>
            <td>${p.property_title}</td>
            <td>${p.location}</td>
            <td>${xaf(p.expected_price)}</td>
            <td><span class="status ${p.status}">${p.status}</span></td>
          </tr>
        `).join('')
        : '<tr><td colspan="4" class="small">Aucun terrain déclaré</td></tr>';

      document.getElementById('payments-body').innerHTML = data.payments.length
        ? data.payments.map((p) => `
          <tr>
            <td>${p.reference || '-'}</td>
            <td>${xaf(p.amount)}</td>
            <td>${p.method}</td>
            <td>${p.paid_at || '-'}</td>
            <td><span class="status ${p.status}">${p.status}</span></td>
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

  load();
})();

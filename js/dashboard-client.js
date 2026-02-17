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

  function xaf(value) {
    return Number(value || 0).toLocaleString('fr-FR') + ' FCFA';
  }

  function flash(message, type) {
    document.getElementById('flash').innerHTML = `<div class="flash ${type}">${message}</div>`;
  }

  function setList(id, items, render) {
    const el = document.getElementById(id);
    el.innerHTML = items.length ? items.map(render).join('') : '<li class="small">Aucune donnée</li>';
  }

  async function load() {
    try {
      const data = await TSApi.request('/api/client/dashboard');

      document.getElementById('m-commitment').textContent = xaf(data.metrics.commitment_total);
      document.getElementById('m-paid').textContent = xaf(data.metrics.paid_total);
      document.getElementById('m-remaining').textContent = xaf(data.metrics.remaining_total);
      document.getElementById('m-score').textContent = `Score de fiabilité: ${data.metrics.reliability_score}/100`;

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

      setList('contracts-list', data.contracts, (c) => `<li>${c.contract_number} - <span class="status ${c.status}">${c.status}</span></li>`);
      setList('pv-list', data.possession, (p) => `<li>${p.pv_number} - <span class="status ${p.status}">${p.status}</span></li>`);

      const docs = await TSApi.request('/api/documents');
      setList('documents-list', docs.documents, (d) => {
        const link = d.public_url
          ? ` - <a href=\"${d.public_url}\" target=\"_blank\" rel=\"noopener noreferrer\">ouvrir</a>`
          : '';
        return `<li>${d.document_type} - ${d.file_name}${link}</li>`;
      });
    } catch (error) {
      flash(error.message, 'err');
    }
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    TSApi.clearSession();
    window.location.href = 'login.html';
  });

  document.getElementById('reservation-form').addEventListener('submit', async (e) => {
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

  document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await TSApi.request('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(document.getElementById('payment-amount').value),
          method: document.getElementById('payment-method').value,
          due_date: document.getElementById('payment-due-date').value || null,
          status: 'paid'
        })
      });
      flash('Paiement enregistré.', 'ok');
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
      flash('Document envoyé.', 'ok');
      e.target.reset();
      await load();
    } catch (error) {
      flash(error.message, 'err');
    }
  });

  load();
})();

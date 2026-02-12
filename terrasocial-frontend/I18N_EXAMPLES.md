# TERRASOCIAL i18n Integration Examples

Quick reference examples for integrating the i18n system into your components.

## Quick Start

### 1. Basic Text Translation

```html
<button data-i18n="actions.save">Save</button>
<h1 data-i18n="nav.dashboard">Dashboard</h1>
<p data-i18n="messages.loading">Loading...</p>
```

### 2. Attribute Translation

```html
<!-- Placeholder text -->
<input
    type="email"
    data-i18n="form.email"
    data-i18n-attr="placeholder"
    placeholder="Email"
/>

<!-- Button title -->
<button
    data-i18n="actions.delete"
    data-i18n-attr="title"
    title="Delete"
/>

<!-- Image alt text -->
<img
    src="logo.png"
    data-i18n="app.name"
    data-i18n-attr="alt"
    alt="TERRASOCIAL"
/>
```

### 3. Dynamic Translation in JavaScript

```javascript
// Get translated text
const message = i18n.t('messages.saveSuccess');
console.log(message);  // "Enregistré avec succès" (French)

// With parameters
const greeting = i18n.t('common.greeting', { name: 'Alice' });

// Change language
await i18n.setLanguage('en');
console.log(i18n.t('messages.saveSuccess'));  // "Saved successfully"
```

---

## Common Scenarios

### Authentication Page

```html
<!-- login form -->
<form id="loginForm">
    <h1 data-i18n="auth.loginTitle">Sign In to TERRASOCIAL</h1>

    <div class="form-group">
        <label for="email" data-i18n="form.email">Email</label>
        <input
            id="email"
            type="email"
            data-i18n="form.email"
            data-i18n-attr="placeholder"
            placeholder="Email"
            required
        />
    </div>

    <div class="form-group">
        <label for="password" data-i18n="form.password">Password</label>
        <input
            id="password"
            type="password"
            data-i18n="form.password"
            data-i18n-attr="placeholder"
            placeholder="Password"
            required
        />
    </div>

    <div class="form-options">
        <label>
            <input type="checkbox" name="remember" />
            <span data-i18n="auth.rememberMe">Remember me</span>
        </label>
        <a href="#/forgot-password" data-i18n="auth.forgotPassword">
            Forgot password?
        </a>
    </div>

    <button type="submit" class="btn-primary" data-i18n="auth.signin">
        Sign In
    </button>

    <p>
        <span data-i18n="auth.noAccount">Don't have an account?</span>
        <a href="#/signup" data-i18n="auth.signup">Sign Up</a>
    </p>
</form>
```

```javascript
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        // Your login logic here
        showToast(i18n.t('messages.saveSuccess'), 'success');
    } catch (error) {
        showToast(i18n.t('messages.error'), 'error');
    }
});
```

### Dashboard with Language Switcher

```html
<header class="app-header">
    <div class="header-left">
        <h1 data-i18n="nav.dashboard">Dashboard</h1>
    </div>

    <div class="header-right">
        <div class="language-switcher">
            <select id="languageSelect">
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="zh">中文</option>
                <option value="de">Deutsch</option>
            </select>
        </div>

        <button id="userMenu" class="btn-user">
            <span data-i18n="common.account">Account</span>
        </button>
    </div>
</header>

<main class="dashboard-content">
    <section class="dashboard-cards">
        <div class="card">
            <h2 data-i18n="payment.deposit">Deposit</h2>
            <p class="value">50,000 CFA</p>
        </div>

        <div class="card">
            <h2 data-i18n="payment.balance">Balance</h2>
            <p class="value">25,000 CFA</p>
        </div>

        <div class="card">
            <h2 data-i18n="subscription.totalAmount">Total Amount</h2>
            <p class="value">100,000 CFA</p>
        </div>
    </section>
</main>
```

```javascript
// Handle language selection
document.getElementById('languageSelect').addEventListener('change', async (e) => {
    const newLang = e.target.value;
    await i18n.setLanguage(newLang);

    // Re-translate all data-i18n elements
    i18n.translateElement(document.body);

    // Update any other dynamic content
    updateDashboardLabels();
});

function updateDashboardLabels() {
    // Update labels that might be in JavaScript objects
    const cardTitles = {
        deposit: i18n.t('payment.deposit'),
        balance: i18n.t('payment.balance'),
        total: i18n.t('subscription.totalAmount')
    };

    console.log('Dashboard labels updated:', cardTitles);
}
```

### Payment Form

```html
<form id="paymentForm" class="payment-form">
    <h2 data-i18n="payment.payment">Payment</h2>

    <div class="form-group">
        <label data-i18n="payment.method">Payment Method</label>
        <select name="method" id="paymentMethod">
            <option value="orange" data-i18n="payment.orangeMoney">Orange Money</option>
            <option value="mtn" data-i18n="payment.mtnMomo">MTN MoMo</option>
            <option value="bank" data-i18n="payment.bankTransfer">Bank Transfer</option>
            <option value="cash" data-i18n="payment.cash">Cash</option>
        </select>
    </div>

    <div class="form-group">
        <label for="amount" data-i18n="form.amount">Amount</label>
        <input
            id="amount"
            type="number"
            name="amount"
            data-i18n="form.amount"
            data-i18n-attr="placeholder"
            placeholder="Amount"
            required
        />
    </div>

    <div class="form-group">
        <label for="proof" data-i18n="payment.proof">Proof of Payment</label>
        <input
            id="proof"
            type="file"
            name="proof"
            accept="image/*,.pdf"
        />
    </div>

    <div class="form-actions">
        <button type="submit" class="btn-primary" data-i18n="actions.submit">
            Submit
        </button>
        <button type="button" class="btn-secondary" data-i18n="actions.cancel">
            Cancel
        </button>
    </div>
</form>
```

```javascript
document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const method = document.getElementById('paymentMethod').value;
    const methodLabel = i18n.t(`payment.${getPaymentMethodKey(method)}`);

    try {
        // Process payment
        showToast(
            i18n.t('messages.saveSuccess'),
            'success'
        );
    } catch (error) {
        showToast(
            i18n.t('messages.saveError'),
            'error'
        );
    }
});

function getPaymentMethodKey(value) {
    const methods = {
        orange: 'orangeMoney',
        mtn: 'mtnMomo',
        bank: 'bankTransfer',
        cash: 'cash'
    };
    return methods[value] || value;
}
```

### Client Profile Page

```html
<div class="client-profile">
    <div class="profile-header">
        <h1 data-i18n="client.clientInformation">Client Information</h1>
        <button class="btn-edit" data-i18n="actions.edit">Edit</button>
    </div>

    <div class="profile-section">
        <h2 data-i18n="client.personalInfo">Personal Information</h2>
        <div class="info-group">
            <label data-i18n="form.firstName">First Name</label>
            <p id="firstName">Jean</p>
        </div>
        <div class="info-group">
            <label data-i18n="form.lastName">Last Name</label>
            <p id="lastName">Dupont</p>
        </div>
        <div class="info-group">
            <label data-i18n="form.phone">Phone</label>
            <p id="phone">+227 90123456</p>
        </div>
    </div>

    <div class="profile-section">
        <h2 data-i18n="client.subscriptions">Subscriptions</h2>
        <table id="subscriptionsTable">
            <thead>
                <tr>
                    <th data-i18n="lot.name">Lot Name</th>
                    <th data-i18n="subscription.subscriptionDate">Subscription Date</th>
                    <th data-i18n="subscription.totalAmount">Total Amount</th>
                    <th data-i18n="subscription.subscriptionStatus">Status</th>
                </tr>
            </thead>
            <tbody>
                <!-- Populated dynamically -->
            </tbody>
        </table>
    </div>

    <div class="profile-section">
        <h2 data-i18n="client.payments">Payments</h2>
        <div id="paymentsContainer">
            <!-- Payment history will be loaded here -->
        </div>
    </div>
</div>
```

```javascript
// Load client data with translated labels
async function loadClientProfile(clientId) {
    const client = await fetchClientData(clientId);

    // Update personal info
    document.getElementById('firstName').textContent = client.firstName;
    document.getElementById('lastName').textContent = client.lastName;
    document.getElementById('phone').textContent = client.phone;

    // Load subscriptions
    loadSubscriptions(client.subscriptions);
}

function loadSubscriptions(subscriptions) {
    const tbody = document.querySelector('#subscriptionsTable tbody');
    tbody.innerHTML = '';

    subscriptions.forEach(sub => {
        const row = document.createElement('tr');
        const statusLabel = i18n.t(`status.${sub.status.toLowerCase()}`);

        row.innerHTML = `
            <td>${sub.lotName}</td>
            <td>${new Date(sub.date).toLocaleDateString()}</td>
            <td>${sub.amount.toLocaleString()} CFA</td>
            <td><span class="status-badge">${statusLabel}</span></td>
        `;
        tbody.appendChild(row);
    });
}
```

### Settings Page with Language Selection

```html
<div class="settings-container">
    <h1 data-i18n="settings.settings">Settings</h1>

    <div class="settings-tabs">
        <button class="tab-button active" data-tab="account" data-i18n="settings.account">
            Account
        </button>
        <button class="tab-button" data-tab="language" data-i18n="settings.language">
            Language
        </button>
        <button class="tab-button" data-tab="security" data-i18n="settings.security">
            Security
        </button>
        <button class="tab-button" data-tab="notifications" data-i18n="settings.notifications">
            Notifications
        </button>
    </div>

    <!-- Account Tab -->
    <div id="account-tab" class="settings-tab active">
        <h2 data-i18n="settings.profile">Profile</h2>
        <!-- Profile settings content -->
    </div>

    <!-- Language Tab -->
    <div id="language-tab" class="settings-tab">
        <h2 data-i18n="settings.language">Language</h2>

        <div class="language-options">
            <p data-i18n="common.selectLanguage">Select your preferred language</p>

            <div class="language-grid">
                <label class="language-option">
                    <input type="radio" name="language" value="fr" />
                    <span>Français</span>
                </label>
                <label class="language-option">
                    <input type="radio" name="language" value="en" />
                    <span>English</span>
                </label>
                <label class="language-option">
                    <input type="radio" name="language" value="es" />
                    <span>Español</span>
                </label>
                <label class="language-option">
                    <input type="radio" name="language" value="zh" />
                    <span>中文</span>
                </label>
                <label class="language-option">
                    <input type="radio" name="language" value="de" />
                    <span>Deutsch</span>
                </label>
            </div>
        </div>
    </div>

    <!-- Security Tab -->
    <div id="security-tab" class="settings-tab">
        <h2 data-i18n="settings.security">Security</h2>
        <button class="btn-secondary" data-i18n="settings.changePassword">
            Change Password
        </button>
    </div>

    <!-- Notifications Tab -->
    <div id="notifications-tab" class="settings-tab">
        <h2 data-i18n="settings.notifications">Notifications</h2>
        <!-- Notification preferences -->
    </div>
</div>
```

```javascript
// Language selection
document.querySelectorAll('input[name="language"]').forEach(radio => {
    radio.value === i18n.getCurrentLanguage() && (radio.checked = true);

    radio.addEventListener('change', async (e) => {
        await i18n.setLanguage(e.target.value);
        i18n.translateElement(document.body);
        showToast(i18n.t('messages.updateSuccess'), 'success');
    });
});

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Update button states
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}
```

### Confirmation Dialog

```javascript
async function deleteItem(itemId, itemName) {
    const confirmed = await showConfirmDialog(
        i18n.t('messages.confirmDelete'),
        `${itemName}?`
    );

    if (confirmed) {
        try {
            await deleteAPI(itemId);
            showToast(
                i18n.t('messages.deleteSuccess'),
                'success'
            );
        } catch (error) {
            showToast(
                i18n.t('messages.deleteError'),
                'error'
            );
        }
    }
}

function showConfirmDialog(message, title) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        dialog.innerHTML = `
            <div class="modal-content">
                <h2>${title}</h2>
                <p>${message}</p>
                <div class="modal-actions">
                    <button class="btn-primary confirm-yes" data-i18n="common.yes">Yes</button>
                    <button class="btn-secondary confirm-no" data-i18n="common.no">No</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        i18n.translateElement(dialog);  // Translate newly added element

        dialog.querySelector('.confirm-yes').addEventListener('click', () => {
            dialog.remove();
            resolve(true);
        });

        dialog.querySelector('.confirm-no').addEventListener('click', () => {
            dialog.remove();
            resolve(false);
        });
    });
}
```

### Data Table with Status Badges

```javascript
function renderTable(data, columns) {
    const table = document.createElement('table');
    table.className = 'data-table';

    // Create header with translated column names
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = i18n.t(col.i18nKey);
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body with data
    const tbody = document.createElement('tbody');
    data.forEach(row => {
        const tr = document.createElement('tr');
        columns.forEach(col => {
            const td = document.createElement('td');
            let value = row[col.key];

            // Handle status with translation and styling
            if (col.type === 'status') {
                const statusBadge = document.createElement('span');
                statusBadge.className = `status-badge status-${value.toLowerCase()}`;
                statusBadge.textContent = i18n.t(`status.${value.toLowerCase()}`);
                td.appendChild(statusBadge);
            } else if (col.type === 'currency') {
                td.textContent = value.toLocaleString() + ' CFA';
            } else if (col.type === 'date') {
                td.textContent = new Date(value).toLocaleDateString(i18n.getCurrentLanguage());
            } else {
                td.textContent = value;
            }

            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
}

// Usage example
const columns = [
    { key: 'name', i18nKey: 'form.name', type: 'text' },
    { key: 'amount', i18nKey: 'form.amount', type: 'currency' },
    { key: 'date', i18nKey: 'form.date', type: 'date' },
    { key: 'status', i18nKey: 'form.status', type: 'status' }
];

const data = [
    { name: 'Lot A', amount: 100000, date: '2024-01-15', status: 'active' },
    { name: 'Lot B', amount: 150000, date: '2024-02-20', status: 'pending' }
];

document.getElementById('tableContainer').appendChild(
    renderTable(data, columns)
);
```

---

## Tips & Best Practices

1. **Always use nested keys**: `nav.dashboard` instead of just `dashboard`
2. **Translate dynamic content**: Use `i18n.t()` in JavaScript when content is generated
3. **Listen for language changes**: Update custom components when language changes
4. **Use data attributes for static text**: `data-i18n` for performance
5. **Remember localStorage**: Language preference is automatically saved
6. **Test all languages**: Ensure all keys are translated in all languages
7. **Use parameter interpolation** for dynamic values: `i18n.t('key', { name: value })`

## Common Issues

**Q: Text showing as key name instead of translation?**
A: Check that the key exists in all language files and JSON is valid.

**Q: Language not changing?**
A: Ensure you're calling `i18n.setLanguage()` and re-translating elements.

**Q: Missing translations on dynamic content?**
A: Use `i18n.translateElement()` after adding new DOM elements.

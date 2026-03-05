# TERRASOCIAL Internationalization (i18n) Guide

## Overview

This document describes the complete internationalization system for the TERRASOCIAL PWA. The system supports 5 languages:

- **French (fr)** - Primary language
- **English (en)**
- **Spanish (es)**
- **Chinese Simplified (zh)**
- **German (de)**

## Files

### Main i18n Module
- **`js/i18n.js`** - I18n manager class with language switching capabilities

### Translation Files
- **`locales/fr.json`** - French translations
- **`locales/en.json`** - English translations
- **`locales/es.json`** - Spanish translations
- **`locales/zh.json`** - Chinese Simplified translations
- **`locales/de.json`** - German translations

## Features

1. **Auto-detection** - Automatically detects browser language
2. **Language Switching** - Change language at runtime with UI persistence
3. **Nested Keys** - Support for nested translation keys (e.g., `nav.dashboard`)
4. **Parameter Interpolation** - Support for dynamic values in translations
5. **LocalStorage** - User's language preference is saved locally
6. **DOM Translation** - Built-in support for translating HTML elements
7. **Plural Forms** - Support for singular/plural translations
8. **Text Direction** - Automatic RTL/LTR handling (extensible for RTL languages)

## Installation

### 1. Include the i18n Script

Add the i18n script to your HTML before other application scripts:

```html
<head>
    <!-- ... other head content ... -->

    <!-- i18n must load before app -->
    <script src="js/i18n.js"></script>
</head>
```

Add it to `index.html` right after the service worker registration script:

```html
<!-- Service Worker Registration -->
<script>
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW registered:', reg))
                .catch(err => console.log('SW registration failed:', err));
        });
    }
</script>

<!-- i18n System -->
<script src="js/i18n.js"></script>

<!-- Application Scripts -->
<script src="js/supabase-client.js"></script>
<script src="js/offline-manager.js"></script>
<script src="js/router.js"></script>
<script src="js/auth.js"></script>
<script src="js/app.js"></script>
```

### 2. Ensure Locales Directory is Accessible

The `locales/` directory must be in the root of your PWA so the i18n manager can fetch translation files:

```
/Frontend_PWA/
├── index.html
├── manifest.json
├── js/
│   ├── i18n.js
│   ├── app.js
│   └── ... other scripts
└── locales/
    ├── fr.json
    ├── en.json
    ├── es.json
    ├── zh.json
    └── de.json
```

## Usage

### Basic Translation Usage

The i18n system creates a global `window.i18n` object that is automatically initialized:

```javascript
// Get a translation
const text = i18n.t('nav.home');  // Returns: "Accueil" (in French)

// With parameter interpolation
const message = i18n.t('messages.fieldRequired');
// Returns: "Ce champ est obligatoire"

// With dynamic values
const customMessage = i18n.t('messages.greeting', { name: 'Jean' });
// If translation is "Bonjour {{name}}"
// Returns: "Bonjour Jean"
```

### API Methods

#### `i18n.init()`
Initialize the i18n system. Called automatically on page load.

```javascript
await i18n.init();
// Returns: current language code (e.g., 'fr')
```

#### `i18n.t(key, params)`
Get translated string with optional parameters.

```javascript
// Simple translation
i18n.t('nav.dashboard')

// With parameters
i18n.t('messages.welcome', { name: 'Alice' })
```

#### `i18n.getCurrentLanguage()`
Get the current language code.

```javascript
const lang = i18n.getCurrentLanguage();  // Returns: 'fr'
```

#### `i18n.setLanguage(langCode)`
Change the current language and trigger UI updates.

```javascript
await i18n.setLanguage('en');  // Switch to English
// Saves preference to localStorage
// Fires 'i18n:changed' event
```

#### `i18n.getSupportedLanguages()`
Get list of all supported languages with display names.

```javascript
const languages = i18n.getSupportedLanguages();
// Returns: [
//   { code: 'fr', name: 'Français', nativeName: 'Français' },
//   { code: 'en', name: 'English', nativeName: 'English' },
//   ...
// ]
```

#### `i18n.getTranslations()`
Get all translations for the current language.

```javascript
const allTranslations = i18n.getTranslations();
```

#### `i18n.translateElement(root)`
Translate all elements with `data-i18n` attributes within a DOM element.

```javascript
// Translate entire page
i18n.translateElement(document.body);

// Translate specific section
i18n.translateElement(document.getElementById('mySection'));
```

#### `i18n.tp(key, count)`
Get plural form based on count.

```javascript
i18n.tp('items', 1)    // Returns singular form
i18n.tp('items', 5)    // Returns plural form
```

#### `i18n.createLanguageSwitcher()`
Create a language switcher UI component.

```javascript
const switcher = i18n.createLanguageSwitcher();
document.querySelector('.header').appendChild(switcher);
```

## Translation in HTML

### Using `data-i18n` Attribute

For static text content:

```html
<button data-i18n="actions.save">Save</button>
<!-- Will be translated to: "Enregistrer" (in French) -->

<h1 data-i18n="nav.dashboard">Dashboard</h1>
<!-- Will be translated to: "Tableau de Bord" -->
```

### Using `data-i18n-attr` Attribute

For element attributes like placeholders, titles, etc:

```html
<input
    type="email"
    data-i18n="form.email"
    data-i18n-attr="placeholder"
    placeholder="Email"
/>
<!-- Placeholder will be translated -->

<button
    data-i18n="actions.delete"
    data-i18n-attr="title"
    title="Delete"
/>
<!-- Title attribute will be translated -->
```

### Using `data-i18n-html` Attribute

For HTML content (use with caution for user input):

```html
<div data-i18n-html="legal.disclaimerText">
    Original disclaimer text
</div>
```

## Dynamic Translation in JavaScript

### Updating Text After Language Change

Listen for the language change event:

```javascript
window.addEventListener('i18n:changed', () => {
    // Refresh all translations
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = i18n.t(key);
    });
});
```

### Creating Language Switcher in Settings

Add a language selector to your settings page:

```html
<div class="settings-section">
    <label for="languageSelect">Language / Langue / Idioma</label>
    <select id="languageSelect">
        <!-- Options will be populated by JavaScript -->
    </select>
</div>
```

```javascript
const select = document.getElementById('languageSelect');
const languages = i18n.getSupportedLanguages();

languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.nativeName;
    if (lang.code === i18n.getCurrentLanguage()) {
        option.selected = true;
    }
    select.appendChild(option);
});

select.addEventListener('change', (e) => {
    i18n.setLanguage(e.target.value);
});
```

## Adding New Translations

### To Add a New Translation Key

1. **Add to all language files** (fr.json, en.json, es.json, zh.json, de.json):

```json
{
  "mySection": {
    "myKey": "Your translation here"
  }
}
```

2. **Use in code**:

```javascript
const text = i18n.t('mySection.myKey');
```

### To Add a New Language

1. **Create a new translation file** (e.g., `locales/pt.json` for Portuguese):

```json
{
  "app": { ... },
  "nav": { ... },
  // ... copy structure from other languages and translate
}
```

2. **Update i18n.js** - Add the language code to `supportedLanguages` array:

```javascript
this.supportedLanguages = ['fr', 'en', 'es', 'zh', 'de', 'pt'];
```

3. **Update language selector** in `getSupportedLanguages()`:

```javascript
return [
    { code: 'fr', name: 'Français', nativeName: 'Français' },
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Español', nativeName: 'Español' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'de', name: 'Deutsch', nativeName: 'Deutsch' },
    { code: 'pt', name: 'Português', nativeName: 'Português' }
];
```

## Translation Coverage

The system includes comprehensive translations for:

### Navigation (`nav.`)
- home, offers, client, agent, admin, dashboard, properties, lots, subscriptions, payments, commissions, clients, reports, settings, help, about, contact, blog, faq, guides, legal

### Authentication (`auth.`)
- login, signin, signup, register, logout, email, password, forgot password, email verification, account creation

### Common Actions (`actions.`)
- save, cancel, edit, delete, add, search, filter, export, print, download, upload, submit, confirm, back, next, previous, close, view, details, create, update, refresh, approve, reject, validate, clear

### Status Labels (`status.`)
- pending, active, completed, cancelled, validated, rejected, in progress, archived, draft, published, approved, on hold

### Form Fields (`form.`)
- name, first name, last name, phone, address, city, region, country, zip code, amount, date, description, notes, reference, status, type, category, comments, required, optional

### Messages (`messages.`)
- success, error, warning, loading, no data, confirm delete, field required, invalid email, password mismatch, offline/online, session expired, etc.

### User Roles (`roles.`)
- admin, staff, agent, client, lawyer, notary, investor, user

### Property & Lot Related (`property.`, `lot.`)
- Available, Reserved, Subscribed, Paid, Notarized, Price, Area, Location, Documents, Owner, Status, Details

### Payment Related (`payment.`)
- Deposit, Installment, Balance, Due Date, Payment Method (Orange Money, MTN MoMo, Bank Transfer, Cash), Payment History, Invoice, Receipt

### Legal Disclaimer (`legal.`)
- Complete legal disclaimer in all languages: "Ce programme n'est ni une banque, ni une microfinance, ni une coopérative d'épargne et de crédit..."

### Help Section (`help.`)
- FAQ, Contact Us, Documentation, Support

### Common Terms (`common.`)
- yes, no, ok, copy, share, download, upload, select, loading, more, less, read, show, hide, sort, etc.

## Browser Compatibility

The i18n system works in all modern browsers that support:
- ES6 (fetch API, async/await, classes)
- LocalStorage API
- Custom Events

Supported in:
- Chrome/Edge 55+
- Firefox 52+
- Safari 10.1+
- Mobile browsers (Chrome, Safari, Firefox)

## Accessibility Considerations

1. **Lang Attribute** - Automatically sets `lang` attribute on `<html>` element
2. **Text Direction** - Supports RTL text direction (extensible for Arabic, Hebrew, etc.)
3. **Screen Readers** - All translations should be semantic and meaningful

## Performance Optimization

1. **Translation files are cached** - Fetch API with browser caching
2. **Language preference saved locally** - No need to re-detect on each page load
3. **Lazy loading** - Translations loaded once on app initialization
4. **Minimal footprint** - i18n.js is only ~10KB, translation files ~10KB each

## Integration with App Components

### Example: Settings Page

```javascript
// views/settings.html
<div class="settings-container">
    <h1 data-i18n="settings.settings">Settings</h1>

    <div class="settings-section">
        <label data-i18n="settings.language">Language</label>
        <select id="languageSelect"></select>
    </div>

    <div class="settings-section">
        <label data-i18n="settings.password">Password</label>
        <input type="password" id="currentPassword"
               data-i18n="settings.currentPassword"
               data-i18n-attr="placeholder" />
    </div>

    <button class="btn-primary" data-i18n="actions.save">Save</button>
</div>
```

```javascript
// In your settings controller
document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('languageSelect');
    const languages = i18n.getSupportedLanguages();

    languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.nativeName;
        if (lang.code === i18n.getCurrentLanguage()) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    select.addEventListener('change', async (e) => {
        await i18n.setLanguage(e.target.value);
        // Re-translate page
        i18n.translateElement(document.body);
    });
});
```

### Example: Dynamic Alerts

```javascript
// Show success message
showToast(i18n.t('messages.saveSuccess'), 'success');

// Show error message
showToast(i18n.t('messages.deleteError'), 'error');

// Confirmation dialog
const confirmed = await showConfirm(i18n.t('messages.confirmDelete'));
```

## Event System

The i18n system fires custom events that your app can listen to:

### `i18n:ready`
Fired when i18n is initialized and ready to use.

```javascript
window.addEventListener('i18n:ready', (event) => {
    console.log('Current language:', event.detail.language);
});
```

### `i18n:changed`
Fired when the user changes the language.

```javascript
window.addEventListener('i18n:changed', (event) => {
    console.log('Language changed to:', event.detail.language);
    // Update UI, reload page content, etc.
});
```

## Troubleshooting

### Translations Not Loading

**Issue**: Getting key names instead of translations
- Check that locale files are in the correct directory (`locales/`)
- Ensure JSON files are valid (check browser console)
- Clear browser cache and localStorage

```javascript
// Clear language preference
localStorage.removeItem('terrasocial_language');
// Then reload page
location.reload();
```

### Missing Language File

**Issue**: Console warning about failed language load
- Ensure the file exists in the `locales/` directory
- Check file naming: must be `[langcode].json` (lowercase)
- Verify JSON syntax is valid

### RTL Text Direction

To add support for RTL languages (Arabic, Hebrew, etc.):

1. Update `_getTextDirection()` method in i18n.js:

```javascript
_getTextDirection(lang) {
    const rtlLanguages = ['ar', 'he', 'ur'];  // Add RTL language codes
    return rtlLanguages.includes(lang) ? 'rtl' : 'ltr';
}
```

2. The HTML element's `dir` attribute will be set automatically.

## Testing

### Manual Testing

1. **Language Detection**
   - Open app in different browser language settings
   - Verify correct language is auto-selected

2. **Language Switching**
   - Switch between languages
   - Verify all UI updates correctly
   - Check localStorage for saved preference

3. **Translation Completeness**
   - Check browser console for missing translation warnings
   - Ensure all keys are translated in all languages

### Automated Testing

```javascript
// Example test
async function testI18n() {
    await i18n.init();

    // Test basic translation
    console.assert(i18n.t('nav.home') !== 'nav.home', 'Translation should exist');

    // Test language switching
    await i18n.setLanguage('en');
    console.assert(i18n.getCurrentLanguage() === 'en', 'Language should be English');

    // Test supported languages
    const langs = i18n.getSupportedLanguages();
    console.assert(langs.length === 5, 'Should have 5 languages');

    console.log('✅ All i18n tests passed!');
}
```

## Support

For issues or questions about the i18n system, refer to:
1. This documentation (I18N_GUIDE.md)
2. i18n.js source code comments
3. Individual locale files for translation examples

## License

This internationalization system is part of the TERRASOCIAL project.

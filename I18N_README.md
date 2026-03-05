# TERRASOCIAL - Multilingual Support (i18n) Documentation

## Overview

The TERRASOCIAL website now supports **5 languages**:
- 🇫🇷 **French (FR)** - Default language
- 🇬🇧 **English (EN)**
- 🇪🇸 **Spanish (ES)**
- 🇨🇳 **Chinese (ZH)** - Simplified Chinese
- 🇩🇪 **German (DE)**

## File Structure

```
Code_source/
├── index.html                 # Main website (updated with i18n support)
├── js/
│   └── site-i18n.js          # i18n JavaScript module
└── locales/
    ├── site-fr.json          # French translations
    ├── site-en.json          # English translations
    ├── site-es.json          # Spanish translations
    ├── site-zh.json          # Chinese translations (Simplified)
    └── site-de.json          # German translations
```

## How It Works

### 1. i18n System (`js/site-i18n.js`)

The i18n system is built as a JavaScript module with the following features:

#### Core Features:
- **Language Detection**: Automatically detects browser language or uses localStorage preference
- **Lazy Loading**: Translations are loaded on demand
- **Fallback Support**: Falls back to French if a translation is not found
- **Nested Keys**: Supports dot notation for nested translation keys (e.g., `hero.title`)
- **Dynamic Updates**: Can change language without page reload
- **localStorage**: Persists language preference across sessions

#### Main Methods:

```javascript
// Set language (async)
await window.i18n.setLanguage('en');

// Get translation
window.i18n.t('hero.title');

// Format currency (FCFA)
window.i18n.formatCurrency(500000);

// Format date
window.i18n.formatDate(new Date());

// Get all supported languages
window.i18n.getLanguages();
```

### 2. HTML Integration

Elements are marked with `data-i18n` attributes for automatic translation:

```html
<!-- Text content -->
<h2 data-i18n="lots.title">Nos Lots Disponibles</h2>

<!-- Form placeholders -->
<input data-i18n-placeholder="form.fullNamePlaceholder">

<!-- Titles and attributes -->
<a data-i18n-title="contact.phone">Call us</a>

<!-- Accessibility -->
<button data-i18n-aria="hero.cta_primary">Book now</button>
```

### 3. Language Switcher

The language switcher dropdown in the header allows users to:
- Select from 5 available languages
- See the current selection with flag emoji
- Have their choice saved in localStorage
- Instantly update all page content

## Translation Files Format

Each translation file is a JSON file with a hierarchical structure:

```json
{
  "hero": {
    "title": "Become an owner...",
    "description": "Access land ownership...",
    "stats": {
      "lots": {
        "number": "50+",
        "label": "Available plots"
      }
    }
  },
  "messages": {
    "success": "Thank you...",
    "error": "An error occurred..."
  }
}
```

## Sections Covered in Translations

Each translation file includes:

### 1. **Header Navigation**
- Navigation menu items
- Logo text

### 2. **Hero Section**
- Main title and tagline
- CTA buttons
- Statistics (lots, surface, months)

### 3. **Lots Section**
- Section title and description
- Three lot types (Standard, Comfort, Premium)
- Features for each lot
- Pricing and payment terms

### 4. **How It Works**
- 5-step process
- Title and description for each step

### 5. **Payment Methods**
- Payment methods list
- Payment simulator labels and descriptions
- Duration options

### 6. **Transparency**
- 6 transparency cards
- Legal framework information
- Security and rights details

### 7. **Subscription Form**
- Form labels and placeholders
- Form options
- Checkboxes for terms and newsletter
- Submit button

### 8. **Contact Section**
- Contact information labels
- Address, phone, email, hours
- Map placeholder

### 9. **Footer**
- Disclaimer and legal notice
- Footer navigation sections
- Copyright and company information

### 10. **Legal Notices**
- Full legal disclaimer (important for Cameroon regulations)
- Messages (success, error, loading)

## Important: Legal Notice Translation

The legal disclaimer is properly translated across all languages:

### French:
"Ce programme n'est ni une banque, ni une microfinance, ni une coopérative d'épargne et de crédit. Il s'agit d'une vente immobilière à paiement échelonné (crédit-vendeur), conforme au Code Civil camerounais."

### English:
"This program is neither a bank, nor a microfinance institution, nor a savings and credit cooperative. It is an installment land sale (seller credit), compliant with Cameroonian Civil Code."

### Spanish:
"Este programa no es un banco, ni una institución de microfinanzas, ni una cooperativa de ahorros y crédito. Es una venta de tierras a plazos (crédito del vendedor), de conformidad con el Código Civil camerunés."

### Chinese:
"本项目既不是银行、小额信贷机构，也不是储蓄和信用合作社。这是分期付款土地销售（卖方信用），符合喀麦隆民法。"

### German:
"Dieses Programm ist weder eine Bank, noch ein Mikrofinanzinstitut oder eine Spargenossenschaft. Es handelt sich um einen Landverkauf mit Ratenzahlung (Verkäuferdarlehen), der dem kamerunischen Zivilgesetzbuch entspricht."

## Usage Examples

### 1. Adding New Translations

To add a new section to all languages:

1. Edit each JSON file in `locales/` directory
2. Add the new key-value pairs under the appropriate section
3. Update the HTML with `data-i18n` attributes

Example:
```json
{
  "newSection": {
    "title": "New Title",
    "description": "Description..."
  }
}
```

### 2. Using Translations in JavaScript

```javascript
// Get translation
const title = window.i18n.t('hero.title');

// Format currency
const price = window.i18n.formatCurrency(500000);

// Format date
const date = window.i18n.formatDate(new Date());

// Change language
await window.i18n.setLanguage('en');
```

### 3. Handling Dynamic Content

For content generated by JavaScript, use the `t()` function:

```javascript
const message = window.i18n.t('messages.success');
alert(message);
```

## Browser Language Detection

The system automatically detects the user's browser language:

1. Checks localStorage for saved preference
2. Checks browser language code (first 2 characters)
3. Falls back to French if no match found

Supported browser languages:
- `fr-*` → French
- `en-*` → English
- `es-*` → Spanish
- `zh-*` → Chinese
- `de-*` → German

## Keyboard Shortcuts & Accessibility

The language switcher is fully accessible:
- Keyboard navigation (Tab key)
- Screen reader support with `aria-label`
- Semantic HTML buttons
- Clear visual feedback

## Performance Considerations

1. **Lazy Loading**: Translations load only when needed
2. **Caching**: Loaded translations are cached in memory
3. **LocalStorage**: Language preference saved (minimal storage)
4. **No jQuery Required**: Pure vanilla JavaScript

## Common Issues & Solutions

### Issue: Translations not appearing
**Solution**: Check browser console for errors. Ensure:
- `js/site-i18n.js` is loaded before other scripts
- Translation files are in `locales/` directory
- File names match the language codes (site-en.json, etc.)

### Issue: Language not persisting
**Solution**: Check browser localStorage is enabled and not full
```javascript
// Check localStorage
console.log(localStorage.getItem('terrasocial-language'));
```

### Issue: Currency formatting incorrect
**Solution**: Ensure the correct locale is being used
```javascript
console.log(window.i18n.currentLanguage);
```

## Testing the i18n System

### Test Checklist:
- [ ] All 5 languages switch correctly
- [ ] Language preference saves (refresh page)
- [ ] All form labels translate
- [ ] Currency formats correctly in payment simulator
- [ ] Links and buttons work after language switch
- [ ] Mobile menu works in all languages
- [ ] No console errors

### Test with browser:
```javascript
// Test all languages
for (const lang of ['fr', 'en', 'es', 'zh', 'de']) {
    await window.i18n.setLanguage(lang);
    console.log(`Language set to: ${lang}`);
}

// Test translation
console.log(window.i18n.t('hero.title'));

// Test currency formatting
console.log(window.i18n.formatCurrency(1000000));
```

## Future Enhancements

Potential improvements:
1. Add more languages (Arabic, Portuguese, etc.)
2. Right-to-left (RTL) language support
3. Language-specific images or layouts
4. SEO-friendly URL structure for each language (e.g., /en/, /fr/)
5. Server-side language routing
6. Translation management UI for administrators

## Support & Maintenance

### Adding a New Language:

1. **Create translation file**:
   - Copy `locales/site-fr.json` to `locales/site-XX.json`
   - Replace all translations

2. **Update i18n.js**:
   ```javascript
   this.supportedLanguages = {
       'fr': { name: 'Français', flag: '🇫🇷' },
       'en': { name: 'English', flag: '🇬🇧' },
       'es': { name: 'Español', flag: '🇪🇸' },
       'zh': { name: '中文', flag: '🇨🇳' },
       'de': { name: 'Deutsch', flag: '🇩🇪' },
       'xx': { name: 'Language Name', flag: '🏳️' }  // New language
   };
   ```

3. **Add option in HTML**:
   ```html
   <button class="lang-option" data-language="xx">🏳️ Language Name</button>
   ```

## Contact & Questions

For issues or questions about the i18n system, review:
- `js/site-i18n.js` - Core functionality
- `locales/site-*.json` - Translation files
- `index.html` - HTML markup with i18n attributes

---

**Last Updated**: February 2026
**Version**: 1.0
**Status**: Production Ready

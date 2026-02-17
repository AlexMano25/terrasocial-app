/**
 * TERRASOCIAL - Internationalization (i18n) System
 * Supports: French (FR), English (EN), Spanish (ES), Chinese (ZH), German (DE)
 */

class I18nManager {
    constructor() {
        this.supportedLanguages = {
            'fr': { name: 'Français', flag: '🇫🇷' },
            'en': { name: 'English', flag: '🇬🇧' },
            'es': { name: 'Español', flag: '🇪🇸' },
            'zh': { name: '中文', flag: '🇨🇳' },
            'de': { name: 'Deutsch', flag: '🇩🇪' }
        };
        this.translations = {};
        this.currentLanguage = this.getDefaultLanguage();
    }

    /**
     * Get default language based on browser or localStorage
     */
    getDefaultLanguage() {
        // Check localStorage first
        const savedLanguage = localStorage.getItem('terrasocial-language');
        if (savedLanguage && this.supportedLanguages[savedLanguage]) {
            return savedLanguage;
        }

        // Check browser language
        const browserLang = navigator.language.substring(0, 2).toLowerCase();
        if (this.supportedLanguages[browserLang]) {
            return browserLang;
        }

        // Default to French
        return 'fr';
    }

    /**
     * Load translations for a specific language
     */
    async loadTranslations(language) {
        if (this.translations[language]) {
            return this.translations[language];
        }

        try {
            const response = await fetch(`locales/site-${language}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${language} translations`);
            }
            this.translations[language] = await response.json();
            return this.translations[language];
        } catch (error) {
            console.error(`Error loading translations for ${language}:`, error);
            // Fallback to French
            if (language !== 'fr') {
                return this.loadTranslations('fr');
            }
            return {};
        }
    }

    /**
     * Get translation key with nested support (e.g., "hero.title")
     */
    getTranslation(key, defaultValue = key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value || defaultValue;
    }

    /**
     * Translate a key (shorthand for getTranslation)
     */
    t(key, defaultValue = key) {
        return this.getTranslation(key, defaultValue);
    }

    /**
     * Set current language and update page
     */
    async setLanguage(language) {
        if (!this.supportedLanguages[language]) {
            console.warn(`Unsupported language: ${language}`);
            return;
        }

        this.currentLanguage = language;
        localStorage.setItem('terrasocial-language', language);

        // Load translations if not already loaded
        await this.loadTranslations(language);

        // Update page content
        this.updatePageContent();

        // Update HTML lang attribute
        document.documentElement.lang = language;

        // Trigger custom event for other scripts
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language } }));
    }

    /**
     * Update all translatable elements on the page
     */
    updatePageContent() {
        // Update document-level metadata
        const translatedTitle = this.t('meta.title');
        const translatedDescription = this.t('meta.description');
        if (translatedTitle && translatedTitle !== 'meta.title') {
            document.title = translatedTitle;
        }
        if (translatedDescription && translatedDescription !== 'meta.description') {
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.setAttribute('content', translatedDescription);
            }
        }

        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            element.textContent = translation;
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });

        // Update elements that intentionally contain HTML (e.g. line breaks)
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.t(key);
        });

        // Update titles
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });

        // Update aria-label for accessibility
        document.querySelectorAll('[data-i18n-aria]').forEach(element => {
            const key = element.getAttribute('data-i18n-aria');
            element.setAttribute('aria-label', this.t(key));
        });
    }

    /**
     * Format number as currency (FCFA)
     */
    formatCurrency(value, language = this.currentLanguage) {
        const formatOptions = {
            style: 'currency',
            currency: 'XAF',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        };

        const locale = {
            'fr': 'fr-FR',
            'en': 'en-GB',
            'es': 'es-ES',
            'zh': 'zh-CN',
            'de': 'de-DE'
        }[language] || 'fr-FR';

        return new Intl.NumberFormat(locale, formatOptions).format(value);
    }

    /**
     * Format date based on language
     */
    formatDate(date, language = this.currentLanguage) {
        const dateObj = typeof date === 'string' ? new Date(date) : date;

        const locale = {
            'fr': 'fr-FR',
            'en': 'en-GB',
            'es': 'es-ES',
            'zh': 'zh-CN',
            'de': 'de-DE'
        }[language] || 'fr-FR';

        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(dateObj);
    }

    /**
     * Get all supported languages
     */
    getLanguages() {
        return this.supportedLanguages;
    }

    /**
     * Get language info
     */
    getLanguageInfo(language) {
        return this.supportedLanguages[language] || null;
    }
}

// Create global instance
window.i18n = new I18nManager();

/**
 * Initialize i18n on page load
 */
document.addEventListener('DOMContentLoaded', async function() {
    // Load current language translations
    await window.i18n.loadTranslations(window.i18n.currentLanguage);

    // Update page content
    window.i18n.updatePageContent();

    // Set HTML lang attribute
    document.documentElement.lang = window.i18n.currentLanguage;

    // Initialize language switcher if it exists
    const languageSwitcher = document.getElementById('language-switcher');
    if (languageSwitcher) {
        initializeLanguageSwitcher();
    }
});

/**
 * Initialize language switcher dropdown
 */
function initializeLanguageSwitcher() {
    const switcher = document.getElementById('language-switcher');
    const toggle = switcher.querySelector('.lang-toggle');
    const menu = switcher.querySelector('.lang-menu');

    // Toggle menu
    toggle.addEventListener('click', function(e) {
        e.preventDefault();
        menu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!switcher.contains(e.target)) {
            menu.classList.remove('active');
        }
    });

    // Handle language selection
    document.querySelectorAll('.lang-option').forEach(option => {
        option.addEventListener('click', async function(e) {
            e.preventDefault();
            const language = this.getAttribute('data-language');
            await window.i18n.setLanguage(language);
            menu.classList.remove('active');

            // Update active state
            document.querySelectorAll('.lang-option').forEach(opt => {
                opt.classList.remove('active');
            });
            this.classList.add('active');

            // Update toggle button text
            const langInfo = window.i18n.getLanguageInfo(language);
            toggle.textContent = `${langInfo.flag} ${language.toUpperCase()}`;
        });
    });

    // Set initial active state
    const currentLang = window.i18n.currentLanguage;
    document.querySelector(`.lang-option[data-language="${currentLang}"]`)?.classList.add('active');
    const langInfo = window.i18n.getLanguageInfo(currentLang);
    toggle.textContent = `${langInfo.flag} ${currentLang.toUpperCase()}`;
}

/**
 * Expose i18n methods globally for use in HTML and other scripts
 */
window.changeLanguage = async function(language) {
    await window.i18n.setLanguage(language);
};

window.translate = function(key, defaultValue) {
    return window.i18n.t(key, defaultValue);
};

window.formatCurrency = function(value) {
    return window.i18n.formatCurrency(value);
};

/**
 * TERRASOCIAL - Configuration
 * Variables d'environnement et paramètres
 */
const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://tbwbzbedlghodzlhtjbo.supabase.co',
  SUPABASE_ANON_KEY: '', // À configurer dans Vercel

  // Application
  APP_NAME: 'TERRASOCIAL',
  APP_VERSION: '1.0.0',
  COMPANY_NAME: 'MANO VERDE INC SA',
  
  // Payment Settings
  MIN_DAILY_PAYMENT: 1500,
  DEPOSIT_PERCENT: 0.10,
  COMMISSION_RATE: 0.05,
  FLYER_RATE: 5,
  
  // Durations
  MIN_DURATION_MONTHS: 24,
  MAX_DURATION_MONTHS: 36,
  JOUISSANCE_ELIGIBLE_MONTHS: 12,
  
  // Contact
  PHONE: '+237 6XX XX XX XX',
  EMAIL: 'contact@terrasocial.cm',
  ADDRESS: 'Yaoundé, Cameroun',
  
  // Legal
  LEGAL_DISCLAIMER: "Ce programme n'est ni une banque, ni une microfinance, ni une coopérative d'épargne et de crédit. Il s'agit d'une vente immobilière à paiement échelonné (crédit-vendeur), conforme au Code Civil camerounais.",
  
  // API Endpoints (Google Apps Script)
  GAS_WEB_APP_URL: '', // À configurer après déploiement GAS
  
  // Feature Flags
  FEATURES: {
    OFFLINE_MODE: true,
    PUSH_NOTIFICATIONS: true,
    FLYER_CAMPAIGNS: true,
    JOUISSANCE_ANTICIPEE: true
  }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.FEATURES);

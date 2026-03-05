/**
 * TERRASOCIAL - Système d'Internationalisation (i18n)
 * Langues supportées: FR, EN, ES, ZH, DE
 */
const I18N = {
  currentLang: 'fr',
  supportedLangs: ['fr', 'en', 'es', 'zh', 'de'],
  
  translations: {
    fr: {
      nav: { home: 'Accueil', properties: 'Terrains', offers: 'Nos Offres', about: 'À Propos', contact: 'Contact', login: 'Connexion', register: 'Inscription', logout: 'Déconnexion', dashboard: 'Tableau de Bord', profile: 'Mon Profil', settings: 'Paramètres', help: 'Aide', language: 'Langue' },
      auth: { signIn: 'Connexion', signUp: 'Inscription', email: 'Adresse email', password: 'Mot de passe', confirmPassword: 'Confirmer', fullName: 'Nom complet', phone: 'Téléphone', forgotPassword: 'Mot de passe oublié ?', rememberMe: 'Se souvenir', noAccount: 'Pas de compte ?', createAccount: 'Créer un compte', loginButton: 'Se connecter', registerButton: "S'inscrire" },
      client: { welcome: 'Bienvenue', mySubscriptions: 'Mes Souscriptions', myPayments: 'Mes Paiements', myDocuments: 'Mes Documents', makePayment: 'Effectuer un Paiement', uploadProof: 'Envoyer Preuve', viewContract: 'Voir Contrat', nextPayment: 'Prochain Paiement', totalPaid: 'Total Payé', remaining: 'Reste à Payer', progress: 'Progression', jouissanceEligible: 'Éligible Jouissance Anticipée' },
      agent: { myProspects: 'Mes Prospects', myClients: 'Mes Clients', myCommissions: 'Mes Commissions', addProspect: 'Ajouter Prospect', createSubscription: 'Créer Souscription', performance: 'Performance', totalEarned: 'Total Gagné', pendingCommission: 'Commission en Attente' },
      admin: { overview: 'Vue Ensemble', properties: 'Terrains', lots: 'Lots', clients: 'Clients', agents: 'Agents', subscriptions: 'Souscriptions', payments: 'Paiements', commissions: 'Commissions', users: 'Utilisateurs', reports: 'Rapports', settings: 'Paramètres', validatePayment: 'Valider', rejectPayment: 'Rejeter' },
      property: { available: 'Disponible', reserved: 'Réservé', sold: 'Vendu', location: 'Localisation', area: 'Superficie', pricePerSqm: 'Prix/m²', totalPrice: 'Prix Total', lotNumber: 'N° Lot', viewDetails: 'Voir Détails', reserve: 'Réserver', subscribe: 'Souscrire' },
      payment: { amount: 'Montant', date: 'Date', method: 'Méthode', reference: 'Référence', proof: 'Preuve', status: 'Statut', orangeMoney: 'Orange Money', mtnMomo: 'MTN MoMo', bankTransfer: 'Virement', cash: 'Espèces', validated: 'Validé', pending: 'En Attente', rejected: 'Rejeté', dailyPayment: 'Paiement Journalier', deposit: 'Acompte' },
      form: { submit: 'Soumettre', cancel: 'Annuler', save: 'Enregistrer', edit: 'Modifier', delete: 'Supprimer', search: 'Rechercher', filter: 'Filtrer', download: 'Télécharger', upload: 'Téléverser', confirm: 'Confirmer', back: 'Retour', next: 'Suivant' },
      messages: { success: 'Opération réussie', error: 'Erreur survenue', loading: 'Chargement...', noData: 'Aucune donnée', confirmDelete: 'Confirmer suppression ?', saved: 'Enregistré', offline: 'Hors ligne', online: 'En ligne' },
      legal: { disclaimer: "Ce programme n'est ni une banque, ni une microfinance. Vente immobilière à paiement échelonné conforme au Code Civil camerounais.", cgv: 'CGV', privacy: 'Confidentialité' },
      help: { title: "Centre d'Aide", search: 'Rechercher...', faq: 'FAQ', guides: 'Guides', contact: 'Support', tutorials: 'Tutoriels' }
    },
    en: {
      nav: { home: 'Home', properties: 'Properties', offers: 'Our Offers', about: 'About', contact: 'Contact', login: 'Login', register: 'Register', logout: 'Logout', dashboard: 'Dashboard', profile: 'Profile', settings: 'Settings', help: 'Help', language: 'Language' },
      auth: { signIn: 'Sign In', signUp: 'Sign Up', email: 'Email', password: 'Password', confirmPassword: 'Confirm', fullName: 'Full Name', phone: 'Phone', forgotPassword: 'Forgot Password?', rememberMe: 'Remember Me', noAccount: 'No Account?', createAccount: 'Create Account', loginButton: 'Sign In', registerButton: 'Sign Up' },
      client: { welcome: 'Welcome', mySubscriptions: 'My Subscriptions', myPayments: 'My Payments', myDocuments: 'My Documents', makePayment: 'Make Payment', uploadProof: 'Upload Proof', viewContract: 'View Contract', nextPayment: 'Next Payment', totalPaid: 'Total Paid', remaining: 'Remaining', progress: 'Progress', jouissanceEligible: 'Early Possession Eligible' },
      agent: { myProspects: 'My Prospects', myClients: 'My Clients', myCommissions: 'My Commissions', addProspect: 'Add Prospect', createSubscription: 'Create Subscription', performance: 'Performance', totalEarned: 'Total Earned', pendingCommission: 'Pending Commission' },
      admin: { overview: 'Overview', properties: 'Properties', lots: 'Lots', clients: 'Clients', agents: 'Agents', subscriptions: 'Subscriptions', payments: 'Payments', commissions: 'Commissions', users: 'Users', reports: 'Reports', settings: 'Settings', validatePayment: 'Validate', rejectPayment: 'Reject' },
      property: { available: 'Available', reserved: 'Reserved', sold: 'Sold', location: 'Location', area: 'Area', pricePerSqm: 'Price/sqm', totalPrice: 'Total Price', lotNumber: 'Lot #', viewDetails: 'View Details', reserve: 'Reserve', subscribe: 'Subscribe' },
      payment: { amount: 'Amount', date: 'Date', method: 'Method', reference: 'Reference', proof: 'Proof', status: 'Status', orangeMoney: 'Orange Money', mtnMomo: 'MTN MoMo', bankTransfer: 'Bank Transfer', cash: 'Cash', validated: 'Validated', pending: 'Pending', rejected: 'Rejected', dailyPayment: 'Daily Payment', deposit: 'Deposit' },
      form: { submit: 'Submit', cancel: 'Cancel', save: 'Save', edit: 'Edit', delete: 'Delete', search: 'Search', filter: 'Filter', download: 'Download', upload: 'Upload', confirm: 'Confirm', back: 'Back', next: 'Next' },
      messages: { success: 'Success', error: 'Error occurred', loading: 'Loading...', noData: 'No data', confirmDelete: 'Confirm delete?', saved: 'Saved', offline: 'Offline', online: 'Online' },
      legal: { disclaimer: 'This is not a bank or microfinance. Real estate sale with staggered payments under Cameroonian Civil Code.', cgv: 'Terms', privacy: 'Privacy' },
      help: { title: 'Help Center', search: 'Search...', faq: 'FAQ', guides: 'Guides', contact: 'Support', tutorials: 'Tutorials' }
    },
    es: {
      nav: { home: 'Inicio', properties: 'Propiedades', offers: 'Ofertas', about: 'Nosotros', contact: 'Contacto', login: 'Iniciar', register: 'Registro', logout: 'Salir', dashboard: 'Panel', profile: 'Perfil', settings: 'Ajustes', help: 'Ayuda', language: 'Idioma' },
      auth: { signIn: 'Iniciar Sesión', signUp: 'Registrarse', email: 'Correo', password: 'Contraseña', confirmPassword: 'Confirmar', fullName: 'Nombre', phone: 'Teléfono', forgotPassword: '¿Olvidó?', rememberMe: 'Recordar', noAccount: '¿Sin cuenta?', createAccount: 'Crear Cuenta', loginButton: 'Entrar', registerButton: 'Registrar' },
      client: { welcome: 'Bienvenido', mySubscriptions: 'Mis Suscripciones', myPayments: 'Mis Pagos', myDocuments: 'Mis Documentos', makePayment: 'Pagar', uploadProof: 'Subir Comprobante', viewContract: 'Ver Contrato', nextPayment: 'Próximo Pago', totalPaid: 'Total Pagado', remaining: 'Pendiente', progress: 'Progreso', jouissanceEligible: 'Elegible Posesión' },
      agent: { myProspects: 'Mis Prospectos', myClients: 'Mis Clientes', myCommissions: 'Mis Comisiones', addProspect: 'Agregar', createSubscription: 'Crear', performance: 'Rendimiento', totalEarned: 'Total Ganado', pendingCommission: 'Comisión Pendiente' },
      admin: { overview: 'General', properties: 'Propiedades', lots: 'Lotes', clients: 'Clientes', agents: 'Agentes', subscriptions: 'Suscripciones', payments: 'Pagos', commissions: 'Comisiones', users: 'Usuarios', reports: 'Informes', settings: 'Ajustes', validatePayment: 'Validar', rejectPayment: 'Rechazar' },
      property: { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido', location: 'Ubicación', area: 'Área', pricePerSqm: 'Precio/m²', totalPrice: 'Precio Total', lotNumber: 'Lote #', viewDetails: 'Ver Detalles', reserve: 'Reservar', subscribe: 'Suscribir' },
      payment: { amount: 'Monto', date: 'Fecha', method: 'Método', reference: 'Referencia', proof: 'Comprobante', status: 'Estado', orangeMoney: 'Orange Money', mtnMomo: 'MTN MoMo', bankTransfer: 'Transferencia', cash: 'Efectivo', validated: 'Validado', pending: 'Pendiente', rejected: 'Rechazado', dailyPayment: 'Pago Diario', deposit: 'Depósito' },
      form: { submit: 'Enviar', cancel: 'Cancelar', save: 'Guardar', edit: 'Editar', delete: 'Eliminar', search: 'Buscar', filter: 'Filtrar', download: 'Descargar', upload: 'Subir', confirm: 'Confirmar', back: 'Atrás', next: 'Siguiente' },
      messages: { success: 'Éxito', error: 'Error', loading: 'Cargando...', noData: 'Sin datos', confirmDelete: '¿Eliminar?', saved: 'Guardado', offline: 'Sin conexión', online: 'Conectado' },
      legal: { disclaimer: 'No es banco ni microfinanciera. Venta inmobiliaria con pagos escalonados según Código Civil camerunés.', cgv: 'Términos', privacy: 'Privacidad' },
      help: { title: 'Ayuda', search: 'Buscar...', faq: 'FAQ', guides: 'Guías', contact: 'Soporte', tutorials: 'Tutoriales' }
    },
    zh: {
      nav: { home: '首页', properties: '房产', offers: '优惠', about: '关于', contact: '联系', login: '登录', register: '注册', logout: '退出', dashboard: '面板', profile: '资料', settings: '设置', help: '帮助', language: '语言' },
      auth: { signIn: '登录', signUp: '注册', email: '邮箱', password: '密码', confirmPassword: '确认', fullName: '姓名', phone: '电话', forgotPassword: '忘记密码?', rememberMe: '记住', noAccount: '没有账户?', createAccount: '创建账户', loginButton: '登录', registerButton: '注册' },
      client: { welcome: '欢迎', mySubscriptions: '我的订阅', myPayments: '我的付款', myDocuments: '我的文档', makePayment: '付款', uploadProof: '上传凭证', viewContract: '查看合同', nextPayment: '下次付款', totalPaid: '已付', remaining: '剩余', progress: '进度', jouissanceEligible: '提前占有' },
      agent: { myProspects: '潜在客户', myClients: '客户', myCommissions: '佣金', addProspect: '添加', createSubscription: '创建', performance: '业绩', totalEarned: '总收入', pendingCommission: '待付佣金' },
      admin: { overview: '概览', properties: '房产', lots: '地块', clients: '客户', agents: '代理', subscriptions: '订阅', payments: '付款', commissions: '佣金', users: '用户', reports: '报告', settings: '设置', validatePayment: '验证', rejectPayment: '拒绝' },
      property: { available: '可用', reserved: '预订', sold: '已售', location: '位置', area: '面积', pricePerSqm: '每平米', totalPrice: '总价', lotNumber: '编号', viewDetails: '详情', reserve: '预订', subscribe: '订阅' },
      payment: { amount: '金额', date: '日期', method: '方式', reference: '参考', proof: '凭证', status: '状态', orangeMoney: 'Orange Money', mtnMomo: 'MTN MoMo', bankTransfer: '银行转账', cash: '现金', validated: '已验证', pending: '待处理', rejected: '已拒绝', dailyPayment: '每日付款', deposit: '押金' },
      form: { submit: '提交', cancel: '取消', save: '保存', edit: '编辑', delete: '删除', search: '搜索', filter: '筛选', download: '下载', upload: '上传', confirm: '确认', back: '返回', next: '下一步' },
      messages: { success: '成功', error: '错误', loading: '加载中...', noData: '无数据', confirmDelete: '确认删除?', saved: '已保存', offline: '离线', online: '在线' },
      legal: { disclaimer: '非银行或小额信贷。符合喀麦隆民法的分期付款房地产销售。', cgv: '条款', privacy: '隐私' },
      help: { title: '帮助', search: '搜索...', faq: '常见问题', guides: '指南', contact: '支持', tutorials: '教程' }
    },
    de: {
      nav: { home: 'Startseite', properties: 'Immobilien', offers: 'Angebote', about: 'Über Uns', contact: 'Kontakt', login: 'Anmelden', register: 'Registrieren', logout: 'Abmelden', dashboard: 'Dashboard', profile: 'Profil', settings: 'Einstellungen', help: 'Hilfe', language: 'Sprache' },
      auth: { signIn: 'Anmelden', signUp: 'Registrieren', email: 'E-Mail', password: 'Passwort', confirmPassword: 'Bestätigen', fullName: 'Name', phone: 'Telefon', forgotPassword: 'Vergessen?', rememberMe: 'Merken', noAccount: 'Kein Konto?', createAccount: 'Konto erstellen', loginButton: 'Anmelden', registerButton: 'Registrieren' },
      client: { welcome: 'Willkommen', mySubscriptions: 'Meine Abos', myPayments: 'Meine Zahlungen', myDocuments: 'Meine Dokumente', makePayment: 'Zahlen', uploadProof: 'Nachweis', viewContract: 'Vertrag', nextPayment: 'Nächste Zahlung', totalPaid: 'Bezahlt', remaining: 'Ausstehend', progress: 'Fortschritt', jouissanceEligible: 'Vorzeitiger Besitz' },
      agent: { myProspects: 'Interessenten', myClients: 'Kunden', myCommissions: 'Provisionen', addProspect: 'Hinzufügen', createSubscription: 'Erstellen', performance: 'Leistung', totalEarned: 'Verdient', pendingCommission: 'Ausstehend' },
      admin: { overview: 'Übersicht', properties: 'Immobilien', lots: 'Grundstücke', clients: 'Kunden', agents: 'Agenten', subscriptions: 'Abos', payments: 'Zahlungen', commissions: 'Provisionen', users: 'Benutzer', reports: 'Berichte', settings: 'Einstellungen', validatePayment: 'Validieren', rejectPayment: 'Ablehnen' },
      property: { available: 'Verfügbar', reserved: 'Reserviert', sold: 'Verkauft', location: 'Standort', area: 'Fläche', pricePerSqm: 'Preis/m²', totalPrice: 'Gesamtpreis', lotNumber: 'Nr.', viewDetails: 'Details', reserve: 'Reservieren', subscribe: 'Abonnieren' },
      payment: { amount: 'Betrag', date: 'Datum', method: 'Methode', reference: 'Referenz', proof: 'Nachweis', status: 'Status', orangeMoney: 'Orange Money', mtnMomo: 'MTN MoMo', bankTransfer: 'Überweisung', cash: 'Bargeld', validated: 'Validiert', pending: 'Ausstehend', rejected: 'Abgelehnt', dailyPayment: 'Täglich', deposit: 'Anzahlung' },
      form: { submit: 'Absenden', cancel: 'Abbrechen', save: 'Speichern', edit: 'Bearbeiten', delete: 'Löschen', search: 'Suchen', filter: 'Filtern', download: 'Download', upload: 'Hochladen', confirm: 'Bestätigen', back: 'Zurück', next: 'Weiter' },
      messages: { success: 'Erfolg', error: 'Fehler', loading: 'Laden...', noData: 'Keine Daten', confirmDelete: 'Löschen?', saved: 'Gespeichert', offline: 'Offline', online: 'Online' },
      legal: { disclaimer: 'Keine Bank oder Mikrofinanz. Immobilienverkauf mit Ratenzahlung nach kamerunischem Zivilrecht.', cgv: 'AGB', privacy: 'Datenschutz' },
      help: { title: 'Hilfe', search: 'Suchen...', faq: 'FAQ', guides: 'Anleitungen', contact: 'Support', tutorials: 'Tutorials' }
    }
  },

  init() {
    const saved = localStorage.getItem('terrasocial_lang');
    if (saved && this.supportedLangs.includes(saved)) this.currentLang = saved;
    else {
      const browser = navigator.language.split('-')[0];
      if (this.supportedLangs.includes(browser)) this.currentLang = browser;
    }
    document.documentElement.lang = this.currentLang;
    this.translatePage();
  },

  setLanguage(lang) {
    if (!this.supportedLangs.includes(lang)) return false;
    this.currentLang = lang;
    localStorage.setItem('terrasocial_lang', lang);
    document.documentElement.lang = lang;
    this.translatePage();
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    return true;
  },

  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];
    for (const k of keys) {
      if (value && value[k] !== undefined) value = value[k];
      else {
        value = this.translations['fr'];
        for (const k2 of keys) value = value && value[k2] !== undefined ? value[k2] : key;
        break;
      }
    }
    if (typeof value === 'string') {
      for (const [pk, pv] of Object.entries(params)) value = value.replace(new RegExp(`{{${pk}}}`, 'g'), pv);
    }
    return value;
  },

  translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = this.t(key);
      else el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = this.t(el.getAttribute('data-i18n-placeholder')));
  },

  getLanguageName(code) {
    return { fr: 'Français', en: 'English', es: 'Español', zh: '中文', de: 'Deutsch' }[code] || code;
  },

  getFlag(lang) {
    return { fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸', zh: '🇨🇳', de: '🇩🇪' }[lang] || '🌐';
  }
};

document.addEventListener('DOMContentLoaded', () => I18N.init());

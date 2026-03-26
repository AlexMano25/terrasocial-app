/**
 * TERRASOCIAL Chatbot Widget
 * WhatsApp-style floating chat assistant
 * Self-contained: injects its own HTML, CSS, and logic
 */
(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────
  const CHAT_HISTORY_KEY = 'ts_chat_history';
  const USER_KEY = 'ts_user';
  const API_ENDPOINT = '/api/chat';
  const MAX_HISTORY = 50;

  // ─── Utilities ──────────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function generateId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  // ─── Context Detection ─────────────────────────────────────────────
  function detectContext() {
    var path = window.location.pathname;
    var user = null;
    try {
      user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
      user = null;
    }
    return {
      page: path,
      isLoggedIn: !!user,
      role: (user && user.role) ? user.role : 'visitor',
      userName: (user && user.full_name) ? user.full_name : null,
      userId: (user && user.id) ? user.id : null,
      is_agent: (user && user.is_agent) || false,
      is_insurer: (user && user.is_insurer) || false,
      is_legal: (user && user.is_legal) || false
    };
  }

  function getWelcomeMessage(ctx) {
    var name = ctx.userName || '';

    // Logged-in users
    if (ctx.isLoggedIn) {
      if (ctx.is_legal) {
        return 'Maitre ' + escapeHtml(name) + ', comment puis-je vous assister aujourd\'hui?';
      }
      if (ctx.is_insurer) {
        return 'Bonjour! Je suis disponible pour toute question sur les souscriptions d\'assurance.';
      }
      if (ctx.is_agent) {
        return 'Bonjour ' + escapeHtml(name) + '! Comment puis-je vous aider avec vos prospects?';
      }
      if (ctx.role === 'owner') {
        return 'Bonjour ' + escapeHtml(name) + '! Votre espace proprietaire est a jour. Besoin d\'aide?';
      }
      // Default logged-in client
      return 'Bonjour ' + escapeHtml(name) + '! Je suis la pour vous guider. Besoin d\'aide avec votre souscription?';
    }

    // Visitors by page
    var page = ctx.page.toLowerCase();
    if (page.indexOf('devenir-agent') !== -1) {
      return 'Vous souhaitez devenir agent partenaire? Je peux vous expliquer comment gagner des commissions!';
    }
    if (page.indexOf('lots') !== -1 || page.indexOf('terrains') !== -1) {
      return 'Bienvenue! Vous consultez nos lots disponibles. Souhaitez-vous en savoir plus sur un terrain en particulier?';
    }
    if (page.indexOf('assurance') !== -1) {
      return 'Bienvenue! Vous avez des questions sur nos formules d\'assurance fonciere?';
    }
    // Default / index
    return 'Bienvenue sur TERRASOCIAL! Je suis votre assistant. Comment puis-je vous aider a devenir proprietaire?';
  }

  function getQuickActions(ctx) {
    if (ctx.isLoggedIn && ctx.is_agent) {
      return [
        { label: 'Mes prospects', value: 'Voir mes prospects' },
        { label: 'Mes commissions', value: 'Voir mes commissions' },
        { label: 'Aide', value: 'J\'ai besoin d\'aide' }
      ];
    }
    if (ctx.isLoggedIn) {
      return [
        { label: 'Mon dossier', value: 'Voir mon dossier' },
        { label: 'Mes paiements', value: 'Voir mes paiements' },
        { label: 'Parler a un conseiller', value: 'Je souhaite parler a un conseiller' }
      ];
    }
    return [
      { label: 'Voir les lots', value: 'Je veux voir les lots disponibles' },
      { label: 'Comment ca marche', value: 'Comment fonctionne TERRASOCIAL?' },
      { label: 'Devenir agent', value: 'Comment devenir agent partenaire?' },
      { label: 'Parler a un conseiller', value: 'Je souhaite parler a un conseiller' }
    ];
  }

  // ─── Sound ──────────────────────────────────────────────────────────
  function playNotificationSound() {
    try {
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio not available
    }
  }

  // ─── CSS Injection ──────────────────────────────────────────────────
  function injectStyles() {
    var css = `
      /* ── Reset scoped to widget ── */
      #ts-chatbot-widget, #ts-chatbot-widget * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      /* ── Floating bubble ── */
      .ts-chat-bubble {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #25D366;
        border: none;
        z-index: 999999 !important;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .ts-chat-bubble:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
      }
      .ts-chat-bubble svg {
        width: 30px;
        height: 30px;
        fill: #fff;
      }

      /* ── Unread badge ── */
      .ts-chat-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #E53935;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        line-height: 20px;
        text-align: center;
      }
      .ts-chat-badge.ts-visible {
        display: flex;
      }

      /* ── Chat window ── */
      .ts-chat-window {
        position: fixed;
        bottom: 96px;
        right: 24px;
        width: 400px;
        height: 540px;
        border-radius: 16px;
        background: #ECE5DD;
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: 99998;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      .ts-chat-window.ts-open {
        display: flex;
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      /* ── Header ── */
      .ts-chat-header {
        background: #1B5E20;
        color: #fff;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      .ts-chat-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #2E7D32;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .ts-chat-avatar svg {
        width: 22px;
        height: 22px;
        fill: #fff;
      }
      .ts-chat-header-info {
        flex: 1;
        min-width: 0;
      }
      .ts-chat-header-name {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
      }
      .ts-chat-header-status {
        font-size: 12px;
        opacity: 0.85;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .ts-chat-header-status::before {
        content: '';
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #69F0AE;
        display: inline-block;
      }
      .ts-chat-close {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }
      .ts-chat-close:hover {
        background: rgba(255,255,255,0.15);
      }
      .ts-chat-close svg {
        width: 20px;
        height: 20px;
        fill: #fff;
      }

      /* ── Messages area ── */
      .ts-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: #ECE5DD url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cdc4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      }
      .ts-chat-messages::-webkit-scrollbar {
        width: 5px;
      }
      .ts-chat-messages::-webkit-scrollbar-thumb {
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
      }

      /* ── Message bubbles ── */
      .ts-msg {
        max-width: 88%;
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 14px;
        line-height: 1.5;
        position: relative;
        word-wrap: break-word;
        white-space: pre-line;
        animation: ts-fadeIn 0.2s ease;
      }
      @keyframes ts-fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .ts-msg-bot {
        background: #fff;
        color: #303030;
        align-self: flex-start;
        border-top-left-radius: 2px;
        box-shadow: 0 1px 1px rgba(0,0,0,0.08);
      }
      .ts-msg-user {
        background: #DCF8C6;
        color: #303030;
        align-self: flex-end;
        border-top-right-radius: 2px;
        box-shadow: 0 1px 1px rgba(0,0,0,0.08);
      }
      .ts-msg-time {
        font-size: 10px;
        color: #999;
        margin-top: 3px;
        text-align: right;
      }
      .ts-msg-user .ts-msg-time {
        color: #7da76a;
      }

      /* ── Typing indicator ── */
      .ts-typing {
        display: none;
        align-self: flex-start;
        background: #fff;
        padding: 10px 16px;
        border-radius: 8px;
        border-top-left-radius: 2px;
        box-shadow: 0 1px 1px rgba(0,0,0,0.08);
        gap: 4px;
        align-items: center;
      }
      .ts-typing.ts-visible {
        display: flex;
      }
      .ts-typing-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #90A4AE;
        animation: ts-bounce 1.2s infinite ease-in-out;
      }
      .ts-typing-dot:nth-child(2) { animation-delay: 0.15s; }
      .ts-typing-dot:nth-child(3) { animation-delay: 0.3s; }
      @keyframes ts-bounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-5px); opacity: 1; }
      }

      /* ── Quick actions ── */
      .ts-quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 4px 0 8px;
        align-self: flex-start;
        max-width: 100%;
      }
      .ts-quick-btn {
        background: #fff;
        border: 1px solid #25D366;
        color: #1B5E20;
        padding: 6px 14px;
        border-radius: 18px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      }
      .ts-quick-btn:hover {
        background: #25D366;
        color: #fff;
      }

      /* ── Input area ── */
      .ts-chat-input-area {
        padding: 10px 12px;
        background: #f0f0f0;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        border-top: 1px solid #ddd;
      }
      .ts-chat-input {
        flex: 1;
        border: none;
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 14px;
        background: #fff;
        outline: none;
        min-width: 0;
      }
      .ts-chat-input::placeholder {
        color: #999;
      }
      .ts-chat-send,
      .ts-chat-mic {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s;
      }
      .ts-chat-send {
        background: #25D366;
      }
      .ts-chat-send:hover {
        background: #1DA851;
      }
      .ts-chat-send svg {
        width: 20px;
        height: 20px;
        fill: #fff;
      }
      .ts-chat-mic {
        background: transparent;
      }
      .ts-chat-mic:hover {
        background: rgba(0,0,0,0.06);
      }
      .ts-chat-mic svg {
        width: 22px;
        height: 22px;
        fill: #555;
      }
      .ts-chat-mic.ts-recording {
        background: #E53935;
      }
      .ts-chat-mic.ts-recording svg {
        fill: #fff;
      }

      /* ── Mobile responsive ── */
      @media (max-width: 768px) {
        .ts-chat-window {
          bottom: 0;
          right: 0;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
        }
        .ts-chat-bubble {
          bottom: 90px;
          right: 16px;
          width: 56px;
          height: 56px;
          z-index: 999999 !important;
        }
        .ts-chat-bubble svg {
          width: 26px;
          height: 26px;
        }
      }
    `;

    var style = document.createElement('style');
    style.id = 'ts-chatbot-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── DOM Creation ───────────────────────────────────────────────────
  function createWidget() {
    var container = document.createElement('div');
    container.id = 'ts-chatbot-widget';

    // SVG icons
    var chatIcon = '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
    var closeIcon = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    var sendIcon = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    var micIcon = '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
    var botAvatarIcon = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z"/></svg>';

    container.innerHTML =
      /* Floating bubble */
      '<button class="ts-chat-bubble" aria-label="Ouvrir le chat">' +
        chatIcon +
        '<span class="ts-chat-badge">0</span>' +
      '</button>' +
      /* Chat window */
      '<div class="ts-chat-window">' +
        /* Header */
        '<div class="ts-chat-header">' +
          '<div class="ts-chat-avatar">' + botAvatarIcon + '</div>' +
          '<div class="ts-chat-header-info">' +
            '<div class="ts-chat-header-name">Assistant TERRASOCIAL</div>' +
            '<div class="ts-chat-header-status">En ligne</div>' +
          '</div>' +
          '<button class="ts-chat-close" aria-label="Fermer">' + closeIcon + '</button>' +
        '</div>' +
        /* Messages */
        '<div class="ts-chat-messages">' +
          '<div class="ts-typing">' +
            '<span class="ts-typing-dot"></span>' +
            '<span class="ts-typing-dot"></span>' +
            '<span class="ts-typing-dot"></span>' +
          '</div>' +
        '</div>' +
        /* Input */
        '<div class="ts-chat-input-area">' +
          '<input class="ts-chat-input" type="text" placeholder="Tapez votre message..." autocomplete="off" />' +
          '<button class="ts-chat-mic" aria-label="Message vocal">' + micIcon + '</button>' +
          '<button class="ts-chat-send" aria-label="Envoyer">' + sendIcon + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(container);

    return {
      container: container,
      bubble: container.querySelector('.ts-chat-bubble'),
      badge: container.querySelector('.ts-chat-badge'),
      window: container.querySelector('.ts-chat-window'),
      closeBtn: container.querySelector('.ts-chat-close'),
      messages: container.querySelector('.ts-chat-messages'),
      typing: container.querySelector('.ts-typing'),
      input: container.querySelector('.ts-chat-input'),
      sendBtn: container.querySelector('.ts-chat-send'),
      micBtn: container.querySelector('.ts-chat-mic')
    };
  }

  // ─── Chat Engine ────────────────────────────────────────────────────
  function ChatBot(els) {
    this.els = els;
    this.isOpen = false;
    this.unreadCount = 0;
    this.history = [];
    this.context = detectContext();
    this.isRecording = false;
    this.recognition = null;
    this.isSending = false;

    this.loadHistory();
    this.bindEvents();
    this.initVoice();
    this.renderInitialMessages();
  }

  // History persistence
  ChatBot.prototype.loadHistory = function () {
    try {
      var raw = localStorage.getItem(CHAT_HISTORY_KEY);
      this.history = raw ? JSON.parse(raw) : [];
    } catch (e) {
      this.history = [];
    }
  };

  ChatBot.prototype.saveHistory = function () {
    try {
      var toSave = this.history.slice(-MAX_HISTORY);
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
    } catch (e) {
      // Storage full or unavailable
    }
  };

  // Render existing history or welcome message
  ChatBot.prototype.renderInitialMessages = function () {
    if (this.history.length > 0) {
      for (var i = 0; i < this.history.length; i++) {
        this.renderMessage(this.history[i], true);
      }
    } else {
      // First time: welcome message + quick actions
      var welcomeMsg = {
        id: generateId(),
        role: 'bot',
        text: getWelcomeMessage(this.context),
        time: new Date().toISOString()
      };
      this.history.push(welcomeMsg);
      this.renderMessage(welcomeMsg, true);
      this.renderQuickActions();
      this.saveHistory();
    }
    this.scrollToBottom();
  };

  // Simple markdown: **bold**, [text](url)
  function formatBotText(text) {
    var safe = escapeHtml(text);
    // Bold: **text** → <strong>text</strong>
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Links: [text](url) → <a href="url">text</a>
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" style="color:#1B5E20;text-decoration:underline;">$1</a>');
    return safe;
  }

  // Render a single message bubble
  ChatBot.prototype.renderMessage = function (msg, skipScroll) {
    var div = document.createElement('div');
    div.className = 'ts-msg ' + (msg.role === 'user' ? 'ts-msg-user' : 'ts-msg-bot');
    var textHtml = msg.role === 'user' ? escapeHtml(msg.text) : formatBotText(msg.text);
    div.innerHTML =
      '<div class="ts-msg-text">' + textHtml + '</div>' +
      '<div class="ts-msg-time">' + formatTime(msg.time) + '</div>';

    // Insert before typing indicator
    this.els.messages.insertBefore(div, this.els.typing);
    if (!skipScroll) {
      this.scrollToBottom();
    }
  };

  // Quick action buttons
  ChatBot.prototype.renderQuickActions = function () {
    var self = this;
    var actions = getQuickActions(this.context);
    var wrapper = document.createElement('div');
    wrapper.className = 'ts-quick-actions';

    actions.forEach(function (action) {
      var btn = document.createElement('button');
      btn.className = 'ts-quick-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', function () {
        // Remove all quick action bars when one is clicked
        var qas = self.els.messages.querySelectorAll('.ts-quick-actions');
        for (var i = 0; i < qas.length; i++) {
          qas[i].remove();
        }
        self.sendMessage(action.value);
      });
      wrapper.appendChild(btn);
    });

    this.els.messages.insertBefore(wrapper, this.els.typing);
    this.scrollToBottom();
  };

  // Typing indicator
  ChatBot.prototype.showTyping = function () {
    this.els.typing.classList.add('ts-visible');
    this.scrollToBottom();
  };

  ChatBot.prototype.hideTyping = function () {
    this.els.typing.classList.remove('ts-visible');
  };

  // Scroll to bottom of messages
  ChatBot.prototype.scrollToBottom = function () {
    var msgs = this.els.messages;
    requestAnimationFrame(function () {
      msgs.scrollTop = msgs.scrollHeight;
    });
  };

  // Badge management
  ChatBot.prototype.incrementBadge = function () {
    if (!this.isOpen) {
      this.unreadCount++;
      this.els.badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      this.els.badge.classList.add('ts-visible');
    }
  };

  ChatBot.prototype.clearBadge = function () {
    this.unreadCount = 0;
    this.els.badge.classList.remove('ts-visible');
  };

  // Toggle chat window
  ChatBot.prototype.toggle = function () {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.els.window.style.display = 'flex';
      // Force reflow then animate
      void this.els.window.offsetHeight;
      this.els.window.classList.add('ts-open');
      this.clearBadge();
      this.els.input.focus();
      this.scrollToBottom();
    } else {
      this.close();
    }
  };

  ChatBot.prototype.close = function () {
    var self = this;
    this.isOpen = false;
    this.els.window.classList.remove('ts-open');
    setTimeout(function () {
      if (!self.isOpen) {
        self.els.window.style.display = 'none';
      }
    }, 250);
  };

  // Send a user message
  ChatBot.prototype.sendMessage = function (text) {
    if (!text || !text.trim() || this.isSending) return;

    text = text.trim();
    var userMsg = {
      id: generateId(),
      role: 'user',
      text: text,
      time: new Date().toISOString()
    };

    this.history.push(userMsg);
    this.renderMessage(userMsg);
    this.saveHistory();
    this.els.input.value = '';

    this.callAPI(text);
  };

  // Call backend API
  ChatBot.prototype.callAPI = function (message) {
    var self = this;
    this.isSending = true;
    this.showTyping();

    // Refresh context for every request
    this.context = detectContext();

    var payload = {
      message: message,
      context: this.context,
      history: this.history.slice(-10).map(function (m) {
        return { role: m.role, text: m.text };
      }),
      user: this.context.isLoggedIn ? {
        id: this.context.userId,
        name: this.context.userName,
        role: this.context.role
      } : null
    };

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        self.hideTyping();
        self.isSending = false;

        var botText = (data && data.reply) ? data.reply : 'Desolee, je n\'ai pas pu traiter votre demande. Veuillez reessayer.';
        var botMsg = {
          id: generateId(),
          role: 'bot',
          text: botText,
          time: new Date().toISOString()
        };

        self.history.push(botMsg);
        self.renderMessage(botMsg);
        self.saveHistory();
        self.incrementBadge();
        playNotificationSound();

        // Render quick actions if suggested
        if (data && data.quick_replies && data.quick_replies.length > 0) {
          self.renderQuickReplies(data.quick_replies);
        }
      })
      .catch(function () {
        self.hideTyping();
        self.isSending = false;

        var errMsg = {
          id: generateId(),
          role: 'bot',
          text: 'Desolee, une erreur s\'est produite. Verifiez votre connexion et reessayez.',
          time: new Date().toISOString()
        };

        self.history.push(errMsg);
        self.renderMessage(errMsg);
        self.saveHistory();
      });
  };

  // Render server-suggested quick replies
  ChatBot.prototype.renderQuickReplies = function (replies) {
    var self = this;
    var wrapper = document.createElement('div');
    wrapper.className = 'ts-quick-actions';

    replies.forEach(function (r) {
      var label = (typeof r === 'string') ? r : (r.label || r.text || r);
      var value = (typeof r === 'string') ? r : (r.value || r.text || r);
      var btn = document.createElement('button');
      btn.className = 'ts-quick-btn';
      btn.textContent = label;
      btn.addEventListener('click', function () {
        wrapper.remove();
        self.sendMessage(String(value));
      });
      wrapper.appendChild(btn);
    });

    this.els.messages.insertBefore(wrapper, this.els.typing);
    this.scrollToBottom();
  };

  // ─── Voice Input ────────────────────────────────────────────────────
  ChatBot.prototype.initVoice = function () {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.els.micBtn.style.display = 'none';
      return;
    }

    var self = this;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'fr-FR';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = function (e) {
      var transcript = e.results[0][0].transcript;
      if (transcript) {
        self.els.input.value = transcript;
        self.sendMessage(transcript);
      }
      self.stopRecording();
    };

    this.recognition.onerror = function () {
      self.stopRecording();
    };

    this.recognition.onend = function () {
      self.stopRecording();
    };
  };

  ChatBot.prototype.startRecording = function () {
    if (!this.recognition || this.isRecording) return;
    try {
      this.isRecording = true;
      this.els.micBtn.classList.add('ts-recording');
      this.recognition.start();
    } catch (e) {
      this.stopRecording();
    }
  };

  ChatBot.prototype.stopRecording = function () {
    this.isRecording = false;
    this.els.micBtn.classList.remove('ts-recording');
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) { /* ignore */ }
    }
  };

  // ─── Event Binding ──────────────────────────────────────────────────
  ChatBot.prototype.bindEvents = function () {
    var self = this;

    // Bubble click
    this.els.bubble.addEventListener('click', function () {
      self.toggle();
    });

    // Close button
    this.els.closeBtn.addEventListener('click', function () {
      self.close();
    });

    // Send button
    this.els.sendBtn.addEventListener('click', function () {
      self.sendMessage(self.els.input.value);
    });

    // Enter key
    this.els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self.sendMessage(self.els.input.value);
      }
    });

    // Mic button
    this.els.micBtn.addEventListener('click', function () {
      if (self.isRecording) {
        self.stopRecording();
      } else {
        self.startRecording();
      }
    });

    // Close on escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && self.isOpen) {
        self.close();
      }
    });
  };

  // ─── Initialize ─────────────────────────────────────────────────────
  function init() {
    injectStyles();
    var els = createWidget();
    new ChatBot(els);
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

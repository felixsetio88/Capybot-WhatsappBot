/**
 * WhatsApp Bot Admin Dashboard Frontend Client
 * Real-time updates via Socket.IO, Multi-User Auth, Multi-Device Sync & Group Management.
 */

// Application State
const state = {
  theme: 'dark',
  authToken: localStorage.getItem('bot_auth_token') || null,
  currentUser: null,
  authMode: 'login', // 'login' | 'register'
  selectedGroupJid: null,
  groups: [],
  leaderboard: [],
  settings: {},
  logs: [],
  messages: [],
  chatOldestTimestamp: null,
  chatHasMore: false,
  chatSearchQuery: '',
  waGroupFilter: 'all',
  waGroupSearch: '',
  isLoadingOlder: false,
  botStatus: 'disconnected',
  qrCodeUrl: null,
  botUser: null,
  pendingReset: null,
  chartInstance: null,
  searchDebounceTimer: null,

  // AI Models & Engine State
  aiMasterEnabled: false,
  aiPrompted: false,
  aiModels: [],
  aiActiveModelId: 'qwen-3.5-0.8b-q4',
  aiStatus: 'available',
  aiContextLength: 4096,
  aiDownloadPollers: {},

  // AI Chatbot Sessions & Flow State (ChatGPT / Gemini UI)
  chatSessions: [],
  activeChatSessionId: null,
  isChatbotGenerating: false,
  chatbotAttachmentBase64: null,

  // System Hardware Check & Crash Health State
  systemTotalRamBytes: 0,
  systemFreeRamBytes: 0,
  recommendedModelId: 'qwen-3.5-0.8b-q4',
  pendingApplyModelId: null,
  crashHealth: null,
};

// Connect Socket.IO
const socket = io();

// DOM Elements
const elements = {
  // Authentication Modal & Elements
  authModal: document.getElementById('auth-modal'),
  authTabLogin: document.getElementById('auth-tab-login'),
  authTabRegister: document.getElementById('auth-tab-register'),
  authForm: document.getElementById('auth-form'),
  authNameGroup: document.getElementById('auth-name-group'),
  authNameInput: document.getElementById('auth-name-input'),
  authPhoneInput: document.getElementById('auth-phone-input'),
  authPasswordInput: document.getElementById('auth-password-input'),
  authSubmitLabel: document.getElementById('auth-submit-label'),
  authAlertBox: document.getElementById('auth-alert-box'),
  authAlertMsg: document.getElementById('auth-alert-msg'),

  // Single User Profile Card in Sidebar Footer
  userProfileCard: document.getElementById('user-profile-card'),
  userDisplayName: document.getElementById('user-display-name'),
  userPhoneLabel: document.getElementById('user-phone-label'),

  // User Settings & Profile Popup Modal
  userSettingsModal: document.getElementById('user-settings-modal'),
  popupDisplayName: document.getElementById('popup-display-name'),
  popupPhoneNumber: document.getElementById('popup-phone-number'),
  popupAccountCreated: document.getElementById('popup-account-created'),
  popupBotStatusDesc: document.getElementById('popup-bot-status-desc'),
  popupStatusBadge: document.getElementById('popup-status-badge'),
  popupStatusLabel: document.getElementById('popup-status-label'),
  popupThemeIcon: document.getElementById('popup-theme-icon'),
  popupThemeDesc: document.getElementById('popup-theme-desc'),
  btnPopupThemeToggle: document.getElementById('btn-popup-theme-toggle'),
  popupBtnThemeIcon: document.getElementById('popup-btn-theme-icon'),
  popupBtnThemeText: document.getElementById('popup-btn-theme-text'),
  btnPopupOpenQr: document.getElementById('btn-popup-open-qr'),
  btnPopupUnlink: document.getElementById('btn-popup-unlink'),
  btnPopupLogout: document.getElementById('btn-popup-logout'),
  btnPopupDeleteAccount: document.getElementById('btn-popup-delete-account'),
  btnCloseUserSettings: document.getElementById('btn-close-user-settings'),
  btnDismissUserSettings: document.getElementById('btn-dismiss-user-settings'),

  // Account & Preferences AI Model & System Telemetry Section
  toggleUserAiMaster: document.getElementById('toggle-user-ai-master'),
  popupAiStatusBadge: document.getElementById('popup-ai-status-badge'),
  popupAiStatusLabel: document.getElementById('popup-ai-status-label'),
  popupAiModelDesc: document.getElementById('popup-ai-model-desc'),
  popupModelSelect: document.getElementById('popup-model-select'),
  btnPopupManageModels: document.getElementById('btn-popup-manage-models'),
  sysTotalSpaceVal: document.getElementById('sys-total-space-val'),
  sysSpaceBreakdownSub: document.getElementById('sys-space-breakdown-sub'),
  sysFreeStorageVal: document.getElementById('sys-free-storage-val'),
  sysTotalDiskSub: document.getElementById('sys-total-disk-sub'),
  sysRamUsedVal: document.getElementById('sys-ram-used-val'),
  sysRamProgressBar: document.getElementById('sys-ram-progress-bar'),
  sysFreeRamSub: document.getElementById('sys-free-ram-sub'),
  sysUptimeVal: document.getElementById('sys-uptime-val'),
  sysBotUptimeSub: document.getElementById('sys-bot-uptime-sub'),
  btnRefreshPopupSys: document.getElementById('btn-refresh-popup-sys'),

  // Crash Logger Elements
  popupCrashCard: document.getElementById('popup-crash-card'),
  popupCrashBadge: document.getElementById('popup-crash-badge'),
  btnRefreshCrashLogs: document.getElementById('btn-refresh-crash-logs'),
  btnClearCrashLogs: document.getElementById('btn-clear-crash-logs'),
  btnSimulateTestCrash: document.getElementById('btn-simulate-test-crash'),
  crashStatTotal: document.getElementById('crash-stat-total'),
  crashStatLast: document.getElementById('crash-stat-last'),
  crashStatCause: document.getElementById('crash-stat-cause'),
  crashLogsContainer: document.getElementById('crash-logs-container'),
  crashEmptyState: document.getElementById('crash-empty-state'),
  modTabCrashBadge: document.getElementById('mod-tab-crash-badge'),
  btnModViewCrashes: document.getElementById('btn-mod-view-crashes'),

  // AI Onboarding Modal Elements
  aiOnboardingModal: document.getElementById('ai-onboarding-modal'),
  btnOnboardEnableAi: document.getElementById('btn-onboard-enable-ai'),
  btnOnboardSkipAi: document.getElementById('btn-onboard-skip-ai'),

  // Mobile & Sidebar Navigation Drawer
  appSidebar: document.getElementById('app-sidebar'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  btnMobileMenu: document.getElementById('btn-mobile-menu'),
  btnCloseSidebar: document.getElementById('btn-close-sidebar'),

  // Navigation
  navTabs: document.querySelectorAll('.nav-item'),
  tabContents: document.querySelectorAll('.tab-content'),
  pageHeading: document.getElementById('page-heading'),
  pageSubheading: document.getElementById('page-subheading'),

  // AI Chatbot Page Elements (ChatGPT / Gemini Style)
  navTabChatbot: document.getElementById('nav-tab-chatbot'),
  tabChatbot: document.getElementById('tab-chatbot'),
  chatbotDisabledOverlay: document.getElementById('chatbot-disabled-overlay'),
  btnEnableAiFromChatbot: document.getElementById('btn-enable-ai-from-chatbot'),
  chatbotSidebar: document.getElementById('chatbot-sidebar'),
  btnToggleChatbotSidebar: document.getElementById('btn-toggle-chatbot-sidebar'),
  btnCloseChatbotSidebar: document.getElementById('btn-close-chatbot-sidebar'),
  btnNewChat: document.getElementById('btn-new-chat'),
  chatbotSearchInput: document.getElementById('chatbot-search-input'),
  chatbotSessionsList: document.getElementById('chatbot-sessions-list'),
  btnClearAllChats: document.getElementById('btn-clear-all-chats'),
  chatbotActiveModelName: document.getElementById('chatbot-active-model-name'),
  chatbotStatusBadge: document.getElementById('chatbot-status-badge'),
  chatbotStatusLabel: document.getElementById('chatbot-status-label'),
  chatbotContextPill: document.getElementById('chatbot-context-pill'),
  chatbotContextLabel: document.getElementById('chatbot-context-label'),
  btnChatbotExport: document.getElementById('btn-chatbot-export'),
  btnChatbotClearCurrent: document.getElementById('btn-chatbot-clear-current'),
  chatbotMessagesScroll: document.getElementById('chatbot-messages-scroll'),
  chatbotWelcomeHero: document.getElementById('chatbot-welcome-hero'),
  chatbotFeed: document.getElementById('chatbot-feed'),
  chatbotAttachmentPreview: document.getElementById('chatbot-attachment-preview'),
  chatbotAttachmentImg: document.getElementById('chatbot-attachment-img'),
  btnRemoveAttachment: document.getElementById('btn-remove-attachment'),
  chatbotInputForm: document.getElementById('chatbot-input-form'),
  chatbotFileInput: document.getElementById('chatbot-file-input'),
  btnChatbotAttach: document.getElementById('btn-chatbot-attach'),
  chatbotTextarea: document.getElementById('chatbot-textarea'),
  btnChatbotSend: document.getElementById('btn-chatbot-send'),
  chatbotSendIcon: document.getElementById('chatbot-send-icon'),

  // AI Models Tab Elements
  navTabModels: document.getElementById('nav-tab-models'),
  modelsPageStatusBadge: document.getElementById('models-page-status-badge'),
  modelsPageStatusLabel: document.getElementById('models-page-status-label'),
  modelsPageActiveModelName: document.getElementById('models-page-active-model-name'),
  modelsPageQuantization: document.getElementById('models-page-quantization'),
  modelsPageVramSub: document.getElementById('models-page-vram-sub'),
  modelsContextValLabel: document.getElementById('models-context-val-label'),
  selectContextLength: document.getElementById('select-context-length'),
  btnSaveContextLength: document.getElementById('btn-save-context-length'),
  btnRefreshModelsList: document.getElementById('btn-refresh-models-list'),
  aiModelsGridContainer: document.getElementById('ai-models-grid-container'),

  // AI Crash Alert & Fail-Safe Recovery Banner
  aiCrashAlert: document.getElementById('ai-crash-alert'),
  aiCrashAlertMsg: document.getElementById('ai-crash-alert-msg'),
  btnReEnableSafeAi: document.getElementById('btn-re-enable-safe-ai'),
  btnDismissAiCrash: document.getElementById('btn-dismiss-ai-crash'),

  // AI System Check & Recommendation Card
  aiSystemCheckCard: document.getElementById('ai-system-check-card'),
  btnRunSystemCheck: document.getElementById('btn-run-system-check'),
  systemCheckStatusTag: document.getElementById('system-check-status-tag'),
  systemCheckDesc: document.getElementById('system-check-desc'),
  scTotalRam: document.getElementById('sc-total-ram'),
  scFreeRam: document.getElementById('sc-free-ram'),
  scFreeRamSub: document.getElementById('sc-free-ram-sub'),
  scRamPercent: document.getElementById('sc-ram-percent'),
  scRamBarFill: document.getElementById('sc-ram-bar-fill'),
  scRamStatusText: document.getElementById('sc-ram-status-text'),
  scRecommendedModel: document.getElementById('sc-recommended-model'),
  scRecommendedReason: document.getElementById('sc-recommended-reason'),

  // High-RAM Warning Confirmation Dialog Modal
  aiRamWarningModal: document.getElementById('ai-ram-warning-modal'),
  warnTargetModelName: document.getElementById('warn-target-model-name'),
  warnTargetRam: document.getElementById('warn-target-ram'),
  warnModelRamVal: document.getElementById('warn-model-ram-val'),
  warnSystemFreeVal: document.getElementById('warn-system-free-val'),
  warnSystemTotalVal: document.getElementById('warn-system-total-val'),
  warnRecommendedAltName: document.getElementById('warn-recommended-alt-name'),
  btnCloseRamWarning: document.getElementById('btn-close-ram-warning'),
  btnCancelRamWarning: document.getElementById('btn-cancel-ram-warning'),
  btnApplyRecommendedModel: document.getElementById('btn-apply-recommended-model'),
  btnProceedRamWarning: document.getElementById('btn-proceed-ram-warning'),

  // Header & Status
  headerStatusBadge: document.getElementById('header-status-badge'),
  headerStatusLabel: document.getElementById('header-status-label'),
  groupSelector: document.getElementById('group-selector'),
  btnRefreshData: document.getElementById('btn-refresh-data'),

  // KPIs
  statTotalMessages: document.getElementById('stat-total-messages'),
  statActiveGroups: document.getElementById('stat-active-groups'),
  statLinksBlocked: document.getElementById('stat-links-blocked'),
  statTopChatter: document.getElementById('stat-top-chatter'),

  // Leaderboard
  leaderboardSearch: document.getElementById('leaderboard-search'),
  leaderboardTbody: document.getElementById('leaderboard-tbody'),
  btnResetGroupCounts: document.getElementById('btn-reset-group-counts'),
  botAdminStatusTitle: document.getElementById('bot-admin-status-title'),
  botAdminStatusDesc: document.getElementById('bot-admin-status-desc'),

  // Groups Full View & Blocked Members
  groupsCardsContainer: document.getElementById('groups-cards-container'),
  blockedUsersCard: document.getElementById('blocked-users-card'),
  blockedUsersTbody: document.getElementById('blocked-users-tbody'),
  blockedCountBadge: document.getElementById('blocked-count-badge'),

  // Group Members Management Modal
  groupMembersModal: document.getElementById('group-members-modal'),
  modalGroupName: document.getElementById('modal-group-name'),
  modalGroupSubtitle: document.getElementById('modal-group-subtitle'),
  modalMemberSearch: document.getElementById('modal-member-search'),
  modalMembersTbody: document.getElementById('modal-members-tbody'),
  modalMembersAdminHint: document.getElementById('modal-members-admin-hint'),
  btnCloseMembersModal: document.getElementById('btn-close-members-modal'),
  btnDismissMembersModal: document.getElementById('btn-dismiss-members-modal'),

  // Settings
  settingsForm: document.getElementById('settings-form'),
  settingsGroupNameBadge: document.getElementById('settings-group-name-badge'),
  toggleBlockInstagram: document.getElementById('toggle-block-instagram'),
  toggleBlockTikTok: document.getElementById('toggle-block-tiktok'),
  toggleDeleteLinks: document.getElementById('toggle-delete-links'),
  toggleWarnUser: document.getElementById('toggle-warn-user'),
  toggleAutoReplyHi: document.getElementById('toggle-auto-reply-hi'),
  toggleAiEnabled: document.getElementById('toggle-ai-enabled'),
  toggleAiImageGen: document.getElementById('toggle-ai-image-gen'),
  toggleAutoRemoveChat: document.getElementById('toggle-auto-remove-chat'),
  panelAutoRemoveMode: document.getElementById('panel-auto-remove-mode'),
  radioRemoveImage: document.getElementById('radio-remove-image'),
  radioRemoveText: document.getElementById('radio-remove-text'),
  cardRemoveImage: document.getElementById('card-remove-image'),
  cardRemoveText: document.getElementById('card-remove-text'),
  inputPassiveThreshold: document.getElementById('input-passive-threshold'),
  toggleAllowNonAdminCommands: document.getElementById('toggle-allow-non-admin-commands'),
  panelAllowedAdminCommands: document.getElementById('panel-allowed-admin-commands'),
  btnSelectAllAdminCmds: document.getElementById('btn-select-all-admin-cmds'),
  btnClearAllAdminCmds: document.getElementById('btn-clear-all-admin-cmds'),
  customWarningText: document.getElementById('custom-warning-text'),
  customReplyText: document.getElementById('custom-reply-text'),
  btnSaveSettings: document.getElementById('btn-save-settings'),

  // Live Group Chats (Authentic WhatsApp Web Interface)
  waSidebar: document.getElementById('wa-sidebar'),
  waChatList: document.getElementById('wa-chat-list'),
  waGroupsSearchInput: document.getElementById('wa-groups-search-input'),
  btnWaClearGroupSearch: document.getElementById('btn-wa-clear-group-search'),
  btnWaRefreshGroups: document.getElementById('btn-wa-refresh-groups'),
  btnWaMobileBack: document.getElementById('btn-wa-mobile-back'),
  waBotAdminTag: document.getElementById('wa-bot-admin-tag'),
  waActiveGroupAvatar: document.getElementById('wa-active-group-avatar'),
  chatCurrentGroupName: document.getElementById('chat-current-group-name'),
  chatCurrentGroupDetails: document.getElementById('chat-current-group-details'),
  chatTotalBadge: document.getElementById('chat-total-badge'),
  chatSearchInput: document.getElementById('chat-search-input'),
  btnClearChatSearch: document.getElementById('btn-clear-chat-search'),
  chatMessagesArea: document.getElementById('chat-messages-area'),
  chatLoadMoreWrap: document.getElementById('chat-load-more-wrap'),
  btnLoadOlderMessages: document.getElementById('btn-load-older-messages'),
  chatEmptyState: document.getElementById('chat-empty-state'),
  chatSendForm: document.getElementById('chat-send-form'),
  chatInputText: document.getElementById('chat-input-text'),
  btnSendChat: document.getElementById('btn-send-chat'),
  btnRefreshChat: document.getElementById('btn-refresh-chat'),

  // Logs
  logsTbody: document.getElementById('logs-tbody'),
  btnClearLogsView: document.getElementById('btn-clear-logs-view'),

  // QR Modal
  qrModal: document.getElementById('qr-modal'),
  qrContainer: document.getElementById('qr-container'),
  qrImage: document.getElementById('qr-image'),
  qrSpinner: document.getElementById('qr-spinner'),
  qrStatusMsg: document.getElementById('qr-status-msg'),
  btnCloseQr: document.getElementById('btn-close-qr'),
  btnDismissModal: document.getElementById('btn-dismiss-modal'),
  btnRestartAuth: document.getElementById('btn-restart-auth'),

  // Confirm Modal
  confirmModal: document.getElementById('confirm-modal'),
  confirmModalTitle: document.getElementById('confirm-modal-title'),
  confirmModalMsg: document.getElementById('confirm-modal-msg'),
  btnCloseConfirm: document.getElementById('btn-close-confirm'),
  btnCancelConfirm: document.getElementById('btn-cancel-confirm'),
  btnExecuteConfirm: document.getElementById('btn-execute-confirm'),

  // Toast Container
  toastContainer: document.getElementById('toast-container'),
};

// ==========================================================================
// Authenticated Fetch Wrapper
// ==========================================================================
async function authFetch(url, options = {}) {
  const headers = options.headers || {};
  if (state.authToken) {
    headers['Authorization'] = `Bearer ${state.authToken}`;
  }
  if (options.body) {
    if (typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    } else if (typeof options.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    state.authToken = null;
    localStorage.removeItem('bot_auth_token');
    showAuthModal('Please sign in to access your WhatsApp dashboard.', 'danger');
  }

  return response;
}

// ==========================================================================
// Initialization & Socket Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  initActivityChart();
  await checkUserAuth();
  startSafeAutoRefresh();
  if (window.lucide) lucide.createIcons();
});

// Socket Event Handlers
socket.on('bot:status', (data) => {
  handleBotStatusUpdate(data);
});

socket.on('chat:counted', (payload) => {
  if (payload.groupJid === state.selectedGroupJid) {
    loadGroupLeaderboard(state.selectedGroupJid, false);
  }
  fetchStatsSummary();
  addLogEntry({
    timestamp: Date.now(),
    group_name: payload.groupName,
    user_name: payload.userName,
    action_type: 'MESSAGE_COUNTED',
    details: `Message counted (Total: ${payload.chatCount})`,
  });
});

socket.on('chat:message', (msg) => {
  if (msg.group_jid === state.selectedGroupJid) {
    appendChatMessage(msg, true);
  }
});

socket.on('link:blocked', (payload) => {
  fetchStatsSummary();
  showToast(`🛡️ Blocked ${payload.linkType} link from ${payload.userName} in ${payload.groupName}`, 'danger');
  addLogEntry({
    timestamp: payload.timestamp || Date.now(),
    group_name: payload.groupName,
    user_name: payload.userName,
    action_type: `LINK_BLOCKED_${payload.linkType.toUpperCase()}`,
    details: `Blocked links: ${payload.links?.join(', ') || ''}`,
  });
});

socket.on('bot:replied', (payload) => {
  showToast(`👋 Auto-replied to ${payload.userName} in ${payload.groupName}`, 'info');
  addLogEntry({
    timestamp: payload.timestamp || Date.now(),
    group_name: payload.groupName,
    user_name: payload.userName,
    action_type: 'HI_REPLIED',
    details: `Auto-replied to "Hi" message`,
  });
});

socket.on('log:activity', (payload) => {
  addLogEntry({
    timestamp: payload.timestamp || Date.now(),
    group_name: payload.groupName,
    user_name: payload.userName,
    action_type: payload.type ? payload.type.toUpperCase() : 'ACTIVITY',
    details: payload.text || '',
  });
});

socket.on('chat:reset', (payload) => {
  if (payload.groupJid === state.selectedGroupJid) {
    loadGroupLeaderboard(state.selectedGroupJid, false);
  }
  fetchStatsSummary();
});

socket.on('settings:updated', (payload) => {
  if (payload.groupJid === state.selectedGroupJid) {
    applySettingsToForm(payload.settings);
  }
});

// AI Model & Config Socket Handlers
socket.on('ai:model_changed', (payload) => {
  fetchAIModelsAndStatus();
});

socket.on('ai:config_changed', (payload) => {
  fetchAIModelsAndStatus();
});

// Crash Logger Real-Time Socket Handler
socket.on('system:crash_logged', (payload) => {
  fetchCrashLogs();
  showToast('⚠️ New system crash logged. Check Settings > Crash History.', 'warning');
});

// ==========================================================================
// Authentication Logic (Phone + Password)
// ==========================================================================
async function checkUserAuth() {
  if (!state.authToken) {
    showAuthModal();
    return;
  }

  try {
    const res = await authFetch('/api/auth/me');
    const json = await res.json();

    if (json.success && json.user) {
      state.currentUser = json.user;
      updateUserProfileUI(json.user);
      closeModal(elements.authModal);

      // Authenticate Socket.IO connection
      socket.emit('auth:authenticate', state.authToken);

      if (json.botStatus) {
        handleBotStatusUpdate(json.botStatus);
      }

      await fetchInitialData();
      checkAndPromptAIOnboarding();
      fetchCrashLogs();
    } else {
      showAuthModal();
    }
  } catch (err) {
    console.error('Auth verification failed:', err);
    showAuthModal();
  }
}

function updateUserProfileUI(user) {
  if (!user) return;
  const name = user.displayName || 'Admin';
  const phoneFormatted = `+${user.phoneNumber}`;

  if (user.aiEnabled !== undefined) {
    state.aiMasterEnabled = Boolean(user.aiEnabled);
  } else if (user.ai_enabled !== undefined) {
    state.aiMasterEnabled = Boolean(user.ai_enabled);
  }

  if (user.aiPrompted !== undefined) {
    state.aiPrompted = Boolean(user.aiPrompted);
  } else if (user.ai_prompted !== undefined) {
    state.aiPrompted = Boolean(user.ai_prompted);
  }

  if (elements.userDisplayName) elements.userDisplayName.textContent = name;
  if (elements.userPhoneLabel) elements.userPhoneLabel.textContent = phoneFormatted;
  if (elements.popupDisplayName) elements.popupDisplayName.textContent = name;
  if (elements.popupPhoneNumber) elements.popupPhoneNumber.textContent = phoneFormatted;
  if (elements.popupAccountCreated && user.createdAt) {
    const dateStr = new Date(user.createdAt).toLocaleDateString();
    elements.popupAccountCreated.textContent = `Member since ${dateStr}`;
  }

  updateChatbotAccessState();
}

function updateChatbotAccessState() {
  if (elements.chatbotDisabledOverlay) {
    elements.chatbotDisabledOverlay.style.display = state.aiMasterEnabled ? 'none' : 'flex';
  }
  if (elements.toggleUserAiMaster) {
    elements.toggleUserAiMaster.checked = Boolean(state.aiMasterEnabled);
  }
  if (elements.popupModelSelect) {
    elements.popupModelSelect.disabled = !state.aiMasterEnabled;
  }
}

function checkAndPromptAIOnboarding() {
  if (state.currentUser && !state.aiPrompted && elements.aiOnboardingModal) {
    // If QR modal is open or pairing is needed, wait until QR modal is closed or bot is connected
    if (elements.qrModal && elements.qrModal.classList.contains('active')) {
      return;
    }
    setTimeout(() => {
      openModal(elements.aiOnboardingModal);
    }, 400);
  }
}

function showAuthModal(message = null, type = 'info') {
  openModal(elements.authModal);
  if (message) {
    elements.authAlertBox.style.display = 'flex';
    elements.authAlertBox.className = `auth-alert ${type}`;
    elements.authAlertMsg.textContent = message;
  } else {
    elements.authAlertBox.style.display = 'none';
  }
  if (window.lucide) lucide.createIcons();
}

function switchAuthMode(mode) {
  state.authMode = mode;
  elements.authAlertBox.style.display = 'none';

  if (mode === 'login') {
    elements.authTabLogin.classList.add('active');
    elements.authTabRegister.classList.remove('active');
    elements.authNameGroup.style.display = 'none';
    elements.authSubmitLabel.textContent = 'Sign In to Dashboard';
  } else {
    elements.authTabRegister.classList.add('active');
    elements.authTabLogin.classList.remove('active');
    elements.authNameGroup.style.display = 'block';
    elements.authSubmitLabel.textContent = 'Create Account & Start Bot';
  }
  if (window.lucide) lucide.createIcons();
}

async function handleAuthSubmit(e) {
  e.preventDefault();

  const phoneNumber = elements.authPhoneInput.value.trim();
  const password = elements.authPasswordInput.value;
  const displayName = elements.authNameInput ? elements.authNameInput.value.trim() : null;

  if (!phoneNumber || !password) {
    showAuthAlert('Please fill in both Phone Number and Password.');
    return;
  }

  const isNewRegistration = state.authMode === 'register';
  const endpoint = isNewRegistration ? '/api/auth/register' : '/api/auth/login';
  const payload = isNewRegistration ? { phoneNumber, password, displayName } : { phoneNumber, password };

  elements.authSubmitLabel.textContent = isNewRegistration ? 'Creating Account...' : 'Connecting...';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (json.success && json.token) {
      state.authToken = json.token;
      state.currentUser = json.user;
      localStorage.setItem('bot_auth_token', json.token);

      updateUserProfileUI(json.user);
      closeModal(elements.authModal);
      elements.authForm.reset();

      // Connect Socket.IO to this user's room
      socket.emit('auth:authenticate', json.token);

      if (json.botStatus) {
        handleBotStatusUpdate(json.botStatus);
      }

      if (isNewRegistration) {
        showToast(`🎉 Account created! Welcome, ${json.user.displayName || json.user.phoneNumber}! Please scan the QR code to link your WhatsApp bot.`, 'success');
        // Prompt user immediately to scan WhatsApp QR code
        openModal(elements.qrModal);
        await fetchInitialData();
      } else {
        showToast(`Welcome back, ${json.user.displayName || json.user.phoneNumber}!`, 'success');
        await fetchInitialData();
        if (json.botStatus?.status === 'qr_ready' || json.botStatus?.status === 'disconnected') {
          openModal(elements.qrModal);
        } else {
          checkAndPromptAIOnboarding();
        }
      }
    } else {
      showAuthAlert(json.error || 'Authentication failed. Please check your credentials.');
    }
  } catch (err) {
    showAuthAlert('Connection error: ' + err.message);
  } finally {
    elements.authSubmitLabel.textContent = isNewRegistration ? 'Create Account & Start Bot' : 'Sign In to Dashboard';
  }
}

function showAuthAlert(message, isSuccess = false) {
  elements.authAlertBox.style.display = 'flex';
  elements.authAlertBox.className = `auth-alert ${isSuccess ? 'success' : 'danger'}`;
  elements.authAlertMsg.textContent = message;
  if (window.lucide) lucide.createIcons();
}

function handleUserLogout() {
  state.authToken = null;
  state.currentUser = null;
  state.groups = [];
  state.messages = [];
  localStorage.removeItem('bot_auth_token');
  closeModal(elements.userSettingsModal);
  showAuthModal('You have been logged out. Your WhatsApp bot remains running in the background.', 'info');
}

let currentConfirmAction = null;

/**
 * Displays a reliable in-app modal confirmation dialog.
 */
function showConfirmDialog({
  title = 'Confirmation Required',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Yes, Proceed',
  cancelText = 'Cancel',
  confirmBtnClass = 'btn-danger',
  onConfirm = null,
} = {}) {
  currentConfirmAction = onConfirm;
  if (elements.confirmModalTitle) elements.confirmModalTitle.textContent = title;
  if (elements.confirmModalMsg) elements.confirmModalMsg.innerHTML = message;
  if (elements.btnExecuteConfirm) {
    elements.btnExecuteConfirm.textContent = confirmText;
    elements.btnExecuteConfirm.className = `btn ${confirmBtnClass}`;
  }
  if (elements.btnCancelConfirm) {
    elements.btnCancelConfirm.textContent = cancelText;
  }
  openModal(elements.confirmModal);
  if (window.lucide) lucide.createIcons();
}

function handleUnlinkWhatsapp(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  showConfirmDialog({
    title: 'Unlink WhatsApp Account',
    message: 'Are you sure you want to unlink your current WhatsApp account? This will disconnect the bot and generate a new pairing QR code.',
    confirmText: 'Yes, Unlink Session',
    confirmBtnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        showToast('Unlinking WhatsApp account...', 'info');
        closeModal(elements.userSettingsModal);
        const res = await authFetch('/api/auth/unlink-whatsapp', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast(json.message, 'success');
          openModal(elements.qrModal);
        } else {
          showToast(`Error: ${json.error}`, 'danger');
        }
      } catch (err) {
        showToast('Failed to unlink: ' + err.message, 'danger');
      }
    },
  });
}

function promptDeleteAccount(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  showConfirmDialog({
    title: '⚠️ Permanent Account Deletion',
    message:
      '<div style="font-size: 0.9rem; line-height: 1.55; color: var(--text-color);">' +
      '<p style="margin-bottom: 10px;">Are you sure you want to permanently <strong>DELETE</strong> your CapyBot account?</p>' +
      '<ul style="padding-left: 18px; margin-bottom: 8px; color: var(--text-muted); font-size: 0.84rem; display: flex; flex-direction: column; gap: 4px;">' +
      '<li>Your WhatsApp bot connection will be disconnected immediately.</li>' +
      '<li>All group message history, leaderboards, stats, and settings will be permanently wiped.</li>' +
      '<li>This action <strong>CANNOT</strong> be undone.</li>' +
      '</ul>' +
      '</div>',
    confirmText: 'Yes, Delete My Account',
    confirmBtnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        showToast('Deleting account and wiping data...', 'info');
        const res = await authFetch('/api/auth/delete-account', { method: 'POST' });
        const json = await res.json();

        if (json.success) {
          showToast(json.message || 'Account successfully deleted.', 'success');
          state.authToken = null;
          state.currentUser = null;
          state.groups = [];
          state.messages = [];
          localStorage.removeItem('bot_auth_token');

          closeModal(elements.userSettingsModal);
          closeModal(elements.groupMembersModal);
          closeModal(elements.qrModal);
          closeModal(elements.confirmModal);

          setTimeout(() => {
            showAuthModal('Your account has been deleted. You can register a new account anytime.', 'info');
          }, 400);
        } else {
          showToast(`Error deleting account: ${json.error}`, 'danger');
        }
      } catch (err) {
        showToast('Failed to delete account: ' + err.message, 'danger');
      }
    },
  });
}

function openUserSettingsPopup() {
  if (state.currentUser) {
    updateUserProfileUI(state.currentUser);
  }
  syncPopupThemeUI();
  syncPopupStatusUI();
  updateAIStatusUI();
  populatePopupModelSelect();
  fetchSystemDiagnostics();
  fetchCrashLogs();
  openModal(elements.userSettingsModal);
  if (window.lucide) lucide.createIcons();
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatUptimeDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

async function fetchSystemDiagnostics() {
  try {
    const res = await authFetch('/api/system/info');
    if (!res || !res.ok) return;
    const json = await res.json();
    if (!json.success || !json.data) return;

    const data = json.data;

    // 1. Storage Space Used
    if (elements.sysTotalSpaceVal) {
      elements.sysTotalSpaceVal.textContent = formatBytes(data.storage.total_used_bytes);
    }
    if (elements.sysSpaceBreakdownSub) {
      const modelsMb = formatBytes(data.storage.models_used_bytes);
      const appMb = formatBytes(data.storage.app_used_bytes);
      elements.sysSpaceBreakdownSub.textContent = `Models: ${modelsMb} • App: ${appMb}`;
    }

    // 2. Free Storage
    if (elements.sysFreeStorageVal) {
      elements.sysFreeStorageVal.textContent = data.storage.disk_free_bytes > 0
        ? formatBytes(data.storage.disk_free_bytes) + ' Free'
        : 'Available';
    }
    if (elements.sysTotalDiskSub) {
      elements.sysTotalDiskSub.textContent = data.storage.disk_total_bytes > 0
        ? `Total Disk: ${formatBytes(data.storage.disk_total_bytes)}`
        : 'Disk Space Available';
    }

    // 3. RAM Usage
    if (elements.sysRamUsedVal) {
      const usedFormatted = formatBytes(data.memory.used_bytes);
      elements.sysRamUsedVal.textContent = `${usedFormatted} (${data.memory.usage_percent}%)`;
    }
    if (elements.sysRamProgressBar) {
      elements.sysRamProgressBar.style.width = `${Math.min(data.memory.usage_percent, 100)}%`;
      if (data.memory.usage_percent > 85) {
        elements.sysRamProgressBar.style.background = '#EF4444';
      } else if (data.memory.usage_percent > 65) {
        elements.sysRamProgressBar.style.background = '#F59E0B';
      } else {
        elements.sysRamProgressBar.style.background = 'linear-gradient(90deg, #2DD4BF, #0D9488)';
      }
    }
    if (elements.sysFreeRamSub) {
      const freeFormatted = formatBytes(data.memory.free_bytes);
      const totalFormatted = formatBytes(data.memory.total_bytes);
      elements.sysFreeRamSub.textContent = `Free: ${freeFormatted} / ${totalFormatted}`;
    }

    // 4. System & Bot Uptime
    if (elements.sysUptimeVal) {
      elements.sysUptimeVal.textContent = formatUptimeDuration(data.uptime.system_seconds);
    }
    if (elements.sysBotUptimeSub) {
      elements.sysBotUptimeSub.textContent = `Bot Uptime: ${formatUptimeDuration(data.uptime.process_seconds)}`;
    }
  } catch (err) {
    console.warn('Could not fetch system telemetry:', err);
  }
}

async function fetchCrashLogs() {
  try {
    const res = await authFetch('/api/system/crashes');
    if (!res || !res.ok) return;
    const json = await res.json();
    if (!json.success) return;

    renderCrashLogs(json.crashes || []);
  } catch (err) {
    console.warn('[CrashLogger UI] Failed to fetch crash logs:', err);
  }
}

function renderCrashLogs(crashes) {
  const count = crashes.length;

  // 1. Update Badges
  if (elements.popupCrashBadge) {
    if (count === 0) {
      elements.popupCrashBadge.textContent = 'Healthy';
      elements.popupCrashBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      elements.popupCrashBadge.style.color = '#10B981';
    } else {
      elements.popupCrashBadge.textContent = `${count} ${count === 1 ? 'Crash' : 'Crashes'}`;
      elements.popupCrashBadge.style.background = 'rgba(244, 63, 94, 0.2)';
      elements.popupCrashBadge.style.color = '#F43F5E';
    }
  }

  if (elements.modTabCrashBadge) {
    if (count === 0) {
      elements.modTabCrashBadge.textContent = 'Healthy';
      elements.modTabCrashBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      elements.modTabCrashBadge.style.color = '#10B981';
    } else {
      elements.modTabCrashBadge.textContent = `${count} ${count === 1 ? 'Crash' : 'Crashes'}`;
      elements.modTabCrashBadge.style.background = 'rgba(244, 63, 94, 0.2)';
      elements.modTabCrashBadge.style.color = '#F43F5E';
    }
  }

  // 2. Summary stats
  if (elements.crashStatTotal) {
    elements.crashStatTotal.textContent = count;
  }

  if (elements.crashStatLast) {
    if (count > 0 && crashes[0].timestamp) {
      const d = new Date(crashes[0].timestamp);
      elements.crashStatLast.textContent = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      elements.crashStatLast.textContent = 'None';
    }
  }

  if (elements.crashStatCause) {
    if (count > 0 && crashes[0].analysis?.category) {
      elements.crashStatCause.textContent = crashes[0].analysis.category;
    } else {
      elements.crashStatCause.textContent = 'None';
    }
  }

  // 3. Render list
  if (!elements.crashLogsContainer) return;
  elements.crashLogsContainer.innerHTML = '';

  if (count === 0) {
    elements.crashLogsContainer.innerHTML = `
      <div class="crash-empty-state">
        <i data-lucide="check-circle" style="width: 24px; height: 24px; color: #10B981;"></i>
        <div>
          <strong>No crashes recorded</strong>
          <p>Your Capybot system has been running stably with no runtime terminations.</p>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  crashes.forEach((crash, index) => {
    const analysis = crash.analysis || {};
    const telemetry = crash.telemetry || {};
    const severity = analysis.severity || 'medium';
    const timeFormatted = new Date(crash.timestamp).toLocaleString();
    const isFirst = index === 0;

    const item = document.createElement('div');
    item.className = `crash-log-item${isFirst ? ' open' : ''}`;

    let telHtml = '';
    if (telemetry.memory) {
      const rssMb = Math.round(telemetry.memory.rssBytes / 1024 / 1024);
      const freeMb = telemetry.memory.systemFreeMB || Math.round(telemetry.memory.systemFreeBytes / 1024 / 1024);
      const uptimeMin = Math.round((telemetry.processUptimeSec || 0) / 60);

      telHtml = `
        <div class="crash-telemetry-grid">
          <div class="crash-tel-box">
            <span class="crash-tel-label">Process RAM (RSS)</span>
            <span class="crash-tel-val">${rssMb} MB</span>
          </div>
          <div class="crash-tel-box">
            <span class="crash-tel-label">System Free RAM</span>
            <span class="crash-tel-val">${freeMb} MB</span>
          </div>
          <div class="crash-tel-box">
            <span class="crash-tel-label">Node Uptime</span>
            <span class="crash-tel-val">${uptimeMin} min</span>
          </div>
        </div>
      `;
    }

    const stackContent = (crash.stackTrace || crash.errorMessage || 'No stack trace available').trim();

    item.innerHTML = `
      <div class="crash-log-header">
        <div class="crash-log-main">
          <div class="crash-log-title-row">
            <span class="crash-type-badge ${severity}">${escapeHtml(analysis.category || crash.crashType || 'Crash')}</span>
            <span class="crash-log-time">${timeFormatted}</span>
          </div>
          <div class="crash-log-msg" title="${escapeHtml(crash.errorMessage)}">${escapeHtml(crash.errorMessage)}</div>
        </div>
        <i data-lucide="chevron-down" class="crash-log-chevron"></i>
      </div>
      <div class="crash-log-details" style="${isFirst ? 'display: flex;' : 'display: none;'}">
        <div class="crash-recommendation-box ${severity === 'warning' ? 'warning' : ''}">
          <div class="crash-rec-title">Diagnosis: ${escapeHtml(analysis.summary || 'Runtime Error')}</div>
          <p class="crash-rec-desc"><strong>Cause:</strong> ${escapeHtml(analysis.cause || crash.errorMessage)}</p>
          <p class="crash-rec-desc" style="margin-top: 4px;"><strong>Recommended Fix:</strong> ${escapeHtml(analysis.recommendation || 'Check logs.')}</p>
        </div>

        ${telHtml}

        <div class="crash-stack-box">
          <div class="crash-stack-header">
            <span class="crash-stack-title">Error Stack Trace & Context</span>
            <button type="button" class="crash-btn-copy-stack" data-stack="${escapeHtml(stackContent)}">
              <i data-lucide="copy" style="width: 10px; height: 10px;"></i>
              <span>Copy</span>
            </button>
          </div>
          <pre class="crash-stack-content"><code>${escapeHtml(stackContent)}</code></pre>
        </div>
      </div>
    `;

    // Toggle accordion
    const header = item.querySelector('.crash-log-header');
    const details = item.querySelector('.crash-log-details');
    header.addEventListener('click', () => {
      const isOpen = item.classList.toggle('open');
      details.style.display = isOpen ? 'flex' : 'none';
    });

    // Copy stack button
    const copyBtn = item.querySelector('.crash-btn-copy-stack');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = copyBtn.getAttribute('data-stack') || stackContent;
        navigator.clipboard.writeText(text).then(() => {
          showToast('Stack trace copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Failed to copy to clipboard', 'error');
        });
      });
    }

    elements.crashLogsContainer.appendChild(item);
  });

  if (window.lucide) lucide.createIcons();
}

function syncPopupStatusUI() {
  const status = state.botStatus || 'disconnected';
  if (!elements.popupStatusBadge) return;

  elements.popupStatusBadge.className = 'connection-badge';
  if (status === 'connected') {
    elements.popupStatusBadge.classList.add('status-connected');
    if (elements.popupStatusLabel) elements.popupStatusLabel.textContent = 'Connected';
    if (elements.popupBotStatusDesc) {
      elements.popupBotStatusDesc.textContent = state.botUser ? `Active on +${state.botUser.phone}` : 'Connected to WhatsApp';
    }
  } else if (status === 'qr_ready') {
    elements.popupStatusBadge.classList.add('status-qr');
    if (elements.popupStatusLabel) elements.popupStatusLabel.textContent = 'Pairing Required';
    if (elements.popupBotStatusDesc) elements.popupBotStatusDesc.textContent = 'Scan QR code to connect';
  } else {
    elements.popupStatusBadge.classList.add('status-disconnected');
    if (elements.popupStatusLabel) elements.popupStatusLabel.textContent = 'Disconnected';
    if (elements.popupBotStatusDesc) elements.popupBotStatusDesc.textContent = 'Bot socket is offline';
  }
  if (window.lucide) lucide.createIcons();
}

function syncPopupThemeUI() {
  const isLight = state.theme === 'light';
  if (elements.popupThemeDesc) {
    elements.popupThemeDesc.textContent = isLight ? 'Current: Light Mode' : 'Current: Dark Mode';
  }
  if (elements.popupBtnThemeText) {
    elements.popupBtnThemeText.textContent = isLight ? 'Switch to Dark' : 'Switch to Light';
  }
  if (elements.popupBtnThemeIcon) {
    elements.popupBtnThemeIcon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
  }
  if (elements.popupThemeIcon) {
    elements.popupThemeIcon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
  }
  if (window.lucide) lucide.createIcons();
}

// ==========================================================================
// Safe Auto-Refresh (Heartbeat)
// ==========================================
function startSafeAutoRefresh() {
  setInterval(() => {
    if (document.visibilityState === 'visible' && state.authToken) {
      fetchStatsSummary();
      if (state.selectedGroupJid) {
        loadGroupLeaderboard(state.selectedGroupJid, false);
      }
    }
  }, 15000);
}

// ==========================================================================
// Bot Status & QR Modal Logic
// ==========================================================================
function handleBotStatusUpdate(data) {
  state.botStatus = data.status;
  state.qrCodeUrl = data.qrCode;
  state.botUser = data.user;

  elements.headerStatusBadge.className = 'connection-badge';
  if (data.status === 'connected') {
    elements.headerStatusBadge.classList.add('status-connected');
    elements.headerStatusLabel.textContent = 'Bot Connected';
    closeModal(elements.qrModal);
    checkAndPromptAIOnboarding();
  } else if (data.status === 'qr_ready') {
    elements.headerStatusBadge.classList.add('status-qr');
    elements.headerStatusLabel.textContent = 'Pairing Required';
    renderQrCode(data.qrCode);
  } else {
    elements.headerStatusBadge.classList.add('status-disconnected');
    elements.headerStatusLabel.textContent = 'Disconnected';
  }

  syncPopupStatusUI();
  if (window.lucide) lucide.createIcons();
}

function renderQrCode(qrDataUrl) {
  if (qrDataUrl) {
    elements.qrImage.src = qrDataUrl;
    elements.qrImage.style.display = 'block';
    elements.qrSpinner.style.display = 'none';
  } else {
    elements.qrImage.style.display = 'none';
    elements.qrSpinner.style.display = 'flex';
    elements.qrStatusMsg.textContent = 'Waiting for QR Code...';
  }
}

// ==========================================================================
// Data Fetching (Authenticated)
// ==========================================================================
async function fetchInitialData() {
  if (!state.authToken) return;
  await Promise.all([
    fetchBotStatus(),
    fetchGroups(),
    fetchStatsSummary(),
    fetchRecentLogs(),
    fetchAIModelsAndStatus(),
    checkAICrashHealth(),
    runSystemCheck(),
  ]);
}

async function fetchBotStatus() {
  try {
    const res = await authFetch('/api/status');
    const json = await res.json();
    if (json.success) {
      handleBotStatusUpdate(json.data);
      updateKpiCards(json.data.stats);
    }
  } catch (err) {
    console.error('Failed to fetch bot status:', err);
  }
}

async function fetchStatsSummary() {
  try {
    const res = await authFetch('/api/status');
    const json = await res.json();
    if (json.success && json.data.stats) {
      updateKpiCards(json.data.stats);
    }
  } catch (err) {
    console.error('Failed to fetch stats:', err);
  }
}

function updateKpiCards(stats) {
  if (!stats) return;
  elements.statTotalMessages.textContent = (stats.totalMessages || 0).toLocaleString();
  elements.statActiveGroups.textContent = (stats.totalGroups || 0).toLocaleString();
  elements.statLinksBlocked.textContent = (stats.totalBlockedLinks || 0).toLocaleString();

  if (stats.topChatter) {
    const topIdentity = formatUserIdentity(stats.topChatter.user_name, stats.topChatter.user_jid);
    elements.statTopChatter.textContent = `${topIdentity.displayFull} (${stats.topChatter.chat_count} chats)`;
  } else {
    elements.statTopChatter.textContent = 'None';
  }
}

async function fetchGroups() {
  try {
    const res = await authFetch('/api/groups');
    const json = await res.json();
    if (json.success && json.data) {
      state.groups = json.data;
      renderGroupSelector(json.data);
      renderGroupsCards(json.data);
      renderWhatsAppChatList(json.data);

      if (json.data.length > 0 && !state.selectedGroupJid) {
        selectGroup(json.data[0].id);
      }
    }
  } catch (err) {
    console.error('Failed to fetch groups:', err);
  }
}

function getAvatarBgColor(str) {
  const colors = [
    'linear-gradient(135deg, #10B981, #059669)',
    'linear-gradient(135deg, #3B82F6, #1D4ED8)',
    'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    'linear-gradient(135deg, #EC4899, #BE185D)',
    'linear-gradient(135deg, #F59E0B, #D97706)',
    'linear-gradient(135deg, #14B8A6, #0F766E)',
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getSenderColor(senderJid) {
  const colors = ['#35CD96', '#00A884', '#6BCEEF', '#D4B35E', '#9370DB', '#FF8F00', '#00BCD4', '#E542A3'];
  let hash = 0;
  for (let i = 0; i < (senderJid || '').length; i++) {
    hash = (hash << 5) - hash + senderJid.charCodeAt(i);
  }
  return colors[Math.abs(hash) % colors.length];
}

function renderWhatsAppChatList(groups) {
  if (!elements.waChatList) return;
  elements.waChatList.innerHTML = '';

  let list = Array.isArray(groups) ? groups : (state.groups || []);

  // Filter by search query
  if (state.waGroupSearch) {
    const q = state.waGroupSearch.toLowerCase();
    list = list.filter((g) => (g.name || '').toLowerCase().includes(q) || (g.id || '').toLowerCase().includes(q));
  }

  // Filter by chip
  if (state.waGroupFilter === 'admin') {
    list = list.filter((g) => g.isBotAdmin);
  }

  if (list.length === 0) {
    elements.waChatList.innerHTML = `
      <div class="table-empty" style="padding: 24px 16px;">
        <i data-lucide="message-square" style="width: 24px; height: 24px; margin-bottom: 6px; color: #8696A0;"></i>
        <p style="font-size: 0.8rem; color: #8696A0;">No matching groups found</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  list.forEach((g) => {
    const isActive = (g.id === state.selectedGroupJid);
    const item = document.createElement('div');
    item.className = `wa-chat-item ${isActive ? 'active' : ''}`;
    item.setAttribute('data-group-jid', g.id);

    const initial = (g.name || 'W').charAt(0).toUpperCase();
    const avatarBg = getAvatarBgColor(g.name || g.id);

    item.innerHTML = `
      <div class="wa-chat-avatar" style="background: ${avatarBg};">
        <span>${escapeHtml(initial)}</span>
      </div>
      <div class="wa-chat-info">
        <div class="wa-chat-title-line">
          <span class="wa-chat-title">${escapeHtml(g.name || 'Unnamed Group')}</span>
          <span class="wa-chat-time">${g.isBotAdmin ? '🛡️ Admin' : ''}</span>
        </div>
        <div class="wa-chat-msg-line">
          <span class="wa-chat-snippet">${g.participantsCount || 0} participants</span>
          ${isActive ? '<span class="wa-chat-badge">Active</span>' : ''}
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      selectGroup(g.id);
      if (window.innerWidth <= 768 && elements.waSidebar) {
        elements.waSidebar.classList.add('wa-mobile-hidden');
      }
    });

    elements.waChatList.appendChild(item);
  });
}

function renderGroupSelector(groups) {
  elements.groupSelector.innerHTML = '';
  if (groups.length === 0) {
    elements.groupSelector.innerHTML = '<option value="">No Groups Found</option>';
    return;
  }

  groups.forEach((g) => {
    const option = document.createElement('option');
    option.value = g.id;
    option.textContent = `${g.name || 'Unnamed Group'} (${g.participantsCount || 0} members)`;
    if (g.id === state.selectedGroupJid) {
      option.selected = true;
    }
    elements.groupSelector.appendChild(option);
  });
}

function renderGroupsCards(groups) {
  elements.groupsCardsContainer.innerHTML = '';
  if (groups.length === 0) {
    elements.groupsCardsContainer.innerHTML = `
      <div class="table-empty" style="grid-column: 1 / -1;">
        <i data-lucide="inbox"></i>
        <p>No active WhatsApp groups found. Add the bot to your WhatsApp group to begin!</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  groups.forEach((g) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <div class="group-card-header">
        <div class="group-icon">
          <i data-lucide="users"></i>
        </div>
        <div style="overflow: hidden;">
          <h4 class="group-card-title">${escapeHtml(g.name || g.id)}</h4>
          <span style="font-size: 0.75rem; color: ${g.isBotAdmin ? '#34D399' : '#FBBF24'};">
            ${g.isBotAdmin ? '🛡️ Bot is Admin' : '⚠️ Bot is Not Admin'}
          </span>
        </div>
      </div>
      <div class="group-card-stats">
        <span>Members: <strong>${g.participantsCount || 0}</strong></span>
        <span>Total Chats: <strong>${(g.totalMessages || 0).toLocaleString()}</strong></span>
      </div>
      <div style="display: flex; gap: 8px; width: 100%;">
        <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="openManageMembersModal('${g.id}')">
          <i data-lucide="users"></i>
          <span>Manage Members</span>
        </button>
        <button class="btn btn-secondary btn-sm" onclick="selectGroup('${g.id}'); switchTab('overview');" title="View Dashboard Analytics">
          <i data-lucide="bar-chart-2"></i>
        </button>
      </div>
    `;
    elements.groupsCardsContainer.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

window.openManageMembersModal = async function (groupJid) {
  state.modalActiveGroupJid = groupJid;
  const currentGroup = state.groups.find((g) => g.id === groupJid);
  const groupName = currentGroup?.name || groupJid;

  if (elements.modalGroupName) elements.modalGroupName.textContent = groupName;
  if (elements.modalGroupSubtitle) {
    elements.modalGroupSubtitle.textContent = `Loading members for ${groupName}...`;
  }
  if (elements.modalMemberSearch) {
    elements.modalMemberSearch.value = '';
  }

  if (elements.modalMembersTbody) {
    elements.modalMembersTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          <div class="spinner" style="margin: 0 auto 8px auto;"></div>
          <p>Loading group members...</p>
        </td>
      </tr>`;
  }

  openModal(elements.groupMembersModal);
  if (window.lucide) lucide.createIcons();

  try {
    const res = await authFetch(`/api/groups/${encodeURIComponent(groupJid)}/stats`);
    const json = await res.json();
    if (json.success && json.data) {
      state.modalMembers = json.data.leaderboard || [];
      state.modalIsBotAdmin = json.data.isBotAdmin;

      if (elements.modalGroupSubtitle) {
        elements.modalGroupSubtitle.textContent = `${state.modalMembers.length} members • ${json.data.isBotAdmin ? '🛡️ Bot is Admin' : '⚠️ Bot Not Admin'}`;
      }

      if (elements.modalMembersAdminHint) {
        elements.modalMembersAdminHint.innerHTML = json.data.isBotAdmin
          ? '🛡️ <em>CapyBot is Group Admin. You can remove members, block users, and manage stats.</em>'
          : '⚠️ <em>To remove members, promote CapyBot to Group Admin in WhatsApp.</em>';
      }

      renderModalMembersList();
    } else {
      showToast('Failed to load group members: ' + (json.error || 'Unknown error'), 'danger');
    }
  } catch (err) {
    showToast('Failed to load group members: ' + err.message, 'danger');
  }
};

function renderModalMembersList() {
  if (!elements.modalMembersTbody) return;
  const query = (elements.modalMemberSearch?.value || '').toLowerCase().trim();
  const members = state.modalMembers || [];

  const filtered = members.filter(
    (m) =>
      (m.user_name && m.user_name.toLowerCase().includes(query)) ||
      (m.user_jid && m.user_jid.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    elements.modalMembersTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          <i data-lucide="users"></i>
          <p>${query ? 'No matching members found.' : 'No members found in this group.'}</p>
        </td>
      </tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  elements.modalMembersTbody.innerHTML = filtered
    .map((member) => {
      const identity = formatUserIdentity(member.user_name, member.user_jid);
      const adminBadge = member.isAdmin
        ? '<span class="badge badge-admin">Admin</span>'
        : '<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-dim);">Member</span>';
      const blockedBadge = member.isBlocked
        ? '<span class="badge btn-danger" style="font-size: 0.65rem; padding: 1px 6px;">🚫 Blocked</span>'
        : '';

      const isBotAccount = member.user_jid?.startsWith((state.currentUser?.phoneNumber || '___'));

      const removeBtn = (!member.isAdmin && !isBotAccount)
        ? `<button class="btn btn-secondary btn-sm text-danger" title="Remove member from WhatsApp group" onclick="promptKickMember('${escapeHtml(state.modalActiveGroupJid)}', '${escapeHtml(member.user_jid)}', '${escapeHtml(identity.name)}')">
             <i data-lucide="user-minus"></i>
             <span>Remove</span>
           </button>`
        : '';

      const blockBtn = (!member.isAdmin && !isBotAccount)
        ? (member.isBlocked
          ? `<button class="btn btn-secondary btn-sm" onclick="promptUnblockMember('${escapeHtml(state.modalActiveGroupJid)}', '${escapeHtml(member.user_jid)}', '${escapeHtml(identity.name)}')">
                 <i data-lucide="shield-check"></i>
                 <span>Unblock</span>
               </button>`
          : `<button class="btn btn-secondary btn-sm text-danger" onclick="promptBlockMember('${escapeHtml(state.modalActiveGroupJid)}', '${escapeHtml(member.user_jid)}', '${escapeHtml(identity.name)}')">
                 <i data-lucide="user-x"></i>
                 <span>Block</span>
               </button>`)
        : '';

      return `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar-sm">${escapeHtml(identity.name.charAt(0).toUpperCase())}</div>
              <div>
                <strong class="member-display-name">${escapeHtml(identity.name)}</strong>
                ${identity.hasBoth ? `<span class="member-subphone">${escapeHtml(identity.phone)}</span>` : ''}
              </div>
            </div>
          </td>
          <td><code>${escapeHtml(identity.phone || identity.name)}</code></td>
          <td>
            <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
              ${adminBadge}
              ${blockedBadge}
            </div>
          </td>
          <td><span class="badge badge-count">${(member.chat_count || 0).toLocaleString()}</span></td>
          <td class="text-right">
            <div style="display: flex; justify-content: flex-end; gap: 6px;">
              ${removeBtn}
              ${blockBtn}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  if (window.lucide) lucide.createIcons();
}

window.promptKickMember = function (groupJid, userJid, name) {
  const targetGroupJid = groupJid || state.selectedGroupJid;
  if (!targetGroupJid || !userJid) {
    showToast('Missing group or user identity.', 'danger');
    return;
  }

  showConfirmDialog({
    title: 'Remove Group Member',
    message: `Are you sure you want to <strong>REMOVE ${escapeHtml(name || userJid)}</strong> from this WhatsApp group?`,
    confirmText: 'Yes, Remove Member',
    confirmBtnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        showToast(`Removing ${name || userJid}...`, 'info');
        const res = await authFetch(`/api/groups/${encodeURIComponent(targetGroupJid)}/kick`, {
          method: 'POST',
          body: { userJid },
        });
        const json = await res.json();
        if (json.success) {
          showToast(json.message, 'success');
          if (state.modalActiveGroupJid === targetGroupJid) {
            openManageMembersModal(targetGroupJid);
          }
          if (state.selectedGroupJid === targetGroupJid) {
            loadGroupLeaderboard(targetGroupJid, false);
          }
        } else {
          showToast(`Error: ${json.error}`, 'danger');
        }
      } catch (err) {
        showToast('Failed to remove member: ' + err.message, 'danger');
      }
    },
  });
};

window.selectGroup = function (groupJid) {
  state.selectedGroupJid = groupJid;
  if (elements.groupSelector) elements.groupSelector.value = groupJid;
  const currentGroup = state.groups.find((g) => g.id === groupJid);

  if (currentGroup) {
    if (elements.settingsGroupNameBadge) elements.settingsGroupNameBadge.textContent = currentGroup.name || groupJid;
    if (elements.chatCurrentGroupName) {
      elements.chatCurrentGroupName.textContent = currentGroup.name || 'WhatsApp Group';
      elements.chatCurrentGroupDetails.textContent = `${currentGroup.participantsCount || 0} participants • ${currentGroup.isBotAdmin ? '🛡️ Bot Admin Active' : 'Member'}`;
    }
    if (elements.waBotAdminTag) {
      elements.waBotAdminTag.style.display = currentGroup.isBotAdmin ? 'inline-block' : 'none';
    }
    if (elements.waActiveGroupAvatar) {
      const initial = (currentGroup.name || 'W').charAt(0).toUpperCase();
      elements.waActiveGroupAvatar.style.background = getAvatarBgColor(currentGroup.name || currentGroup.id);
      elements.waActiveGroupAvatar.innerHTML = `<span>${escapeHtml(initial)}</span>`;
    }
    updateBotAdminNotice(currentGroup.isBotAdmin);
  }

  // Update active item in wa-chat-list
  if (elements.waChatList) {
    elements.waChatList.querySelectorAll('.wa-chat-item').forEach((el) => {
      if (el.getAttribute('data-group-jid') === groupJid) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  // Clear search on group switch
  state.chatSearchQuery = '';
  if (elements.chatSearchInput) elements.chatSearchInput.value = '';
  if (elements.btnClearChatSearch) elements.btnClearChatSearch.style.display = 'none';

  loadGroupLeaderboard(groupJid);
  loadGroupSettings(groupJid);
  loadGroupMessages(groupJid, true);
};

function updateBotAdminNotice(isBotAdmin) {
  if (isBotAdmin) {
    elements.botAdminStatusTitle.textContent = 'Bot Has Admin Permissions';
    elements.botAdminStatusDesc.textContent = 'Automatic message deletion for Instagram and TikTok links is active.';
  } else {
    elements.botAdminStatusTitle.textContent = 'Bot Permissions Restricted';
    elements.botAdminStatusDesc.textContent = 'Promote bot to Group Admin in WhatsApp to enable auto-deletion.';
  }
}

// ==========================================================================
// Leaderboard Management
// ==========================================================================
async function loadGroupLeaderboard(groupJid, showLoading = true) {
  if (!groupJid) return;
  if (showLoading) {
    elements.leaderboardTbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          <div class="spinner" style="margin: 0 auto 8px auto;"></div>
          <p>Loading member chat analytics...</p>
        </td>
      </tr>`;
  }

  try {
    const res = await authFetch(`/api/groups/${encodeURIComponent(groupJid)}/stats`);
    const json = await res.json();
    if (json.success && json.data) {
      state.leaderboard = json.data.leaderboard || [];
      state.blockedMembers = json.data.blockedMembers || [];
      renderLeaderboard(state.leaderboard);
      renderBlockedMembers(state.blockedMembers);
      updateActivityChart(state.leaderboard);
      if (json.data.isBotAdmin !== undefined) {
        updateBotAdminNotice(json.data.isBotAdmin);
      }
    }
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
  }
}

function renderLeaderboard(members) {
  const query = elements.leaderboardSearch.value.toLowerCase().trim();
  const filtered = members.filter(
    (m) =>
      (m.user_name && m.user_name.toLowerCase().includes(query)) ||
      (m.user_jid && m.user_jid.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    elements.leaderboardTbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          <i data-lucide="inbox"></i>
          <p>${query ? 'No matching members found.' : 'No chat activity recorded yet for this group.'}</p>
        </td>
      </tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  elements.leaderboardTbody.innerHTML = filtered
    .map((member, index) => {
      const rank = index + 1;
      const rankBadge =
        rank === 1
          ? '<span class="rank-badge rank-1">🥇 1</span>'
          : rank === 2
            ? '<span class="rank-badge rank-2">🥈 2</span>'
            : rank === 3
              ? '<span class="rank-badge rank-3">🥉 3</span>'
              : `<span class="rank-badge rank-other">${rank}</span>`;

      const identity = formatUserIdentity(member.user_name, member.user_jid);
      const lastActive = formatTimeAgo(member.last_active);
      const adminBadge = member.isAdmin ? '<span class="badge badge-admin">Admin</span>' : '';
      const blockedBadge = member.isBlocked
        ? '<span class="badge btn-danger" style="font-size: 0.65rem; padding: 1px 6px;">🚫 Blocked</span>'
        : '';

      const blockButton = member.isBlocked
        ? `<button class="btn btn-secondary btn-sm" onclick="promptUnblockMember('${escapeHtml(member.group_jid)}', '${escapeHtml(member.user_jid)}', '${escapeHtml(identity.name)}')">
             <i data-lucide="shield-check"></i>
             <span>Unblock</span>
           </button>`
        : `<button class="btn btn-secondary btn-sm text-danger" onclick="promptBlockMember('${escapeHtml(member.group_jid)}', '${escapeHtml(member.user_jid)}', '${escapeHtml(identity.name)}')">
             <i data-lucide="user-x"></i>
             <span>Block</span>
           </button>`;

      return `
        <tr>
          <td>${rankBadge}</td>
          <td>
            <div class="user-cell">
              <div class="user-avatar-sm">${escapeHtml(identity.name.charAt(0).toUpperCase())}</div>
              <div>
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <strong class="member-display-name">${escapeHtml(identity.name)}</strong>
                  ${adminBadge}
                  ${blockedBadge}
                </div>
                ${identity.hasBoth ? `<span class="member-subphone">${escapeHtml(identity.phone)}</span>` : ''}
              </div>
            </div>
          </td>
          <td><code>${escapeHtml(identity.phone || identity.name)}</code></td>
          <td>
            <span class="badge badge-count">${(member.chat_count || 0).toLocaleString()} chats</span>
          </td>
          <td><span class="text-dim">${lastActive}</span></td>
          <td class="text-right">
            <div style="display: flex; justify-content: flex-end; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="promptResetMember('${escapeHtml(member.group_jid)}', '${escapeHtml(member.user_jid)}', '${escapeHtml(identity.name)}')">
                <i data-lucide="rotate-ccw"></i>
                <span>Reset</span>
              </button>
              ${!member.isAdmin ? blockButton : ''}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  if (window.lucide) lucide.createIcons();
}

function renderBlockedMembers(blockedList) {
  if (!elements.blockedUsersTbody) return;
  if (elements.blockedCountBadge) {
    elements.blockedCountBadge.textContent = `${(blockedList || []).length} Blocked`;
  }

  if (!blockedList || blockedList.length === 0) {
    elements.blockedUsersTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          <i data-lucide="shield-check"></i>
          <p>No members are currently blocked in this group.</p>
        </td>
      </tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  elements.blockedUsersTbody.innerHTML = blockedList
    .map((b) => {
      const identity = formatUserIdentity(b.user_name, b.user_jid);
      const date = new Date(b.created_at).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      return `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar-sm">${escapeHtml(identity.name.charAt(0).toUpperCase())}</div>
              <div>
                <strong class="member-display-name">${escapeHtml(identity.name)}</strong>
                ${identity.hasBoth ? `<span class="member-subphone">${escapeHtml(identity.phone)}</span>` : ''}
              </div>
            </div>
          </td>
          <td><code>${escapeHtml(identity.phone || identity.name)}</code></td>
          <td><span class="text-dim">${date}</span></td>
          <td><span class="badge btn-danger" style="font-size: 0.72rem; padding: 2px 8px;">🚫 Auto-Delete Active</span></td>
          <td class="text-right">
            <button class="btn btn-secondary btn-sm" onclick="promptUnblockMember('${escapeHtml(b.group_jid)}', '${escapeHtml(b.user_jid)}', '${escapeHtml(identity.name)}')">
              <i data-lucide="shield-check"></i>
              <span>Unblock</span>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  if (window.lucide) lucide.createIcons();
}

window.promptBlockMember = function (groupJid, userJid, name) {
  const targetGroupJid = groupJid || state.selectedGroupJid;
  if (!targetGroupJid || !userJid) {
    showToast('Missing group or user identity.', 'danger');
    return;
  }

  showConfirmDialog({
    title: 'Block Group Member',
    message: `Are you sure you want to block <strong>${escapeHtml(name || userJid)}</strong> in this group? Any messages they send will be automatically deleted.`,
    confirmText: 'Yes, Block Member',
    confirmBtnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        showToast(`Blocking ${name || userJid}...`, 'info');
        const res = await authFetch(`/api/groups/${encodeURIComponent(targetGroupJid)}/block`, {
          method: 'POST',
          body: { userJid, userName: name },
        });
        const json = await res.json();
        if (json.success) {
          showToast(json.message, 'success');
          loadGroupLeaderboard(targetGroupJid, false);
        } else {
          showToast(`Error: ${json.error}`, 'danger');
        }
      } catch (err) {
        showToast('Failed to block: ' + err.message, 'danger');
      }
    },
  });
};

window.promptUnblockMember = function (groupJid, userJid, name) {
  const targetGroupJid = groupJid || state.selectedGroupJid;
  if (!targetGroupJid || !userJid) {
    showToast('Missing group or user identity.', 'danger');
    return;
  }

  showConfirmDialog({
    title: 'Unblock Group Member',
    message: `Are you sure you want to unblock <strong>${escapeHtml(name || userJid)}</strong>? Their messages will no longer be deleted.`,
    confirmText: 'Yes, Unblock',
    confirmBtnClass: 'btn-primary',
    onConfirm: async () => {
      try {
        showToast(`Unblocking ${name || userJid}...`, 'info');
        const res = await authFetch(`/api/groups/${encodeURIComponent(targetGroupJid)}/unblock`, {
          method: 'POST',
          body: { userJid },
        });
        const json = await res.json();
        if (json.success) {
          showToast(json.message, 'success');
          loadGroupLeaderboard(targetGroupJid, false);
        } else {
          showToast(`Error: ${json.error}`, 'danger');
        }
      } catch (err) {
        showToast('Failed to unblock: ' + err.message, 'danger');
      }
    },
  });
};

// ==========================================================================
// Chart.js Activity Visualization
// ==========================================================================
function initActivityChart() {
  const ctx = document.getElementById('activityChart')?.getContext('2d');
  if (!ctx) return;

  state.chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['No Data'],
      datasets: [
        {
          data: [1],
          backgroundColor: ['rgba(255, 255, 255, 0.05)'],
          borderColor: 'transparent',
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: state.theme === 'light' ? '#475569' : '#94A3B8',
            font: { family: 'Outfit', size: 11 },
            boxWidth: 12,
            padding: 8,
          },
        },
      },
      cutout: '68%',
    },
  });
}

function updateActivityChart(members) {
  if (!state.chartInstance) return;

  if (!members || members.length === 0) {
    state.chartInstance.data.labels = ['No Data'];
    state.chartInstance.data.datasets[0].data = [1];
    state.chartInstance.data.datasets[0].backgroundColor = ['rgba(255, 255, 255, 0.05)'];
    state.chartInstance.update();
    return;
  }

  const top = members.slice(0, 4);
  const othersCount = members.slice(4).reduce((sum, m) => sum + m.chat_count, 0);

  const labels = top.map((m) => m.user_name || m.user_jid.split('@')[0]);
  const data = top.map((m) => m.chat_count);

  if (othersCount > 0) {
    labels.push('Others');
    data.push(othersCount);
  }

  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#64748B'];

  state.chartInstance.data.labels = labels;
  state.chartInstance.data.datasets[0].data = data;
  state.chartInstance.data.datasets[0].backgroundColor = colors.slice(0, labels.length);
  state.chartInstance.update();
}

// ==========================================================================
// Settings Management
// ==========================================================================
async function loadGroupSettings(groupJid) {
  if (!groupJid) return;
  try {
    const res = await authFetch(`/api/groups/${encodeURIComponent(groupJid)}/settings`);
    const json = await res.json();
    if (json.success && json.data) {
      applySettingsToForm(json.data);
    }
  } catch (err) {
    console.error('Failed to load group settings:', err);
  }
}

function applySettingsToForm(settings) {
  state.settings = settings;
  elements.toggleBlockInstagram.checked = Boolean(settings.block_instagram);
  elements.toggleBlockTikTok.checked = Boolean(settings.block_tiktok);
  elements.toggleDeleteLinks.checked = Boolean(settings.delete_links);
  elements.toggleWarnUser.checked = Boolean(settings.warn_user);
  elements.toggleAutoReplyHi.checked = Boolean(settings.auto_reply_hi);
  if (elements.toggleAiEnabled) {
    elements.toggleAiEnabled.checked = settings.ai_enabled !== undefined ? Boolean(settings.ai_enabled) : false;
  }
  if (elements.toggleAiImageGen) {
    elements.toggleAiImageGen.checked = settings.ai_image_gen_enabled !== undefined ? Boolean(settings.ai_image_gen_enabled) : true;
  }

  // Automatic Chat Removal
  if (elements.toggleAutoRemoveChat) {
    const isAutoRemove = Boolean(settings.auto_remove_chat);
    elements.toggleAutoRemoveChat.checked = isAutoRemove;
    if (elements.panelAutoRemoveMode) {
      elements.panelAutoRemoveMode.style.display = isAutoRemove ? 'block' : 'none';
    }
  }

  const autoRemoveMode = settings.auto_remove_mode || 'remove_image';
  if (elements.radioRemoveImage && elements.radioRemoveText) {
    if (autoRemoveMode === 'remove_text') {
      elements.radioRemoveText.checked = true;
      if (elements.cardRemoveText) elements.cardRemoveText.classList.add('active');
      if (elements.cardRemoveImage) elements.cardRemoveImage.classList.remove('active');
    } else {
      elements.radioRemoveImage.checked = true;
      if (elements.cardRemoveImage) elements.cardRemoveImage.classList.add('active');
      if (elements.cardRemoveText) elements.cardRemoveText.classList.remove('active');
    }
  }

  if (elements.inputPassiveThreshold) {
    elements.inputPassiveThreshold.value = settings.passive_threshold !== undefined ? settings.passive_threshold : 5;
  }

  // Non-Admin Command Delegation
  if (elements.toggleAllowNonAdminCommands) {
    const isAllowed = Boolean(settings.allow_non_admin_commands);
    elements.toggleAllowNonAdminCommands.checked = isAllowed;
    if (elements.panelAllowedAdminCommands) {
      elements.panelAllowedAdminCommands.style.display = isAllowed ? 'block' : 'none';
    }
  }

  const allowedCmds = (settings.allowed_non_admin_commands || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const cmdCheckboxes = document.querySelectorAll('.admin-cmd-checkbox');
  cmdCheckboxes.forEach((cb) => {
    cb.checked = allowedCmds.includes(cb.value.toLowerCase());
  });

  elements.customWarningText.value = settings.custom_warning || '';
  elements.customReplyText.value = settings.custom_reply || '';
}

async function saveGroupSettings(e) {
  e.preventDefault();
  if (!state.selectedGroupJid) {
    showToast('Please select a WhatsApp group first', 'warning');
    return;
  }

  const selectedAdminCmds = [];
  document.querySelectorAll('.admin-cmd-checkbox:checked').forEach((cb) => {
    selectedAdminCmds.push(cb.value.trim().toLowerCase());
  });

  const selectedAutoRemoveMode = document.querySelector('input[name="auto_remove_mode"]:checked')?.value || 'remove_image';

  const payload = {
    block_instagram: elements.toggleBlockInstagram.checked,
    block_tiktok: elements.toggleBlockTikTok.checked,
    delete_links: elements.toggleDeleteLinks.checked,
    warn_user: elements.toggleWarnUser.checked,
    auto_reply_hi: elements.toggleAutoReplyHi.checked,
    ai_enabled: elements.toggleAiEnabled ? elements.toggleAiEnabled.checked : false,
    ai_image_gen_enabled: elements.toggleAiImageGen ? elements.toggleAiImageGen.checked : true,
    auto_remove_chat: elements.toggleAutoRemoveChat ? elements.toggleAutoRemoveChat.checked : false,
    auto_remove_mode: selectedAutoRemoveMode,
    passive_threshold: elements.inputPassiveThreshold ? (parseInt(elements.inputPassiveThreshold.value, 10) || 5) : 5,
    allow_non_admin_commands: elements.toggleAllowNonAdminCommands ? elements.toggleAllowNonAdminCommands.checked : false,
    allowed_non_admin_commands: selectedAdminCmds.join(','),
    custom_warning: elements.customWarningText.value.trim() || null,
    custom_reply: elements.customReplyText.value.trim() || null,
  };

  try {
    const res = await authFetch(`/api/groups/${encodeURIComponent(state.selectedGroupJid)}/settings`, {
      method: 'POST',
      body: payload,
    });
    const json = await res.json();
    if (json.success) {
      showToast('Settings saved successfully!', 'success');
    } else {
      showToast(`Error: ${json.error}`, 'danger');
    }
  } catch (err) {
    showToast('Failed to save settings: ' + err.message, 'danger');
  }
}

// ==========================================================================
// Reset Chat Counts
// ==========================================================================
window.promptResetMember = function (groupJid, userJid, userName) {
  state.pendingReset = { groupJid, userJid, userName, type: 'single' };
  elements.confirmModalTitle.textContent = `Clear Chat Count for ${userName}`;
  elements.confirmModalMsg.textContent = `Are you sure you want to reset ${userName}'s chat count to 0?`;
  openModal(elements.confirmModal);
};

function promptResetGroup() {
  if (!state.selectedGroupJid) {
    showToast('Select a group first', 'warning');
    return;
  }
  const group = state.groups.find((g) => g.id === state.selectedGroupJid);
  const groupName = group?.name || state.selectedGroupJid;

  state.pendingReset = { groupJid: state.selectedGroupJid, groupName, type: 'group' };
  elements.confirmModalTitle.textContent = `Reset All Chat Counts in ${groupName}`;
  elements.confirmModalMsg.textContent = `Are you sure you want to reset chat counts for ALL members in this group to 0?`;
  openModal(elements.confirmModal);
}

async function executeReset() {
  if (!state.pendingReset) return;

  const { groupJid, userJid, groupName, type } = state.pendingReset;
  try {
    const res = await authFetch(`/api/groups/${encodeURIComponent(groupJid)}/reset`, {
      method: 'POST',
      body: { userJid: type === 'single' ? userJid : null, groupName },
    });

    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      closeModal(elements.confirmModal);
      loadGroupLeaderboard(groupJid, false);
      fetchStatsSummary();
    } else {
      showToast(`Reset failed: ${json.error}`, 'danger');
    }
  } catch (err) {
    showToast('Error executing reset: ' + err.message, 'danger');
  } finally {
    state.pendingReset = null;
  }
}

// ==========================================================================
// Group Chats Live Stream & History Retrieval
// ==========================================================================
async function loadGroupMessages(groupJid, reset = true) {
  if (!groupJid) return;

  if (reset) {
    state.messages = [];
    state.chatOldestTimestamp = null;
    state.chatHasMore = false;
    elements.chatMessagesArea.innerHTML = '';
    elements.chatEmptyState.style.display = 'none';
  }

  let url = `/api/groups/${encodeURIComponent(groupJid)}/messages?limit=50`;
  if (state.chatSearchQuery) {
    url += `&search=${encodeURIComponent(state.chatSearchQuery)}`;
  }

  try {
    const res = await authFetch(url);
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      state.messages = json.data;
      state.chatHasMore = Boolean(json.pagination?.hasMore);
      state.chatOldestTimestamp = json.pagination?.oldestTimestamp || null;

      renderChatMessages(state.messages, false);
      updateChatHeaderBadge(json.pagination?.totalCount || json.data.length);
      updateLoadMoreButton();

      if (state.messages.length === 0) {
        elements.chatEmptyState.style.display = 'flex';
      } else {
        elements.chatEmptyState.style.display = 'none';
        scrollToChatBottom();
      }
    }
  } catch (err) {
    console.error('Failed to load group messages:', err);
  }
}

async function loadOlderGroupMessages() {
  if (!state.selectedGroupJid || !state.chatOldestTimestamp || state.isLoadingOlder) return;

  state.isLoadingOlder = true;
  elements.btnLoadOlderMessages.disabled = true;
  elements.btnLoadOlderMessages.innerHTML = `<div class="spinner-sm"></div> <span>Loading older messages...</span>`;

  const previousScrollHeight = elements.chatMessagesArea.scrollHeight;
  const previousScrollTop = elements.chatMessagesArea.scrollTop;

  let url = `/api/groups/${encodeURIComponent(state.selectedGroupJid)}/messages?limit=50&before=${state.chatOldestTimestamp}`;
  if (state.chatSearchQuery) {
    url += `&search=${encodeURIComponent(state.chatSearchQuery)}`;
  }

  try {
    const res = await authFetch(url);
    const json = await res.json();

    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      state.messages = [...json.data, ...state.messages];
      state.chatHasMore = Boolean(json.pagination?.hasMore);
      state.chatOldestTimestamp = json.pagination?.oldestTimestamp || json.data[0].timestamp;

      renderChatMessages(state.messages, false);
      updateChatHeaderBadge(json.pagination?.totalCount || state.messages.length);

      // Preserve exact scroll offset
      const newScrollHeight = elements.chatMessagesArea.scrollHeight;
      elements.chatMessagesArea.scrollTop = previousScrollTop + (newScrollHeight - previousScrollHeight);
    } else {
      state.chatHasMore = false;
    }
  } catch (err) {
    showToast('Failed to load older messages: ' + err.message, 'danger');
  } finally {
    state.isLoadingOlder = false;
    elements.btnLoadOlderMessages.disabled = false;
    elements.btnLoadOlderMessages.innerHTML = `<i data-lucide="history"></i> <span>Load Older Messages</span>`;
    updateLoadMoreButton();
    if (window.lucide) lucide.createIcons();
  }
}

function updateLoadMoreButton() {
  if (elements.chatLoadMoreWrap) {
    elements.chatLoadMoreWrap.style.display = state.chatHasMore ? 'flex' : 'none';
  }
}

function updateChatHeaderBadge(totalCount) {
  if (elements.chatTotalBadge) {
    elements.chatTotalBadge.textContent = `${totalCount.toLocaleString()} Messages`;
  }
}

function formatDateDivider(timestamp) {
  if (!timestamp) return 'TODAY';
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return 'TODAY';
  if (isYesterday) return 'YESTERDAY';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function renderChatMessages(messages, scrollToBottom = false) {
  elements.chatMessagesArea.innerHTML = '';

  if (!messages || messages.length === 0) {
    elements.chatEmptyState.style.display = 'flex';
    return;
  }

  elements.chatEmptyState.style.display = 'none';

  let lastDateStr = null;

  messages.forEach((msg) => {
    const msgDateStr = new Date(msg.timestamp).toDateString();
    if (msgDateStr !== lastDateStr) {
      const divider = document.createElement('div');
      divider.className = 'wa-date-divider';
      divider.innerHTML = `<span>${formatDateDivider(msg.timestamp)}</span>`;
      elements.chatMessagesArea.appendChild(divider);
      lastDateStr = msgDateStr;
    }
    appendChatMessage(msg, false);
  });

  if (scrollToBottom) {
    scrollToChatBottom();
  }
}

function appendChatMessage(msg, shouldScroll = true) {
  if (!msg) return;

  // Deduplication check: Do not re-render if message is already in DOM
  const uniqueKey = msg.id ? `db-${msg.id}` : (msg.message_id ? `msg-${msg.message_id}` : `tmp-${msg.timestamp}-${msg.sender_jid}`);
  if (document.getElementById(`chat-msg-${uniqueKey}`)) {
    return;
  }

  // Also maintain state.messages deduplication
  const alreadyInState = state.messages.some((m) =>
    (m.id && msg.id && m.id === msg.id) ||
    (m.message_id && msg.message_id && m.message_id === msg.message_id)
  );
  if (!alreadyInState) {
    state.messages.push(msg);
  }

  if (elements.chatEmptyState) {
    elements.chatEmptyState.style.display = 'none';
  }

  const isOutgoing = Boolean(msg.is_from_me);
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const identity = isOutgoing ? { name: 'Admin (You)', phone: '', hasBoth: false } : formatUserIdentity(msg.sender_name, msg.sender_jid);

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble-wrap ${isOutgoing ? 'outgoing' : 'incoming'}`;
  bubble.id = `chat-msg-${uniqueKey}`;

  let highlightedText = escapeHtml(msg.message_text);
  if (state.chatSearchQuery) {
    const regex = new RegExp(`(${escapeRegex(state.chatSearchQuery)})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  const senderColor = getSenderColor(msg.sender_jid || msg.sender_name || 'user');
  const senderHtml = isOutgoing
    ? ''
    : `<div class="chat-bubble-sender">
        <span class="sender-name" style="color: ${senderColor};">${escapeHtml(identity.name)}</span>
        ${identity.hasBoth ? `<span class="sender-phone">${escapeHtml(identity.phone)}</span>` : ''}
      </div>`;

  bubble.innerHTML = `
    <div class="chat-bubble">
      ${senderHtml}
      <div class="chat-bubble-text">${highlightedText}</div>
      <div class="chat-bubble-meta">
        <span class="chat-bubble-time">${time}</span>
        ${isOutgoing ? `<i data-lucide="check-check" class="chat-check-icon"></i>` : ''}
      </div>
    </div>
  `;

  elements.chatMessagesArea.appendChild(bubble);
  if (window.lucide) lucide.createIcons();

  if (shouldScroll) {
    scrollToChatBottom();
  }
}

function scrollToChatBottom() {
  setTimeout(() => {
    elements.chatMessagesArea.scrollTop = elements.chatMessagesArea.scrollHeight;
  }, 50);
}

async function handleSendChatMessage(e) {
  e.preventDefault();
  const text = elements.chatInputText.value.trim();
  if (!text) return;

  if (!state.selectedGroupJid) {
    showToast('Please select a WhatsApp group to chat in.', 'warning');
    return;
  }

  elements.btnSendChat.disabled = true;
  elements.btnSendChat.innerHTML = '<div class="spinner-sm"></div>';

  try {
    const res = await authFetch(`/api/groups/${encodeURIComponent(state.selectedGroupJid)}/send-message`, {
      method: 'POST',
      body: { text },
    });

    const json = await res.json();
    if (json.success) {
      elements.chatInputText.value = '';
      if (json.data) {
        appendChatMessage(json.data, true);
      }
    } else {
      showToast(`Error sending message: ${json.error}`, 'danger');
    }
  } catch (err) {
    showToast('Failed to send message: ' + err.message, 'danger');
  } finally {
    elements.btnSendChat.disabled = false;
    elements.btnSendChat.innerHTML = '<i data-lucide="send"></i>';
    if (window.lucide) lucide.createIcons();
    elements.chatInputText.focus();
  }
}

// ==========================================================================
// Logs & Activity
// ==========================================================================
async function fetchRecentLogs() {
  try {
    const res = await authFetch('/api/logs?limit=50');
    const json = await res.json();
    if (json.success && json.data) {
      state.logs = json.data;
      renderLogsTable(state.logs);
    }
  } catch (err) {
    console.error('Failed to fetch activity logs:', err);
  }
}

function renderLogsTable(logs) {
  if (!logs || logs.length === 0) {
    elements.logsTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          <i data-lucide="clock"></i>
          <p>No activity recorded yet.</p>
        </td>
      </tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  elements.logsTbody.innerHTML = logs
    .map((log) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      let badgeClass = 'badge-info';
      let actionLabel = log.action_type;

      if (log.action_type.startsWith('LINK_BLOCKED')) {
        badgeClass = 'btn-danger';
        actionLabel = '🛡️ ' + log.action_type.replace('LINK_BLOCKED_', '');
      } else if (log.action_type === 'HI_REPLIED') {
        badgeClass = 'badge-count';
        actionLabel = '👋 HI REPLIED';
      } else if (log.action_type === 'BOT_CONNECTED') {
        badgeClass = 'status-connected';
        actionLabel = '🟢 CONNECTED';
      } else if (log.action_type === 'ADMIN_TAGALL') {
        badgeClass = 'badge-count';
        actionLabel = '📢 TAG ALL';
      } else if (log.action_type === 'ADMIN_DELETE_MESSAGE') {
        badgeClass = 'btn-danger';
        actionLabel = '🗑️ DELETED MSG';
      } else if (log.action_type === 'ADMIN_KICK_MEMBER') {
        badgeClass = 'btn-danger';
        actionLabel = '👢 KICKED';
      } else if (log.action_type === 'ADMIN_HIDETAG') {
        badgeClass = 'badge-count';
        actionLabel = '📣 HIDETAG';
      } else if (log.action_type === 'STICKER_CREATED') {
        badgeClass = 'badge-count';
        actionLabel = '🎨 STICKER';
      } else if (log.action_type === 'COMMAND_INACTIVE') {
        badgeClass = 'badge-count';
        actionLabel = '📋 INACTIVE';
      } else if (log.action_type === 'COMMAND_CHATCOUNT') {
        badgeClass = 'badge-count';
        actionLabel = '📊 CHATCOUNT';
      }

      const logUser = formatUserIdentity(log.user_name, log.user_jid);
      return `
        <tr>
          <td><code style="font-size: 0.78rem;">${time}</code></td>
          <td><strong>${escapeHtml(log.group_name || 'System / Global')}</strong></td>
          <td>
            <strong>${escapeHtml(logUser.name)}</strong>
            ${logUser.hasBoth ? `<span class="text-dim" style="font-size: 0.75rem; display: block;">${escapeHtml(logUser.phone)}</span>` : ''}
          </td>
          <td><span class="${badgeClass}" style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px;">${actionLabel}</span></td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(log.details || '')}</td>
        </tr>
      `;
    })
    .join('');

  if (window.lucide) lucide.createIcons();
}

function addLogEntry(entry) {
  state.logs.unshift(entry);
  if (state.logs.length > 50) state.logs.pop();
  renderLogsTable(state.logs);
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners() {
  // Authentication Listeners
  if (elements.authTabLogin) {
    elements.authTabLogin.addEventListener('click', () => switchAuthMode('login'));
  }
  if (elements.authTabRegister) {
    elements.authTabRegister.addEventListener('click', () => switchAuthMode('register'));
  }
  if (elements.authForm) {
    elements.authForm.addEventListener('submit', handleAuthSubmit);
  }

  // Single User Profile Card Click -> Open Popup
  if (elements.userProfileCard) {
    elements.userProfileCard.addEventListener('click', openUserSettingsPopup);
    elements.userProfileCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openUserSettingsPopup();
      }
    });
  }

  // User Settings Popup Actions
  if (elements.btnCloseUserSettings) {
    elements.btnCloseUserSettings.addEventListener('click', () => closeModal(elements.userSettingsModal));
  }
  if (elements.btnDismissUserSettings) {
    elements.btnDismissUserSettings.addEventListener('click', () => closeModal(elements.userSettingsModal));
  }
  if (elements.btnPopupThemeToggle) {
    elements.btnPopupThemeToggle.addEventListener('click', toggleTheme);
  }
  if (elements.btnPopupOpenQr) {
    elements.btnPopupOpenQr.addEventListener('click', () => {
      closeModal(elements.userSettingsModal);
      renderQrCode(state.qrCodeUrl);
      openModal(elements.qrModal);
    });
  }
  if (elements.btnPopupUnlink) {
    elements.btnPopupUnlink.addEventListener('click', handleUnlinkWhatsapp);
  }
  if (elements.btnPopupLogout) {
    elements.btnPopupLogout.addEventListener('click', handleUserLogout);
  }
  if (elements.btnPopupDeleteAccount) {
    elements.btnPopupDeleteAccount.addEventListener('click', promptDeleteAccount);
  }
  if (elements.btnRefreshPopupSys) {
    elements.btnRefreshPopupSys.addEventListener('click', () => {
      showToast('Refreshing system diagnostics...', 'info');
      fetchSystemDiagnostics();
    });
  }

  // Crash Logger Event Handlers
  if (elements.btnRefreshCrashLogs) {
    elements.btnRefreshCrashLogs.addEventListener('click', () => {
      showToast('Refreshing crash logs...', 'info');
      fetchCrashLogs();
    });
  }

  if (elements.btnClearCrashLogs) {
    elements.btnClearCrashLogs.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear all crash logs?')) return;
      try {
        const res = await authFetch('/api/system/crashes', { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          showToast('Crash logs cleared successfully.', 'success');
          fetchCrashLogs();
        } else {
          showToast(json.error || 'Failed to clear crash logs', 'error');
        }
      } catch (err) {
        showToast('Error clearing crash logs', 'error');
      }
    });
  }

  if (elements.btnSimulateTestCrash) {
    elements.btnSimulateTestCrash.addEventListener('click', async () => {
      const types = ['oom', 'network', 'generic'];
      const pick = types[Math.floor(Math.random() * types.length)];
      try {
        const res = await authFetch('/api/system/crashes/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sampleType: pick }),
        });
        const json = await res.json();
        if (json.success) {
          showToast(`Test crash logged: ${pick.toUpperCase()}`, 'info');
          fetchCrashLogs();
        }
      } catch (err) {
        showToast('Failed to simulate test crash', 'error');
      }
    });
  }

  if (elements.btnModViewCrashes) {
    elements.btnModViewCrashes.addEventListener('click', () => {
      openUserSettingsPopup();
      setTimeout(() => {
        if (elements.popupCrashCard) {
          elements.popupCrashCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    });
  }

  // Tab Switching
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      elements.navTabs.forEach((t) => t.classList.remove('active'));
      elements.tabContents.forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.dataset.tab}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');

      // Update page titles
      if (tab.dataset.tab === 'overview') {
        elements.pageHeading.textContent = 'Group Overview & Analytics';
        elements.pageSubheading.textContent = 'Real-time chat activity, Instagram/TikTok link blocker, and group controls.';
      } else if (tab.dataset.tab === 'groups') {
        elements.pageHeading.textContent = 'WhatsApp Groups';
        elements.pageSubheading.textContent = 'All connected groups and member metrics';
      } else if (tab.dataset.tab === 'moderation') {
        elements.pageHeading.textContent = 'Link Security & Settings';
        elements.pageSubheading.textContent = 'Configure Instagram, TikTok link blocking, and auto-reply';
      } else if (tab.dataset.tab === 'logs') {
        elements.pageHeading.textContent = 'Live Activity Logs';
        elements.pageSubheading.textContent = 'Real-time audit trail of moderation and chat events';
      } else if (tab.dataset.tab === 'chats') {
        elements.pageHeading.textContent = 'Group Live Chat Stream';
        elements.pageSubheading.textContent = 'View group conversations in real-time, retrieve past messages, and send messages as admin';
        if (state.selectedGroupJid) {
          loadGroupMessages(state.selectedGroupJid);
        }
      } else if (tab.dataset.tab === 'chatbot') {
        elements.pageHeading.textContent = 'On-Device AI Chatbot';
        elements.pageSubheading.textContent = 'ChatGPT & Google Gemini experience powered by local Qwen 3.5 foundation models';
        initChatbot();
      } else if (tab.dataset.tab === 'models') {
        elements.pageHeading.textContent = 'AI Model Management & Settings';
        elements.pageSubheading.textContent = 'Download, switch, and configure on-device Qwen 3.5 foundation models';
        fetchAIModelsAndStatus();
        runSystemCheck();
      } else if (tab.dataset.tab === 'help') {
        elements.pageHeading.textContent = 'Help & Commands Guide';
        elements.pageSubheading.textContent = 'Learn how to use in-chat admin commands and group automation features';
      }

      // Close mobile navigation drawer if open
      closeMobileSidebar();

      if (window.lucide) lucide.createIcons();
    });
  });

  // AI Chatbot Event Handlers (ChatGPT & Gemini UI)
  setupChatbotEvents();

  // AI Models Tab & Controls
  if (elements.btnSaveContextLength) {
    elements.btnSaveContextLength.addEventListener('click', handleContextLengthChange);
  }
  if (elements.btnRefreshModelsList) {
    elements.btnRefreshModelsList.addEventListener('click', () => {
      showToast('Refreshing AI models list...', 'info');
      fetchAIModelsAndStatus();
    });
  }

  // Account & Preferences Modal AI Selector
  if (elements.popupModelSelect) {
    elements.popupModelSelect.addEventListener('change', (e) => {
      handlePopupModelSelect(e.target.value);
    });
  }
  if (elements.btnPopupManageModels) {
    elements.btnPopupManageModels.addEventListener('click', () => {
      closeModal(elements.userSettingsModal);
      switchTab('models');
    });
  }

  // Master AI Toggle & Onboarding Listeners
  if (elements.btnOnboardEnableAi) {
    elements.btnOnboardEnableAi.addEventListener('click', async () => {
      try {
        await authFetch('/api/user/ai-status', {
          method: 'POST',
          body: { aiEnabled: 1, aiPrompted: 1, enableAllGroups: true },
        });
        state.aiMasterEnabled = true;
        state.aiPrompted = true;
        if (state.currentUser) {
          state.currentUser.aiEnabled = true;
          state.currentUser.ai_enabled = 1;
          state.currentUser.aiPrompted = true;
          state.currentUser.ai_prompted = 1;
        }
        updateChatbotAccessState();
        closeModal(elements.aiOnboardingModal);
        switchTab('models');
        showToast('AI features enabled! Choose an AI model to download.', 'success');
      } catch (err) {
        showToast('Failed to update AI status: ' + err.message, 'danger');
      }
    });
  }

  if (elements.btnOnboardSkipAi) {
    elements.btnOnboardSkipAi.addEventListener('click', async () => {
      try {
        await authFetch('/api/user/ai-status', {
          method: 'POST',
          body: { aiEnabled: 0, aiPrompted: 1 },
        });
        state.aiMasterEnabled = false;
        state.aiPrompted = true;
        if (state.currentUser) {
          state.currentUser.aiEnabled = false;
          state.currentUser.ai_enabled = 0;
          state.currentUser.aiPrompted = true;
          state.currentUser.ai_prompted = 1;
        }
        updateChatbotAccessState();
        closeModal(elements.aiOnboardingModal);
        showToast('AI features remain disabled. You can enable them anytime in Settings.', 'info');
      } catch (err) {
        showToast('Failed to update AI status: ' + err.message, 'danger');
      }
    });
  }

  if (elements.toggleUserAiMaster) {
    elements.toggleUserAiMaster.addEventListener('change', async (e) => {
      const isEnabled = e.target.checked;
      try {
        const res = await authFetch('/api/user/ai-status', {
          method: 'POST',
          body: { aiEnabled: isEnabled ? 1 : 0, enableAllGroups: isEnabled },
        });
        const json = await res.json();
        if (json.success) {
          state.aiMasterEnabled = isEnabled;
          if (state.currentUser) {
            state.currentUser.aiEnabled = isEnabled;
            state.currentUser.ai_enabled = isEnabled ? 1 : 0;
          }
          updateChatbotAccessState();
          showToast(isEnabled ? 'AI features enabled globally.' : 'AI features disabled. Background AI process stopped.', isEnabled ? 'success' : 'info');
          if (state.selectedGroupJid && typeof loadGroupSettings === 'function') {
            loadGroupSettings(state.selectedGroupJid);
          }
        } else {
          throw new Error(json.error || 'Failed to update');
        }
      } catch (err) {
        showToast('Failed to update master AI toggle: ' + err.message, 'danger');
        e.target.checked = !isEnabled;
      }
    });
  }

  if (elements.btnEnableAiFromChatbot) {
    elements.btnEnableAiFromChatbot.addEventListener('click', async () => {
      try {
        await authFetch('/api/user/ai-status', {
          method: 'POST',
          body: { aiEnabled: 1, enableAllGroups: true },
        });
        state.aiMasterEnabled = true;
        if (state.currentUser) {
          state.currentUser.aiEnabled = true;
          state.currentUser.ai_enabled = 1;
        }
        updateChatbotAccessState();
        showToast('AI features enabled!', 'success');
        switchTab('models');
      } catch (err) {
        showToast('Failed to enable AI features: ' + err.message, 'danger');
      }
    });
  }

  // AI Crash Banner Actions
  if (elements.btnDismissAiCrash) {
    elements.btnDismissAiCrash.addEventListener('click', handleDismissAICrash);
  }
  if (elements.btnReEnableSafeAi) {
    elements.btnReEnableSafeAi.addEventListener('click', handleReEnableSafeAI);
  }

  // System Hardware Check Button
  if (elements.btnRunSystemCheck) {
    elements.btnRunSystemCheck.addEventListener('click', runSystemCheck);
  }

  // High-RAM Warning Confirmation Dialog Modal Actions
  if (elements.btnCloseRamWarning) {
    elements.btnCloseRamWarning.addEventListener('click', () => closeModal(elements.aiRamWarningModal));
  }
  if (elements.btnCancelRamWarning) {
    elements.btnCancelRamWarning.addEventListener('click', () => closeModal(elements.aiRamWarningModal));
  }
  if (elements.btnApplyRecommendedModel) {
    elements.btnApplyRecommendedModel.addEventListener('click', () => {
      closeModal(elements.aiRamWarningModal);
      executeModelApply(state.recommendedModelId || 'qwen-3.5-0.8b-q4');
    });
  }
  if (elements.btnProceedRamWarning) {
    elements.btnProceedRamWarning.addEventListener('click', () => {
      closeModal(elements.aiRamWarningModal);
      if (state.pendingApplyModelId) {
        executeModelApply(state.pendingApplyModelId);
      }
    });
  }

  // Context Length Configuration Save
  if (elements.btnSaveContextLength) {
    elements.btnSaveContextLength.addEventListener('click', handleContextLengthChange);
  }

  // Refresh Models List Button
  if (elements.btnRefreshModelsList) {
    elements.btnRefreshModelsList.addEventListener('click', () => {
      showToast('Refreshing AI models catalog & hardware stats...', 'info');
      fetchAIModelsAndStatus();
      runSystemCheck();
    });
  }

  // Mobile Navigation Drawer Toggle Listeners
  if (elements.btnMobileMenu) {
    elements.btnMobileMenu.addEventListener('click', openMobileSidebar);
  }
  if (elements.btnCloseSidebar) {
    elements.btnCloseSidebar.addEventListener('click', closeMobileSidebar);
  }
  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.addEventListener('click', closeMobileSidebar);
  }

  // Group Selector Change
  elements.groupSelector.addEventListener('change', (e) => {
    if (e.target.value) selectGroup(e.target.value);
  });

  // Refresh Button
  elements.btnRefreshData.addEventListener('click', () => {
    showToast('Refreshing data...', 'info');
    fetchInitialData();
  });

  // Chat Refresh Button
  if (elements.btnRefreshChat) {
    elements.btnRefreshChat.addEventListener('click', () => {
      if (state.selectedGroupJid) {
        showToast('Reloading group messages...', 'info');
        loadGroupMessages(state.selectedGroupJid);
      }
    });
  }

  // Chat Load Older Messages Button
  if (elements.btnLoadOlderMessages) {
    elements.btnLoadOlderMessages.addEventListener('click', loadOlderGroupMessages);
  }

  // Chat Search Input with Debounce
  if (elements.chatSearchInput) {
    elements.chatSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      state.chatSearchQuery = query;

      if (elements.btnClearChatSearch) {
        elements.btnClearChatSearch.style.display = query ? 'flex' : 'none';
      }

      clearTimeout(state.searchDebounceTimer);
      state.searchDebounceTimer = setTimeout(() => {
        if (state.selectedGroupJid) {
          loadGroupMessages(state.selectedGroupJid, false);
        }
      }, 250);
    });
  }

  // Clear Chat Search Button
  if (elements.btnClearChatSearch) {
    elements.btnClearChatSearch.addEventListener('click', () => {
      state.chatSearchQuery = '';
      elements.chatSearchInput.value = '';
      elements.btnClearChatSearch.style.display = 'none';
      if (state.selectedGroupJid) {
        loadGroupMessages(state.selectedGroupJid, true);
      }
    });
  }

  // Chat Send Form Submit
  if (elements.chatSendForm) {
    elements.chatSendForm.addEventListener('submit', handleSendChatMessage);
  }

  // WhatsApp Sidebar Group Search
  if (elements.waGroupsSearchInput) {
    elements.waGroupsSearchInput.addEventListener('input', (e) => {
      state.waGroupSearch = e.target.value;
      if (elements.btnWaClearGroupSearch) {
        elements.btnWaClearGroupSearch.style.display = e.target.value ? 'flex' : 'none';
      }
      renderWhatsAppChatList();
    });
  }

  // Clear WhatsApp Group Search
  if (elements.btnWaClearGroupSearch) {
    elements.btnWaClearGroupSearch.addEventListener('click', () => {
      state.waGroupSearch = '';
      if (elements.waGroupsSearchInput) elements.waGroupsSearchInput.value = '';
      elements.btnWaClearGroupSearch.style.display = 'none';
      renderWhatsAppChatList();
    });
  }

  // Refresh WhatsApp Groups
  if (elements.btnWaRefreshGroups) {
    elements.btnWaRefreshGroups.addEventListener('click', () => {
      showToast('Refreshing WhatsApp groups...', 'info');
      fetchGroups();
    });
  }

  // Mobile Back to Chats List
  if (elements.btnWaMobileBack) {
    elements.btnWaMobileBack.addEventListener('click', () => {
      if (elements.waSidebar) {
        elements.waSidebar.classList.remove('wa-mobile-hidden');
      }
    });
  }

  // Filter Chips (All, Groups, Admin)
  document.querySelectorAll('.wa-filter-chips .wa-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.wa-filter-chips .wa-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.waGroupFilter = chip.dataset.filter || 'all';
      renderWhatsAppChatList();
    });
  });

  // Leaderboard Search Filter
  elements.leaderboardSearch.addEventListener('input', () => {
    renderLeaderboard(state.leaderboard);
  });

  // Reset Group Button
  elements.btnResetGroupCounts.addEventListener('click', promptResetGroup);

  // Settings Form Submit
  elements.settingsForm.addEventListener('submit', saveGroupSettings);

  // Toggle Automatic Chat Removal Panel
  if (elements.toggleAutoRemoveChat) {
    elements.toggleAutoRemoveChat.addEventListener('change', (e) => {
      if (elements.panelAutoRemoveMode) {
        elements.panelAutoRemoveMode.style.display = e.target.checked ? 'block' : 'none';
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    });
  }

  // Radio button card highlight sync
  document.querySelectorAll('input[name="auto_remove_mode"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      if (elements.cardRemoveImage) elements.cardRemoveImage.classList.toggle('active', e.target.value === 'remove_image');
      if (elements.cardRemoveText) elements.cardRemoveText.classList.toggle('active', e.target.value === 'remove_text');
    });
  });

  // Toggle Non-Admin Command Delegation Panel
  if (elements.toggleAllowNonAdminCommands) {
    elements.toggleAllowNonAdminCommands.addEventListener('change', (e) => {
      if (elements.panelAllowedAdminCommands) {
        elements.panelAllowedAdminCommands.style.display = e.target.checked ? 'block' : 'none';
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    });
  }

  if (elements.btnSelectAllAdminCmds) {
    elements.btnSelectAllAdminCmds.addEventListener('click', () => {
      document.querySelectorAll('.admin-cmd-checkbox').forEach((cb) => {
        cb.checked = true;
      });
    });
  }

  if (elements.btnClearAllAdminCmds) {
    elements.btnClearAllAdminCmds.addEventListener('click', () => {
      document.querySelectorAll('.admin-cmd-checkbox').forEach((cb) => {
        cb.checked = false;
      });
    });
  }

  // Clear Logs View
  elements.btnClearLogsView.addEventListener('click', () => {
    state.logs = [];
    renderLogsTable([]);
    showToast('Logs view cleared', 'info');
  });

  // Group Members Modal
  if (elements.modalMemberSearch) {
    elements.modalMemberSearch.addEventListener('input', renderModalMembersList);
  }
  if (elements.btnCloseMembersModal) {
    elements.btnCloseMembersModal.addEventListener('click', () => closeModal(elements.groupMembersModal));
  }
  if (elements.btnDismissMembersModal) {
    elements.btnDismissMembersModal.addEventListener('click', () => closeModal(elements.groupMembersModal));
  }

  // Close Modals
  elements.btnCloseQr.addEventListener('click', () => {
    closeModal(elements.qrModal);
    checkAndPromptAIOnboarding();
  });
  elements.btnDismissModal.addEventListener('click', () => {
    closeModal(elements.qrModal);
    checkAndPromptAIOnboarding();
  });
  if (elements.btnCloseConfirm) {
    elements.btnCloseConfirm.addEventListener('click', (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      currentConfirmAction = null;
      state.pendingReset = null;
      closeModal(elements.confirmModal);
    });
  }
  if (elements.btnCancelConfirm) {
    elements.btnCancelConfirm.addEventListener('click', (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      currentConfirmAction = null;
      state.pendingReset = null;
      closeModal(elements.confirmModal);
    });
  }
  if (elements.btnExecuteConfirm) {
    elements.btnExecuteConfirm.addEventListener('click', async (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeModal(elements.confirmModal);
      if (typeof currentConfirmAction === 'function') {
        const action = currentConfirmAction;
        currentConfirmAction = null;
        await action();
      } else if (state.pendingReset) {
        await executeReset();
      }
    });
  }

  // Restart / Reset Session Button in QR Modal
  elements.btnRestartAuth.addEventListener('click', async () => {
    try {
      showToast('Resetting session & generating new QR...', 'info');
      elements.qrImage.style.display = 'none';
      elements.qrSpinner.style.display = 'flex';
      elements.qrStatusMsg.textContent = 'Resetting session...';
      await authFetch('/api/auth/unlink-whatsapp', { method: 'POST' });
    } catch (err) {
      showToast('Error resetting session: ' + err.message, 'danger');
    }
  });
}

// ==========================================================================
// Helper Utilities
// ==========================================================================
function openModal(modal) {
  if (modal) modal.classList.add('active');
}

function closeModal(modal) {
  if (modal) modal.classList.remove('active');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  else if (type === 'warning') iconName = 'alert-triangle';
  else if (type === 'danger') iconName = 'alert-octagon';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatUserIdentity(name, jid) {
  let rawPhone = '';
  if (jid) {
    const clean = jid.replace(/@.*$/, '').replace(/:.*$/, '');
    if (/^\d{7,16}$/.test(clean)) {
      rawPhone = `+${clean}`;
    } else if (clean && !clean.includes('admin') && !clean.includes('bot')) {
      rawPhone = clean;
    }
  }

  const cleanName = (name && name.trim() && name !== 'Member' && !name.startsWith('admin@')) ? name.trim() : null;

  if (cleanName && rawPhone && cleanName !== rawPhone) {
    return {
      name: cleanName,
      phone: rawPhone,
      hasBoth: true,
      displayFull: `${cleanName} (${rawPhone})`,
    };
  } else if (cleanName) {
    return {
      name: cleanName,
      phone: rawPhone || '',
      hasBoth: false,
      displayFull: cleanName,
    };
  } else if (rawPhone) {
    return {
      name: rawPhone,
      phone: rawPhone,
      hasBoth: false,
      displayFull: rawPhone,
    };
  }

  return { name: 'Member', phone: '', hasBoth: false, displayFull: 'Member' };
}

// ==========================================================================
// Theme Management (Light / Dark Mode)
// ==========================================================================
function initTheme() {
  const savedTheme =
    localStorage.getItem('bot_theme') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(savedTheme, false);
}

function applyTheme(themeName, showNotification = true) {
  state.theme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('bot_theme', themeName);

  syncPopupThemeUI();

  // Update chart legend color if chart exists
  if (state.chartInstance && state.chartInstance.options?.plugins?.legend?.labels) {
    state.chartInstance.options.plugins.legend.labels.color = themeName === 'light' ? '#475569' : '#94A3B8';
    state.chartInstance.update();
  }

  if (window.lucide) lucide.createIcons();
}

function toggleTheme() {
  const nextTheme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme, true);
  showToast(`Switched to ${nextTheme === 'light' ? 'Light' : 'Dark'} Mode`, 'info');
}

// ==========================================================================
// Mobile Navigation Drawer Helpers
// ==========================================
function openMobileSidebar() {
  if (elements.appSidebar) elements.appSidebar.classList.add('open');
  if (elements.sidebarOverlay) elements.sidebarOverlay.classList.add('active');
}

function closeMobileSidebar() {
  if (elements.appSidebar) elements.appSidebar.classList.remove('open');
  if (elements.sidebarOverlay) elements.sidebarOverlay.classList.remove('active');
}

// Switch Active Tab Programmatically
function switchTab(tabName) {
  elements.navTabs.forEach((t) => {
    if (t.dataset.tab === tabName) {
      t.click();
    }
  });
}

// ==========================================================================
// AI Models Management & Engine Functions (Qwen 3.5 & Multimodal Vision)
// ==========================================================================

async function fetchAIModelsAndStatus() {
  try {
    const [modelsRes, statusRes] = await Promise.all([
      authFetch('/api/ai/models').catch(() => null),
      authFetch('/api/ai/status').catch(() => null),
    ]);

    if (modelsRes && modelsRes.ok) {
      const modelsJson = await modelsRes.json();
      if (modelsJson.success && modelsJson.data) {
        state.aiModels = modelsJson.data.models || [];
        state.aiActiveModelId = modelsJson.data.active_model_id || state.aiActiveModelId;
        state.aiContextLength = modelsJson.data.context_length || state.aiContextLength;
        state.aiStatus = modelsJson.data.status || 'available';
      }
    }

    if (statusRes && statusRes.ok) {
      const statusJson = await statusRes.json();
      if (statusJson.success && statusJson.data) {
        state.aiStatus = statusJson.data.status || state.aiStatus;
        if (statusJson.data.active_model) {
          state.aiActiveModelId = statusJson.data.active_model.id || state.aiActiveModelId;
        }
        if (statusJson.data.context_length) {
          state.aiContextLength = statusJson.data.context_length;
        }
      }
    }

    updateAIStatusUI();
    renderAIModelsGrid();
    populatePopupModelSelect();
  } catch (err) {
    console.error('Failed to fetch AI models and status:', err);
  }
}

function updateAIStatusUI() {
  const activeModel = (state.aiModels && state.aiModels.find((m) => m.id === state.aiActiveModelId)) || {
    id: state.aiActiveModelId,
    name: 'Qwen 3.5 0.8B Q4',
    quantization: 'Q4',
    ram_required_mb: 800,
    size_mb: 520,
    default_context_length: 4096,
  };

  const statusMap = {
    available: { label: 'Available', badgeClass: 'status-available' },
    busy: { label: 'Busy (Processing...)', badgeClass: 'status-busy' },
    unavailable: { label: 'Unavailable (Offline)', badgeClass: 'status-unavailable' },
  };

  const currentStatus = statusMap[state.aiStatus] || statusMap.available;

  // 1. Update AI Models Page Header
  if (elements.modelsPageStatusBadge && elements.modelsPageStatusLabel) {
    elements.modelsPageStatusBadge.className = `connection-badge ${currentStatus.badgeClass}`;
    elements.modelsPageStatusLabel.textContent = currentStatus.label;
  }

  if (elements.modelsPageActiveModelName) {
    elements.modelsPageActiveModelName.textContent = activeModel.name;
  }

  if (elements.modelsPageQuantization) {
    elements.modelsPageQuantization.textContent = `${activeModel.quantization} (${activeModel.quantization === 'Q4' ? '4-bit' : '8-bit'})`;
  }

  if (elements.modelsPageVramSub) {
    elements.modelsPageVramSub.textContent = `~${activeModel.ram_required_mb} MB RAM Required • ${activeModel.size_mb} MB Storage`;
  }

  if (elements.modelsContextValLabel) {
    elements.modelsContextValLabel.textContent = `${(state.aiContextLength || 4096).toLocaleString()} tokens`;
  }

  if (elements.selectContextLength) {
    elements.selectContextLength.value = String(state.aiContextLength || 4096);
  }

  // 2. Update Account & Preferences Modal
  if (elements.popupAiStatusBadge && elements.popupAiStatusLabel) {
    elements.popupAiStatusBadge.className = `connection-badge ${currentStatus.badgeClass}`;
    elements.popupAiStatusLabel.textContent = currentStatus.label;
  }

  if (elements.popupAiModelDesc) {
    elements.popupAiModelDesc.textContent = `${activeModel.name} (${(state.aiContextLength || 4096).toLocaleString()} tokens)`;
  }

  // 3. Update Chatbot Page Header
  updateChatbotHeaderTelemetry();
}

// AI Crash Health & Fail-Safe Telemetry
// ==========================================================================
async function checkAICrashHealth() {
  try {
    const res = await authFetch('/api/ai/health');
    if (!res || !res.ok) return;
    const json = await res.json();
    if (json.success && json.data) {
      state.crashHealth = json.data;
      if (json.data.crash_detected && !json.data.crash_acknowledged) {
        if (elements.aiCrashAlert) {
          elements.aiCrashAlert.style.display = 'flex';
          if (elements.aiCrashAlertMsg) {
            elements.aiCrashAlertMsg.textContent = json.data.crash_reason ||
              'The application detected an unexpected termination during the previous session while AI was running. AI features were automatically disabled on startup to keep your WhatsApp bot stable.';
          }
          if (window.lucide) lucide.createIcons();
        }
      } else {
        if (elements.aiCrashAlert) {
          elements.aiCrashAlert.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error('Failed to check AI health:', err);
  }
}

async function handleDismissAICrash() {
  try {
    if (elements.aiCrashAlert) elements.aiCrashAlert.style.display = 'none';
    await authFetch('/api/ai/health/acknowledge', { method: 'POST' });
    if (state.crashHealth) {
      state.crashHealth.crash_detected = false;
      state.crashHealth.crash_acknowledged = true;
    }
  } catch (err) {
    console.error('Failed to acknowledge crash:', err);
  }
}

async function handleReEnableSafeAI() {
  try {
    showToast('Re-enabling AI with safe model (Qwen 3.5 0.8B Q4)...', 'info');
    await handleDismissAICrash();

    // 1. Apply Safe 0.8B Q4 model
    await executeModelApply('qwen-3.5-0.8b-q4');

    // 2. Enable master AI
    await authFetch('/api/user/ai-status', {
      method: 'POST',
      body: { aiEnabled: 1, enableAllGroups: true },
    });
    state.aiMasterEnabled = true;
    if (state.currentUser) {
      state.currentUser.aiEnabled = true;
      state.currentUser.ai_enabled = 1;
    }
    updateChatbotAccessState();
    showToast('✅ Safe Model applied and AI features re-enabled!', 'success');
  } catch (err) {
    showToast('Failed to re-enable safe AI: ' + err.message, 'danger');
  }
}

// System Hardware Capability & Smart AI Recommendation Assessment
// ==========================================================================
async function runSystemCheck() {
  try {
    if (elements.btnRunSystemCheck) {
      elements.btnRunSystemCheck.disabled = true;
      elements.btnRunSystemCheck.innerHTML = '<div class="spinner-sm" style="margin-right:6px;"></div><span>Checking...</span>';
    }

    const res = await authFetch('/api/system/info');
    if (!res || !res.ok) return;
    const json = await res.json();
    if (!json.success || !json.data) return;

    const data = json.data;
    const mem = data.memory || {};
    const totalBytes = mem.total_bytes || 0;
    const freeBytes = mem.free_bytes || 0;
    const usagePercent = mem.usage_percent || (totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0);

    state.systemTotalRamBytes = totalBytes;
    state.systemFreeRamBytes = freeBytes;

    const totalGb = totalBytes > 0 ? (totalBytes / (1024 * 1024 * 1024)).toFixed(1) : '8.0';
    const freeGb = freeBytes > 0 ? (freeBytes / (1024 * 1024 * 1024)).toFixed(1) : '2.5';
    const freeMb = freeBytes > 0 ? (freeBytes / (1024 * 1024)) : 2560;
    const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)) : 8192;

    // Smart Hardware Recommendation Calculation
    let recId = 'qwen-3.5-0.8b-q4';
    let recName = 'Qwen 3.5 0.8B Q4';
    let recReason = 'Minimal RAM footprint (~800 MB) • Zero crash risk';

    if (freeMb >= 4200 && totalMb >= 14000) {
      recId = 'qwen-3.5-4b-q4';
      recName = 'Qwen 3.5 4B Q4';
      recReason = 'High reasoning fidelity & deep summarization (~3.5 GB RAM)';
    } else if (freeMb >= 2200 && totalMb >= 7000) {
      recId = 'qwen-3.5-2b-q4';
      recName = 'Qwen 3.5 2B Q4';
      recReason = 'Ideal balance of speed, multimodal vision & memory safety (~1.8 GB RAM)';
    } else if (freeMb >= 1400) {
      recId = 'qwen-3.5-0.8b-q8';
      recName = 'Qwen 3.5 0.8B Q8';
      recReason = 'High instruction precision with lightweight memory footprint (~1.2 GB RAM)';
    } else {
      recId = 'qwen-3.5-0.8b-q4';
      recName = 'Qwen 3.5 0.8B Q4';
      recReason = 'Ultra-lightweight 4-bit model • Optimized for low RAM headroom';
    }

    state.recommendedModelId = recId;
    state.recommendedModelName = recName;

    // Update UI elements in System Check Card
    if (elements.scTotalRam) elements.scTotalRam.textContent = `${totalGb} GB`;
    if (elements.scFreeRam) elements.scFreeRam.textContent = `${freeGb} GB`;
    if (elements.scFreeRamSub) elements.scFreeRamSub.textContent = freeMb < 1500 ? '⚠️ Low Memory Headroom' : 'Available Memory Headroom';
    if (elements.scRamPercent) elements.scRamPercent.textContent = `${usagePercent}%`;
    if (elements.scRamBarFill) {
      elements.scRamBarFill.style.width = `${Math.min(100, Math.max(0, usagePercent))}%`;
      elements.scRamBarFill.style.background = usagePercent > 85 ? 'linear-gradient(90deg, #F59E0B, #EF4444)' : 'linear-gradient(90deg, #2DD4BF, #6366F1)';
    }
    if (elements.scRamStatusText) {
      elements.scRamStatusText.textContent = usagePercent > 85 ? '⚠️ High system memory load' : `${freeGb} GB available for AI execution`;
    }
    if (elements.scRecommendedModel) elements.scRecommendedModel.textContent = recName;
    if (elements.scRecommendedReason) elements.scRecommendedReason.textContent = recReason;
    if (elements.systemCheckStatusTag) {
      elements.systemCheckStatusTag.textContent = freeMb < 1500 ? 'Low Headroom' : 'Hardware Ready';
      elements.systemCheckStatusTag.style.color = freeMb < 1500 ? '#F59E0B' : '#2DD4BF';
    }

    // Re-render models grid with recommendation badges
    renderAIModelsGrid();
  } catch (err) {
    console.error('System check failed:', err);
  } finally {
    if (elements.btnRunSystemCheck) {
      elements.btnRunSystemCheck.disabled = false;
      elements.btnRunSystemCheck.innerHTML = '<i data-lucide="activity"></i><span>Run System Check</span>';
      if (window.lucide) lucide.createIcons();
    }
  }
}

// AI Models Grid Rendering & Action Handlers
// ==========================================================================
function renderAIModelsGrid() {
  if (!elements.aiModelsGridContainer) return;
  elements.aiModelsGridContainer.innerHTML = '';

  const fallbackModels = [
    { id: 'qwen-3.5-0.8b-q4', name: 'Qwen 3.5 0.8B Q4', parameters: '0.8B', quantization: 'Q4', size_mb: 520, ram_required_mb: 800, speed: 'Ultra Fast (~65 tok/s)', description: 'Ultra-lightweight 4-bit quantized model. Minimal RAM footprint (~800MB). Perfect for lightweight servers and background WhatsApp bot tasks.', supports_vision: true, is_downloaded: true, download_status: 'completed', download_progress: 100 },
    { id: 'qwen-3.5-0.8b-q8', name: 'Qwen 3.5 0.8B Q8', parameters: '0.8B', quantization: 'Q8', size_mb: 890, ram_required_mb: 1200, speed: 'Very Fast (~55 tok/s)', description: 'High-precision 8-bit compact model. Superior instruction-following fidelity with low memory consumption (~1.2GB).', supports_vision: true, is_downloaded: false, download_status: 'not_downloaded', download_progress: 0 },
    { id: 'qwen-3.5-2b-q4', name: 'Qwen 3.5 2B Q4', parameters: '2B', quantization: 'Q4', size_mb: 1350, ram_required_mb: 1800, speed: 'Fast (~42 tok/s)', description: 'Balanced 4-bit model offering high reasoning capability, excellent multilingual comprehension, and visual Q&A reasoning (~1.8GB RAM).', supports_vision: true, is_downloaded: true, download_status: 'completed', download_progress: 100 },
    { id: 'qwen-3.5-2b-q8', name: 'Qwen 3.5 2B Q8', parameters: '2B', quantization: 'Q8', size_mb: 2300, ram_required_mb: 2900, speed: 'Moderate (~32 tok/s)', description: '8-bit high-precision 2B model for complex analytical queries, code understanding, and intricate visual scene breakdown (~2.9GB RAM).', supports_vision: true, is_downloaded: false, download_status: 'not_downloaded', download_progress: 0 },
    { id: 'qwen-3.5-4b-q4', name: 'Qwen 3.5 4B Q4', parameters: '4B', quantization: 'Q4', size_mb: 2650, ram_required_mb: 3500, speed: 'Moderate (~26 tok/s)', description: 'Advanced 4-bit foundation model with strong multi-step logic, detailed message summarization, and deep visual perception (~3.5GB RAM).', supports_vision: true, is_downloaded: false, download_status: 'not_downloaded', download_progress: 0 },
    { id: 'qwen-3.5-4b-q8', name: 'Qwen 3.5 4B Q8', parameters: '4B', quantization: 'Q8', size_mb: 4550, ram_required_mb: 5400, speed: 'Standard (~18 tok/s)', description: 'Maximum intelligence 8-bit model. Unmatched accuracy for high-context chat summarization, deep image reasoning, and coding tasks (~5.4GB RAM).', supports_vision: true, is_downloaded: false, download_status: 'not_downloaded', download_progress: 0 },
  ];

  const modelsToRender = (state.aiModels && state.aiModels.length > 0) ? state.aiModels : fallbackModels;
  const freeRamMb = state.systemFreeRamBytes > 0 ? (state.systemFreeRamBytes / (1024 * 1024)) : 3000;
  const totalRamMb = state.systemTotalRamBytes > 0 ? (state.systemTotalRamBytes / (1024 * 1024)) : 8192;

  modelsToRender.forEach((model) => {
    const isActive = (model.id === state.aiActiveModelId);
    const isDownloaded = Boolean(model.is_downloaded || model.download_status === 'completed');
    const isDownloading = (model.download_status === 'downloading');
    const progress = model.download_progress || 0;
    const isRecommended = (model.id === state.recommendedModelId);
    const isHighRam = (model.ram_required_mb > freeRamMb) || (model.ram_required_mb > totalRamMb * 0.70);

    const card = document.createElement('div');
    card.className = `ai-model-card ${isActive ? 'active-model' : ''} ${isRecommended ? 'is-recommended' : ''}`;
    card.id = `model-card-${model.id}`;

    const quantClass = (model.quantization === 'Q4') ? 'q4' : 'q8';

    let recommendationBadgeHtml = '';
    if (isRecommended) {
      recommendationBadgeHtml = `<span class="badge badge-recommended">🌟 Recommended for Your System</span>`;
    } else if (isHighRam) {
      recommendationBadgeHtml = `<span class="badge badge-high-ram">⚠️ High RAM (~${model.ram_required_mb} MB)</span>`;
    }

    let downloadSectionHtml = '';
    if (isDownloading) {
      downloadSectionHtml = `
        <div class="ai-download-progress-wrap">
          <div class="ai-progress-stats">
            <span>Downloading Model Weights...</span>
            <span><strong>${progress}%</strong> (${model.download_speed || '32 MB/s'})</span>
          </div>
          <div class="ai-progress-bar">
            <div class="ai-progress-fill" style="width: ${progress}%;"></div>
          </div>
        </div>
      `;
    }

    let actionButtonsHtml = '';
    if (isActive) {
      actionButtonsHtml = `
        <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.9; cursor: default; width: 100%;">
          <i data-lucide="check-circle-2" style="color: #2DD4BF;"></i>
          <span>Active & Applied</span>
        </button>
      `;
    } else if (isDownloading) {
      actionButtonsHtml = `
        <button class="btn btn-secondary btn-sm" disabled style="width: 100%;">
          <div class="spinner-sm" style="margin-right: 6px;"></div>
          <span>Downloading ${progress}%</span>
        </button>
      `;
    } else if (isDownloaded) {
      actionButtonsHtml = `
        <button class="btn btn-primary btn-sm btn-apply-model" data-model-id="${model.id}">
          <i data-lucide="play"></i>
          <span>Apply Model</span>
        </button>
        <button class="btn btn-secondary btn-sm text-danger btn-delete-model" data-model-id="${model.id}" title="Delete downloaded model files" style="flex: 0 0 42px;">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    } else {
      actionButtonsHtml = `
        <button class="btn btn-secondary btn-sm btn-download-model" data-model-id="${model.id}">
          <i data-lucide="download"></i>
          <span>Download (${model.size_mb} MB)</span>
        </button>
        <button class="btn btn-primary btn-sm btn-apply-model" data-model-id="${model.id}">
          <i data-lucide="play"></i>
          <span>Apply</span>
        </button>
      `;
    }

    card.innerHTML = `
      <div class="ai-model-card-header">
        <div class="ai-model-title-wrap">
          <h4 class="ai-model-title">${escapeHtml(model.name)}</h4>
          <span class="ai-quant-badge ${quantClass}">${model.quantization}</span>
          ${recommendationBadgeHtml}
        </div>
        ${isActive ? `<div class="ai-active-ribbon"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Active</div>` : ''}
      </div>

      <p class="ai-model-desc">${escapeHtml(model.description)}</p>

      <div class="ai-model-specs">
        <div class="ai-spec-item">
          <span class="ai-spec-label">Model Size</span>
          <span class="ai-spec-val">${model.size_mb} MB</span>
        </div>
        <div class="ai-spec-item">
          <span class="ai-spec-label">RAM Required</span>
          <span class="ai-spec-val ${isHighRam ? 'text-rose' : ''}">~${model.ram_required_mb} MB</span>
        </div>
        <div class="ai-spec-item">
          <span class="ai-spec-label">Parameters</span>
          <span class="ai-spec-val">${model.parameters}</span>
        </div>
        <div class="ai-spec-item">
          <span class="ai-spec-label">Inference Speed</span>
          <span class="ai-spec-val">${model.speed || 'Fast'}</span>
        </div>
        <div class="ai-vision-pill">
          <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
          <span>Supports Multimodal Image Recognition & Vision</span>
        </div>
      </div>

      ${downloadSectionHtml}

      <div class="ai-model-card-actions">
        ${actionButtonsHtml}
      </div>
    `;

    elements.aiModelsGridContainer.appendChild(card);
  });

  // Attach button events
  elements.aiModelsGridContainer.querySelectorAll('.btn-download-model').forEach((btn) => {
    btn.addEventListener('click', () => handleModelDownload(btn.dataset.modelId));
  });

  elements.aiModelsGridContainer.querySelectorAll('.btn-apply-model').forEach((btn) => {
    btn.addEventListener('click', () => handleModelApply(btn.dataset.modelId));
  });

  elements.aiModelsGridContainer.querySelectorAll('.btn-delete-model').forEach((btn) => {
    btn.addEventListener('click', () => handleModelDelete(btn.dataset.modelId));
  });

  if (window.lucide) lucide.createIcons();
}

async function handleModelDownload(modelId) {
  try {
    showToast(`Starting download for ${modelId}...`, 'info');
    const res = await authFetch('/api/ai/models/download', {
      method: 'POST',
      body: { modelId },
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.data?.message || 'Download started in background!', 'info');
      startDownloadPolling(modelId);
    } else {
      showToast(`Download failed: ${json.error}`, 'danger');
    }
  } catch (err) {
    showToast('Failed to trigger download: ' + err.message, 'danger');
  }
}

function startDownloadPolling(modelId) {
  if (state.aiDownloadPollers[modelId]) {
    clearInterval(state.aiDownloadPollers[modelId]);
  }

  state.aiDownloadPollers[modelId] = setInterval(async () => {
    try {
      const res = await authFetch('/api/ai/models');
      const json = await res.json();
      if (json.success && json.data) {
        state.aiModels = json.data.models || [];
        const model = state.aiModels.find((m) => m.id === modelId);
        renderAIModelsGrid();

        if (model && (model.download_status === 'completed' || model.is_downloaded)) {
          clearInterval(state.aiDownloadPollers[modelId]);
          delete state.aiDownloadPollers[modelId];
          showToast(`✅ ${model.name} download complete and ready to apply!`, 'success');
        }
      }
    } catch (err) {
      clearInterval(state.aiDownloadPollers[modelId]);
      delete state.aiDownloadPollers[modelId];
    }
  }, 600);
}

/**
 * Validates memory safety before applying an AI model.
 * If target model exceeds safe RAM thresholds, prompts user with a High-RAM Warning Modal.
 */
async function handleModelApply(modelId, force = false) {
  const modelObj = (state.aiModels && state.aiModels.find((m) => m.id === modelId)) || {
    id: modelId,
    name: modelId,
    ram_required_mb: 800,
  };

  const freeRamMb = state.systemFreeRamBytes > 0 ? (state.systemFreeRamBytes / (1024 * 1024)) : 3000;
  const totalRamMb = state.systemTotalRamBytes > 0 ? (state.systemTotalRamBytes / (1024 * 1024)) : 8192;
  const isHighRisk = (modelObj.ram_required_mb > freeRamMb) || (modelObj.ram_required_mb > totalRamMb * 0.70);

  if (isHighRisk && !force && elements.aiRamWarningModal) {
    state.pendingApplyModelId = modelId;
    if (elements.warnTargetModelName) elements.warnTargetModelName.textContent = modelObj.name;
    if (elements.warnTargetRam) elements.warnTargetRam.textContent = `${modelObj.ram_required_mb.toLocaleString()} MB`;
    if (elements.warnModelRamVal) elements.warnModelRamVal.textContent = `${(modelObj.ram_required_mb / 1024).toFixed(1)} GB`;
    if (elements.warnSystemFreeVal) elements.warnSystemFreeVal.textContent = `${(freeRamMb / 1024).toFixed(1)} GB`;
    if (elements.warnSystemTotalVal) elements.warnSystemTotalVal.textContent = `${(totalRamMb / 1024).toFixed(1)} GB`;
    if (elements.warnRecommendedAltName) {
      elements.warnRecommendedAltName.textContent = `${state.recommendedModelName || 'Qwen 3.5 0.8B Q4'} (~800 MB RAM)`;
    }
    openModal(elements.aiRamWarningModal);
    if (window.lucide) lucide.createIcons();
    return;
  }

  await executeModelApply(modelId);
}

async function executeModelApply(modelId) {
  state.aiStatus = 'busy';
  updateAIStatusUI();

  const modelObj = (state.aiModels && state.aiModels.find((m) => m.id === modelId)) || { name: modelId };
  showToast(`⏳ Applying AI model: ${modelObj.name}...`, 'info');

  try {
    const res = await authFetch('/api/ai/models/apply', {
      method: 'POST',
      body: { modelId },
    });
    const json = await res.json();
    if (json.success) {
      state.aiActiveModelId = modelId;
      state.aiStatus = 'available';
      if (json.data?.context_length) {
        state.aiContextLength = json.data.context_length;
      }
      showToast(`✅ Successfully activated ${modelObj.name}!`, 'success');
      await fetchAIModelsAndStatus();
    } else {
      state.aiStatus = 'available';
      updateAIStatusUI();
      showToast(`Failed to apply model: ${json.error}`, 'danger');
    }
  } catch (err) {
    state.aiStatus = 'available';
    updateAIStatusUI();
    showToast('Error applying model: ' + err.message, 'danger');
  }
}

function handleModelDelete(modelId) {
  showConfirmDialog({
    title: 'Delete Model Weights',
    message: `Are you sure you want to delete the downloaded model files for <strong>${escapeHtml(modelId)}</strong>?`,
    confirmText: 'Yes, Delete Files',
    confirmBtnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        const res = await authFetch('/api/ai/models/delete', {
          method: 'POST',
          body: { modelId },
        });
        const json = await res.json();
        if (json.success) {
          showToast('Model files deleted.', 'info');
          await fetchAIModelsAndStatus();
        } else {
          showToast(`Delete failed: ${json.error}`, 'danger');
        }
      } catch (err) {
        showToast('Failed to delete model: ' + err.message, 'danger');
      }
    },
  });
}

async function handleContextLengthChange() {
  const newContextLength = Number(elements.selectContextLength.value);
  if (!newContextLength) return;

  try {
    elements.btnSaveContextLength.disabled = true;
    elements.btnSaveContextLength.innerHTML = '<div class="spinner-sm"></div>';

    const res = await authFetch('/api/ai/models/config', {
      method: 'POST',
      body: { contextLength: newContextLength },
    });
    const json = await res.json();
    if (json.success) {
      state.aiContextLength = newContextLength;
      updateAIStatusUI();
      showToast(`✅ Context length updated to ${newContextLength.toLocaleString()} tokens!`, 'success');
    } else {
      showToast(`Failed to update context length: ${json.error}`, 'danger');
    }
  } catch (err) {
    showToast('Error updating context length: ' + err.message, 'danger');
  } finally {
    elements.btnSaveContextLength.disabled = false;
    elements.btnSaveContextLength.innerHTML = '<i data-lucide="check"></i><span>Apply</span>';
    if (window.lucide) lucide.createIcons();
  }
}

function populatePopupModelSelect() {
  if (!elements.popupModelSelect) return;
  elements.popupModelSelect.innerHTML = '';

  const fallbackModels = [
    { id: 'qwen-3.5-0.8b-q4', name: 'Qwen 3.5 0.8B Q4' },
    { id: 'qwen-3.5-0.8b-q8', name: 'Qwen 3.5 0.8B Q8' },
    { id: 'qwen-3.5-2b-q4', name: 'Qwen 3.5 2B Q4' },
    { id: 'qwen-3.5-2b-q8', name: 'Qwen 3.5 2B Q8' },
    { id: 'qwen-3.5-4b-q4', name: 'Qwen 3.5 4B Q4' },
    { id: 'qwen-3.5-4b-q8', name: 'Qwen 3.5 4B Q8' },
  ];

  const models = (state.aiModels && state.aiModels.length > 0) ? state.aiModels : fallbackModels;

  models.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    if (m.id === state.aiActiveModelId) {
      opt.selected = true;
    }
    elements.popupModelSelect.appendChild(opt);
  });
}

async function handlePopupModelSelect(modelId) {
  if (!modelId || modelId === state.aiActiveModelId) return;
  await handleModelApply(modelId);
}

// =============================================================================
// ON-DEVICE AI CHATBOT ENGINE (ChatGPT & Google Gemini UI/UX)
// =============================================================================

const CHATBOT_STORAGE_KEY = 'capybot_ai_chat_sessions_v1';

async function initChatbot() {
  loadLocalChatSessions();
  updateChatbotHeaderTelemetry();
  renderChatSessionsList();
  renderActiveChatMessages();
  await syncChatSessionsWithBackend();
}

function loadLocalChatSessions() {
  try {
    const raw = localStorage.getItem(CHATBOT_STORAGE_KEY);
    if (raw) {
      state.chatSessions = JSON.parse(raw);
    } else {
      state.chatSessions = [];
    }
  } catch (e) {
    console.error('Failed to parse saved chat sessions:', e);
    state.chatSessions = [];
  }

  if (!Array.isArray(state.chatSessions) || state.chatSessions.length === 0) {
    createNewChatSession(null, false);
  } else if (!state.activeChatSessionId || !state.chatSessions.find((s) => s.id === state.activeChatSessionId)) {
    state.activeChatSessionId = state.chatSessions[0].id;
  }
}

async function syncChatSessionsWithBackend() {
  try {
    const res = await authFetch('/api/chatbot/sessions');
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      state.chatSessions = json.data;
      if (!state.activeChatSessionId || !state.chatSessions.find((s) => s.id === state.activeChatSessionId)) {
        state.activeChatSessionId = state.chatSessions[0].id;
      }
      saveLocalChatSessions();
      renderChatSessionsList();
      renderActiveChatMessages();
    } else if (state.chatSessions && state.chatSessions.length > 0) {
      // Push any unsaved local sessions to backend for initial migration
      for (const s of state.chatSessions) {
        authFetch('/api/chatbot/sessions', {
          method: 'POST',
          body: { id: s.id, title: s.title, modelId: s.modelId || state.aiActiveModelId, createdAt: s.createdAt, updatedAt: s.updatedAt || s.createdAt },
        }).catch(() => { });
        if (Array.isArray(s.messages)) {
          for (const m of s.messages) {
            authFetch(`/api/chatbot/sessions/${encodeURIComponent(s.id)}/messages`, {
              method: 'POST',
              body: { role: m.role, content: m.content, imageBase64: m.imageBase64, createdAt: m.timestamp || m.createdAt },
            }).catch(() => { });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Backend chat sync deferred:', e);
  }
}

function saveLocalChatSessions() {
  try {
    localStorage.setItem(CHATBOT_STORAGE_KEY, JSON.stringify(state.chatSessions));
  } catch (e) {
    console.error('Failed to save chat sessions to localStorage:', e);
  }
}

function getActiveChatSession() {
  if (!state.chatSessions || state.chatSessions.length === 0) return null;
  let session = state.chatSessions.find((s) => s.id === state.activeChatSessionId);
  if (!session) {
    session = state.chatSessions[0];
    state.activeChatSessionId = session.id;
  }
  return session;
}

function createNewChatSession(initialPrompt = null, shouldSave = true) {
  const newSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: initialPrompt ? initialPrompt.slice(0, 32) + (initialPrompt.length > 32 ? '...' : '') : 'New Conversation',
    createdAt: Date.now(),
    modelId: state.aiActiveModelId,
    messages: [],
  };

  state.chatSessions.unshift(newSession);
  state.activeChatSessionId = newSession.id;

  if (shouldSave) {
    saveLocalChatSessions();
    renderChatSessionsList();
    renderActiveChatMessages();
    authFetch('/api/chatbot/sessions', {
      method: 'POST',
      body: {
        id: newSession.id,
        title: newSession.title,
        modelId: newSession.modelId,
        createdAt: newSession.createdAt,
        updatedAt: newSession.createdAt,
      },
    }).catch(() => { });
  }

  // Focus textarea
  if (elements.chatbotTextarea) {
    elements.chatbotTextarea.value = '';
    elements.chatbotTextarea.style.height = 'auto';
    elements.chatbotTextarea.focus();
  }

  clearChatbotAttachment();
  return newSession;
}

function switchChatSession(sessionId) {
  if (sessionId === state.activeChatSessionId) return;
  state.activeChatSessionId = sessionId;
  renderChatSessionsList();
  renderActiveChatMessages();

  // Close sidebar on mobile
  if (elements.chatbotSidebar && window.innerWidth < 860) {
    elements.chatbotSidebar.classList.remove('open');
  }
}

function renameChatSession(sessionId, e) {
  if (e) e.stopPropagation();
  const session = state.chatSessions.find((s) => s.id === sessionId);
  if (!session) return;

  const currentTitle = session.title || 'New Conversation';
  const newTitle = prompt('Enter a new title for this conversation:', currentTitle);
  if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
    session.title = newTitle.trim();
    saveLocalChatSessions();
    renderChatSessionsList();
    showToast('Conversation renamed.', 'info');
    authFetch(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      body: { title: session.title },
    }).catch(() => { });
  }
}

function deleteChatSession(sessionId, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  showConfirmDialog({
    title: 'Delete Conversation',
    message: 'Are you sure you want to delete this AI chat conversation?',
    confirmText: 'Yes, Delete',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      state.chatSessions = state.chatSessions.filter((s) => s.id !== sessionId);
      if (state.chatSessions.length === 0) {
        createNewChatSession(null, false);
      } else if (state.activeChatSessionId === sessionId) {
        state.activeChatSessionId = state.chatSessions[0].id;
      }

      saveLocalChatSessions();
      renderChatSessionsList();
      renderActiveChatMessages();
      showToast('Conversation deleted.', 'info');

      authFetch(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      }).catch(() => { });
    },
  });
}

function clearAllChatSessions(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  showConfirmDialog({
    title: 'Erase All Chat History',
    message: 'Are you sure you want to permanently erase <strong>ALL</strong> AI chat conversations? This cannot be undone.',
    confirmText: 'Yes, Erase All',
    confirmBtnClass: 'btn-danger',
    onConfirm: () => {
      state.chatSessions = [];
      createNewChatSession(null, false);
      saveLocalChatSessions();
      renderChatSessionsList();
      renderActiveChatMessages();
      showToast('All chat history cleared.', 'info');

      authFetch('/api/chatbot/sessions', {
        method: 'DELETE',
      }).catch(() => { });
    },
  });
}

function exportChatSession(sessionId = null) {
  const session = sessionId ? state.chatSessions.find((s) => s.id === sessionId) : getActiveChatSession();
  if (!session || !session.messages || session.messages.length === 0) {
    showToast('No messages to export.', 'warning');
    return;
  }

  let md = `# ${session.title || 'Conversation'}\n\n`;
  md += `*Exported on ${new Date().toLocaleString()} • Model: ${session.modelId || state.aiActiveModelId}*\n\n---\n\n`;

  session.messages.forEach((m) => {
    const roleName = m.role === 'user' ? '👤 User' : '🤖 Assistant';
    const timeStr = new Date(m.timestamp || Date.now()).toLocaleTimeString();
    md += `### ${roleName} (${timeStr})\n\n`;
    if (m.imageBase64) {
      md += `*[Attached Image: Multimodal Vision Input]*\n\n`;
    }
    md += `${m.content}\n\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(session.title || 'conversation').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Conversation exported as Markdown.', 'success');
}

function renderChatSessionsList(searchFilter = '') {
  if (!elements.chatbotSessionsList) return;
  elements.chatbotSessionsList.innerHTML = '';

  const filter = (searchFilter || (elements.chatbotSearchInput ? elements.chatbotSearchInput.value : '')).toLowerCase().trim();

  const filteredSessions = state.chatSessions.filter((s) => {
    if (!filter) return true;
    if (s.title && s.title.toLowerCase().includes(filter)) return true;
    if (s.messages && s.messages.some((m) => m.content && m.content.toLowerCase().includes(filter))) return true;
    return false;
  });

  if (filteredSessions.length === 0) {
    elements.chatbotSessionsList.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); font-size: 0.78rem; padding: 20px 10px;">
        ${filter ? 'No matching conversations.' : 'No conversations yet.'}
      </div>
    `;
    return;
  }

  // Group by Today, Yesterday, Previous 7 Days, Older
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const groups = {
    today: [],
    yesterday: [],
    previous7: [],
    older: [],
  };

  filteredSessions.forEach((s) => {
    const age = now - (s.createdAt || now);
    if (age < oneDay) {
      groups.today.push(s);
    } else if (age < 2 * oneDay) {
      groups.yesterday.push(s);
    } else if (age < 7 * oneDay) {
      groups.previous7.push(s);
    } else {
      groups.older.push(s);
    }
  });

  const renderGroup = (title, list) => {
    if (!list || list.length === 0) return;
    const heading = document.createElement('div');
    heading.className = 'chat-group-heading';
    heading.textContent = title;
    elements.chatbotSessionsList.appendChild(heading);

    list.forEach((s) => {
      const isActive = s.id === state.activeChatSessionId;
      const item = document.createElement('div');
      item.className = `chat-session-item ${isActive ? 'active' : ''}`;
      item.onclick = () => switchChatSession(s.id);

      item.innerHTML = `
        <i data-lucide="message-square" class="session-icon"></i>
        <span class="session-title" title="${escapeHtml(s.title || 'New Conversation')}">${escapeHtml(s.title || 'New Conversation')}</span>
        <div class="session-actions">
          <button class="session-action-btn" title="Rename" onclick="renameChatSession('${s.id}', event)">
            <i data-lucide="edit-3"></i>
          </button>
          <button class="session-action-btn" title="Delete" onclick="deleteChatSession('${s.id}', event)">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
      elements.chatbotSessionsList.appendChild(item);
    });
  };

  renderGroup('Today', groups.today);
  renderGroup('Yesterday', groups.yesterday);
  renderGroup('Previous 7 Days', groups.previous7);
  renderGroup('Older', groups.older);

  if (window.lucide) lucide.createIcons();
}

function renderActiveChatMessages() {
  const session = getActiveChatSession();
  if (!session || !session.messages || session.messages.length === 0) {
    if (elements.chatbotWelcomeHero) elements.chatbotWelcomeHero.style.display = 'block';
    if (elements.chatbotFeed) elements.chatbotFeed.style.display = 'none';
    if (elements.chatbotFeed) elements.chatbotFeed.innerHTML = '';
    return;
  }

  if (elements.chatbotWelcomeHero) elements.chatbotWelcomeHero.style.display = 'none';
  if (elements.chatbotFeed) {
    elements.chatbotFeed.style.display = 'flex';
    elements.chatbotFeed.innerHTML = '';

    session.messages.forEach((msg) => {
      appendChatbotMessageElement(msg);
    });

    scrollChatbotToBottom();
  }

  if (window.lucide) lucide.createIcons();
}

function appendChatbotMessageElement(msg, isTyping = false) {
  if (!elements.chatbotFeed) return;
  if (elements.chatbotWelcomeHero) elements.chatbotWelcomeHero.style.display = 'none';
  elements.chatbotFeed.style.display = 'flex';

  const isUser = msg.role === 'user';
  const row = document.createElement('div');
  row.className = `chat-message-item ${isUser ? 'user' : 'assistant'}`;
  row.id = `msg_${msg.id || Date.now()}`;

  let contentHtml = '';
  if (isUser) {
    let imgHtml = '';
    if (msg.imageBase64) {
      imgHtml = `<img src="${msg.imageBase64}" alt="Attached Visual" class="chat-msg-image-thumb">`;
    }
    contentHtml = `
      <div class="chat-msg-body-wrap">
        ${imgHtml}
        <div class="chat-msg-bubble">${escapeHtml(msg.content)}</div>
      </div>
      <div class="chat-msg-avatar user-avatar-icon">
        <i data-lucide="user"></i>
      </div>
    `;
  } else {
    const formattedMarkdown = formatChatbotMarkdown(msg.content);
    contentHtml = `
      <div class="chat-msg-avatar ai-avatar">
        <i data-lucide="sparkles"></i>
      </div>
      <div class="chat-msg-body-wrap">
        <div class="chat-msg-bubble markdown-body">${formattedMarkdown}</div>
        <div class="chat-msg-actions">
          <button class="chat-action-btn" title="Copy response" onclick="copyAssistantMessage(this, '${escapeForAttribute(msg.content)}')">
            <i data-lucide="copy"></i>
            <span>Copy</span>
          </button>
          <button class="chat-action-btn" title="Regenerate response" onclick="regenerateLastResponse()">
            <i data-lucide="refresh-cw"></i>
            <span>Regenerate</span>
          </button>
          <span class="chat-msg-meta-pill">${msg.modelName || 'Qwen 3.5'} • On-Device</span>
        </div>
      </div>
    `;
  }

  row.innerHTML = contentHtml;
  elements.chatbotFeed.appendChild(row);
  if (window.lucide) lucide.createIcons();
  scrollChatbotToBottom();
  return row;
}

function formatChatbotMarkdown(rawText) {
  if (!rawText) return '';

  let html = rawText;

  // 1. Code blocks: ```lang ... ```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'code';
    const escapedCode = escapeHtml(code.trim());
    return `
      <div class="chat-code-container">
        <div class="chat-code-header">
          <span>${escapeHtml(language)}</span>
          <button class="chat-code-copy-btn" onclick="copyCodeSnippet(this)">
            <i data-lucide="copy"></i>
            <span>Copy code</span>
          </button>
        </div>
        <pre class="chat-code-pre"><code>${escapedCode}</code></pre>
      </div>
    `;
  });

  // 2. Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 3. Headings: ###, ##, #
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 4. Bold and Italics: **bold**, *italics*, _italics_
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 5. Blockquotes: > quote
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 6. Bullet lists: • or - or *
  html = html.replace(/^[•\-\*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

  // 7. Line breaks to paragraphs
  html = html.split('\n\n').map((para) => {
    para = para.trim();
    if (!para) return '';
    if (para.startsWith('<div class="chat-code-container"') || para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<blockquote')) {
      return para;
    }
    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

function escapeForAttribute(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '\\n');
}

window.copyCodeSnippet = function (btn) {
  const container = btn.closest('.chat-code-container');
  if (!container) return;
  const codeEl = container.querySelector('code');
  if (!codeEl) return;

  const text = codeEl.textContent || codeEl.innerText;
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = '<i data-lucide="check" style="color:#2DD4BF;"></i><span style="color:#2DD4BF;">Copied!</span>';
    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = '<i data-lucide="copy"></i><span>Copy code</span>';
      if (window.lucide) lucide.createIcons();
    }, 2000);
  }).catch(() => {
    showToast('Failed to copy code to clipboard', 'error');
  });
};

window.copyAssistantMessage = function (btn, text) {
  const cleanText = text.replace(/\\n/g, '\n');
  navigator.clipboard.writeText(cleanText).then(() => {
    showToast('Response copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy message', 'error');
  });
};

window.regenerateLastResponse = function () {
  const session = getActiveChatSession();
  if (!session || !session.messages || session.messages.length === 0) return;

  // Find last user message
  let lastUserMsg = null;
  for (let i = session.messages.length - 1; i >= 0; i--) {
    if (session.messages[i].role === 'user') {
      lastUserMsg = session.messages[i];
      break;
    }
  }

  if (!lastUserMsg) {
    showToast('No previous user prompt to regenerate.', 'warning');
    return;
  }

  // Remove trailing assistant message if present
  if (session.messages[session.messages.length - 1].role === 'assistant') {
    session.messages.pop();
  }

  saveChatSessions();
  renderActiveChatMessages();
  executeChatbotQuery(lastUserMsg.content, lastUserMsg.imageBase64, true);
};

function scrollChatbotToBottom() {
  if (elements.chatbotMessagesScroll) {
    setTimeout(() => {
      elements.chatbotMessagesScroll.scrollTop = elements.chatbotMessagesScroll.scrollHeight;
    }, 50);
  }
}

function updateChatbotHeaderTelemetry() {
  const activeModel = (state.aiModels && state.aiModels.find((m) => m.id === state.aiActiveModelId)) || {
    id: state.aiActiveModelId,
    name: 'Qwen 3.5 0.8B Q4',
  };
  if (elements.chatbotActiveModelName) {
    elements.chatbotActiveModelName.textContent = activeModel.name;
  }
  if (elements.chatbotStatusBadge && elements.chatbotStatusLabel) {
    elements.chatbotStatusBadge.className = `connection-badge status-${state.aiStatus} chatbot-status-badge`;
    elements.chatbotStatusLabel.textContent = state.aiStatus.charAt(0).toUpperCase() + state.aiStatus.slice(1);
  }
  if (elements.chatbotContextLabel) {
    elements.chatbotContextLabel.textContent = `${Number(state.aiContextLength).toLocaleString()} tokens`;
  }
}

function setupChatbotEvents() {
  // Mobile Sidebar Toggle
  if (elements.btnToggleChatbotSidebar) {
    elements.btnToggleChatbotSidebar.addEventListener('click', () => {
      if (elements.chatbotSidebar) {
        elements.chatbotSidebar.classList.toggle('open');
      }
    });
  }
  if (elements.btnCloseChatbotSidebar) {
    elements.btnCloseChatbotSidebar.addEventListener('click', () => {
      if (elements.chatbotSidebar) {
        elements.chatbotSidebar.classList.remove('open');
      }
    });
  }

  // New Chat Button
  if (elements.btnNewChat) {
    elements.btnNewChat.addEventListener('click', () => {
      createNewChatSession();
      showToast('Started a new conversation.', 'info');
    });
  }

  // Search Conversations
  if (elements.chatbotSearchInput) {
    elements.chatbotSearchInput.addEventListener('input', (e) => {
      renderChatSessionsList(e.target.value);
    });
  }

  // Clear All History
  if (elements.btnClearAllChats) {
    elements.btnClearAllChats.addEventListener('click', clearAllChatSessions);
  }

  // Clear Current Chat
  if (elements.btnChatbotClearCurrent) {
    elements.btnChatbotClearCurrent.addEventListener('click', () => {
      const session = getActiveChatSession();
      if (!session || !session.messages || session.messages.length === 0) return;
      if (confirm('Clear all messages in the current conversation?')) {
        session.messages = [];
        saveChatSessions();
        renderActiveChatMessages();
        showToast('Current conversation cleared.', 'info');
      }
    });
  }

  // Export Conversation
  if (elements.btnChatbotExport) {
    elements.btnChatbotExport.addEventListener('click', () => exportChatSession());
  }

  // Auto-resize Textarea & Enter to submit
  if (elements.chatbotTextarea) {
    elements.chatbotTextarea.addEventListener('input', () => {
      elements.chatbotTextarea.style.height = 'auto';
      elements.chatbotTextarea.style.height = Math.min(elements.chatbotTextarea.scrollHeight, 180) + 'px';
      updateChatbotSendButtonState();
    });

    elements.chatbotTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleChatbotSubmit();
      }
    });
  }

  // Chat Form Submit
  if (elements.chatbotInputForm) {
    elements.chatbotInputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleChatbotSubmit();
    });
  }

  // Attachment Button & File Input
  if (elements.btnChatbotAttach && elements.chatbotFileInput) {
    elements.btnChatbotAttach.addEventListener('click', () => {
      elements.chatbotFileInput.click();
    });

    elements.chatbotFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleChatbotAttachment(file);
    });
  }

  // Remove Attachment
  if (elements.btnRemoveAttachment) {
    elements.btnRemoveAttachment.addEventListener('click', clearChatbotAttachment);
  }

  // Paste Image Support on window and textarea
  window.addEventListener('paste', (e) => {
    // Only handle if on chatbot tab or target inside chatbot
    const activeTab = document.querySelector('.nav-item.active')?.dataset?.tab;
    if (activeTab !== 'chatbot') return;

    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleChatbotAttachment(file);
          showToast('📸 Attached photo from clipboard for Vision analysis', 'info');
          break;
        }
      }
    }
  });

  // Drag & Drop image on chatbot main area
  const mainArea = document.querySelector('.chatbot-main-area');
  if (mainArea) {
    mainArea.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    mainArea.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleChatbotAttachment(file);
        showToast('📸 Attached dropped photo for Vision analysis', 'info');
      }
    });
  }

  // Suggestion Cards click
  document.querySelectorAll('.suggestion-card').forEach((card) => {
    card.addEventListener('click', () => {
      const promptText = card.getAttribute('data-prompt');
      const needsImage = card.getAttribute('data-needs-image') === 'true';

      if (needsImage && !state.chatbotAttachmentBase64) {
        if (elements.chatbotFileInput) elements.chatbotFileInput.click();
        if (elements.chatbotTextarea) {
          elements.chatbotTextarea.value = promptText;
          updateChatbotSendButtonState();
        }
        showToast('Please select a photo to analyze with Vision.', 'info');
        return;
      }

      if (promptText) {
        if (elements.chatbotTextarea) elements.chatbotTextarea.value = promptText;
        handleChatbotSubmit();
      }
    });
  });
}

function handleChatbotAttachment(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please choose a valid photo (PNG, JPEG, WEBP).', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    state.chatbotAttachmentBase64 = event.target.result;
    if (elements.chatbotAttachmentImg) {
      elements.chatbotAttachmentImg.src = state.chatbotAttachmentBase64;
    }
    if (elements.chatbotAttachmentPreview) {
      elements.chatbotAttachmentPreview.style.display = 'flex';
    }
    updateChatbotSendButtonState();
    if (elements.chatbotTextarea) elements.chatbotTextarea.focus();
  };
  reader.readAsDataURL(file);
}

function clearChatbotAttachment() {
  state.chatbotAttachmentBase64 = null;
  if (elements.chatbotFileInput) elements.chatbotFileInput.value = '';
  if (elements.chatbotAttachmentImg) elements.chatbotAttachmentImg.src = '';
  if (elements.chatbotAttachmentPreview) {
    elements.chatbotAttachmentPreview.style.display = 'none';
  }
  updateChatbotSendButtonState();
}

function updateChatbotSendButtonState() {
  if (!elements.btnChatbotSend) return;
  const hasText = elements.chatbotTextarea && elements.chatbotTextarea.value.trim().length > 0;
  const hasImage = !!state.chatbotAttachmentBase64;
  elements.btnChatbotSend.disabled = (!hasText && !hasImage) || state.isChatbotGenerating;
}

async function handleChatbotSubmit() {
  if (state.isChatbotGenerating) return;

  const text = elements.chatbotTextarea ? elements.chatbotTextarea.value.trim() : '';
  const imageBase64 = state.chatbotAttachmentBase64;

  if (!text && !imageBase64) return;

  // Clear inputs
  if (elements.chatbotTextarea) {
    elements.chatbotTextarea.value = '';
    elements.chatbotTextarea.style.height = 'auto';
  }
  clearChatbotAttachment();
  updateChatbotSendButtonState();

  await executeChatbotQuery(text, imageBase64);
}

async function executeChatbotQuery(promptText, imageBase64 = null, isRegeneration = false) {
  let session = getActiveChatSession();
  if (!session) {
    session = createNewChatSession(promptText, false);
  }

  // If this is first turn, set conversation title
  if (session.messages.length === 0 && promptText) {
    session.title = promptText.length > 28 ? promptText.slice(0, 28) + '...' : promptText;
    authFetch(`/api/chatbot/sessions/${encodeURIComponent(session.id)}`, {
      method: 'PUT',
      body: { title: session.title },
    }).catch(() => { });
  }

  // Add User Message if not regenerating
  if (!isRegeneration) {
    const userMsg = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: promptText || (imageBase64 ? 'Analyze this photo' : ''),
      imageBase64: imageBase64 || null,
      timestamp: Date.now(),
    };
    session.messages.push(userMsg);
    appendChatbotMessageElement(userMsg);
    saveLocalChatSessions();
    renderChatSessionsList();

    // Persist to SQLite backend
    authFetch(`/api/chatbot/sessions/${encodeURIComponent(session.id)}/messages`, {
      method: 'POST',
      body: {
        role: userMsg.role,
        content: userMsg.content,
        imageBase64: userMsg.imageBase64,
        createdAt: userMsg.timestamp,
      },
    }).catch(() => { });
  }

  // Show Typing Indicator Row
  state.isChatbotGenerating = true;
  updateChatbotSendButtonState();
  if (elements.btnChatbotSend) {
    elements.btnChatbotSend.innerHTML = '<div class="spinner-sm"></div>';
  }

  const typingRow = document.createElement('div');
  typingRow.className = 'chat-message-item assistant';
  typingRow.id = 'chatbot-typing-row';
  typingRow.innerHTML = `
    <div class="chat-msg-avatar ai-avatar">
      <i data-lucide="sparkles"></i>
    </div>
    <div class="chat-msg-body-wrap">
      <div class="chat-msg-bubble">
        <div class="chat-typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    </div>
  `;
  if (elements.chatbotFeed) {
    elements.chatbotFeed.appendChild(typingRow);
    if (window.lucide) lucide.createIcons();
    scrollChatbotToBottom();
  }

  try {
    // Multi-turn history (last 6 messages)
    const history = session.messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await authFetch('/api/ai/ask', {
      method: 'POST',
      body: {
        prompt: promptText,
        imageBase64: imageBase64 || null,
        history,
      },
    });

    const json = await res.json();
    if (typingRow && typingRow.parentNode) {
      typingRow.parentNode.removeChild(typingRow);
    }

    let responseText = 'No response generated.';
    let modelName = 'Qwen 3.5';

    if (json.success && json.data) {
      responseText = json.data.response || responseText;
      modelName = json.data.model_name || modelName;
    } else {
      responseText = `⚠️ Error: ${json.error || 'Failed to process prompt.'}`;
    }

    const assistantMsg = {
      id: `msg_a_${Date.now()}`,
      role: 'assistant',
      content: responseText,
      modelName,
      timestamp: Date.now(),
    };

    session.messages.push(assistantMsg);
    saveLocalChatSessions();

    appendChatbotMessageElement(assistantMsg);

    // Persist to SQLite backend
    authFetch(`/api/chatbot/sessions/${encodeURIComponent(session.id)}/messages`, {
      method: 'POST',
      body: {
        role: assistantMsg.role,
        content: assistantMsg.content,
        createdAt: assistantMsg.timestamp,
      },
    }).catch(() => { });
  } catch (err) {
    if (typingRow && typingRow.parentNode) {
      typingRow.parentNode.removeChild(typingRow);
    }
    const errMsg = {
      id: `msg_err_${Date.now()}`,
      role: 'assistant',
      content: `⚠️ Failed to connect to AI engine: ${err.message}`,
      modelName: 'Error',
      timestamp: Date.now(),
    };
    session.messages.push(errMsg);
    saveLocalChatSessions();
    appendChatbotMessageElement(errMsg);
  } finally {
    state.isChatbotGenerating = false;
    updateChatbotSendButtonState();
    if (elements.btnChatbotSend) {
      elements.btnChatbotSend.innerHTML = '<i data-lucide="arrow-up" id="chatbot-send-icon"></i>';
      if (window.lucide) lucide.createIcons();
    }
    scrollChatbotToBottom();
  }
}


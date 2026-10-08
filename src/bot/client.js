import sessionManager from './sessionManager.js';

export const botClient = sessionManager.getOrCreateSession(1, false);
export default botClient;

/**
 * Link detection utility for Instagram and TikTok URLs
 */

// Regular expression to detect Instagram URLs
const INSTAGRAM_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am|ig\.me)(?:\/[^\s"']*)?/gi;

// Regular expression to detect TikTok URLs
const TIKTOK_REGEX = /(?:https?:\/\/)?(?:www\.|vt\.|vm\.|m\.)?(?:tiktok\.com|douyin\.com)(?:\/[^\s"']*)?/gi;

// Generalized URL regex to extract all URLs in a message
const GENERIC_URL_REGEX = /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;

/**
 * Inspects a message string for Instagram and TikTok links
 * @param {string} text 
 * @returns {{
 *   hasInstagram: boolean,
 *   hasTikTok: boolean,
 *   isBlocked: boolean,
 *   matchedLinks: string[],
 *   type: 'INSTAGRAM' | 'TIKTOK' | 'BOTH' | null
 * }}
 */
export function detectBlockedLinks(text) {
  if (!text || typeof text !== 'string') {
    return {
      hasInstagram: false,
      hasTikTok: false,
      isBlocked: false,
      matchedLinks: [],
      type: null,
    };
  }

  const instagramMatches = text.match(INSTAGRAM_REGEX) || [];
  const tiktokMatches = text.match(TIKTOK_REGEX) || [];

  // Filter out any false positives if domain is just substring of another word
  const validIg = instagramMatches.filter(url => /instagram\.com|instagr\.am|ig\.me/i.test(url));
  const validTt = tiktokMatches.filter(url => /tiktok\.com|douyin\.com/i.test(url));

  const hasInstagram = validIg.length > 0;
  const hasTikTok = validTt.length > 0;
  const matchedLinks = [...validIg, ...validTt];

  let type = null;
  if (hasInstagram && hasTikTok) {
    type = 'BOTH';
  } else if (hasInstagram) {
    type = 'INSTAGRAM';
  } else if (hasTikTok) {
    type = 'TIKTOK';
  }

  return {
    hasInstagram,
    hasTikTok,
    isBlocked: hasInstagram || hasTikTok,
    matchedLinks,
    type,
  };
}

/**
 * Checks if a specific text is a "Hi" greeting
 * Supports "hi", "hello", "hey", "hie", "halo", etc. (case-insensitive & trimmed)
 * @param {string} text
 * @returns {boolean}
 */
export function isHiGreeting(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.trim().toLowerCase().replace(/[!.,?~]/g, '');
  const hiPatterns = ['hi', 'hey', 'hello', 'halo', 'hallo', 'hie', 'yo', 'hai'];
  return hiPatterns.includes(normalized);
}

export default {
  detectBlockedLinks,
  isHiGreeting,
};

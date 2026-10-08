import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';

/**
 * Checks if a message or quoted context contains an image or sticker
 * @param {object} msg - Baileys message object
 * @param {object} contextInfo - Message context info
 * @returns {{ isImage: boolean, targetNode: object|null, mediaType: string }}
 */
export function extractMediaForSticker(msg, contextInfo) {
  // Case 1: Quoted message contains an image or sticker
  if (contextInfo?.quotedMessage) {
    const quoted = contextInfo.quotedMessage;
    const imgNode =
      quoted.imageMessage ||
      quoted.viewOnceMessage?.message?.imageMessage ||
      quoted.viewOnceMessageV2?.message?.imageMessage ||
      (quoted.documentMessage?.mimetype?.startsWith('image/') ? quoted.documentMessage : null);

    if (imgNode) {
      return { isImage: true, targetNode: imgNode, mediaType: 'image' };
    }

    if (quoted.stickerMessage) {
      return { isImage: true, targetNode: quoted.stickerMessage, mediaType: 'sticker' };
    }
  }

  // Case 2: Direct message contains an image
  const directImg =
    msg.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessageV2?.message?.imageMessage;

  if (directImg) {
    return { isImage: true, targetNode: directImg, mediaType: 'image' };
  }

  return { isImage: false, targetNode: null, mediaType: null };
}

/**
 * Downloads media from Baileys message node and returns Buffer
 * @param {object} mediaNode
 * @param {string} mediaType
 * @returns {Promise<Buffer>}
 */
export async function downloadMediaBuffer(mediaNode, mediaType = 'image') {
  const stream = await downloadContentFromMessage(mediaNode, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

/**
 * Converts an image Buffer into a 512x512 square WebP WhatsApp sticker
 * @param {Buffer} imageBuffer
 * @returns {Promise<Buffer>}
 */
export async function convertToStickerWebp(imageBuffer) {
  return await sharp(imageBuffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Check if the text matches the .sticker command
 * @param {string} text
 * @returns {boolean}
 */
export function isStickerCommand(text) {
  if (!text) return false;
  return /^\.(sticker|stiker|s)\b/i.test(text.trim());
}

/**
 * Checks if a message or quoted message contains View Once (or standard) media to reveal
 * @param {object} msg - Baileys message object
 * @param {object} contextInfo - Message context info
 * @returns {{ isMedia: boolean, targetNode: object|null, mediaType: string, isViewOnce: boolean, caption: string }}
 */
export function extractViewOnceMedia(msg, contextInfo) {
  // Case 1: Quoted message contains View Once or media
  if (contextInfo?.quotedMessage) {
    const quoted = contextInfo.quotedMessage;

    // View Once Image
    const imgNode =
      quoted.viewOnceMessage?.message?.imageMessage ||
      quoted.viewOnceMessageV2?.message?.imageMessage ||
      quoted.viewOnceMessageV2Extension?.message?.imageMessage ||
      quoted.imageMessage;

    if (imgNode) {
      const isVO = Boolean(
        quoted.viewOnceMessage ||
        quoted.viewOnceMessageV2 ||
        quoted.viewOnceMessageV2Extension ||
        imgNode.viewOnce
      );
      return {
        isMedia: true,
        targetNode: imgNode,
        mediaType: 'image',
        isViewOnce: isVO,
        caption: imgNode.caption || '',
      };
    }

    // View Once Video
    const videoNode =
      quoted.viewOnceMessage?.message?.videoMessage ||
      quoted.viewOnceMessageV2?.message?.videoMessage ||
      quoted.viewOnceMessageV2Extension?.message?.videoMessage ||
      quoted.videoMessage;

    if (videoNode) {
      const isVO = Boolean(
        quoted.viewOnceMessage ||
        quoted.viewOnceMessageV2 ||
        quoted.viewOnceMessageV2Extension ||
        videoNode.viewOnce
      );
      return {
        isMedia: true,
        targetNode: videoNode,
        mediaType: 'video',
        isViewOnce: isVO,
        caption: videoNode.caption || '',
      };
    }

    // View Once Audio
    const audioNode =
      quoted.viewOnceMessage?.message?.audioMessage ||
      quoted.viewOnceMessageV2?.message?.audioMessage ||
      quoted.audioMessage;

    if (audioNode) {
      return {
        isMedia: true,
        targetNode: audioNode,
        mediaType: 'audio',
        isViewOnce: true,
        caption: '',
      };
    }
  }

  // Case 2: Direct message contains View Once media
  const direct = msg.message;
  if (direct) {
    const imgNode =
      direct.viewOnceMessage?.message?.imageMessage ||
      direct.viewOnceMessageV2?.message?.imageMessage ||
      direct.viewOnceMessageV2Extension?.message?.imageMessage ||
      direct.imageMessage;

    if (imgNode) {
      const isVO = Boolean(
        direct.viewOnceMessage ||
        direct.viewOnceMessageV2 ||
        direct.viewOnceMessageV2Extension ||
        imgNode.viewOnce
      );
      return {
        isMedia: true,
        targetNode: imgNode,
        mediaType: 'image',
        isViewOnce: isVO,
        caption: imgNode.caption || '',
      };
    }

    const videoNode =
      direct.viewOnceMessage?.message?.videoMessage ||
      direct.viewOnceMessageV2?.message?.videoMessage ||
      direct.viewOnceMessageV2Extension?.message?.videoMessage ||
      direct.videoMessage;

    if (videoNode) {
      const isVO = Boolean(
        direct.viewOnceMessage ||
        direct.viewOnceMessageV2 ||
        direct.viewOnceMessageV2Extension ||
        videoNode.viewOnce
      );
      return {
        isMedia: true,
        targetNode: videoNode,
        mediaType: 'video',
        isViewOnce: isVO,
        caption: videoNode.caption || '',
      };
    }
  }

  return { isMedia: false, targetNode: null, mediaType: null, isViewOnce: false, caption: '' };
}

/**
 * Check if the text matches the .peek / .rvo command
 * @param {string} text
 * @returns {boolean}
 */
export function isPeekCommand(text) {
  if (!text) return false;
  return /^\.(peek|rvo|viewonce|reveal|intip)\b/i.test(text.trim());
}

export default {
  extractMediaForSticker,
  extractViewOnceMedia,
  downloadMediaBuffer,
  convertToStickerWebp,
  isStickerCommand,
  isPeekCommand,
};

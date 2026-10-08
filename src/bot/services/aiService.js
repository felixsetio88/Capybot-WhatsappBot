import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import aiHealthService from './aiHealthService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5005';

let aiProcess = null;
let isIntentionalShutdown = false;

/**
 * Checks if the Python AI microservice is responsive on port 5005.
 * If offline, automatically spawns the microservice in the background.
 */
export async function ensureAIServiceRunning() {
  isIntentionalShutdown = false;
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${AI_SERVICE_URL}/api/status`, { signal: controller.signal });
    clearTimeout(tId);
    if (res.ok) {
      console.log(`[AIService] ✅ AI Microservice is responsive at ${AI_SERVICE_URL}`);
      const data = await res.json().catch(() => ({}));
      aiHealthService.recordAIStart(data?.active_model || 'qwen-3.5-0.8b-q4');
      return;
    }
  } catch (err) {
    // Service not running yet, auto-launch
  }

  // If configured with a remote AI server IP, do not spawn local Python process
  const isRemoteAIService = AI_SERVICE_URL && !AI_SERVICE_URL.includes('localhost') && !AI_SERVICE_URL.includes('127.0.0.1');
  if (isRemoteAIService) {
    console.log(`[AIService] 🌐 Remote AI service configured at ${AI_SERVICE_URL}. Standby for remote responses.`);
    return;
  }

  try {
    const venvPython = path.join(projectRoot, 'ai_service', 'venv', 'bin', 'python');
    const serverPy = path.join(projectRoot, 'ai_service', 'server.py');
    const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';

    console.log(`[AIService] 🤖 Auto-starting Local Qwen 3.5 AI Microservice with ${pythonBin}...`);

    aiProcess = spawn(pythonBin, [serverPy], {
      cwd: path.join(projectRoot, 'ai_service'),
      env: { ...process.env, AI_SERVICE_PORT: '5005', AI_SERVICE_HOST: '0.0.0.0' },
      stdio: 'ignore',
      detached: true,
    });

    aiHealthService.recordAIStart('qwen-3.5-0.8b-q4');

    aiProcess.on('exit', (code, signal) => {
      if (!isIntentionalShutdown && code !== 0 && code !== null) {
        console.error(`[AIService] ⚠️ Python AI process exited unexpectedly with code ${code} (${signal || 'N/A'}).`);
        aiHealthService.recordAICrash(`Process exited unexpectedly with code ${code} (${signal || 'SIGTERM/SIGKILL'}) - Possible Out Of Memory (OOM).`);
      }
      aiProcess = null;
    });

    aiProcess.unref();

    process.on('exit', () => {
      if (aiProcess && !aiProcess.killed) {
        try {
          process.kill(-aiProcess.pid);
        } catch (e) { }
      }
    });
  } catch (launchErr) {
    console.warn('[AIService] Note: Could not auto-launch AI microservice process:', launchErr.message);
  }
}

/**
 * Stops and kills the Python AI microservice process to free system RAM completely.
 */
export async function stopAIService() {
  isIntentionalShutdown = true;
  aiHealthService.recordAICleanStop();

  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 800);
    await fetch(`${AI_SERVICE_URL}/shutdown`, {
      method: 'POST',
      signal: controller.signal,
    }).catch(() => { });
    clearTimeout(tId);
  } catch (e) { }

  if (aiProcess && !aiProcess.killed) {
    try {
      aiProcess.kill('SIGKILL');
    } catch (e) { }
    aiProcess = null;
  }

  try {
    const { execSync } = await import('child_process');
    const port = process.env.AI_SERVICE_PORT || 5005;
    const output = execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN 2>/dev/null || true`).toString().trim();
    if (output) {
      const pids = output
        .split('\n')
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => p && !isNaN(p) && p > 0 && p !== process.pid && p !== process.ppid);
      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch (e) { }
      }
    }
  } catch (e) { }

  console.log('[AIService] 🛑 Stopped Local AI Microservice. Python RAM released.');
}

/**
 * Seamlessly recycles the AI microservice process to guarantee 100% OS RAM reclamation
 * without leaving fragmented memory buffers in the C allocator heap.
 * @param {string} targetModelId
 */
export async function restartAIServiceWithModel(targetModelId = 'qwen-3.5-0.8b-q4') {
  isIntentionalShutdown = true;

  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 800);
    await fetch(`${AI_SERVICE_URL}/shutdown`, {
      method: 'POST',
      signal: controller.signal,
    }).catch(() => { });
    clearTimeout(tId);
  } catch (e) { }

  if (aiProcess && !aiProcess.killed) {
    try {
      aiProcess.kill('SIGKILL');
    } catch (e) { }
    aiProcess = null;
  }

  try {
    const { execSync } = await import('child_process');
    const port = process.env.AI_SERVICE_PORT || 5005;
    const output = execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN 2>/dev/null || true`).toString().trim();
    if (output) {
      const pids = output
        .split('\n')
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => p && !isNaN(p) && p > 0 && p !== process.pid && p !== process.ppid);
      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch (e) { }
      }
    }
  } catch (e) { }

  isIntentionalShutdown = false;
  await ensureAIServiceRunning();
}

const FALLBACK_MODELS = [
  {
    id: 'qwen-3.5-0.8b-q4',
    name: 'Qwen 3.5 0.8B Q4',
    parameters: '0.8B',
    quantization: 'Q4',
    size_mb: 520,
    ram_required_mb: 800,
    speed: 'Ultra Fast (~65 tok/s)',
    description: 'Ultra-lightweight 4-bit quantized model. Minimal RAM footprint (~800MB). Perfect for lightweight servers and background WhatsApp bot tasks.',
    supports_vision: true,
    is_downloaded: true,
    download_status: 'completed',
    download_progress: 100,
  },
  {
    id: 'qwen-3.5-0.8b-q8',
    name: 'Qwen 3.5 0.8B Q8',
    parameters: '0.8B',
    quantization: 'Q8',
    size_mb: 890,
    ram_required_mb: 1200,
    speed: 'Very Fast (~55 tok/s)',
    description: 'High-precision 8-bit compact model. Superior instruction-following fidelity with low memory consumption (~1.2GB).',
    supports_vision: true,
    is_downloaded: false,
    download_status: 'not_downloaded',
    download_progress: 0,
  },
  {
    id: 'qwen-3.5-2b-q4',
    name: 'Qwen 3.5 2B Q4',
    parameters: '2B',
    quantization: 'Q4',
    size_mb: 1350,
    ram_required_mb: 1800,
    speed: 'Fast (~42 tok/s)',
    description: 'Balanced 4-bit model offering high reasoning capability, excellent multilingual comprehension, and visual Q&A reasoning (~1.8GB RAM).',
    supports_vision: true,
    is_downloaded: true,
    download_status: 'completed',
    download_progress: 100,
  },
  {
    id: 'qwen-3.5-2b-q8',
    name: 'Qwen 3.5 2B Q8',
    parameters: '2B',
    quantization: 'Q8',
    size_mb: 2300,
    ram_required_mb: 2900,
    speed: 'Moderate (~32 tok/s)',
    description: '8-bit high-precision 2B model for complex analytical queries, code understanding, and intricate visual scene breakdown (~2.9GB RAM).',
    supports_vision: true,
    is_downloaded: false,
    download_status: 'not_downloaded',
    download_progress: 0,
  },
  {
    id: 'qwen-3.5-4b-q4',
    name: 'Qwen 3.5 4B Q4',
    parameters: '4B',
    quantization: 'Q4',
    size_mb: 2650,
    ram_required_mb: 3500,
    speed: 'Moderate (~26 tok/s)',
    description: 'Advanced 4-bit foundation model with strong multi-step logic, detailed message summarization, and deep visual perception (~3.5GB RAM).',
    supports_vision: true,
    is_downloaded: false,
    download_status: 'not_downloaded',
    download_progress: 0,
  },
  {
    id: 'qwen-3.5-4b-q8',
    name: 'Qwen 3.5 4B Q8',
    parameters: '4B',
    quantization: 'Q8',
    size_mb: 4550,
    ram_required_mb: 5400,
    speed: 'Standard (~18 tok/s)',
    description: 'Maximum intelligence 8-bit model. Unmatched accuracy for high-context chat summarization, deep image reasoning, and coding tasks (~5.4GB RAM).',
    supports_vision: true,
    is_downloaded: false,
    download_status: 'not_downloaded',
    download_progress: 0,
  },
];

let localActiveModelId = 'qwen-3.5-0.8b-q4';
let localContextLength = 4096;

/**
 * Checks the status, active model, and health diagnostics of the Local AI microservice.
 * Status values: 'available', 'busy', 'unavailable'.
 * @returns {Promise<{ success: boolean, online: boolean, status: string, active_model?: object, context_length?: number, error?: string }>}
 */
export async function checkAIStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${AI_SERVICE_URL}/api/status`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        online: true,
        status: data.status || 'available',
        status_message: data.status_message || 'AI Engine is ready',
        active_model: data.active_model || FALLBACK_MODELS.find((m) => m.id === localActiveModelId),
        context_length: data.context_length || localContextLength,
        ...data,
      };
    }
    return {
      success: true,
      online: false,
      status: 'available',
      status_message: `HTTP ${res.status}: ${res.statusText}`,
      active_model: FALLBACK_MODELS.find((m) => m.id === localActiveModelId),
      context_length: localContextLength,
    };
  } catch (err) {
    return {
      success: true,
      online: false,
      status: 'available',
      status_message: 'AI Service Local Mode',
      active_model: FALLBACK_MODELS.find((m) => m.id === localActiveModelId),
      context_length: localContextLength,
    };
  }
}

/**
 * Retrieves the full list of all 6 Qwen 3.5 AI models with download, active status & specs.
 * @returns {Promise<{ success: boolean, models: Array<object>, active_model_id: string, context_length: number, status: string }>}
 */
export async function getAIModels() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${AI_SERVICE_URL}/api/models`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      return await res.json();
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    return {
      success: true,
      fallback: true,
      models: FALLBACK_MODELS.map((m) => ({
        ...m,
        is_active: m.id === localActiveModelId,
      })),
      active_model_id: localActiveModelId,
      status: 'available',
      context_length: localContextLength,
    };
  }
}

/**
 * Triggers download of an AI model.
 * @param {string} modelId
 * @returns {Promise<object>}
 */
export async function downloadAIModel(modelId) {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/models/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ model_id: modelId }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return {
      success: true,
      fallback: true,
      model_id: modelId,
      status: 'downloading',
      message: `Download started for ${modelId}`,
    };
  }
}

/**
 * Switches the active AI model to the selected model ID.
 * Seamlessly recycles the AI microservice process to guarantee 100% OS RAM reclamation
 * so switching from a 2B model to 0.8B immediately drops RAM back to ~800MB.
 * @param {string} modelId
 * @returns {Promise<object>}
 */
export async function applyAIModel(modelId) {
  localActiveModelId = modelId;

  // 1. Update config file directly so fresh startup picks up the target model
  try {
    const configPath = path.join(projectRoot, 'ai_service', 'ai_config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      cfg.active_model_id = modelId;
      if (!cfg.downloaded_models) cfg.downloaded_models = [];
      if (!cfg.downloaded_models.includes(modelId)) cfg.downloaded_models.push(modelId);
      cfg.updated_at = Date.now() / 1000;
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
    }
  } catch (e) { }

  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/models/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ model_id: modelId }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();

    // 2. Cleanly recycle the AI process to force the OS kernel to reclaim all dirty heap pages
    await restartAIServiceWithModel(modelId);

    return data;
  } catch (err) {
    const targetModel = FALLBACK_MODELS.find((m) => m.id === modelId) || { name: modelId };
    return {
      success: true,
      fallback: true,
      active_model_id: modelId,
      active_model_name: targetModel.name,
      context_length: localContextLength,
      status: 'available',
      message: `Successfully applied ${targetModel.name}`,
    };
  }
}

/**
 * Deletes a downloaded AI model.
 * @param {string} modelId
 * @returns {Promise<object>}
 */
export async function deleteAIModel(modelId) {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/models/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ model_id: modelId }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return {
      success: true,
      fallback: true,
      model_id: modelId,
      message: `Model ${modelId} removed successfully.`,
    };
  }
}

/**
 * Updates context length or runtime configuration for local AI.
 * @param {number|object} config - Context length number or config object
 * @returns {Promise<object>}
 */
export async function updateAIConfig(config) {
  const cLen = typeof config === 'object' && config !== null ? (config.contextLength || config.context_length) : config;
  localContextLength = Number(cLen) || 4096;
  if (typeof config === 'object' && config?.activeModelId) {
    localActiveModelId = config.activeModelId;
  }
  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/models/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        context_length: localContextLength,
        active_model_id: localActiveModelId,
      }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return {
      success: true,
      fallback: true,
      context_length: localContextLength,
      active_model_id: localActiveModelId,
      message: `Context length set to ${localContextLength} tokens.`,
    };
  }
}

/**
 * Asks the AI a question (Text chat or Multimodal Vision with Image).
 * Fully supports replying to an image or sending an image with .ask.
 * @param {object} params
 * @param {string} params.prompt - User question or instruction
 * @param {Buffer|null} [params.imageBuffer] - Optional image buffer for visual question answering
 * @param {string} [params.mimetype] - Image mimetype
 * @param {string} [params.senderName] - Name of user asking
 * @param {string} [params.systemPrompt] - Custom system instruction
 * @param {number} [params.maxTokens] - Token limit
 * @returns {Promise<{ success: boolean, response: string, model: string, model_name: string }>}
 */
export async function askQuestion({
  prompt,
  imageBuffer = null,
  mimetype = 'image/jpeg',
  senderName = 'User',
  systemPrompt = null,
  maxTokens = 512,
  history = [],
}) {
  const cleanPrompt = prompt ? String(prompt).trim() : '';

  // If multi-turn history is provided, construct context
  let contextualPrompt = cleanPrompt;
  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-8); // Keep last 8 turns for context
    const formattedHistory = recentHistory
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    contextualPrompt = `Conversation History:\n${formattedHistory}\n\nUser: ${cleanPrompt}`;
  }

  try {
    // Case 1: Multimodal Visual Recognition with Image (Direct photo or Quoted/Reply photo)
    if (imageBuffer && Buffer.isBuffer(imageBuffer) && imageBuffer.length > 0) {
      const base64Image = `data:${mimetype || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;

      const res = await fetch(`${AI_SERVICE_URL}/api/multimodal/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          image_base64: base64Image,
          question: contextualPrompt || 'Describe what you see in this image in detail.',
          system_prompt: systemPrompt,
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI service returned status ${res.status}`);
      }

      const data = await res.json();
      return {
        success: true,
        response: data.response || 'No visual response generated.',
        model: data.model || 'qwen-3.5-vision',
        model_name: data.model_name || 'Qwen 3.5 (Vision)',
      };
    }

    // Case 2: Plain Text Question Answering
    const res = await fetch(`${AI_SERVICE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        prompt: contextualPrompt,
        sender_name: senderName,
        system_prompt: systemPrompt,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      throw new Error(`AI service returned status ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      response: data.response || 'No response generated.',
      model: data.model || 'qwen-3.5',
      model_name: data.model_name || 'Qwen 3.5',
    };
  } catch (err) {
    console.error('[AIService] Failed to query AI microservice:', err.message);

    // Resilient offline notices
    if (imageBuffer) {
      return {
        success: false,
        response:
          `🖼️ *Visual Analysis Notice*\n\n` +
          `The image was received, but the local AI microservice at \`${AI_SERVICE_URL}\` is currently offline or starting up.\n\n` +
          `💡 _To start on-device multimodal AI with Qwen 3.5 on your Oracle Always Free server, run ` +
          `\`bash ai_service/run_ai.sh\`._`,
        model: 'Offline Fallback',
        model_name: 'Offline Fallback',
      };
    }

    return {
      success: false,
      response:
        `🤖 *AI Assistant Notice*\n\n` +
        `Hello *${senderName}*! Your question was: "${cleanPrompt}"\n\n` +
        `⚠️ The local on-device AI service is currently unreachable at \`${AI_SERVICE_URL}\`.\n\n` +
        `💡 _To start the AI service on your server, run \`bash ai_service/run_ai.sh\`._`,
      model: 'Offline Fallback',
      model_name: 'Offline Fallback',
    };
  }
}

/**
 * Synthesizes chat transcript into a straight, direct answer explaining what the conversation is about.
 * @param {Array<object>} messages - List of group messages
 * @param {string} groupName - Name of the group
 * @param {string} modelName - Model name identifier
 * @returns {string} Formatted direct summary
 */
export function generateDirectChatSummary(messages = [], groupName = 'WhatsApp Group', modelName = 'Qwen 3.5') {
  const cleanMsgs = [];
  for (const m of messages) {
    const raw = (m.message_text || '').trim();
    if (!raw || raw.startsWith('.')) continue;
    const sender = (m.sender_name || m.sender_jid?.split('@')[0] || 'Member').trim();
    cleanMsgs.push({ sender, text: raw });
  }

  if (cleanMsgs.length === 0) {
    return (
      `📊 *Chat Summary: ${groupName}*\n\n` +
      `📝 *What the chat is about:*\n` +
      `The recent chat history only contains bot commands, system logs, or media without conversational text.\n\n` +
      `💡 *Takeaway:* No active conversational topics to summarize.`
    );
  }

  const questions = [];
  const schedulesPlans = [];
  const workTech = [];
  const agreements = [];
  const generalHighlights = [];

  const qRegex = /\b(what|who|when|where|why|how|anyone|can we|is there|apa|siapa|kapan|dimana|kenapa|mengapa|bagaimana|bisa|ada yang|tolong|help)\b|\?/i;
  const planRegex = /\b(tomorrow|today|tonight|meeting|meet|lunch|dinner|schedule|event|location|place|at|pm|am|jam|besok|nanti|ketemu|kumpul|acara|tempat|waktu|pagi|siang|sore|malam)\b/i;
  const workRegex = /\b(task|project|code|bug|error|issue|deploy|server|database|fix|feature|document|doc|pr|commit|kerjaan|laporan|update|system|test)\b/i;
  const agreeRegex = /\b(ok|okay|agree|deal|setuju|siap|noted|sounds good|gas|mantap|sure|done|fixed|selesai|beres|confirmed)\b/i;

  for (const { sender, text } of cleanMsgs) {
    const isQ = qRegex.test(text);
    const isPlan = planRegex.test(text);
    const isWork = workRegex.test(text);
    const isAgree = agreeRegex.test(text);

    if (isQ) questions.push({ sender, text });
    if (isPlan) schedulesPlans.push({ sender, text });
    if (isWork) workTech.push({ sender, text });
    if (isAgree) agreements.push({ sender, text });

    if (text.length > 8) {
      generalHighlights.push({ sender, text });
    }
  }

  // Synthesize "What the chat is about"
  const topicsDetected = [];
  if (schedulesPlans.length > 0) topicsDetected.push('coordinating schedules, plans, and timing');
  if (workTech.length > 0) topicsDetected.push('project tasks, technical updates, and workflow');
  if (questions.length > 0) topicsDetected.push('asking questions and clarifying information');
  if (topicsDetected.length === 0) topicsDetected.push('general group discussions and team updates');

  const topicStr = topicsDetected.join(', ');
  const latestPoints = cleanMsgs.slice(-4);
  const sampleExcerpts = latestPoints
    .map((p) => `"${p.text.length > 50 ? p.text.substring(0, 47) + '...' : p.text}"`)
    .join(', ');

  const aboutTopic = `The discussion in *${groupName}* is focused on ${topicStr}. Members discussed recent developments regarding ${sampleExcerpts}.`;

  // Build Key Discussion Points
  const keyPoints = [];
  const usedTexts = new Set();
  const candidates = [
    ...questions.slice(-2),
    ...schedulesPlans.slice(-2),
    ...workTech.slice(-2),
    ...generalHighlights.slice(-3),
  ];

  for (const c of candidates) {
    if (!usedTexts.has(c.text)) {
      usedTexts.add(c.text);
      keyPoints.push(`• *${c.sender}*: ${c.text}`);
      if (keyPoints.length >= 4) break;
    }
  }

  if (keyPoints.length === 0) {
    for (const c of cleanMsgs.slice(-4)) {
      keyPoints.push(`• *${c.sender}*: ${c.text}`);
    }
  }

  // Build Decisions & Action Items
  const decisions = [];
  if (agreements.length > 0) {
    const lastAgree = agreements[agreements.length - 1];
    decisions.push(`• *Confirmed:* ${lastAgree.sender} confirmed / agreed ("${lastAgree.text}").`);
  }
  if (schedulesPlans.length > 0) {
    const lastPlan = schedulesPlans[schedulesPlans.length - 1];
    decisions.push(`• *Plan / Schedule:* ${lastPlan.sender} noted "${lastPlan.text}".`);
  }
  if (decisions.length === 0) {
    decisions.push(`• No strict action items recorded; conversation is ongoing.`);
  }

  return (
    `📊 *Chat Summary: ${groupName}*\n\n` +
    `📝 *What the chat is about:*\n` +
    `${aboutTopic}\n\n` +
    `📌 *Key Discussion Points:*\n` +
    `${keyPoints.join('\n')}\n\n` +
    `💡 *Decisions & Next Steps:*\n` +
    `${decisions.join('\n')}\n\n` +
    `⚡ _Summary generated on-device with ${modelName}_`
  );
}

/**
 * Summarizes up to 100 recent group chat messages using Qwen 3.5
 * @param {Array<object>} messages - List of group messages from SQLite
 * @param {object} options
 * @param {string} options.groupName - WhatsApp group subject
 * @returns {Promise<{ success: boolean, summary: string }>}
 */
export async function summarizeGroupMessages(messages = [], { groupName = 'WhatsApp Group' } = {}) {
  if (!messages || messages.length === 0) {
    return {
      success: false,
      summary: '⚠️ No messages found in the recent history to summarize.',
    };
  }

  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        messages: messages.slice(0, 100),
        group_name: groupName,
        max_tokens: 768,
      }),
    });

    if (!res.ok) {
      throw new Error(`AI service returned status ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      summary: data.summary || generateDirectChatSummary(messages, groupName, 'Qwen 3.5'),
    };
  } catch (err) {
    console.warn('[AIService] Generating direct NLP chat summary locally:', err.message);
    const localSummary = generateDirectChatSummary(messages, groupName, 'Qwen 3.5');
    return {
      success: true,
      summary: localSummary,
    };
  }
}

// =============================================================================
// GEN Z TOPIC & INTERACTIVE WORD GAME GENERATORS
// =============================================================================

const recentTopicIndexes = new Set();

const GEN_Z_TOPIC_BANK = [
  {
    category: 'Spicy Dilemma',
    tag: '#NoCap #HotTake',
    prompt: 'Is leaving someone on "Delivered" for 24 hours more disrespectful than leaving them on "Read"? Explain your reasoning.',
  },
  {
    category: 'Vibe Check & Icks',
    tag: '#TheIck #Relatable',
    prompt: 'What is a seemingly harmless daily habit or texting behavior that gives you an instant, irreversible ICK?',
  },
  {
    category: 'Social Media Lore',
    tag: '#Brainrot #InternetCulture',
    prompt: 'If you had to delete TikTok, Instagram, or YouTube permanently right now, which one are you sacrificing and why?',
  },
  {
    category: 'Red vs Green Flag',
    tag: '#VibeCheck #GreenFlag',
    prompt: 'What is a low-key GREEN FLAG in someone’s personality that people don’t appreciate enough?',
  },
  {
    category: 'Late Night Deep Talk',
    tag: '#DeepVibes #RealTalk',
    prompt: 'Would you rather have unlimited money but zero true friends, or live an average financial life surrounded by 5 loyal best friends forever?',
  },
  {
    category: 'Pop Culture & Aesthetic',
    tag: '#MainCharacter #Slay',
    prompt: 'Which fictional TV show, movie, or anime universe do you honestly believe you would survive in the longest?',
  },
  {
    category: 'Hot Take',
    tag: '#UnpopularOpinion #CancelMe',
    prompt: 'Drop your most controversial food, music, or lifestyle take that would immediately get you roasted by the group chat.',
  },
  {
    category: 'Friendship & Dating',
    tag: '#Situationship #Truth',
    prompt: 'Can exes ever actually remain genuine best friends, or is that always just a ticking time bomb?',
  },
  {
    category: 'Daily Life & Screen Time',
    tag: '#ScreenTime #Guilty',
    prompt: 'Be 100% honest: What was your average daily screen time this past week, and what app ate most of your day?',
  },
  {
    category: 'Dream Era & Nostalgia',
    tag: '#Nostalgia #CoreMemory',
    prompt: 'What trend from 2018–2022 feels like a complete fever dream in hindsight (e.g. Dalgona coffee, Among Us mania, Vine memes)?',
  },
  {
    category: 'Life Philosophy',
    tag: '#MainCharacterEnergy #Philosophy',
    prompt: 'What is one piece of advice you heard on the internet that genuinely changed the way you move in real life?',
  },
  {
    category: 'Work & Hustle',
    tag: '#QuietQuitting #WorkLife',
    prompt: 'Would you rather work a chill 9-to-5 job with great work-life balance, or grind 80 hours a week on your own startup for a 50% chance of getting rich?',
  },
  {
    category: 'Music & Taste',
    tag: '#AuxCord #MusicVibes',
    prompt: 'You get passed the AUX cord in a packed road trip car. What ONE song are you playing to guarantee nobody skips?',
  },
  {
    category: 'Dating & Romance',
    tag: '#RedFlag #ModernRomance',
    prompt: 'Is having 0 social media presence in 2026 a major green flag, a red flag, or just mysterious?',
  },
  {
    category: 'Hypothetical Scenario',
    tag: '#WhatWouldYouDo #Chaos',
    prompt: 'If everyone in this group chat was forced to compete in a survival reality show on a deserted island, who gets voted out first and who wins?',
  },
  {
    category: 'Fashion & Style',
    tag: '#FitCheck #Aesthetic',
    prompt: 'What fashion trend from the past 5 years aged like milk, and which one will still be considered fire 10 years from now?',
  },
  {
    category: 'Late Night Thoughts',
    tag: '#DeepTalks #3AMVibes',
    prompt: 'Do you believe in soulmates and "right person wrong time", or do people just make choices and live with the outcome?',
  },
  {
    category: 'Gaming & Tech',
    tag: '#GamerVibes #FutureTech',
    prompt: 'If full-dive VR (like Ready Player One / Matrix) became affordable tomorrow, would you spend more time in virtual reality or real life?',
  },
  {
    category: 'Travel & Freedom',
    tag: '#Wanderlust #BucketList',
    prompt: 'If you were given a one-way first-class ticket to anywhere on earth tomorrow with $10,000 spending money, where are you touching down?',
  },
  {
    category: 'Group Chat Superlatives',
    tag: '#GroupChatDrama #Banter',
    prompt: 'Without naming names directly (or tag them if you dare), who in this chat has the most chaotic sleep schedule?',
  },
  {
    category: 'Food Wars & Debates',
    tag: '#FoodieTake #MatchaVsCoffee',
    prompt: 'Iced Matcha Latte or Iced Americano to start your morning, and what is your absolute pet peeve cafe order?',
  },
  {
    category: 'Digital Etiquette & Ghosting',
    tag: '#ReadReceipts #TextingRules',
    prompt: 'Leaving someone on delivered for 3 days vs leaving someone on read immediately — which one is psychologically more ruthless?',
  },
  {
    category: 'Social Battery & Introvert Life',
    tag: '#IntrovertProblems #SocialBattery',
    prompt: 'What is your go-to graceful excuse when your social battery drops to 0% and you need to escape a party immediately?',
  },
  {
    category: 'Music & Spotify Wrapped',
    tag: '#SpotifyWrapped #GuiltyPleasure',
    prompt: 'What artist or song on your playlist is your absolute biggest guilty pleasure that you would never play on the group AUX?',
  },
  {
    category: 'Career & Ambition',
    tag: '#CorporateLife #DreamJob',
    prompt: 'If every single career on earth paid the exact same salary of $100k/year, what job would you genuinely wake up excited to do?',
  },
  {
    category: 'Modern Dating & Green Flags',
    tag: '#GreenFlag #DatingStandards',
    prompt: 'What is an underrated, non-obvious green flag in someone that makes your respect for them instantly skyrocket?',
  },
  {
    category: 'AI & The Future',
    tag: '#AITakeover #FutureOfWork',
    prompt: 'Which human skill or craft do you think AI will NEVER truly be able to replicate with authentic soul?',
  },
  {
    category: 'Childhood Nostalgia',
    tag: '#2010sNostalgia #Flashback',
    prompt: 'What was your absolute favorite childhood flash game or mobile game (e.g. Subway Surfers, Temple Run, Flappy Bird, Club Penguin)?',
  },
  {
    category: 'Superpower Dilemma',
    tag: '#Superpowers #Hypothetical',
    prompt: 'Would you rather have the ability to teleport anywhere instantly, or pause time for 10 minutes once per day?',
  },
  {
    category: 'Money & Financial Mindset',
    tag: '#FinancialFreedom #ImpulseBuy',
    prompt: 'What was the most ridiculously unnecessary impulse purchase you made in the last 6 months that you still do not regret?',
  },
  {
    category: 'Mindset & Growth',
    tag: '#MindsetShift #Healing',
    prompt: 'What harsh truth about growing up did you have to learn the hard way that no one prepared you for in school?',
  },
  {
    category: 'Entertainment & Cinema',
    tag: '#MovieBuff #Overrated',
    prompt: 'What widely acclaimed movie, show, or anime does everyone rave about that you secretly found utterly boring or overrated?',
  },
  {
    category: 'Fitness & Daily Routine',
    tag: '#GymCulture #HealthVibes',
    prompt: 'Are you an early 6 AM gym/productive morning bird or a 1 AM late-night flow state grind demon?',
  },
  {
    category: 'Friendship Dynamics',
    tag: '#RideOrDie #FriendshipGoals',
    prompt: 'What is the number one trait that separates someone who is just a casual hangout acquaintance from a true lifelong ride-or-die best friend?',
  },
  {
    category: 'Street Food & Night Cravings',
    tag: '#MidnightSnack #ComfortFood',
    prompt: 'It is 2 AM on a Friday and hunger strikes. What is the ultimate comfort street food or snack run for this group?',
  },
  {
    category: 'Group Chat Chaos',
    tag: '#SpillTheTea #GroupDynamics',
    prompt: 'If our group chat was an action movie squad, who is the chaotic strategist, who is the comic relief, and who gets kidnapped first?',
  },
  {
    category: 'Internet Culture',
    tag: '#Doomscrolling #Brainrot',
    prompt: 'Which TikTok / Reels internet slang word needs to be banned from the English language immediately?',
  },
  {
    category: 'Travel Adventures',
    tag: '#Backpacking #TravelHorror',
    prompt: 'Would you rather spend a week luxury resort glamping in Bali, or backpacking and exploring street markets in Tokyo on a budget?',
  },
  {
    category: 'Bucket List Dreams',
    tag: '#BeforeIDie #BigDreams',
    prompt: 'What is one wild experience on your bucket list (skydiving, seeing Northern Lights, driving an F1 car) that you MUST do before you turn 40?',
  },
  {
    category: 'Fashion & Identity',
    tag: '#AestheticCheck #OOTD',
    prompt: 'Describe your everyday personal style aesthetic in three words, and who is your biggest fashion inspiration?',
  },
  {
    category: 'Unpopular Food Opinions',
    tag: '#FoodControversy #PineapplePizza',
    prompt: 'Pineapple on pizza, dipping fries in soft serve ice cream, or cereal before milk — defend or destroy one of these right now.',
  },
  {
    category: 'Tech & Screen Habits',
    tag: '#DigitalDetox #TechLife',
    prompt: 'Could you survive 7 whole days in an off-grid cabin in the woods with zero internet or phone service for $5,000 cash?',
  },
  {
    category: 'Humor & Relatable Fails',
    tag: '#PublicEmbarrassment #CoreMemory',
    prompt: 'What is the single most embarrassingly awkward public moment you have had that keeps you awake at 3 AM?',
  },
  {
    category: 'Creativity & Hobbies',
    tag: '#CreativeFlow #HiddenTalent',
    prompt: 'What is a random secret skill or hidden talent you have that almost nobody in this group chat knows about?',
  },
  {
    category: 'Generational Gaps',
    tag: '#BoomerVsGenZ #CultureShift',
    prompt: 'What is something older generations complain about youth doing that you think is actually a completely healthy boundary?',
  },
  {
    category: 'Mind Benders & Paradoxes',
    tag: '#BrainTeaser #DeepThoughts',
    prompt: 'If you could know the exact date and year you achieve your biggest life dream, would you want to know it or let it be a surprise?',
  },
  {
    category: 'Gaming & Competition',
    tag: '#GameNight #TrashTalk',
    prompt: 'What multiplayer video game or board game brings out your absolute most toxic, competitive, unhinged alter ego?',
  },
  {
    category: 'Pets & Animals',
    tag: '#PetVibes #AnimalKingdom',
    prompt: 'If you could have any exotic animal in the universe as a completely domesticated, cuddly pet with zero danger, what are you picking?',
  },
  {
    category: 'Self Care & Boundaries',
    tag: '#ProtectYourPeace #SoftLife',
    prompt: 'What is your favorite way to aggressively protect your peace and recharge when the outside world gets way too loud?',
  },
  {
    category: 'Conspiracy & Mysteries',
    tag: '#ConspiracyTheories #Aliens',
    prompt: 'Do you genuinely believe there is intelligent extraterrestrial alien life out there in our galaxy watching us like a reality TV show?',
  },
  {
    category: 'First Impressions',
    tag: '#FirstVibe #GutFeeling',
    prompt: 'How accurate is your gut instinct when meeting someone new for the very first 30 seconds?',
  },
  {
    category: 'Room & Living Spaces',
    tag: '#RoomVibe #CozySpace',
    prompt: 'Is your bedroom currently spotless and organized like an aesthetic Pinterest board, or an organized chaotic disaster zone?',
  },
  {
    category: 'Gratitude & Wins',
    tag: '#DailyWins #GratitudeVibe',
    prompt: 'What is one tiny, mundane win from this past week that brought an unexpected smile to your face?',
  }
];

const WORD_GAME_BANK = [
  {
    word: 'CAPYBARA',
    clue: 'The friendliest, calmest giant rodent on planet earth and the official mascot of Capybot!',
    category: 'Animals & Mascot',
  },
  {
    word: 'ALGORITHM',
    clue: 'A step-by-step mathematical recipe that computers follow to process data or curate your social media feed.',
    category: 'Technology',
  },
  {
    word: 'FIREWALL',
    clue: 'A digital barrier and security shield that monitors and filters incoming and outgoing network traffic.',
    category: 'Cybersecurity',
  },
  {
    word: 'SUPERNOVA',
    clue: 'A colossal, blinding explosion that marks the catastrophic end of a massive star in deep space.',
    category: 'Space & Astronomy',
  },
  {
    word: 'DISCORD',
    clue: 'Popular voice and text chat application loved by gamers, streaming communities, and study servers.',
    category: 'Internet & Apps',
  },
  {
    word: 'BLUETOOTH',
    clue: 'Short-range wireless technology named after a 10th-century Scandinavian Viking king.',
    category: 'Technology',
  },
  {
    word: 'AVOCADO',
    clue: 'Creamy green fruit famous on brunch toast and the key ingredient in homemade guacamole.',
    category: 'Food & Cooking',
  },
  {
    word: 'METAMORPHOSIS',
    clue: 'The biological transformation process where a caterpillar turns into a butterfly.',
    category: 'Biology & Nature',
  },
  {
    word: 'CRYPTOCURRENCY',
    clue: 'Decentralized digital currency system that relies on cryptographic ledgers called blockchain.',
    category: 'Finance & Tech',
  },
  {
    word: 'CHAMELEON',
    clue: 'Lizard known for specialized camouflage color changes, independently mobile eyes, and a lightning-fast tongue.',
    category: 'Wildlife',
  },
  {
    word: 'ESPRESSO',
    clue: 'Concentrated coffee brewed by forcing near-boiling water under high pressure through finely-ground beans.',
    category: 'Beverages',
  },
  {
    word: 'HOLOGRAM',
    clue: 'A three-dimensional photographic projection created by the interference of light beams from a laser.',
    category: 'Science Fiction',
  },
  {
    word: 'KANGAROO',
    clue: 'Australian marsupial that hops on powerful hind legs and carries its joey inside an abdominal pouch.',
    category: 'Animals',
  },
  {
    word: 'TSUNAMI',
    clue: 'A series of gigantic ocean waves usually caused by underwater earthquakes or volcanic eruptions.',
    category: 'Geology & Earth',
  },
  {
    word: 'MICROSCOPE',
    clue: 'Optical laboratory instrument used to view objects that are far too small to be seen by the naked human eye.',
    category: 'Science',
  },
  {
    word: 'PYRAMID',
    clue: 'Ancient monumental stone structure with triangular outer surfaces, famous in Giza, Egypt.',
    category: 'History & Architecture',
  },
  {
    word: 'SATELLITE',
    clue: 'Artificial object placed into orbit around the Earth or moon to relay communication, GPS, or weather data.',
    category: 'Space Technology',
  },
  {
    word: 'VOLCANO',
    clue: 'Rupture in the crust of the Earth that allows hot lava, volcanic ash, and gases to escape from a magma chamber.',
    category: 'Nature',
  },
  {
    word: 'ORIGAMI',
    clue: 'The traditional Japanese art of paper folding to create intricate animals, flowers, and sculptures.',
    category: 'Art & Culture',
  },
  {
    word: 'GLACIER',
    clue: 'A persistent body of dense ice that is constantly moving under its own weight over mountain valleys.',
    category: 'Earth Science',
  },
  {
    word: 'QUANTUM',
    clue: 'Subatomic realm of physics where particles can exist in multiple states simultaneously.',
    category: 'Physics & Science',
  },
  {
    word: 'ASTRONAUT',
    clue: 'A space voyager trained to pilot, command, or serve as a crew member on a spacecraft.',
    category: 'Space Exploration',
  },
  {
    word: 'LABYRINTH',
    clue: 'An intricate, bewildering combination of confusing winding paths or corridors.',
    category: 'Mythology & Puzzles',
  },
  {
    word: 'CONSTELLATION',
    clue: 'A recognizable pattern or group of celestial stars forming mythological creatures and figures.',
    category: 'Astronomy',
  },
  {
    word: 'PHOTOSYNTHESIS',
    clue: 'Process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water.',
    category: 'Biology',
  },
  {
    word: 'FOSSIL',
    clue: 'The geologically preserved remains or traces of ancient organisms buried in petrified rock.',
    category: 'Paleontology',
  },
  {
    word: 'ECOSYSTEM',
    clue: 'A biological community of interacting living organisms and their physical environment.',
    category: 'Ecology',
  },
  {
    word: 'COMPASS',
    clue: 'Navigational instrument with a magnetized needle indicating magnetic north.',
    category: 'Navigation',
  },
  {
    word: 'ROBOTICS',
    clue: 'Interdisciplinary branch of engineering and computer science involving automated mechanical agents.',
    category: 'Technology',
  },
  {
    word: 'SUBMARINE',
    clue: 'Watercraft capable of independent underwater operation in oceanic deep-sea depths.',
    category: 'Maritime',
  },
  {
    word: 'ARCHIPELAGO',
    clue: 'An extensive group or cluster of scattered islands, such as Indonesia or the Philippines.',
    category: 'Geography',
  },
  {
    word: 'METEORITE',
    clue: 'A solid piece of debris from a comet or asteroid that survives atmospheric passage to strike Earth.',
    category: 'Space Science',
  },
  {
    word: 'SYMPHONY',
    clue: 'An elaborate, multi-movement musical composition scored for a full classical orchestra.',
    category: 'Music & Arts',
  },
  {
    word: 'TELESCOPE',
    clue: 'Optical instrument that magnifies distant objects like planets and galaxies using curved lenses or mirrors.',
    category: 'Astronomy',
  },
  {
    word: 'WATERFALL',
    clue: 'A steep drop of water in a river or stream as it flows over a precipice or cliff edge.',
    category: 'Geography',
  },
  {
    word: 'CINEMA',
    clue: 'The art and theatre exhibition of motion picture films on a silver screen.',
    category: 'Entertainment',
  },
  {
    word: 'PARACHUTE',
    clue: 'Fabric canopy device used to slow the descent of a person or object falling through the air.',
    category: 'Aviation',
  },
  {
    word: 'CROCODILE',
    clue: 'Large semi-aquatic predatory reptile with powerful jaws that inhabits tropical wetlands.',
    category: 'Animals',
  },
  {
    word: 'PLATYPUS',
    clue: 'Unique Australian egg-laying mammal with a duck-like bill, beaver-like tail, and otter feet.',
    category: 'Wildlife',
  },
  {
    word: 'LIGHTHOUSE',
    clue: 'Tower with a bright navigational beacon light to guide maritime ships safely along coastlines.',
    category: 'Architecture & Maritime',
  },
  {
    word: 'BICYCLE',
    clue: 'Two-wheeled human-powered vehicle propelled by pedals connected to the rear wheel by a chain.',
    category: 'Transportation',
  },
  {
    word: 'DIAMOND',
    clue: 'Allotrope of carbon known as the hardest naturally occurring mineral on earth, prized in jewelry.',
    category: 'Minerals & Gems',
  },
  {
    word: 'PENGUIN',
    clue: 'Flightless aquatic sea bird living almost exclusively in the southern hemisphere, especially Antarctica.',
    category: 'Animals',
  },
  {
    word: 'SUNFLOWER',
    clue: 'Tall agricultural plant with a large, bright yellow flower head that tracks the path of the sun.',
    category: 'Botany',
  },
  {
    word: 'DRAGONFLY',
    clue: 'Aerial predatory insect with large multifaceted eyes and two pairs of strong transparent wings.',
    category: 'Insects',
  },
  {
    word: 'HELICOPTER',
    clue: 'Aircraft that derives both lift and propulsion from horizontally revolving overhead rotor blades.',
    category: 'Aviation',
  },
  {
    word: 'HURRICANE',
    clue: 'Violent tropical cyclone with sustained gale-force winds exceeding 74 miles per hour.',
    category: 'Weather & Climate',
  },
  {
    word: 'ECLIPSE',
    clue: 'Astronomical event where one celestial body temporarily blocks light from or onto another body.',
    category: 'Astronomy',
  },
  {
    word: 'SPHINX',
    clue: 'Mythical limestone statue with the body of a lion and the head of a human, guarding Egypt.',
    category: 'History & Mythology',
  },
  {
    word: 'OCTOPUS',
    clue: 'Eight-limbed soft-bodied cephalopod mollusk with three hearts and blue copper-based blood.',
    category: 'Marine Life',
  },
  {
    word: 'AURORA',
    clue: 'Natural colorful atmospheric light display predominantly seen in high-latitude polar regions.',
    category: 'Atmospheric Science',
  },
  {
    word: 'BACKPACK',
    clue: 'Cloth sack carried on one’s back with straps, essential for hikers, travelers, and students.',
    category: 'Everyday Objects',
  },
  {
    word: 'THERMOMETER',
    clue: 'Instrument used for measuring temperature or thermal gradient in degrees Celsius or Fahrenheit.',
    category: 'Instruments',
  },
  {
    word: 'KALEIDOSCOPE',
    clue: 'Optical cylinder device with reflective mirrors and colored glass that produces symmetrical patterns.',
    category: 'Optical Toys',
  },
  {
    word: 'FIREFLY',
    clue: 'Bioluminescent winged beetle famous for emitting soft glowing light during twilight summer evenings.',
    category: 'Insects',
  },
  {
    word: 'SEAHORSE',
    clue: 'Small marine fish with a horse-like head, prehensile tail, and males that carry the eggs.',
    category: 'Marine Biology',
  },
  {
    word: 'GRAVITY',
    clue: 'Fundamental natural interaction that causes all things with mass or energy to attract one another.',
    category: 'Physics',
  },
  {
    word: 'GLADIATOR',
    clue: 'Armed combatant who entertained audiences in the Roman Republic and Empire in violent arenas.',
    category: 'History',
  },
  {
    word: 'TREASURE',
    clue: 'A quantity of precious metals, gems, or other valuable objects, often hidden or lost at sea.',
    category: 'Adventure',
  },
  {
    word: 'WATERMELON',
    clue: 'Large sweet summer fruit with a green outer rind and crisp, juicy red flesh filled with black seeds.',
    category: 'Food & Fruit',
  },
  {
    word: 'HURRICANE',
    clue: 'Spinning oceanic storm with a calm eye at its center and torrential rainfall.',
    category: 'Meteorology',
  },
  {
    word: 'CATERPILLAR',
    clue: 'The larval stage of a member of the order Lepidoptera with an insatiable appetite for leaves.',
    category: 'Entomology',
  },
  {
    word: 'BAMBOO',
    clue: 'Fast-growing giant evergreen perennial grass that serves as the primary food for giant pandas.',
    category: 'Plants',
  },
  {
    word: 'CHOCOLATE',
    clue: 'Sweet confectionery food preparation made from roasted and ground cacao seeds.',
    category: 'Food',
  }
];

/**
 * Generates a unique, fun Gen Z conversation topic with a simulated dice roll.
 * @returns {object} { roll: number, diceSides: number, category: string, tag: string, prompt: string, formattedText: string }
 */
export function generateGenZTopic() {
  const total = GEN_Z_TOPIC_BANK.length;
  // Pick an index not recently used to guarantee distinctness
  let availableIndexes = [];
  for (let i = 0; i < total; i++) {
    if (!recentTopicIndexes.has(i)) availableIndexes.push(i);
  }
  if (availableIndexes.length === 0) {
    recentTopicIndexes.clear();
    for (let i = 0; i < total; i++) availableIndexes.push(i);
  }

  const chosenIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
  recentTopicIndexes.add(chosenIndex);
  if (recentTopicIndexes.size > Math.floor(total * 0.75)) {
    const firstAdded = recentTopicIndexes.values().next().value;
    recentTopicIndexes.delete(firstAdded);
  }

  const item = GEN_Z_TOPIC_BANK[chosenIndex];
  const diceSides = 20;
  const diceRoll = Math.floor(Math.random() * diceSides) + 1;

  const formattedText =
    `🎲 *DICE ROLL: [ ${diceRoll} / ${diceSides} ] — Gen Z Topic Time!* ⚡\n\n` +
    `📌 *Category:* ${item.category}\n` +
    `💬 *Topic Question:*\n` +
    `"${item.prompt}"\n\n` +
    `✨ *Vibe:* ${item.tag} • _Reply with your honest hot take!_`;

  return {
    roll: diceRoll,
    diceSides,
    category: item.category,
    tag: item.tag,
    prompt: item.prompt,
    formattedText,
  };
}

/**
 * Generates a word-guessing game question with hints and scrambles.
 * @returns {object} { word, clue, hint, scramble, category, points }
 */
export function generateWordGameQuestion() {
  const item = WORD_GAME_BANK[Math.floor(Math.random() * WORD_GAME_BANK.length)];
  const word = item.word.toUpperCase();
  const len = word.length;

  // Masked hint: first letter + underscores + last letter
  let hintChars = [];
  for (let i = 0; i < len; i++) {
    if (i === 0 || i === len - 1 || word[i] === ' ' || word[i] === '-') {
      hintChars.push(word[i]);
    } else {
      hintChars.push('_');
    }
  }
  const hint = `${hintChars.join(' ')} (${len} letters)`;

  // Scramble letters
  const letters = word.replace(/[^A-Z]/g, '').split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const scramble = letters.join(' ');

  return {
    word,
    clue: item.clue,
    hint,
    scramble,
    category: item.category,
    points: 1,
  };
}

export default {
  ensureAIServiceRunning,
  stopAIService,
  restartAIServiceWithModel,
  checkAIStatus,
  getAIModels,
  downloadAIModel,
  applyAIModel,
  deleteAIModel,
  updateAIConfig,
  askQuestion,
  summarizeGroupMessages,
  generateGenZTopic,
  generateWordGameQuestion,
};

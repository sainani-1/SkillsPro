const AI_BASE_URL = (import.meta.env.VITE_AI_BASE_URL || 'http://127.0.0.1:11434').trim().replace(/\/$/, '');
const AI_MODEL = (import.meta.env.VITE_AI_MODEL || 'llama3:latest').trim();
const AI_MAX_HISTORY_MESSAGES = Number(import.meta.env.VITE_AI_MAX_HISTORY_MESSAGES || 4);
const AI_MAX_TOKENS = Number(import.meta.env.VITE_AI_MAX_TOKENS || 220);
const AI_TEMPERATURE = Number(import.meta.env.VITE_AI_TEMPERATURE || 0.2);
const AI_TOP_P = Number(import.meta.env.VITE_AI_TOP_P || 0.85);
const AI_TIMEOUT_MS = Number(import.meta.env.VITE_AI_TIMEOUT_MS || 20000);

const toChatMessages = ({ systemInstruction, history, message }) => {
  const systemMessage = systemInstruction
    ? [{ role: 'system', content: String(systemInstruction).trim() }]
    : [];

  const recentHistory = (history || []).slice(-AI_MAX_HISTORY_MESSAGES);
  const priorMessages = recentHistory.map((item) => ({
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content: String(item.content || '').trim(),
  }));

  return [
    ...systemMessage,
    ...priorMessages,
    { role: 'user', content: String(message || '').trim() },
  ].filter((item) => item.content);
};

const readTextFromResponse = (data) =>
  String(
    data?.message?.content ||
      data?.response ||
      ''
  ).trim();

export const isAiConfigured = () => !!AI_BASE_URL && !!AI_MODEL;

export const generateAssistantReply = async ({
  systemInstruction,
  history = [],
  message,
}) => {
  if (!isAiConfigured() || !String(message || '').trim()) {
    return null;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const response = await fetch(
    `${AI_BASE_URL}/api/chat`,
    {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        stream: false,
        keep_alive: '15m',
        messages: toChatMessages({
          systemInstruction,
          history,
          message,
        }),
        options: {
          temperature: AI_TEMPERATURE,
          top_p: AI_TOP_P,
          num_ctx: 2048,
          num_predict: AI_MAX_TOKENS,
        },
      }),
    }
  );
  window.clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || 'AI request failed');
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return readTextFromResponse(data) || null;
};

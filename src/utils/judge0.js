const DEFAULT_JUDGE0_TIMEOUT_MS = 30000;
const ONECOMPILER_URL = 'https://onecompiler-apis.p.rapidapi.com/api/v1/run';
const ONECOMPILER_DEFAULT_KEY = '6c1b60a65emsh4f7371296b76e50p18a055jsn78b781957d20';
const ONECOMPILER_DEFAULT_HOST = 'onecompiler-apis.p.rapidapi.com';

function buildJudge0Headers() {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (import.meta.env.VITE_JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = import.meta.env.VITE_JUDGE0_API_KEY;
  }

  if (import.meta.env.VITE_JUDGE0_API_HOST) {
    headers['X-RapidAPI-Host'] = import.meta.env.VITE_JUDGE0_API_HOST;
  }

  return headers;
}

function getJudge0BaseUrl() {
  const baseUrl = import.meta.env.VITE_JUDGE0_URL;
  if (!baseUrl) return '';
  return baseUrl.replace(/\/+$/, '');
}

function getOneCompilerHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-key': import.meta.env.VITE_ONECOMPILER_API_KEY || ONECOMPILER_DEFAULT_KEY,
    'x-rapidapi-host': import.meta.env.VITE_ONECOMPILER_API_HOST || ONECOMPILER_DEFAULT_HOST,
  };
}

async function fetchJudge0(path, options = {}) {
  const response = await fetch(`${getJudge0BaseUrl()}${path}`, {
    ...options,
    headers: {
      ...buildJudge0Headers(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Judge0 request failed with ${response.status}`);
  }

  return response.json();
}

let languageIdCache = null;

async function resolveLanguageId(languageKey) {
  if (!languageIdCache) {
    const languages = await fetchJudge0('/languages');
    const matchers = {
      python: (name) => /^python\b/i.test(name),
      java: (name) => /^java\b/i.test(name),
      javascript: (name) => /^javascript\b/i.test(name),
      cpp: (name) => /^c\+\+\b/i.test(name),
    };

    languageIdCache = Object.entries(matchers).reduce((acc, [key, matcher]) => {
      const language = languages.find((entry) => matcher(entry.name || ''));
      if (language) acc[key] = language.id;
      return acc;
    }, {});
  }

  const languageId = languageIdCache?.[languageKey];
  if (!languageId) {
    throw new Error(`Judge0 does not expose a language mapping for "${languageKey}".`);
  }
  return languageId;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function executeJudge0Code({ language, sourceCode, stdin = '' }) {
  if (!getJudge0BaseUrl()) {
    return executeOneCompilerFallback({ language, sourceCode, stdin });
  }

  const languageId = await resolveLanguageId(language);
  const submission = await fetchJudge0('/submissions?base64_encoded=false&wait=false', {
    method: 'POST',
    body: JSON.stringify({
      language_id: languageId,
      source_code: sourceCode,
      stdin,
    }),
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < DEFAULT_JUDGE0_TIMEOUT_MS) {
    const result = await fetchJudge0(
      `/submissions/${submission.token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory`
    );

    if (result.status?.id && result.status.id <= 2) {
      await delay(1200);
      continue;
    }

    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compileOutput: result.compile_output || '',
      message: result.message || '',
      status: result.status?.description || 'Completed',
      executionTime: result.time || '',
      memory: result.memory || '',
    };
  }

  throw new Error('Judge0 execution timed out. Try again with smaller input.');
}

async function executeOneCompilerFallback({ language, sourceCode, stdin = '' }) {
  const fileMap = {
    python: { language: 'python', name: 'index.py' },
    java: { language: 'java', name: 'Main.java' },
    javascript: { language: 'javascript', name: 'index.js' },
    cpp: { language: 'cpp', name: 'main.cpp' },
  };

  const config = fileMap[language];
  if (!config) {
    throw new Error(`Unsupported language "${language}" for playground.`);
  }

  const response = await fetch(ONECOMPILER_URL, {
    method: 'POST',
    headers: getOneCompilerHeaders(),
    body: JSON.stringify({
      language: config.language,
      stdin,
      files: [
        {
          name: config.name,
          content: sourceCode,
        },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `OneCompiler request failed with ${response.status}`);
  }

  const result = await response.json();
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || result.error || '',
    compileOutput: result.exception || '',
    message: '',
    status: result.stderr || result.error || result.exception ? 'Error' : 'Accepted',
    executionTime: result.time || '',
    memory: result.memory || '',
  };
}

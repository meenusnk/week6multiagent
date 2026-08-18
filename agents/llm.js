function normalizeHistory(history = []) {
  return history
    .filter((entry) => entry && entry.role && entry.content)
    .map((entry) => ({
      role: entry.role === 'user' ? 'user' : 'assistant',
      content: String(entry.content)
    }));
}

function getActiveModelConfig(env = process.env) {
  // The classroom proxy is the required endpoint for this project.
  // We intentionally ignore stale OpenAI keys in the repo so the app does not
  // accidentally use the paid OpenAI credit path.
  return {
    provider: 'vibe-proxy',
    apiKey: 'sk-vibe-summer-2026',
    model: 'class-chat-model',
    baseUrl: 'https://vibe-proxy-gqv4.onrender.com/v1'
  };
}

async function callModel({
  message,
  history = [],
  systemPrompt,
  model,
  temperature = 0.7,
  env = process.env
}) {
  if (!message || !String(message).trim()) {
    throw new Error('A message is required.');
  }

  const config = getActiveModelConfig(env);
  const selectedModel = model || config.model;
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new Error('No API key is configured. Add RAPTOR_MINI_API_KEY, OPENAI_API_KEY, or use the classroom proxy settings.');
  }

  const baseUrl = config.baseUrl;

  // Build the message array in the OpenAI-compatible format.
  const messages = [
    { role: 'system', content: String(systemPrompt) },
    ...normalizeHistory(history),
    { role: 'user', content: String(message).trim() }
  ];

  // Standard fetch() POST request to the LLM proxy endpoint.
  // We send JSON with the model name and message list.
  // Request streaming for faster perceived response time
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature,
        stream: false,
        max_tokens: 500
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json();

  if (!response.ok) {
    console.error('LLM error:', data);
    throw new Error(data?.error?.message || 'The model request failed.');
  }

  // The proxy returns OpenAI-style content at:
  // data.choices[0].message.content
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('No response returned by the model.');
  }

  return reply;
}

module.exports = { callModel, getActiveModelConfig };

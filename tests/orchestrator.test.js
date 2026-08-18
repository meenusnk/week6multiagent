const test = require('node:test');
const assert = require('node:assert/strict');

const { chooseAgent, runOrchestratedAgent } = require('../agents/orchestrator');
const { getActiveModelConfig } = require('../agents/llm');

test('routes map requests to Navigator', () => {
  assert.equal(chooseAgent('Find the quickest route from Paris to Berlin'), 'Navigator');
});

test('routes treasure clues to Treasure Hunter', () => {
  assert.equal(chooseAgent('Search the island for hidden treasure clues'), 'Treasure Hunter');
});

test('routes final decisions to Captain', () => {
  assert.equal(chooseAgent('Captain, choose where the crew should go next'), 'Captain');
});

test('defaults to Captain when the intent is unclear', () => {
  assert.equal(chooseAgent('Hello there'), 'Captain');
});

test('uses the classroom proxy even if older OpenAI keys exist in the environment', () => {
  const config = getActiveModelConfig({
    RAPTOR_MINI_API_KEY: 'raptor-key',
    RAPTOR_MINI_MODEL: 'raptor-mini',
    RAPTOR_MINI_BASE_URL: 'https://raptor.example/v1',
    OPENAI_API_KEY: 'openai-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_BASE_URL: 'https://api.openai.com/v1'
  });

  assert.equal(config.provider, 'vibe-proxy');
  assert.equal(config.apiKey, 'sk-vibe-summer-2026');
  assert.equal(config.model, 'class-chat-model');
  assert.equal(config.baseUrl, 'https://vibe-proxy-gqv4.onrender.com/v1');
});

test('dispatches to the selected agent when the orchestrator already knows the route', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;

  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.OPENAI_BASE_URL = 'https://api.example.com/v1';

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: 'Follow the northern ridge to the cove.' } }]
    })
  });

  try {
    const reply = await runOrchestratedAgent({
      message: 'Plan the safest route to the cove.',
      history: [],
      agent: 'Navigator'
    });

    assert.equal(typeof reply, 'string');
    assert.ok(reply.length > 0);
    assert.match(reply, /north|cove|route/i);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }

    if (originalBaseUrl === undefined) {
      delete process.env.OPENAI_BASE_URL;
    } else {
      process.env.OPENAI_BASE_URL = originalBaseUrl;
    }
  }
});

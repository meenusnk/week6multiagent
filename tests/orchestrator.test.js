const test = require('node:test');
const assert = require('node:assert/strict');

const { determineAgents, parseAgentPlan, runOrchestratedAgent } = require('../agents/orchestrator');
const { getActiveModelConfig } = require('../agents/llm');

test('parses a valid ordered planner response', () => {
  assert.deepEqual(parseAgentPlan('["Navigator", "Treasure Hunter", "Captain"]'), [
    'Navigator',
    'Treasure Hunter',
    'Captain'
  ]);
});

test('uses the LLM planner to determine the agent workflow', async () => {
  const originalFetch = global.fetch;
  const responses = [
    '["Navigator", "Treasure Hunter", "Captain"]',
    'Captain'
  ];
  let requestCount = 0;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: responses[requestCount++] } }]
    })
  });

  try {
    const result = await determineAgents({
      message: 'Plan a route, investigate clues, and decide the final crew action.'
    });
    assert.deepEqual(result.agents, ['Navigator', 'Treasure Hunter', 'Captain']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('planner excludes offline agents and preserves an online fallback', async () => {
  const originalFetch = global.fetch;
  const responses = ['["Navigator"]', 'Navigator'];
  let requestCount = 0;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: responses[requestCount++] } }]
    })
  });

  try {
    const result = await determineAgents({
      message: 'Navigator, which way is north?',
      availableAgents: ['Navigator', 'Treasure Hunter']
    });
    assert.deepEqual(result.agents, ['Navigator']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('does not dispatch an explicitly requested offline agent', async () => {
  await assert.rejects(
    runOrchestratedAgent({
      message: 'Where is the treasure?',
      agent: 'Captain',
      availableAgents: ['Navigator', 'Treasure Hunter']
    }),
    /requested agent is offline/
  );
});

test('does not restore offline agents when every agent is disabled', async () => {
  await assert.rejects(
    determineAgents({
      message: 'Where is the treasure?',
      availableAgents: []
    }),
    /No agents are online/
  );
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
    const result = await runOrchestratedAgent({
      message: 'Plan the safest route to the cove.',
      history: [],
      agent: 'Navigator'
    });

    assert.deepEqual(result.agents, ['Navigator']);
    assert.equal(result.outputs.length, 1);
    assert.equal(typeof result.outputs[0].reply, 'string');
    assert.match(result.outputs[0].reply, /north|cove|route/i);
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

test('runs multiple selected agents sequentially and returns every output', async () => {
  const originalFetch = global.fetch;
  const responses = ['Route briefing', 'Clue briefing', 'Final command'];
  let requestCount = 0;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: responses[requestCount++] } }]
    })
  });

  try {
    const result = await runOrchestratedAgent({
      message: 'Plan the route and find clues before making the final decision.',
      history: [],
      agent: ['Navigator', 'Treasure Hunter', 'Captain']
    });

    assert.deepEqual(result.agents, ['Navigator', 'Treasure Hunter', 'Captain']);
    assert.deepEqual(result.outputs.map(output => output.agent), result.agents);
    assert.deepEqual(result.outputs.map(output => output.reply), responses);
    assert.equal(requestCount, 3);
  } finally {
    global.fetch = originalFetch;
  }
});

test('plans dynamically, then runs the planned agents in order', async () => {
  const originalFetch = global.fetch;
  const responses = [
    '["Navigator", "Captain"]',
    'Captain',
    'Route briefing',
    'Final command'
  ];
  let requestCount = 0;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: responses[requestCount++] } }]
    })
  });

  try {
    const result = await runOrchestratedAgent({
      message: 'Plan the safest route and make the final decision.',
      history: []
    });

    assert.deepEqual(result.agents, ['Navigator', 'Captain']);
    assert.deepEqual(result.outputs.map(output => output.reply), ['Route briefing', 'Final command']);
    assert.equal(requestCount, 4);
  } finally {
    global.fetch = originalFetch;
  }
});

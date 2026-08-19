const { runNavigator } = require('./navigator');
const { runTreasureHunter } = require('./treasureHunter');
const { runCaptain } = require('./captain');
const { callModel } = require('./llm');

const AVAILABLE_AGENTS = ['Navigator', 'Treasure Hunter', 'Captain'];

function parseAgentPlan(reply) {
  const cleaned = String(reply || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned);
  const agents = Array.isArray(parsed) ? parsed : parsed.agents;

  if (!Array.isArray(agents) || agents.length === 0) {
    throw new Error('The planner returned no agents.');
  }

  const validAgents = agents.filter((agent, index) => (
    typeof agent === 'string' &&
    AVAILABLE_AGENTS.includes(agent) &&
    agents.indexOf(agent) === index
  ));

  if (validAgents.length === 0 || validAgents.length !== agents.length) {
    throw new Error('The planner returned an invalid agent list.');
  }

  return validAgents;
}

async function determineAgents({ message, history = [], availableAgents = AVAILABLE_AGENTS }) {
  const onlineAgents = AVAILABLE_AGENTS.filter(agent => availableAgents.includes(agent));
  const plannerAgents = onlineAgents.length > 0 ? onlineAgents : AVAILABLE_AGENTS;
  const systemPrompt = `You are the orchestration planner for a multi-agent pirate assistant. Determine which specialist agents should answer the user's request and the exact order they should run.

Available agents:
- Navigator: routes, travel plans, maps, locations, hazards, and directions.
- Treasure Hunter: clues, puzzles, hidden objects, treasure discovery, and investigation.
- Captain: decisions, prioritization, final recommendations, and combining other specialists' work.

Only these agents are currently online and may be selected: ${plannerAgents.join(', ')}.
Choose the smallest useful ordered list from the online agents. If the user directly addresses a role, such as "Navigator, ..." or "can you tell me Navigator?", put that role first. Do not select offline agents. Include Captain after other specialists when the user asks for a final plan or decision and Captain is online. Return ONLY a JSON array containing one or more exact agent names from the online list. Never return explanations.`;

  try {
    const plannerReply = await callModel({
      message,
      history,
      systemPrompt,
      temperature: 0,
      model: 'class-chat-model',
      maxTokens: 80,
      timeoutMs: 10000
    });
    const agents = parseAgentPlan(plannerReply);
    const unavailable = agents.some(agent => !plannerAgents.includes(agent));
    if (unavailable) throw new Error('The planner selected an offline agent.');
    return { agents, trace: ['LLM planner selected the agent workflow.'] };
  } catch (error) {
    const fallback = plannerAgents.includes('Captain')
      ? ['Captain']
      : [plannerAgents[0]];
    console.error(`Agent planner failed; using ${fallback[0]} fallback:`, error.message);
    return { agents: fallback, trace: [`LLM planner failed; defaulted to ${fallback[0]}.`] };
  }
}

async function runOrchestratedAgent({ message, history = [], agent, availableAgents = AVAILABLE_AGENTS }) {
  const requestedAgents = Array.isArray(agent) ? agent : agent ? [agent] : null;
  const onlineAgents = AVAILABLE_AGENTS.filter(candidate => availableAgents.includes(candidate));
  const agentChoice = requestedAgents
    ? { agents: requestedAgents, trace: [] }
    : await determineAgents({ message, history, availableAgents: onlineAgents });
  const selectedAgents = agentChoice.agents;
  const trace = agentChoice.trace;
  const outputs = [];
  let priorOutputs = history;

  for (const selectedAgent of selectedAgents) {
    trace.push(`Running: ${selectedAgent}`);

    let reply;
    if (selectedAgent === 'Navigator') {
      reply = await runNavigator({ message, history: priorOutputs });
    } else if (selectedAgent === 'Treasure Hunter') {
      reply = await runTreasureHunter({ message, history: priorOutputs });
    } else if (selectedAgent === 'Captain') {
      reply = await runCaptain({ message, history: priorOutputs });
    } else {
      throw new Error(`Unknown agent: ${selectedAgent}`);
    }

    outputs.push({ agent: selectedAgent, reply });
    priorOutputs = [...priorOutputs, { role: 'assistant', content: reply }];
  }

  return {
    reply: outputs.at(-1)?.reply || '',
    agent: selectedAgents.at(-1),
    agents: selectedAgents,
    outputs,
    trace
  };
}

module.exports = { determineAgents, parseAgentPlan, runOrchestratedAgent };

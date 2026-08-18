const { runNavigator } = require('./navigator');
const { runTreasureHunter } = require('./treasureHunter');
const { runCaptain } = require('./captain');

function chooseAgent(message) {
  const text = String(message || '').toLowerCase();
  const trace = [];

  if (!text.trim()) {
    trace.push('No message provided, defaulting to Captain');
    return { agent: 'Captain', trace };
  }

  const greetingKeywords = ['hi', 'hello', 'hey', 'good morning', 'good evening', 'how are you', 'howdy', 'greetings'];
  const routeKeywords = ['route', 'map', 'directions', 'direction', 'navigate', 'travel', 'road', 'distance', 'location', 'waypoint', 'path'];
  const treasureKeywords = ['treasure', 'clue', 'clues', 'hidden', 'hunt', 'map clue', 'secret', 'artifact', 'search', 'island', 'buried'];
  const captainKeywords = ['captain', 'decide', 'choose', 'final', 'decision', 'where should we go', 'crew', 'lead'];

  trace.push(`Analyzing: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

  if (captainKeywords.some((keyword) => text.includes(keyword))) {
    trace.push(`✓ Captain keywords detected`);
    return { agent: 'Captain', trace };
  }

  if (routeKeywords.some((keyword) => text.includes(keyword))) {
    trace.push(`✓ Navigation keywords detected`);
    return { agent: 'Navigator', trace };
  }

  if (treasureKeywords.some((keyword) => text.includes(keyword))) {
    trace.push(`✓ Treasure keywords detected`);
    return { agent: 'Treasure Hunter', trace };
  }

  if (greetingKeywords.some((keyword) => text.includes(keyword))) {
    trace.push(`✓ Greeting detected`);
    return { agent: 'Captain', trace };
  }

  trace.push(`No keywords matched, defaulting to Captain`);
  return { agent: 'Captain', trace };
}

async function runOrchestratedAgent({ message, history = [], agent }) {
  const agentChoice = agent ? { agent, trace: [] } : chooseAgent(message);
  const selectedAgent = agentChoice.agent;
  const trace = agentChoice.trace;

  trace.push(`Selected: ${selectedAgent}`);

  let reply;
  if (selectedAgent === 'Navigator') {
    reply = await runNavigator({ message, history });
  } else if (selectedAgent === 'Treasure Hunter') {
    reply = await runTreasureHunter({ message, history });
  } else {
    reply = await runCaptain({ message, history });
  }

  return { reply, agent: selectedAgent, trace };
}

module.exports = { chooseAgent, runOrchestratedAgent };

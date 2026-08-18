const { runNavigator } = require('./navigator');
const { runTreasureHunter } = require('./treasureHunter');
const { runCaptain } = require('./captain');

function chooseAgent(message) {
  const text = String(message || '').toLowerCase();

  if (!text.trim()) {
    return 'Captain';
  }

  const greetingKeywords = ['hi', 'hello', 'hey', 'good morning', 'good evening', 'how are you', 'howdy', 'greetings'];
  const routeKeywords = ['route', 'map', 'directions', 'direction', 'navigate', 'travel', 'road', 'distance', 'location', 'waypoint', 'path'];
  const treasureKeywords = ['treasure', 'clue', 'clues', 'hidden', 'hunt', 'map clue', 'secret', 'artifact', 'search', 'island', 'buried'];
  const captainKeywords = ['captain', 'decide', 'choose', 'final', 'decision', 'where should we go', 'crew', 'lead'];

  if (captainKeywords.some((keyword) => text.includes(keyword))) {
    return 'Captain';
  }

  if (routeKeywords.some((keyword) => text.includes(keyword))) {
    return 'Navigator';
  }

  if (treasureKeywords.some((keyword) => text.includes(keyword))) {
    return 'Treasure Hunter';
  }

  if (greetingKeywords.some((keyword) => text.includes(keyword))) {
    return 'Captain';
  }

  return 'Captain';
}

async function runOrchestratedAgent({ message, history = [], agent }) {
  const selectedAgent = agent || chooseAgent(message);

  if (selectedAgent === 'Navigator') {
    return runNavigator({ message, history });
  }

  if (selectedAgent === 'Treasure Hunter') {
    return runTreasureHunter({ message, history });
  }

  return runCaptain({ message, history });
}

module.exports = { chooseAgent, runOrchestratedAgent };

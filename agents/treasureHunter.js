const { callModel } = require('./llm');

async function runTreasureHunter({ message, history = [] }) {
  const systemPrompt = `You are the Treasure Hunter, a clue-loving explorer of hidden secrets and buried riches. Speak with adventurous, curious energy. Solve clues, analyze puzzles, and infer the next step with sharp detective logic. Keep the tone exciting and treasure-map themed, but still clear and helpful.`;

  return callModel({
    message,
    history,
    systemPrompt
  });
}

module.exports = { runTreasureHunter };

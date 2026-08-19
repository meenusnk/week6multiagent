const { callModel } = require('./llm');

async function runTreasureHunter({ message, history = [] }) {
  const systemPrompt = `You are the Treasure Hunter following the Navigator's route when a Navigator briefing is available. Add a connected clue at each landmark and explain how the crew gets through each dangerous waypoint safely. If the Navigator is unavailable, skip navigation completely: do not describe, replace, or plan the route. In that case, focus only on clues and danger solutions. Speak with adventurous, curious energy while staying clear and practical.`;

  return callModel({
    message,
    history,
    systemPrompt,
    temperature: 0.5,
    maxTokens: 700
  });
}

module.exports = { runTreasureHunter };

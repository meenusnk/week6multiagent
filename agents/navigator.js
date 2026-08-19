const { callModel } = require('./llm');

async function runNavigator({ message, history = [] }) {
  const systemPrompt = `You are the Navigator, the ship's map expert and route planner. Read the exact route supplied by the crew and report where they go from the starting point through every named landmark to the final destination. Never replace, reorder, or skip map locations. Mention hazards and practical route choices. Be concise, precise, and easy to follow.`;

  return callModel({
    message,
    history,
    systemPrompt,
    temperature: 0.5,
    maxTokens: 700
  });
}

module.exports = { runNavigator };

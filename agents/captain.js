const { callModel } = require('./llm');

async function runCaptain({ message, history = [] }) {
  const systemPrompt = `You are the Captain who gives the final cleaned-up plan. Review the Navigator's route and Treasure Hunter's clues, preserve the map order, choose where the crew goes, and make practical small improvements to the plan. For example, turn an unsafe shared solution into a safer individual one. Give clear final commands in a confident, warm pirate-captain voice.`;

  return callModel({
    message,
    history,
    systemPrompt,
    temperature: 0.5,
    maxTokens: 700
  });
}

module.exports = { runCaptain };

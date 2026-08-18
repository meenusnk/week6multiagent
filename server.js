const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { chooseAgent, runOrchestratedAgent } = require('./agents/orchestrator');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: MODEL });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'A message is required.' });
  }

  try {
    const agent = chooseAgent(message);
    const reply = await runOrchestratedAgent({
      message,
      history,
      agent
    });

    res.json({
      agent,
      reply
    });
  } catch (error) {
    console.error('Agent request failed:', error);
    res.status(500).json({
      error: error.message || 'Unable to reach the LLM provider.'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Multi-agent chat app running at http://localhost:${PORT}`);
  console.log(`Using model: ${MODEL}`);
});

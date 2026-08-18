const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { runOrchestratedAgent } = require('./agents/orchestrator');

dotenv.config();

const app = express();
const START_PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function listenOnPort(port) {
  const server = app.listen(port, () => {
    console.log(`Multi-agent chat app running at http://localhost:${port}`);
    console.log(`Using model: ${MODEL}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy. Trying ${nextPort} instead.`);
      listenOnPort(nextPort);
      return;
    }

    throw error;
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: MODEL });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [], agent } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'A message is required.' });
  }

  try {
    const { reply, agent: selectedAgent, trace } = await runOrchestratedAgent({
      message,
      history,
      agent
    });

    res.json({
      agent: selectedAgent,
      reply,
      trace
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

listenOnPort(START_PORT);

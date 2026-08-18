const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');
const sendButton = document.getElementById('send-button');
const traceLog = document.getElementById('trace-log');

// The browser sends chat requests to the app server.
// The server decides which specialist agent responds and then uses the classroom proxy behind the scenes.
const API_URL = '/api/chat';

function addTrace(message, type = 'info') {
  const isEmpty = traceLog.querySelector('.trace-empty');
  if (isEmpty) isEmpty.remove();

  const traceEntry = document.createElement('div');
  traceEntry.className = `trace-entry ${type}`;
  traceEntry.textContent = message;
  traceLog.appendChild(traceEntry);
  
  // Keep trace log scrolled to bottom
  traceLog.scrollTop = traceLog.scrollHeight;
}

function addMessage(role, text) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;

  if (role === 'assistant') {
    const label = document.createElement('div');
    const body = document.createElement('div');

    const parts = String(text).split('\n');
    const firstLine = parts.shift() || '';
    const rest = parts.join('\n');

    label.className = 'agent-label';
    label.textContent = firstLine;

    body.className = 'agent-body';
    body.textContent = rest || '';

    messageEl.appendChild(label);
    if (rest) {
      messageEl.appendChild(body);
    }
  } else if (role === 'user') {
    messageEl.textContent = text;
  } else {
    messageEl.textContent = text;
  }

  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  input.disabled = isLoading;
  sendButton.textContent = isLoading ? '⏳ Thinking...' : 'Send';
}

// Simple response cache to reduce API calls
const responseCache = new Map();

function getCacheKey(message) {
  return message.trim().toLowerCase();
}

async function sendMessage(messageText) {
  const text = messageText.trim();
  if (!text) return;

  const cacheKey = getCacheKey(text);
  
  // Check cache first
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    addMessage('user', text);
    input.value = '';
    
    addTrace(cached.trace[0] || 'Cached response', 'agent');
    addMessage('assistant', `${cached.agentLabel}\n${cached.reply}`);
    return;
  }

  addMessage('user', text);
  input.value = '';
  setLoading(true);

  try {
    // Immediately show thinking state with agent label for faster perceived response
    const thinkingMessage = document.createElement('div');
    thinkingMessage.className = 'message assistant thinking';
    thinkingMessage.textContent = '🤔 Agent is thinking...';
    messagesContainer.appendChild(thinkingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        history: []
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Request failed.');
    }

    const reply = data?.reply?.trim();
    const agent = data?.agent || 'Captain';
    const trace = data?.trace || [];

    if (!reply) {
      throw new Error('No response returned by the model.');
    }

    const agentLabel = {
      Navigator: '🧭 Navigator',
      'Treasure Hunter': '🪎 Treasure Hunter',
      Captain: '🏴‍☠️ Captain'
    }[agent] || `🏴‍☠️ ${agent}`;

    // Cache the response
    responseCache.set(cacheKey, { reply, agentLabel, trace, agent });
    if (responseCache.size > 50) {
      // Remove oldest entry if cache gets too large
      const firstKey = responseCache.keys().next().value;
      responseCache.delete(firstKey);
    }

    // Display trace entries
    trace.forEach(entry => {
      addTrace(entry, 'agent');
    });

    // Remove the thinking indicator and show the actual response
    thinkingMessage.remove();
    
    // Show the agent name on the first line, then the message body below it.
    addMessage('assistant', `${agentLabel}\n${reply}`);
  } catch (error) {
    addMessage('system', `⚠️ ${error.message}`);
  } finally {
    setLoading(false);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await sendMessage(input.value);
});

// Handle checkbox toggle functionality
const checkboxes = Array.from(document.querySelectorAll('.agent-check'));
checkboxes.forEach(checkbox => {
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    checkbox.classList.toggle('checked');
    
    // Get the parent agent-card and toggle online/offline
    const agentCard = checkbox.closest('.agent-card');
    const statusElement = agentCard.querySelector('small');
    
    agentCard.classList.toggle('online');
    agentCard.classList.toggle('offline');
    
    // Update status text
    const isOnline = agentCard.classList.contains('online');
    statusElement.textContent = isOnline ? 'Online' : 'Offline';
  });
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

addMessage('assistant', '🏴‍☠️ Captain\nAhoy, matey! Ready to set sail with the crew.');

agentToggles.forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const isOn = toggle.getAttribute('aria-pressed') === 'true';
    const nextState = !isOn;

    toggle.setAttribute('aria-pressed', String(nextState));
    toggle.classList.toggle('is-off', !nextState);

    const card = toggle.closest('.agent-card');
    if (card) {
      card.classList.toggle('offline', !nextState);
      const statusText = card.querySelector('small');
      if (statusText) {
        statusText.textContent = nextState ? 'Online' : 'Offline';
      }
    }
  });
});

// Treasure maps data
const treasureMaps = {
  1: { name: 'The Lagoon of the Lost', locations: ['Sunken Temples', 'Dark Caves', 'Ghost Ships'] },
  2: { name: 'The Valley of Vampires', locations: ['Bloodstone Cliffs', 'Ancient Crypt', 'Forbidden Forest'] },
  3: { name: 'The School of Sirens', locations: ['Siren Rocks', 'Shipwreck Bay', 'Enchanted Reefs'] },
  4: { name: 'The Cursed Citadel', locations: ['Throne of Skulls', 'Lava Chambers', 'Mirrored Halls'] },
  5: { name: 'The Shadow Isles', locations: ['Black Sand Beach', 'Skull Peak', 'Phantom Lagoon'] }
};

// Handle treasure map clicks
const treasureMapItems = document.querySelectorAll('.treasure-map-item');
treasureMapItems.forEach(item => {
  item.addEventListener('click', async () => {
    const mapId = item.getAttribute('data-map');
    const mapData = treasureMaps[mapId];
    
    // Show map selection
    treasureMapItems.forEach(m => m.classList.remove('active'));
    item.classList.add('active');
    
    // Display treasure map info
    const mapMessage = `🗺️ ${mapData.name}\n\nLocations: ${mapData.locations.join(', ')}`;
    addMessage('system', mapMessage);
    
    // Generate collaborative story
    await generateTreasureHuntStory(mapId, mapData);
  });
});

async function generateTreasureHuntStory(mapId, mapData) {
  const prompt = `You are part of a pirate crew on an adventure. The crew is heading to: ${mapData.name}. They must navigate through: ${mapData.locations.join(', ')}. Create a brief, exciting story about how your crew finds the treasure together.`;
  
  addMessage('user', `🗺️ Searching for treasure at ${mapData.name}...`);
  setLoading(true);

  try {
    const thinkingMessage = document.createElement('div');
    thinkingMessage.className = 'message assistant thinking';
    thinkingMessage.textContent = '⚔️ The pirate crew springs into action...';
    messagesContainer.appendChild(thinkingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Make three parallel requests to all agents for a collaborative story
    const agents = ['Navigator', 'Treasure Hunter', 'Captain'];
    const stories = [];

    for (const agent of agents) {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          history: [],
          agent: agent
        })
      });

      const data = await response.json();
      if (response.ok && data.reply) {
        stories.push({
          agent: agent,
          reply: data.reply.trim()
        });
      }
    }

    thinkingMessage.remove();

    // Display the collaborative story
    if (stories.length > 0) {
      const collaborativeStory = stories
        .map(s => `${s.agent}:\n${s.reply}`)
        .join('\n\n---\n\n');
      
      addMessage('assistant', `⚔️ The Treasure Hunt\n\n${collaborativeStory}`);
      addTrace(`Generated collaborative story from 3 agents for ${mapData.name}`, 'agent');
    } else {
      addMessage('system', '⚠️ Unable to generate treasure hunt story.');
    }
  } catch (error) {
    addMessage('system', `⚠️ ${error.message}`);
  } finally {
    setLoading(false);
  }
}

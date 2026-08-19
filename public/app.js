const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');
const sendButton = document.getElementById('send-button');
const traceLog = document.getElementById('trace-log');

// The browser sends chat requests to the app server.
// The server decides which specialist agent responds and then uses the classroom proxy behind the scenes.
const API_URL = '/api/chat';
const IS_GITHUB_PAGES = window.location.hostname.endsWith('github.io');

function demoReply(message, agent = 'Captain') {
  const topic = String(message).toLowerCase();
  if (agent === 'Navigator' || /route|map|direction|travel|distance/.test(topic)) {
    return 'Follow the marked route from the starting point through each waypoint. Keep the crew together and avoid uncharted waters.';
  }
  if (agent === 'Treasure Hunter' || /treasure|clue|hidden|search|island/.test(topic)) {
    return 'Search each marked location carefully. Look for fresh footprints, unusual markings, and anything hidden near shelter or fresh water.';
  }
  return 'The crew is ready. Choose the marked route, keep the team together, and make camp before nightfall.';
}

async function requestChat(payload) {
  if (IS_GITHUB_PAGES) {
    const agent = payload.agent || 'Captain';
    return {
      ok: true,
      async json() {
        return {
          agent,
          reply: demoReply(payload.message, agent),
          outputs: [{ agent, reply: demoReply(payload.message, agent) }],
          trace: [`Demo mode: ${agent} responded locally.`]
        };
      }
    };
  }

  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

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

function getCacheKey(message, availableAgents) {
  return `${message.trim().toLowerCase()}::${availableAgents.join('|')}`;
}

async function sendMessage(messageText) {
  const text = messageText.trim();
  if (!text) return;

  const availableAgents = getOnlineAgents();
  const cacheKey = getCacheKey(text, availableAgents);
  
  // Check cache first
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    addMessage('user', text);
    input.value = '';
    
    addTrace(cached.trace[0] || 'Cached response', 'agent');
    cached.outputs.forEach(output => {
      addMessage('assistant', `${output.agentLabel}\n${output.reply}`);
    });
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

    const response = await requestChat({
      message: text,
      history: [],
      availableAgents
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Request failed.');
    }

    const outputs = Array.isArray(data?.outputs) && data.outputs.length
      ? data.outputs
      : [{ agent: data?.agent || 'Captain', reply: data?.reply || '' }];
    const reply = data?.reply?.trim() || outputs.at(-1)?.reply?.trim();
    const agent = data?.agent || outputs.at(-1)?.agent || 'Captain';
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
    responseCache.set(cacheKey, {
      reply,
      agentLabel,
      trace,
      agent,
      outputs: outputs.map(output => ({
        agentLabel: {
          Navigator: '🧭 Navigator',
          'Treasure Hunter': '🪎 Treasure Hunter',
          Captain: '🏴‍☠️ Captain'
        }[output.agent] || `🏴‍☠️ ${output.agent}`,
        reply: String(output.reply).trim()
      }))
    });
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
    
    // Show every sequential specialist output in the order it was produced.
    outputs.forEach(output => {
      const outputLabel = {
        Navigator: '🧭 Navigator',
        'Treasure Hunter': '🪎 Treasure Hunter',
        Captain: '🏴‍☠️ Captain'
      }[output.agent] || `🏴‍☠️ ${output.agent}`;
      addMessage('assistant', `${outputLabel}\n${String(output.reply).trim()}`);
    });
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

function getOnlineAgents() {
  return Array.from(document.querySelectorAll('.agent-card.online'))
    .map(card => card.dataset.agent)
    .filter(Boolean);
}

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

addMessage('assistant', '🏴‍☠️ Captain\nAhoy, matey! Ready to set sail with the crew.');

// Treasure maps data
const treasureMaps = {
  1: { name: 'The Lagoon of the Lost', locations: ['Sunken Temples', 'Dark Caves', 'Ghost Ships'], destination: 'The Lagoon of the Lost', icons: ['temple', 'cave', 'ship', 'lagoon'], scenery: ['cloud', 'mountain', 'palm', 'island', 'wave'], scene: 'lagoon' },
  2: { name: 'The Valley of Vampires', locations: ['Bloodstone Cliffs', 'Ancient Crypt', 'Forbidden Forest'], destination: 'The Valley of Vampires', icons: ['cliff', 'crypt', 'forest', 'peak'], scenery: ['mountain', 'cloud', 'island', 'palm', 'wave'], scene: 'valley' },
  3: { name: 'The School of Sirens', locations: ['Siren Rocks', 'Shipwreck Bay', 'Enchanted Reefs'], destination: 'The School of Sirens', icons: ['rock', 'wreck', 'reef', 'island'], scenery: ['wave', 'cloud', 'island', 'palm', 'mountain'], scene: 'sirens' },
  4: { name: 'The Cursed Citadel', locations: ['Throne of Skulls', 'Lava Chambers', 'Mirrored Halls'], destination: 'The Cursed Citadel', icons: ['throne', 'lava', 'mirror', 'citadel'], scenery: ['mountain', 'cloud', 'palm', 'island', 'wave'], scene: 'citadel' },
  5: { name: 'The Shadow Isles', locations: ['Black Sand Beach', 'Skull Peak', 'Phantom Lagoon'], destination: 'The Shadow Isles', icons: ['beach', 'peak', 'lagoon', 'island'], scenery: ['cloud', 'wave', 'island', 'palm', 'mountain'], scene: 'shadow' }
};

const mapLayouts = {
  lagoon: { points: [[13, 78], [37, 27], [62, 72], [87, 35]], path: 'M13 78 C17 48 29 8 37 27 S48 88 62 72 S78 13 87 35' },
  valley: { points: [[13, 30], [35, 77], [62, 27], [87, 69]], path: 'M13 30 C20 72 27 91 35 77 S49 5 62 27 S78 92 87 69' },
  sirens: { points: [[13, 70], [36, 28], [63, 76], [87, 37]], path: 'M13 70 C17 19 28 10 36 28 C45 52 53 95 63 76 S78 13 87 37' },
  citadel: { points: [[13, 77], [37, 28], [63, 73], [87, 31]], path: 'M13 77 C25 94 25 8 37 28 C49 48 52 91 63 73 S78 8 87 31' },
  shadow: { points: [[13, 31], [36, 75], [62, 25], [87, 70]], path: 'M13 31 C24 88 27 5 36 75 S50 95 62 25 S78 7 87 70' }
};

function addTreasureMap(mapData) {
  const layout = mapLayouts[mapData.scene];
  const message = document.createElement('div');
  message.className = `message map-message map-${mapData.scene}`;

  const title = document.createElement('div');
  title.className = 'map-heading';
  title.innerHTML = `<span class="map-compass">✦</span><div><strong>${mapData.name}</strong><small>charted route</small></div>`;

  const canvas = document.createElement('div');
  canvas.className = 'treasure-map';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${mapData.name}, route through ${mapData.locations.join(', ')}, ending at ${mapData.destination}`);

  mapData.scenery.forEach((type, index) => {
    const scenery = document.createElement('span');
    scenery.className = `map-scenery scenery-${type} scenery-position-${index + 1}`;
    scenery.setAttribute('aria-hidden', 'true');
    canvas.appendChild(scenery);
  });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('map-route');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', layout.path);
  svg.appendChild(path);
  canvas.appendChild(svg);

  const landmarks = [...mapData.locations, mapData.destination];
  landmarks.forEach((location, index) => {
    const landmark = document.createElement('div');
    const isDestination = index === landmarks.length - 1;
    landmark.className = `map-landmark${isDestination ? ' destination-landmark' : ''}`;
    landmark.style.left = `${layout.points[index][0]}%`;
    landmark.style.top = `${layout.points[index][1]}%`;
    landmark.innerHTML = isDestination
      ? `<span class="map-destination" aria-label="Final destination">X</span><strong>${location}</strong>`
      : `<span class="landmark-icon landmark-${mapData.icons[index]}" aria-hidden="true"></span><strong>${location}</strong>`;
    canvas.appendChild(landmark);
  });

  const routeLabel = document.createElement('div');
  routeLabel.className = 'map-footer';
  routeLabel.textContent = ['Starting point', ...landmarks].join('  →  ');
  message.append(title, canvas, routeLabel);
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle treasure map clicks
const treasureMapItems = document.querySelectorAll('.treasure-map-item');
treasureMapItems.forEach(item => {
  item.addEventListener('click', async () => {
    const mapId = item.getAttribute('data-map');
    const mapData = treasureMaps[mapId];
    
    // Show map selection
    treasureMapItems.forEach(m => m.classList.remove('active'));
    item.classList.add('active');
    
    addTreasureMap(mapData);
    
    // Generate collaborative story
    await generateTreasureHuntStory(mapId, mapData);
  });
});

async function generateTreasureHuntStory(mapId, mapData) {
  const route = `Starting point -> ${mapData.locations.join(' -> ')} -> ${mapData.name}`;
  
  setLoading(true);

  try {
    const thinkingMessage = document.createElement('div');
    thinkingMessage.className = 'message assistant thinking';
    thinkingMessage.textContent = '⚔️ The pirate crew springs into action...';
    messagesContainer.appendChild(thinkingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Offline agents are skipped entirely; remaining specialists still hand off their work.
    const agents = ['Navigator', 'Treasure Hunter', 'Captain']
      .filter(agent => getOnlineAgents().includes(agent));
    const stories = [];

    if (agents.length === 0) {
      thinkingMessage.remove();
      addMessage('system', '⚠️ All agents are offline. Bring at least one agent online to start the hunt.');
      return;
    }

    for (const agent of agents) {
      let message;
      if (agent === 'Navigator') {
        message = `Read this treasure map route: ${route}. Tell the crew exactly where they travel from the starting point, through each location in order, and finally to ${mapData.name}. Mention safe route choices and dangerous sections. Do not invent a different route.`;
      } else if (agent === 'Treasure Hunter') {
        const navigatorBriefing = stories.find(story => story.agent === 'Navigator')?.reply;
        message = navigatorBriefing
          ? `The Navigator gave this route: ${route}. Navigator's briefing: ${navigatorBriefing} As the crew travels, find one clue at each location and explain how to get safely through its danger. Keep the clues connected to the route.`
          : `The Navigator is offline, so skip the navigation job. Do not describe, replace, or plan the route. Focus only on finding one clue at each listed location and explaining how the crew can safely get through each danger point.`;
      } else {
        const navigatorBriefing = stories.find(story => story.agent === 'Navigator')?.reply || 'Navigator is offline; use the map route directly.';
        const hunterBriefing = stories.find(story => story.agent === 'Treasure Hunter')?.reply || 'Treasure Hunter is offline; make the safety and clue decisions yourself.';
        message = `You are the Captain making the final call. Map route: ${route}. Navigator: ${navigatorBriefing} Treasure Hunter: ${hunterBriefing} Clean this plan up, choose the final route and actions, and make small practical improvements when needed. Give clear commands to the crew.`;
      }

      const response = await requestChat({
        message,
        history: [],
        agent
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
      addTrace(`Generated story from ${stories.map(story => story.agent).join(', ')} for ${mapData.name}`, 'agent');
    } else {
      addMessage('system', '⚠️ Unable to generate treasure hunt story.');
    }
  } catch (error) {
    addMessage('system', `⚠️ ${error.message}`);
  } finally {
    setLoading(false);
  }
}

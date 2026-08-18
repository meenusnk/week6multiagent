const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');
const sendButton = document.getElementById('send-button');
const agentToggles = Array.from(document.querySelectorAll('.mini-toggle'));

// The browser sends chat requests to the app server.
// The server decides which specialist agent responds and then uses the classroom proxy behind the scenes.
const API_URL = '/api/chat';

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
    messageEl.textContent = `You: ${text}`;
  } else {
    messageEl.textContent = text;
  }

  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  input.disabled = isLoading;
  sendButton.textContent = isLoading ? 'Sending...' : 'Send';
}

async function sendMessage(messageText) {
  const text = messageText.trim();
  if (!text) return;

  addMessage('user', text);
  input.value = '';
  setLoading(true);

  try {
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

    if (!reply) {
      throw new Error('No response returned by the model.');
    }

    const agentLabel = {
      Navigator: '🧭 Navigator',
      'Treasure Hunter': '🪎 Treasure Hunter',
      Captain: '🏴‍☠️ Captain'
    }[agent] || `🏴‍☠️ ${agent}`;

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

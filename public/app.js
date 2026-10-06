const messagesEl = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const newChat = document.getElementById('newChat');
const helpButton = document.getElementById('helpButton');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const HISTORY_KEY = 'cosmoguide_history_v1';

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function renderMarkdownish(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function addMessage(role, text, extra = {}, save = true) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '👤' : '🚀';

  const content = document.createElement('div');
  content.className = 'bubble';
  content.innerHTML = renderMarkdownish(text);

  if (extra.media?.url) {
    const media = document.createElement('div');
    media.className = 'media-card';

    if (extra.media.type === 'image') {
      const img = document.createElement('img');

      img.src = extra.media.url;
      img.alt = extra.media.title || 'Space image';
      img.loading = 'lazy';

      img.onerror = () => {
        img.style.display = 'none';
      };

      media.appendChild(img);
    }

    const link = document.createElement('a');

    link.href = extra.media.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    link.textContent =
      extra.media.type === 'video'
        ? 'Open video ↗'
        : 'Open full image ↗';

    media.appendChild(link);
    content.appendChild(media);
  }

  if (extra.source) {
    const source = document.createElement('div');
    source.className = 'source';
    source.textContent = `Source: ${extra.source}`;
    content.appendChild(source);
  }

  if (role === 'user') {
    row.appendChild(content);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(content);
  }

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (save) {
    saveHistory();
  }
}

function addLoading() {
  const row = document.createElement('div');

  row.className = 'message-row bot';
  row.id = 'loadingRow';

  row.innerHTML = `
    <div class="avatar">🚀</div>
    <div class="bubble loading">
      <span class="dots">
        <i></i>
        <i></i>
        <i></i>
      </span>
      Thinking…
    </div>
  `;

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeLoading() {
  document.getElementById('loadingRow')?.remove();
}

function saveHistory() {
  const rows = [...messagesEl.querySelectorAll('.message-row')]
    .filter(row => row.id !== 'loadingRow')
    .map(row => ({
      role: row.classList.contains('user') ? 'user' : 'bot',
      text: row.querySelector('.bubble')?.innerText || ''
    }))
    .slice(-50);

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(rows)
  );
}

function loadHistory() {
  try {
    const rows = JSON.parse(
      localStorage.getItem(HISTORY_KEY) || '[]'
    );

    if (rows.length) {
      rows.forEach(row => {
        addMessage(
          row.role,
          row.text,
          {},
          false
        );
      });

      return;
    }
  } catch (error) {
    console.error('History loading failed:', error);
  }

  addMessage(
    'bot',
    `Welcome to **CosmoGuide AI** 🚀

I’m a Space & Astronomy Information Assistant.

You can type natural-language questions — buttons are only shortcuts.

Try asking:
“Tell me about Mars gravity”
or
“Where is the ISS right now?”`
  );
}

async function sendMessage(message) {
  const text = String(message || '').trim();

  if (!text || sendButton.disabled) {
    return;
  }

  addMessage('user', text);

  input.value = '';
  input.style.height = 'auto';

  sendButton.disabled = true;

  addLoading();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        message: text
      })
    });

    const data = await response.json();

    removeLoading();

    if (!response.ok) {
      throw new Error(
        data.error || 'Request failed'
      );
    }

    addMessage(
      'bot',
      data.text ||
        'I received the request but no response text was returned.',
      data
    );

  } catch (error) {
    removeLoading();

    addMessage(
      'bot',
      `⚠️ **Unable to complete that request.**

${error.message}`
    );

  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener('keydown', event => {
  if (
    event.key === 'Enter' &&
    !event.shiftKey
  ) {
    event.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';

  input.style.height =
    `${Math.min(input.scrollHeight, 120)}px`;
});

document
  .querySelectorAll('[data-message]')
  .forEach(button => {
    button.addEventListener('click', () => {
      sendMessage(button.dataset.message);
    });
  });

helpButton.addEventListener('click', () => {
  sendMessage('What can you do?');
});

newChat.addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);

  messagesEl.innerHTML = '';

  addMessage(
    'bot',
    `New chat started. 🚀

Ask a natural-language space question whenever you’re ready.`
  );
});

async function checkHealth() {
  try {
    const response = await fetch('/api/health');

    const data = await response.json();

    if (data.ok) {
      statusDot.className = 'status-dot ok';

      statusText.textContent =
        data.solarTokenConfigured
          ? 'APIs ready'
          : 'NASA / ISS ready';
    } else {
      throw new Error();
    }

  } catch (error) {
    statusDot.className = 'status-dot bad';

    statusText.textContent =
      'Backend unavailable';
  }
}

loadHistory();
checkHealth();
input.focus();
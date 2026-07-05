const STORAGE_KEY = 'lazadisChatSessions';
const chatBox = document.getElementById('chat-box');
const sessionList = document.getElementById('chat-session-list');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const fileInput = document.getElementById('chat-file');
const newChatButton = document.getElementById('new-chat-btn');
const closeChatButton = document.getElementById('close-chat');

const chatWidget = document.getElementById('chat-widget');
const chatToggleBtn = document.getElementById('chat-toggle-btn');

let sessions = [];
let activeSessionId = null;
let pendingFile = null;

function loadSessions() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return { sessions: [], activeSessionId: null };
        }

        const parsed = JSON.parse(stored);
        return {
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
            activeSessionId: parsed.activeSessionId || null,
        };
    } catch (error) {
        console.error('Gagal membaca sesi chat:', error);
        return { sessions: [], activeSessionId: null };
    }
}

function saveSessions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, activeSessionId }));
}

function createSession(title = 'Percakapan baru') {
    const session = {
        id: Date.now().toString(),
        title,
        messages: [],
    };

    sessions.unshift(session);
    activeSessionId = session.id;
    saveSessions();
    return session;
}

function getActiveSession() {
    return sessions.find((session) => session.id === activeSessionId) || null;
}

function updateSessionTitle(text) {
    const session = getActiveSession();
    if (!session || session.messages.length !== 1) {
        return;
    }

    session.title = text.length > 24 ? `${text.slice(0, 21)}...` : text;
    saveSessions();
    renderSessions();
}

function renderSessions() {
    if (!sessionList) {
        return;
    }

    sessionList.innerHTML = '';

    sessions.forEach((session) => {
        const button = document.createElement('button');
        button.className = `session-pill${session.id === activeSessionId ? ' active' : ''}`;
        button.type = 'button';
        button.textContent = session.title;
        button.addEventListener('click', () => {
            activeSessionId = session.id;
            saveSessions();
            renderSessions();
            renderMessages();
        });
        sessionList.appendChild(button);
    });
}

function renderMessages() {
    const session = getActiveSession();
    if (!chatBox || !session) {
        return;
    }

    chatBox.innerHTML = '';

    if (!session.messages.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'bot-msg';
        emptyState.textContent = 'Halo! Ada yang bisa kami bantu mengenai layanan Lazadis@Net?';
        chatBox.appendChild(emptyState);
        return;
    }

    session.messages.forEach((message) => {
        const wrapper = document.createElement('div');
        wrapper.className = `message-row ${message.role === 'user' ? 'user' : 'bot'}`;

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role === 'user' ? 'user' : 'bot'}`;
        bubble.textContent = message.text;
        wrapper.appendChild(bubble);
        chatBox.appendChild(wrapper);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

function addMessage(role, text) {
    let session = getActiveSession();
    if (!session) {
        session = createSession();
    }

    session.messages.push({ role, text });
    if (role === 'user' && session.messages.length === 1) {
        updateSessionTitle(text);
    }
    saveSessions();
    renderMessages();
}

function setBusy(isBusy) {
    userInput.disabled = isBusy;
    fileInput.disabled = isBusy;
    chatForm.querySelector('button[type="submit"]').disabled = isBusy;
    chatForm.querySelector('button[type="submit"]').innerHTML = isBusy
        ? '<i class="fas fa-spinner fa-spin"></i>'
        : '<i class="fas fa-paper-plane"></i>';
}

function attachFile() {
    pendingFile = fileInput.files?.[0] || null;
    if (pendingFile) {
        userInput.placeholder = `File: ${pendingFile.name}`;
    } else {
        userInput.placeholder = 'Ketik pesan...';
    }
}

function createNewChat() {
    createSession('Chat baru');
    renderSessions();
    renderMessages();
}

async function sendMessage(event) {
    event.preventDefault();

    const text = userInput.value.trim();
    if (!text && !pendingFile) {
        return;
    }

    addMessage('user', text || (pendingFile ? `Lampiran: ${pendingFile.name}` : ''));
    const messageText = text || (pendingFile ? `Lampiran: ${pendingFile.name}` : '');
    userInput.value = '';

    const history = getActiveSession().messages.map(({ role, text }) => ({ role, text }));
    setBusy(true);

    try {
        let response;
        if (pendingFile) {
            const formData = new FormData();
            formData.append('file', pendingFile);
            formData.append('prompt', messageText);
            formData.append('promptHistory', JSON.stringify(history));
            response = await fetch('/api/file', {
                method: 'POST',
                body: formData,
            });
        } else {
            response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: history }),
            });
        }

        const data = await response.json();
        if (!response.ok) {
            addMessage('model', data.error || 'Maaf, server tidak menanggapi dengan benar.');
        } else {
            addMessage('model', data.result || 'Maaf, saya belum bisa menjawab saat ini.');
        }
    } catch (error) {
        console.error(error);
        addMessage('model', 'Maaf, terjadi gangguan saat menghubungkan ke server.');
    } finally {
        setBusy(false);
        pendingFile = null;
        fileInput.value = '';
        userInput.placeholder = 'Ketik pesan...';
        renderMessages();
    }
}


function toggleChat(open) {
    if (!chatWidget || !chatToggleBtn) {
        return;
    }

    if (open) {
        chatWidget.classList.remove('collapsed');
        chatToggleBtn.classList.add('collapsed');
    } else {
        chatWidget.classList.add('collapsed');
        chatToggleBtn.classList.remove('collapsed');
    }
}

if (chatForm) {
    chatForm.addEventListener('submit', sendMessage);
}

if (fileInput) {
    fileInput.addEventListener('change', attachFile);
}

if (newChatButton) {
    newChatButton.addEventListener('click', createNewChat);
}

if (chatToggleBtn) {
    chatToggleBtn.addEventListener('click', () => toggleChat(true));
}

if (closeChatButton) {
    closeChatButton.addEventListener('click', () => toggleChat(false));
}

function initializeChat() {
    const data = loadSessions();
    sessions = data.sessions;
    activeSessionId = data.activeSessionId;

    if (!sessions.length) {
        createSession('Chat baru');
    } else if (!sessions.find((session) => session.id === activeSessionId)) {
        activeSessionId = sessions[0].id;
        saveSessions();
    }

    if (chatWidget.classList.contains('collapsed')) {
        chatToggleBtn.classList.remove('collapsed');
    } else {
        chatToggleBtn.classList.add('collapsed');
    }

    renderSessions();
    renderMessages();
}

initializeChat();
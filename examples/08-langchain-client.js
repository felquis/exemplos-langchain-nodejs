const chatEl = document.getElementById("chat");
const startStopBtn = document.getElementById("startStopBtn");
const voiceSelect = document.getElementById("voiceSelect");
const statusText = document.getElementById("statusText");
const autoSpeakCheckbox = document.getElementById("autoSpeak");
const personaInput = document.getElementById("personaInput");
const savePersonaBtn = document.getElementById("savePersonaBtn");
const resetPersonaBtn = document.getElementById("resetPersonaBtn");
const dynamicControls = document.getElementById("dynamicControls");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSynthesis = window.speechSynthesis;

let recognition = null;
let isListening = false;
let voices = [];
let chatId = Math.random().toString(36).slice(2);

function appendMessage(role, text, isError = false) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;
  wrapper.innerHTML = `
    <div class="avatar">${role === "user" ? "U" : "A"}</div>
    <div class="content${isError ? " error" : ""}">${escapeHtml(text)}</div>
  `;
  if (chatEl.firstChild) {
    chatEl.insertBefore(wrapper, chatEl.firstChild);
  } else {
    chatEl.appendChild(wrapper);
  }
  chatEl.scrollTop = 0;
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function populateVoices() {
  voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";
  const preferred = ["Samantha", "Google US English", "Google português do Brasil", "Microsoft Maria Online (Natural) - Portuguese (Brazil)"];
  const sorted = [...voices].sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  for (const v of sorted) {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name} — ${v.lang}`;
    if (preferred.some(p => v.name.includes(p))) opt.selected = true;
    voiceSelect.appendChild(opt);
  }
}

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = populateVoices;
}
populateVoices();

function speakText(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  const selected = voices.find(v => v.name === voiceSelect.value);
  if (selected) {
    utterance.voice = selected;
  }
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

async function callAgent({ message = "", action, fileName } = {}) {
  const res = await fetch("/api/langchain-demo-08", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, persona: loadPersona(), chatId, action, fileName }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

function renderUIRequest(ui) {
  dynamicControls.innerHTML = "";
  if (!ui) return;
  if (ui.type === "file-upload") {
    const label = document.createElement("label");
    label.textContent = ui.label || "Upload a file";
    label.style.marginRight = "8px";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ui.accept || "*/*";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      appendMessage("user", `(uploaded) ${file.name}`);
      statusText.textContent = "Uploading...";
      try {
        const { output, ui: nextUi, chatId: serverChatId } = await callAgent({ action: "file_uploaded", fileName: file.name });
        if (serverChatId) chatId = serverChatId;
        appendMessage("assistant", output || "");
        if (autoSpeakCheckbox.checked && output) speakText(output);
        renderUIRequest(nextUi);
        statusText.textContent = "Listening...";
      } catch (e) {
        appendMessage("assistant", `Error: ${e.message}`, true);
        statusText.textContent = "Error";
      }
    });

    dynamicControls.appendChild(label);
    dynamicControls.appendChild(input);
  }
}

function startRecognition() {
  if (!SpeechRecognition) {
    appendMessage("assistant", "SpeechRecognition is not supported in this browser.", true);
    return;
  }
  if (isListening) return;
  recognition = new SpeechRecognition();
  recognition.lang = voices.find(v => v.name === voiceSelect.value)?.lang || navigator.language || "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalTranscript = "";

  recognition.onstart = () => {
    isListening = true;
    startStopBtn.textContent = "Stop Listening";
    startStopBtn.classList.add("stop");
    statusText.textContent = `Listening (${recognition.lang})...`;
  };

  recognition.onresult = async (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) {
        finalTranscript += text + " ";
      } else {
        interim += text;
      }
    }
    statusText.textContent = interim ? `Heard: ${interim}` : `Listening (${recognition.lang})...`;

    if (finalTranscript.trim()) {
      const userText = finalTranscript.trim();
      finalTranscript = "";
      appendMessage("user", userText);
      statusText.textContent = "Thinking...";
      try {
        const { output, ui, chatId: serverChatId } = await callAgent({ message: userText });
        if (serverChatId) chatId = serverChatId;
        appendMessage("assistant", output || "");
        if (autoSpeakCheckbox.checked && output) speakText(output);
        renderUIRequest(ui);
        statusText.textContent = "Listening...";
      } catch (e) {
        appendMessage("assistant", `Error: ${e.message}`, true);
        statusText.textContent = "Error";
      }
    }
  };

  recognition.onerror = (event) => {
    appendMessage("assistant", `Recognition error: ${event.error}`, true);
    statusText.textContent = `Error: ${event.error}`;
  };

  recognition.onend = () => {
    isListening = false;
    startStopBtn.textContent = "Start Listening";
    startStopBtn.classList.remove("stop");
    statusText.textContent = "Idle";
  };

  recognition.start();
}

function stopRecognition() {
  if (recognition && isListening) {
    recognition.stop();
  }
}

startStopBtn.addEventListener("click", () => {
  if (isListening) stopRecognition(); else startRecognition();
});

// Fallback: click once to unlock audio on mobile/iOS
window.addEventListener("click", () => {
  if (speechSynthesis.paused) speechSynthesis.resume();
});

// Persona persistence
function loadPersona() {
  const p = localStorage.getItem("voice_demo_persona");
  return p && p.trim() ? p : defaultPersona();
}

function defaultPersona() {
  return "You are a concise assistant. Always answer in 1-2 short sentences. Stay in character if one is provided. Refuse overly complex or unsafe topics; briefly explain and suggest a simpler, safer angle.";
}

function savePersona(text) {
  localStorage.setItem("voice_demo_persona", text || "");
}

function hydratePersonaUI() {
  personaInput.value = loadPersona();
}

savePersonaBtn.addEventListener("click", () => {
  savePersona(personaInput.value);
  statusText.textContent = "Persona saved.";
  setTimeout(() => (statusText.textContent = isListening ? "Listening..." : "Idle"), 1200);
});

resetPersonaBtn.addEventListener("click", () => {
  const d = defaultPersona();
  personaInput.value = d;
  savePersona(d);
  statusText.textContent = "Persona reset.";
  setTimeout(() => (statusText.textContent = isListening ? "Listening..." : "Idle"), 1200);
});

hydratePersonaUI();



import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = new OpenAI();

app.use(express.json());

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Voice Chat (STT ↔️ LLM ↔️ TTS)</title>
    <style>
      :root {
        --bg: #0b0f17;
        --card: #101726;
        --muted: #7b8a9a;
        --text: #ebf1f5;
        --user: #1f6feb;
        --assistant: #2ea043;
        --danger: #f85149;
      }
      html, body { height: 100%; }
      body {
        margin: 0;
        background: radial-gradient(1200px 600px at 80% -10%, #1b2a4a 0%, #0b0f17 60%), var(--bg);
        color: var(--text);
        font: 14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        display: grid;
        grid-template-rows: auto 1fr;
      }
      header {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        backdrop-filter: blur(6px);
        position: sticky; top: 0;
        background: rgba(11,15,23,0.6);
      }
      header h1 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.2px; }
      header .sub { color: var(--muted); font-size: 12px; }
      .container {
        max-width: 960px;
        margin: 0 auto;
        padding: 20px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }
      .controls {
        display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px; padding: 12px;
      }
      .controls button {
        appearance: none; border: 0; border-radius: 10px; padding: 10px 14px; font-weight: 600; color: #fff; cursor: pointer;
        background: linear-gradient(180deg, #2b72ff, #1f5ae6);
      }
      .controls button.stop { background: linear-gradient(180deg, #ff4d4f, #e03335); }
      .controls select, .controls input[type="checkbox"] { padding: 8px 10px; border-radius: 8px; background: #0c1424; color: #fff; border: 1px solid rgba(255,255,255,0.12); }
      .controls .status { color: var(--muted); }
      .chat {
        height: calc(100vh - 180px);
        overflow: auto;
        background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px; padding: 12px;
      }
      .msg { display: grid; grid-template-columns: 40px 1fr; gap: 10px; padding: 10px 8px; }
      .msg + .msg { border-top: 1px dashed rgba(255,255,255,0.06); }
      .avatar { height: 32px; width: 32px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 14px; }
      .user .avatar { background: var(--user); }
      .assistant .avatar { background: var(--assistant); }
      .content { white-space: pre-wrap; color: #dfe7ee; }
      .error { color: var(--danger); }
      footer { padding: 10px 20px; color: var(--muted); font-size: 12px; text-align: center; }
      a { color: #7aa2ff; text-decoration: none; }
    </style>
  </head>
  <body>
    <header>
      <div class="container">
        <h1>Voice Chat Demo <span class="sub">STT → LLM → TTS</span></h1>
      </div>
    </header>
    <main class="container">
      <section class="controls">
        <button id="startStopBtn" type="button">Start Listening</button>
        <label>
          Voice
          <select id="voiceSelect"></select>
        </label>
        <label>
          <input id="autoSpeak" type="checkbox" checked /> Auto speak replies
        </label>
        <span class="status" id="statusText">Idle</span>
      </section>
      <section class="controls" style="align-items: flex-start;">
        <div style="display:flex;gap:8px;flex:1;align-items:flex-start;">
          <textarea id="personaInput" rows="3" style="flex:1;min-width:240px;resize:vertical;" placeholder="Describe the character. Example: You are Luna, a friendly kids' storyteller. Speak in simple, cheerful sentences. Avoid complex topics; if asked, politely refuse and suggest a kid-friendly alternative."></textarea>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button id="savePersonaBtn" type="button">Save Persona</button>
            <button id="resetPersonaBtn" type="button">Reset</button>
          </div>
        </div>
        <small class="status">The persona is sent with every request. The assistant will answer briefly, stay in character, and refuse complex topics.</small>
      </section>
      <section class="chat" id="chat"></section>
    </main>
    <footer>Speech Recognition and Synthesis use the browser APIs. OpenAI handled server-side. | <a href="https://platform.openai.com/docs" target="_blank" rel="noreferrer noopener">Docs</a></footer>
    <script type="module" src="/client.js"></script>
  </body>
  </html>`);
});

// Serve the single-file frontend JS
app.get("/client.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "06-voice-chat-client.js"));
});

// Chat endpoint: accepts { message, persona } and returns { output }
app.post("/api/chat", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const personaRaw = typeof req.body?.persona === "string" ? req.body.persona.trim() : "";
    if (!message) {
      return res.status(400).json({ error: "message (string) is required" });
    }

    const systemGuard =
      "You are a concise assistant. Keep answers to 1-2 short sentences. Refuse complex, unsafe, or overly technical topics with a brief, friendly explanation and suggest a simpler alternative. Always remain in the provided character and style if one is supplied.";

    const preface = personaRaw ? `Character: ${personaRaw}` : "";

    const response = await client.responses.create({
      model: "gpt-4-turbo",
      input: [
        { role: "system", content: systemGuard },
        preface ? { role: "system", content: preface } : null,
        { role: "user", content: message },
      ].filter(Boolean),
      max_output_tokens: 120,
    });

    const output = response?.output_text ?? "";
    return res.json({ output });
  } catch (error) {
    console.error("/api/chat error", error);
    return res.status(500).json({ error: "internal_error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Voice chat server running on http://localhost:${port}`);
});



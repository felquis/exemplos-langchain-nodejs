import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { allTimeTravelTools } from "../src/tools/time-travel-tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = new OpenAI();
// Simple in-memory chat history store for demo 07 (per-chat memory)
const chatHistories = new Map(); // key: chatId -> Array<HumanMessage|AIMessage>

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


// ========== LangChain Demo 07 (identical UI, separate endpoint) ==========
app.get("/langchain-demo-07", (_req, res) => {
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
    <script type="module" src="/langchain-demo-07/client.js"></script>
  </body>
  </html>`);
});

app.get("/langchain-demo-07/client.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "07-langchain-client.js"));
});

// LangChain Agent endpoint: accepts { message, persona } and returns { output }
app.post("/api/langchain-demo-07", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const personaRaw = typeof req.body?.persona === "string" ? req.body.persona.trim() : "";
    const chatId = typeof req.body?.chatId === "string" ? req.body.chatId.trim() : "";
    if (!message) {
      return res.status(400).json({ error: "message (string) is required" });
    }

    const systemGuard =
      "You are a concise assistant. Keep answers to 1-2 short sentences. Refuse complex, unsafe, or overly technical topics with a brief, friendly explanation and suggest a simpler alternative. Always remain in the provided character and style if one is supplied.";
    const preface = personaRaw ? `Character: ${personaRaw}` : "";

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo",
      temperature: 0.3,
    });

    const baseMessages = [["system", systemGuard]];
    if (preface) baseMessages.push(["system", preface]);
    baseMessages.push(new MessagesPlaceholder("chat_history"));
    baseMessages.push(["human", "{input}"]); 
    baseMessages.push(new MessagesPlaceholder("agent_scratchpad"));
    const prompt = ChatPromptTemplate.fromMessages(baseMessages);

    const tools = allTimeTravelTools;
    const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
    const executor = new AgentExecutor({ agent, tools, verbose: false });

    // Resolve chat history for this chat session
    const key = chatId || `chat_${Math.random().toString(36).slice(2)}`;
    const chat_history = chatHistories.get(key) || [];

    const result = await executor.invoke({ input: message, chat_history });
    const output = result?.output ?? "";

    // Append latest exchange
    chat_history.push(new HumanMessage(message));
    chat_history.push(new AIMessage(output));
    chatHistories.set(key, chat_history);

    return res.json({ output, chatId: key });
  } catch (error) {
    console.error("/api/langchain-demo-07 error", error);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ========== LangChain Demo 08 (dynamic UI requests) ==========
app.get("/langchain-demo-08", (_req, res) => {
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
        height: calc(100vh - 220px);
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
      <section class="controls" id="dynamicControls" style="display:block; align-items:flex-start;"></section>
      <section class="chat" id="chat"></section>
    </main>
    <footer>Speech Recognition and Synthesis use the browser APIs. OpenAI handled server-side. | <a href="https://platform.openai.com/docs" target="_blank" rel="noreferrer noopener">Docs</a></footer>
    <script type="module" src="/langchain-demo-08/client.js"></script>
  </body>
  </html>`);
});

app.get("/langchain-demo-08/client.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "08-langchain-client.js"));
});

// LangChain Agent endpoint with structured UI suggestions
app.post("/api/langchain-demo-08", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const personaRaw = typeof req.body?.persona === "string" ? req.body.persona.trim() : "";
    const chatId = typeof req.body?.chatId === "string" ? req.body.chatId.trim() : "";
    const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
    if (!message && action !== "file_uploaded") {
      return res.status(400).json({ error: "message (string) is required" });
    }

    const systemGuard = (
      "You are a concise assistant. Keep answers to 1-2 short sentences. Refuse complex, unsafe, or overly technical topics with a brief, friendly explanation and suggest a simpler alternative. Always remain in the provided character and style if one is supplied.\n" +
      "When you need the user to upload a document, respond ONLY with strict minified JSON of the form: {{\"say\":\"<assistant text>\",\"ui\":{{\"type\":\"file-upload\",\"label\":\"<label>\",\"accept\":\"*/*\"}}}}.\n" +
      "In all other cases, respond ONLY with strict minified JSON: {{\"say\":\"<assistant text>\"}}. Do not include any extra keys or explanations."
    );
    const preface = personaRaw ? `Character: ${personaRaw}` : "";

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo",
      temperature: 0.3,
    });

    const baseMessages = [["system", systemGuard]];
    if (preface) baseMessages.push(["system", preface]);
    baseMessages.push(new MessagesPlaceholder("chat_history"));
    if (action === "file_uploaded") {
      baseMessages.push(["human", `I have uploaded a document named: ${fileName || "unknown"}. Continue.`]);
    } else {
      baseMessages.push(["human", "{input}"]);
    }
    baseMessages.push(new MessagesPlaceholder("agent_scratchpad"));
    const prompt = ChatPromptTemplate.fromMessages(baseMessages);

    const tools = allTimeTravelTools;
    const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
    const executor = new AgentExecutor({ agent, tools, verbose: false });

    const key = chatId || `chat_${Math.random().toString(36).slice(2)}`;
    const chat_history = (globalThis.__demo08_hist ||= new Map()).get(key) || [];

    const result = await executor.invoke({ input: message || "", chat_history });
    const raw = result?.output ?? "";

    let say = raw;
    let ui = null;
    try {
      const parsed = JSON.parse(raw);
      say = typeof parsed?.say === "string" ? parsed.say : raw;
      ui = parsed?.ui ?? null;
    } catch {}

    chat_history.push(new HumanMessage(action === "file_uploaded" ? `(file uploaded) ${fileName}` : message));
    chat_history.push(new AIMessage(say));
    // store back the chat history
    globalThis.__demo08_hist.set(key, chat_history);

    return res.json({ output: say, ui, chatId: key });
  } catch (error) {
    console.error("/api/langchain-demo-08 error", error);
    return res.status(500).json({ error: "internal_error" });
  }
});

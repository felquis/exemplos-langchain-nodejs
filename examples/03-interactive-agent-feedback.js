import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { allTimeTravelTools } from "../src/tools/time-travel-tools.js";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Helper para feedback de status no terminal
const status = {
  spinner: ['|', '/', '-', '\\'],
  interval: null,
  index: 0,
  start: function(message) {
    this.index = 0;
    process.stdout.write('\r' + message + ' ' + this.spinner[this.index]);
    this.interval = setInterval(() => {
      this.index = (this.index + 1) % this.spinner.length;
      process.stdout.write('\r' + message + ' ' + this.spinner[this.index]);
    }, 100);
  },
  stop: function() {
    clearInterval(this.interval);
    process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Limpa a linha
  },
  update: function(message) {
    clearInterval(this.interval);
    process.stdout.write('\r' + message + ' '.repeat(20) + '\r'); // Limpa e atualiza
  }
};

async function main() {
  let executor; // Declarado aqui para ser acessível no escopo da ferramenta

  const agentCallbacks = [
    {
      handleAgentAction(action) {
        status.update(`↪ Usando a ferramenta: ${action.tool}...`);
      },
      handleToolEnd(output, runId, parentRunId, tags) {
        status.update(`✔ Ferramenta ${tags.tool} finalizada.`);
      },
      handleLLMStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata) {
        status.update(`🧠 Consultando a consciência galáctica...`);
      },
    }
  ];

  // Ferramenta customizada para controlar o modo verbose
  const toggleVerboseTool = new DynamicStructuredTool({
    name: "alternar_logs_detalhados",
    description: "Ativa ou desativa os logs detalhados (verbose) do sistema.",
    schema: z.object({
        ativar: z.boolean().describe("Defina como 'true' para ativar os logs, 'false' para desativar."),
    }),
    func: async ({ ativar }) => {
      if (executor) {
        executor.verbose = ativar;
        return `Logs detalhados foram ${ativar ? 'ativados' : 'desativados'}. A mudança terá efeito a partir da sua próxima mensagem.`;
      }
      return "Erro ao tentar alterar os logs.";
    },
  });

  const tools = [...allTimeTravelTools, toggleVerboseTool];

  // O prompt do sistema agora informa sobre a nova ferramenta
  const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `Você é um guia de viagens no tempo galáctico. Seu objetivo é ajudar os usuários a explorar eventos marcantes do passado e do futuro da humanidade no espaço.
    
    - Sempre responda em português do Brasil.
    - Use as ferramentas disponíveis para encontrar eventos com base nos critérios do usuário.
    - Você também pode ativar ou desativar os logs detalhados do sistema se o usuário pedir (ex: "ative os logs" ou "desative o modo verbose").
    - Aja como um verdadeiro guia turístico do tempo: seja entusiasmado e informativo!
    
    Data atual (no seu ponto de origem): ${new Date().toISOString().split('T')[0]}`],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-3.5-turbo",
    temperature: 0.7,
    maxTokens: 2048,
  });

  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt: promptTemplate,
  });

  executor = new AgentExecutor({ // Atribui a instância ao executor declarado acima
    agent,
    tools,
    verbose: false, // Começamos com logs desativados por padrão
    handleParsingErrors: true,
    callbacks: agentCallbacks,
  });

  const rl = readline.createInterface({ input, output });
  const chat_history = [];

  console.log(`
Guia de Viagens no Tempo Galáctico iniciado!

  - Digite 'sair' para encerrar a sessão.
  - Você pode ativar ou desativar os logs detalhados do agente (ex: 'ative os logs' ou 'desative o modo verbose').
`);

  while (true) {
    const userInput = await rl.question("\nVocê: ");

    if (userInput.toLowerCase() === 'sair') {
      console.log("Encerrando o guia de viagens no tempo. Até a próxima aventura!");
      rl.close();
      break;
    }

    status.start("O Guia está pensando...");

    try {
      const result = await executor.invoke({ 
        input: userInput,
        chat_history: chat_history,
      });
      status.stop();
      console.log(`\nGuia: ${result.output}`);
      chat_history.push(new HumanMessage(userInput));
      chat_history.push(new AIMessage(result.output));
    } catch (error) {
      status.stop();
      console.error("\nOcorreu um erro durante a execução:", error);
    }
  }
}

main().catch(console.error);


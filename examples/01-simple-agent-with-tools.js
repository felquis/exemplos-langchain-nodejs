import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { allTimeTravelTools } from "../src/tools/time-travel-tools.js";

async function main() {
  const tools = allTimeTravelTools;

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `Você é um guia de viagens no tempo galáctico. Seu objetivo é ajudar os usuários a explorar eventos marcantes do passado e do futuro da humanidade no espaço.
    
    - Sempre responda em português do Brasil.
    - Use as ferramentas disponíveis para encontrar eventos com base nos critérios do usuário, como local (planeta, lua), tópico ou data.
    - Ao listar eventos, apresente-os de forma clara.
    - Se um usuário pedir detalhes sobre um evento específico, use a ferramenta get_event_details para fornecer uma descrição completa.
    - Aja como um verdadeiro guia turístico do tempo: seja entusiasmado e informativo!
    
    Data atual (no seu ponto de origem): ${new Date().toISOString().split('T')[0]}`],
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

  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    maxIterations: 5,
    handleParsingErrors: true,
  });

  // const prompt = "Quais eventos futuros estão planejados para Marte?";
  // const prompt = "Só quero ver os eventos do passado";
  const prompt = "Só quero ver os eventos do passado";

  const result = await executor.invoke({ input: prompt, chat_history: [] });

  console.log("Prompt:", result.input);
  console.log("Final LLM answer:", result.output);
}

main().catch(console.error);


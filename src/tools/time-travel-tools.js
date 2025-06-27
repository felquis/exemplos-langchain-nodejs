import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Mock database of galactic and historical events (Time-Travel Log)
export const events = [
  // Past Events
  { id: 1, name: "Lançamento do Sputnik 1", date: "1957-10-04T19:28:00Z", location: "Baikonur, Terra", topic: "Início da Era Espacial", description: "O primeiro satélite artificial da humanidade é lançado, marcando o início da corrida espacial." },
  { id: 2, name: "Primeiro Homem na Lua", date: "1969-07-20T20:17:00Z", location: "Mar da Tranquilidade, Lua", topic: "Conquista Lunar", description: "A Apollo 11 pousa e Neil Armstrong se torna o primeiro humano a caminhar na superfície lunar." },
  { id: 3, name: "Lançamento do Telescópio Hubble", date: "1990-04-24T12:33:00Z", location: "Órbita Terrestre", topic: "Astronomia", description: "O Telescópio Espacial Hubble é implantado, revolucionando nossa visão do cosmos." },
  { id: 4, name: "Pouso do Rover Curiosity em Marte", date: "2012-08-06T05:17:00Z", location: "Cratera Gale, Marte", topic: "Exploração de Marte", description: "O rover Curiosity pousa com sucesso em Marte para procurar por evidências de vida passada." },
  
  // Future Events
  { id: 5, name: "Inauguração da Primeira Colônia em Marte", date: "2077-03-15T12:00:00Z", location: "Nova Olympus, Marte", topic: "Colonização Planetária", description: "A primeira cidade autossuficiente em Marte, Nova Olympus, é oficialmente inaugurada." },
  { id: 6, name: "Conferência de Mineração de Asteroides", date: "2142-06-10T09:00:00Z", location: "Estação Ceres, Cinturão de Asteroides", topic: "Economia Espacial", description: "Corporações de todo o sistema solar se reúnem para discutir a logística da mineração de asteroides." },
  { id: 7, name: "Descoberta de Vida Microbiana em Europa", date: "2205-11-01T15:30:00Z", location: "Oceano Galileo, Europa (Lua de Júpiter)", topic: "Astrobiologia", description: "Sondas robóticas confirmam a existência de vida microbiana nos oceanos sob a crosta de gelo de Europa." },
  { id: 8, name: "Grande Prêmio de Corridas Solares", date: "2310-09-25T14:00:00Z", location: "Anéis de Saturno", topic: "Esportes Espaciais", description: "A corrida anual de naves movidas a vento solar através dos majestosos anéis de Saturno." }
];

/**
 * Tool to list historical and future events from the time-travel log.
 */
export const listEventsTool = new DynamicStructuredTool({
  name: "list_galactic_events",
  description: "Lista eventos históricos e futuros do registro de tempo. Pode ser filtrado por local, tópico e/ou um intervalo de datas.",
  schema: z.object({
    location: z.string().optional().describe("O local (planeta, lua, etc.) para filtrar os eventos (e.g., 'Marte', 'Terra')"),
    topic: z.string().optional().describe("O tópico para filtrar os eventos (e.g., 'Colonização Planetária', 'Astronomia')"),
    startDate: z.string().optional().describe("A data de início para o filtro (formato ISO: YYYY-MM-DD)"),
    endDate: z.string().optional().describe("A data de término para o filtro (formato ISO: YYYY-MM-DD)"),
  }),
  func: async ({ location, topic, startDate, endDate }) => {
    let filteredEvents = events;

    if (location) {
      filteredEvents = filteredEvents.filter(e => e.location.toLowerCase().includes(location.toLowerCase()));
    }
    if (topic) {
      filteredEvents = filteredEvents.filter(e => e.topic.toLowerCase().includes(topic.toLowerCase()));
    }
    if (startDate) {
        filteredEvents = filteredEvents.filter(s => new Date(s.date) >= new Date(startDate));
    }
    if (endDate) {
        filteredEvents = filteredEvents.filter(s => new Date(s.date) <= new Date(endDate));
    }

    return JSON.stringify(filteredEvents.map(e => ({ id: e.id, name: e.name, date: e.date, location: e.location, topic: e.topic })));
  },
});

/**
 * Tool to get the details of a specific event from the time-travel log.
 */
export const getEventDetailsTool = new DynamicStructuredTool({
    name: "get_event_details",
    description: "Obtém os detalhes completos de um evento específico pelo seu ID.",
    schema: z.object({
        eventId: z.number().describe("O ID único do evento."),
    }),
    func: async ({ eventId }) => {
        const event = events.find(e => e.id === eventId);
        if (!event) {
            return `Erro: Evento com ID ${eventId} não encontrado no registro de tempo.`;
        }
        return JSON.stringify(event);
    },
});

export const allTimeTravelTools = [listEventsTool, getEventDetailsTool]; 
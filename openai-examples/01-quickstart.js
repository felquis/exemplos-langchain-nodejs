import "dotenv/config";
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4-turbo",
  input: "Olá, quem é você? PS: finja ser uma reincanação do Nicola Tesla",
});

console.log(response.output_text);
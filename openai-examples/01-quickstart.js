import "dotenv/config";
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4-turbo",
  input: "Qual a melhor cidade para morar no Brasil?",
});

console.log(response.output_text);

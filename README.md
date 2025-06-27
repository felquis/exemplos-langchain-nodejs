# LangChain Tools e AgentExecutor PoC (Node.js)

Exemplos simples e práticos de como integrar LLMs (como o ChatGPT) em aplicações Node.js/JavaScript usando LangChain.

Este repositório serve como uma Prova de Conceito (PoC) para demonstrar o uso de ferramentas LangChain com `AgentExecutor` em um ambiente Node.js. O foco principal é mostrar como aproveitar ferramentas para buscar dados externos e enriquecer os prompts de Modelos de Linguagem Grandes (LLM), permitindo a criação de agentes de IA mais poderosos e com maior percepção de contexto.

Os exemplos são estruturados para proporcionar uma experiência de aprendizado progressiva, começando com um agente básico e introduzindo gradualmente conceitos mais complexos.

Essa é uma prova de conceito pra quem quer entender, testar e aplicar IA generativa de forma real — sem complicação.

💬 Se tiver dúvidas ou quiser trocar ideia, temos um grupo de estudo no WhatsApp:  
[https://chat.whatsapp.com/KkjdHzeBTK48oKxyNPxDuc](https://chat.whatsapp.com/KkjdHzeBTK48oKxyNPxDuc)

## 🚀 Começando

### Pré-requisitos

- Node.js (v18 ou superior)
- Uma chave de API da OpenAI

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/your-username/poc-langchain-tools-nodejs.git
    cd poc-langchain-tools-nodejs
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure suas variáveis de ambiente:**

    Crie um arquivo `.env` na raiz do projeto copiando o arquivo de exemplo:
    ```bash
    cp .env.example .env
    ```

    Abra o arquivo `.env` e adicione sua chave de API da OpenAI:
    ```
    OPENAI_API_KEY="sua_chave_de_api_da_openai_aqui"
    ```

### Executando os Exemplos

Os exemplos estão localizados no diretório `examples/`. Você pode executá-los usando o `node`.

Por exemplo, para executar o primeiro exemplo:
```bash
node examples/01-simple-agent-with-tools.js
```

Verifique o código-fonte de cada arquivo para obter comentários e explicações detalhadas.

## Exemplos

### `examples/01-simple-agent-with-tools.js`

Uma demonstração básica de um agente que atua como um "Guia de Viagens no Tempo Galáctico". Ele usa ferramentas para buscar eventos históricos e futuros em um registro de tempo fictício.

#### Exemplo de Entrada e Saída

**Comando:**
```bash
node examples/01-simple-agent-with-tools.js
```

**Prompt de Entrada (no código):**
```javascript
const prompt = "Só quero ver os eventos do passado";
```

**Examplo de Saída no Terminal:**
```
Aqui estão alguns eventos marcantes do passado:

1. **Lançamento do Sputnik 1**
   - Data: 04 de outubro de 1957
   - Local: Baikonur, Terra
   - Tópico: Início da Era Espacial

2. **Primeiro Homem na Lua**
   - Data: 20 de julho de 1969
   - Local: Mar da Tranquilidade, Lua
   - Tópico: Conquista Lunar

3. **Lançamento do Telescópio Hubble**
   - Data: 24 de abril de 1990
   - Local: Órbita Terrestre
   - Tópico: Astronomia

4. **Pouso do Rover Curiosity em Marte**
   - Data: 06 de agosto de 2012
   - Local: Cratera Gale, Marte
   - Tópico: Exploração de Marte

Se desejar mais detalhes sobre algum desses eventos, é só me avisar! 😊
```

## Contribuições

Contribuições são bem-vindas! Se você tiver ideias para novos exemplos ou melhorias, sinta-se à vontade para abrir uma issue ou enviar um pull request. 
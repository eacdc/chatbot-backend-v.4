const path = require("path");
const OpenAI = require("openai");

// Load backend .env so we can use OPENAI_API_KEY
require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing. Set it in chatbot-backend/.env");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const VECTOR_STORE_ID = "vs_697b0643ebcc8191ace93d3b2d5f9301"; // ← put your vector store id here
const MIN_SCORE = 0.92;           // strict threshold

const question = "In what units is the volume of a liquid usually measured, and in what units are small liquid volumes measured?";

(async () => {
  try {
    // Step 1: Search vector store
    const results = await client.vectorStores.search(VECTOR_STORE_ID, {
      query: question,
      max_num_results: 20
    });

    // Step 2: Filter chunks by strict threshold
    const kept = (results.data || []).filter(
      r => r.score != null && r.score >= MIN_SCORE
    );

    if (!kept.length) {
      console.log("No relevant results above 92% confidence.");
      return;
    }

    // Step 3: Build context from filtered chunks
    const context = kept
      .map(r => {
        const textParts = (r.content || [])
          .filter(p => p.type === "text")
          .map(p => p.text)
          .join("\n");
        return `[${r.filename} score=${r.score.toFixed(2)}]\n${textParts}`;
      })
      .join("\n\n");

    // Step 4: System prompt (instructions + context); user message = question only
    const systemPrompt = `Your are a teacher for grade: 7. You are currently teaching the book: Physics. The current chapter is : Physical Quantities and Measurement. The language of the book is English.

We are building a question answer module for the book.
You will be given a descriptive question.

Your task is to answer the same using the context given to you below. 

You cannot answer the question from outside of the context given to you below.

You answers will be used to compare the answer of the student and then grade them.

Therefore your answers must say : what are the most important part that needs to be covered in answering. What are other essential parts which can complete the answer. And finally, what other pointers can be added to make the answer gold standard.

Please make sure, your response is not beyond the contents of the chapter that has been given to you as your tool.

If the question cannot be answered because it feels incomplete and data to answer the question is not given in the question, for example: if the question say: refer to the diagram below and say which object is moving faster. In this case, you have no knowledge of the diagram, your output should be INVALID.

If the question is valid, you will output a JSON object with the following parameters:

Question-Validity, Tentative response from the book

CONTEXT (use only this to answer):
${context}`;

    const response = await client.responses.create({
      model: "gpt-5.2",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: question }]
        }
      ]
    });

    // Print first text output
    const answerText = response.output?.[0]?.content?.[0]?.text || "";
    console.log(answerText);
  } catch (err) {
    console.error("Error running vector search test:", err);
  }
})();
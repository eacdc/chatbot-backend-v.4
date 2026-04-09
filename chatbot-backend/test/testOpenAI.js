const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});
// import OpenAI from "openai";
// import fs from "fs";
// import path from "path";
// import { randomUUID } from "crypto";

// Test-only OpenAI client that uses your environment API key
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing. Set it in chatbot-backend/.env");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Create a vector store from arbitrary text.
 * This mirrors the original @testOpenAI.js logic:
 * 1) write text to a temp file
 * 2) create a vector store
 * 3) upload the temp file
 * 4) attach it to the vector store (embeddings created here)
 */
async function createVectorStoreFromText(inputText) {
  const tempFileName = `temp-${randomUUID()}.txt`;
  const tempFilePath = path.join(process.cwd(), tempFileName);

  try {
    // 1️⃣ Write text to temp file
    fs.writeFileSync(tempFilePath, inputText, "utf8");

    // 2️⃣ Create vector store
    const vectorStore = await openai.vectorStores.create({
      name: "Dynamic Text Vector Store"
    });

    // 3️⃣ Upload temp file
    const file = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: "assistants"
    });

    // 4️⃣ Attach file to vector store (embeddings created here)
    const vectorFile = await openai.vectorStores.files.create(
      vectorStore.id,
      { file_id: file.id }
    );

    // 5️⃣ Return OpenAI output
    return {
      vectorStore,
      file,
      vectorFile
    };
  } finally {
    // 6️⃣ Always delete temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

module.exports = {
  createVectorStoreFromText
};



// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// async function createVectorStoreFromText(inputText) {
//   const tempFileName = `temp-${randomUUID()}.txt`;
//   const tempFilePath = path.join(process.cwd(), tempFileName);

//   try {
//     // 1️⃣ Write text to temp file
//     fs.writeFileSync(tempFilePath, inputText, "utf8");

//     // 2️⃣ Create vector store
//     const vectorStore = await openai.vectorStores.create({
//       name: "Dynamic Text Vector Store"
//     });

//     // 3️⃣ Upload temp file
//     const file = await openai.files.create({
//       file: fs.createReadStream(tempFilePath),
//       purpose: "assistants"
//     });

//     // 4️⃣ Attach file to vector store (embeddings created here)
//     const vectorFile = await openai.vectorStores.files.create(
//       vectorStore.id,
//       { file_id: file.id }
//     );

//     // 5️⃣ Return OpenAI output
//     return {
//       vectorStore,
//       file,
//       vectorFile
//     };

//   } finally {
//     // 6️⃣ Always delete temp file
//     if (fs.existsSync(tempFilePath)) {
//       fs.unlinkSync(tempFilePath);
//     }
//   }
// }


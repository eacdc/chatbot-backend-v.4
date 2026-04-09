const express = require("express");
const router = express.Router();
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");

// Load OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 600000
});

const SCORE_THRESHOLD = 0.60;

/** Retry processChunk on 5xx (e.g. 500, 520) with exponential backoff */
async function processChunkWithRetry(chunk, vectorStoreId, grade, title, chapter, language, onProgress, maxRetries = 3) {
  const baseDelayMs = 5000;
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processChunk(chunk, vectorStoreId, grade, title, chapter, language, onProgress);
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      const is5xx = (typeof status === "number" && status >= 500) || /520|500|502|503/.test(String(err?.message || ""));
      if (!is5xx || attempt === maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[V2] Chunk failed (status ${status || "?"}), retry ${attempt}/${maxRetries} in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Clean and parse JSON from AI response text
 */
function cleanAndParseJSON(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  try {
    let cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    try {
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      
      console.warn("Failed to parse JSON from response:", err.message);
      return {
        error: "Failed to parse JSON",
        rawText: text.substring(0, 500)
      };
    } catch (secondErr) {
      console.error("Complete JSON parsing failure:", secondErr.message);
      return {
        error: "Failed to parse JSON",
        rawText: text.substring(0, 500)
      };
    }
  }
}

/**
 * Safely get text from OpenAI Responses API output (handles different shapes / reasoning output)
 */
function getResponseText(response, stepName) {
  if (!response?.output?.length) {
    throw new Error(`OpenAI ${stepName} returned no output.`);
  }
  let text = response.output[0]?.content?.[0]?.text;
  if (text != null && text !== "") return text;
  for (const out of response.output) {
    const content = out?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.text != null && c.text !== "") return c.text;
    }
  }
  const errDetail = JSON.stringify(response.output.slice(0, 2));
  throw new Error(`OpenAI ${stepName} returned no text in output. output: ${errDetail}`);
}

/**
 * Create vector store from text (reusing testOpenAI.js pattern)
 */
async function createVectorStoreFromText(inputText) {
  const tempFileName = `temp-${randomUUID()}.txt`;
  const tempFilePath = path.join(process.cwd(), tempFileName);

  try {
    fs.writeFileSync(tempFilePath, inputText, "utf8");

    const vectorStore = await openai.vectorStores.create({
      name: "Dynamic Text Vector Store"
    });

    const file = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: "assistants"
    });

    const vectorFile = await openai.vectorStores.files.create(
      vectorStore.id,
      { file_id: file.id }
    );

    return {
      vectorStore,
      file,
      vectorFile
    };
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

/**
 * Split text into sentence-based chunks.
 * No limit on number of parts; each chunk has at most maxWordsPerChunk words.
 * Splits at sentence boundaries (. ! ? followed by space).
 * @param {string} text - Raw text to split
 * @param {number} maxWordsPerChunk - Max words per chunk (default 1000)
 */
function splitTextIntoSentenceParts(text, maxWordsPerChunk = 1000) {
  const sentenceEndRegex = /[.!?]+\s+/g;
  const sentenceEndings = [];
  let match;

  while ((match = sentenceEndRegex.exec(text)) !== null) {
    sentenceEndings.push(match.index + match[0].length);
  }

  if (sentenceEndings.length === 0) {
    return [text];
  }

  const wordCount = (text.match(/\s+/g) || []).length + 1;
  const wordsPerPart = Math.max(1, maxWordsPerChunk);
  const minParts = Math.max(1, Math.ceil(wordCount / wordsPerPart));

  const parts = [];
  let startPos = 0;

  for (let i = 0; i < minParts && startPos < text.length; i++) {
    const approxCharPos = startPos + (wordsPerPart * 6);
    
    let endPos = text.length;
    for (let j = 0; j < sentenceEndings.length; j++) {
      if (sentenceEndings[j] > approxCharPos) {
        endPos = sentenceEndings[j];
        break;
      }
    }

    if (endPos <= startPos) {
      endPos = sentenceEndings.length > 0 ? sentenceEndings[sentenceEndings.length - 1] : text.length;
    }

    const part = text.substring(startPos, endPos).trim();
    if (part) {
      parts.push(part);
    }

    startPos = endPos;

    if (parts.length >= minParts - 1 && startPos < text.length) {
      break;
    }
  }

  if (startPos < text.length) {
    const lastPart = text.substring(startPos).trim();
    if (lastPart) {
      parts.push(lastPart);
    }
  }

  return parts;
}

/**
 * Enrich questions with vector-search-based answers (PARALLELIZED for speed)
 */
async function enrichQuestionsWithAnswers(questions, vectorStoreId, meta) {
  if (!Array.isArray(questions)) return;
  // console.log('#######',questions)

  // Process all questions in parallel using Promise.all
  await Promise.all(questions.map(async (q) => {
    const questionText = q.question;
    const questionTextwithType = q.question_type+" "+questionText;
    if (!questionText) return;

    const rawType = q.question_type || q["question type"] || "";
    const typeLower = String(rawType).toLowerCase();

    const usePrompt1 =
      typeLower.includes("short answer") ||
      typeLower.includes("descriptive");

    const { grade, title, chapter, language } = meta;

    let context = "";
    let highestScore = 0;

    if (usePrompt1) {
      const searchResults = await openai.vectorStores.search(vectorStoreId, {
        query: questionText,
        max_num_results: 20
      });

      const results = searchResults.data || [];
      if (!results.length) {
        q["Question-Validity"] = "INVALID";
        return;
      }

      highestScore = results.reduce(
        (max, r) => (r.score != null && r.score > max ? r.score : max),
        0
      );
      q.highestScore = highestScore;

      context = results
        .map(r => {
          const textParts = (r.content || [])
            .filter(p => p.type === "text")
            .map(p => p.text)
            .join("\n");
          const filename = r.filename || "source";
          return `[${filename} score=${r.score.toFixed(2)}]\n${textParts}`;
        })
        .join("\n\n");
    }

    const systemPrompt = usePrompt1
      ? `Your are a teacher for grade: ${grade}. You are currently teaching the book: ${title}. The current chapter is : ${chapter}. The language of the book is ${language}.

We are building a question answer module for the book.
You will be given a descriptive question.

Your task is to answer the same using the context given to you below. 

You cannot answer the question from outside of the context given to you below.

You answers will be used to compare the answer of the student and then grade them.

Therefore your answers must say : what are the most important part that needs to be covered in answering. What are other essential parts which can complete the answer. And finally, what other pointers can be added to make the answer gold standard.

Please make sure, your response is not beyond the contents of the chapter that has been given to you as your tool.

If the question cannot be answered because it feels incomplete and data to answer the question is not given in the question, for example: if the question say: refer to the diagram below and say which object is moving faster. In this case, you have no knowledge of the diagram, your output should be INVALID.

If the question is valid, you will output a JSON object with the following parameters:

Question-Validity, Tentative response from the book. Example: {"Question-Validity": "VALID", "Tentative response from the book": "The answer to the question is in the context given to you below."}

CONTEXT (use only this to answer):
${context}`
      : `Your are a teacher for grade: ${grade}. You are currently teaching the book: ${title}. The current chapter is : ${chapter}. The language of the book is ${language}.

We are building a question answer module for the book.
You will be given a question.

If the question cannot be answered because it feels incomplete and data to answer the question is not given in the question, for example: if the question say: refer to the diagram below and say which object is moving faster. In this case, you have no knowledge of the diagram, your output should be INVALID.

question validity will only be VALID or INVALID.

If the question is valid, you will output a JSON object with the following parameters. No need to find answer to the question. strictly follow below example.

{"Question-Validity": "VALID"/"INVALID","Invalid reason": "reason for invalidity"}. Example: {"Question-Validity": "INVALID","Invalid reason": "Question is incomplete because it refers to a diagram"}`;

    const answerResp = await openai.responses.create({
      model: "gpt-5.2",
      text:{
        "format": {"type": "text"},
        "verbosity": "medium",
      },
      reasoning:{
          "effort": "medium",
          "summary": "auto",
      },
      store:true,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: questionTextwithType }]
        }
      ]
    });

    const answerText = answerResp.output?.[0]?.content?.[0]?.text || answerResp.output?.[1]?.content?.[0]?.text;
    const parsed = cleanAndParseJSON(answerText);
    // console.log('#######',JSON.stringify(parsed));

    if (parsed && typeof parsed === "object") {
      if (parsed["Question-Validity"] !== undefined) {
        q["Question-Validity"] = parsed["Question-Validity"];
      }
      if (parsed["Tentative response from the book"] !== undefined) {
        q["Tentative response from the book"] = parsed["Tentative response from the book"];
      }
      if (parsed["Invalid reason"] !== undefined) {
        q["Invalid reason"] = parsed["Invalid reason"];
      }
    } 
    // if(JSON.stringify(parsed) === null || JSON.stringify(parsed) === undefined || parsed === null || parsed === undefined) {
    //   // q["Question-Validity"] = "INVALID";
    //   // q["Invalid reason"] = "No valid response from the book";
    //   console.log('#######4',answerResp);
    //   console.log('#######5',answerResp.output?.[0]?.content);   
      console.log('#######1',JSON.stringify(q));
      console.log('#######2',JSON.stringify(parsed));
      console.log('#######4',answerResp);
      console.log('#######5',answerResp.output?.[0]);  
    // }
  }));
}

/**
 * Categorize enriched questions into 5 buckets
 */
function categorizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return {
      shortAnswerDescriptiveAtOrAbove75: [],
      shortAnswerDescriptiveInvalid: [],
      shortAnswerDescriptiveBelow75: [],
      otherQuestionValid: [],
      otherQuestionInvalid: []
    };
  }

  const shortAnswerDescriptiveAtOrAbove75 = [];
  const shortAnswerDescriptiveInvalid = [];
  const shortAnswerDescriptiveBelow75 = [];
  const otherQuestionValid = [];
  const otherQuestionInvalid = [];

  for (const q of questions) {
    const rawType = q.question_type || q["question type"] || "";
    const typeLower = String(rawType).toLowerCase();
    const isShortAnswerOrDescriptive =
      typeLower.includes("short answer") || typeLower.includes("descriptive");

    // console.log('#######',JSON.stringify(q))

    const validity = (q["Question-Validity"] || "").toUpperCase();
    const isValid = validity === "VALID";
    const score = q.highestScore != null ? Number(q.highestScore) : 0;

    if (isShortAnswerOrDescriptive) {
      if (!isValid) {
        shortAnswerDescriptiveInvalid.push(q);
      } else if (score >= SCORE_THRESHOLD) {
        shortAnswerDescriptiveAtOrAbove75.push(q);
      } else {
        shortAnswerDescriptiveBelow75.push(q);
      }
    } else {
      if (isValid) {
        otherQuestionValid.push(q);
      } else {
        otherQuestionInvalid.push(q);
      }
    }
  }

  return {
    shortAnswerDescriptiveAtOrAbove75,
    shortAnswerDescriptiveInvalid,
    shortAnswerDescriptiveBelow75,
    otherQuestionValid,
    otherQuestionInvalid
  };
}

/**
 * Internal function: Process a single chunk
 * Same logic as test/openai-agent
 * @param {Function} [onProgress] - Optional callback({ stage, message }) for progress reporting
 */
async function processChunk(message, vectorStoreId, grade, title, chapter, language, onProgress) {
  // Normalize metadata
  const timestamp3 = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata'
  });
  console.log(`[${timestamp3}] processChunk started`);

  const normalizedGrade = grade || "7";
  const normalizedTitle = title || "example title";
  const normalizedChapter = chapter || "example chapter";
  const normalizedLanguage = language || "English";

  // Step 1: Normalize text + extract subtopics
  if (onProgress) onProgress({ stage: "normalizing", message: "Normalizing the text..." });
  const systemPrompt1 = `You are a proof reader. You are given raw text that was generated after extracting from a pdf of a book.
I need you to normalize the text word by word, sentence by sentence. Do not omit any content.
Also, categorize the text is minimum 2 and maximum 7 subtopics.  

The text will contain a lot of questions, activities, and self assessment tasks. These are not a separate subtopic but these questions, activities, and self assessment tasks will belong to one of those subtopics.  So please do not create a subtopic for questions, activities, and self assessment tasks. Subtopics will only be generated from the learning content of the chapter of the book.

Important instructions:

1. Fix any special characters or escape sequences (like \\t, \\n, \\x07, etc.) that appear in the raw text
2. Maintain proper paragraph structure and formatting
3. Preserve all content including figure references (Fig. X.X) and mathematical symbols
4. Maintain the same language as the language of the raw text. 
5. Handle any control characters or strange formatting artifacts from the PDF conversion

Go ahead page by page and convert the raw text to what the actual text would appear like in the original book. Do not add any outside knowledge or content.

Title of the book is ${normalizedTitle}. The book is meant for children of grade ${normalizedGrade}. The name of the chapter is ${normalizedChapter}. The content of the chapter is in language ${normalizedLanguage}.

You will output a JSON with a object Normalized text, and its subtopic names.`;

  // const response1 = await openai.responses.create({
  //   model: "gpt-4.1",
  //   temperature: 0.1,
  //   input: [
  //     {
  //       role: "system",
  //       content: [{ type: "input_text", text: systemPrompt1 }]
  //     },
  //     {
  //       role: "user",
  //       content: [{ type: "input_text", text: message }]
  //     }
  //   ]
  // });

  const response1 = await openai.responses.create({
    model: "gpt-5.2",
    text:{
      "format": {"type": "text"},
      "verbosity": "medium",
    },
    reasoning:{
        "effort": "medium",
        "summary": "auto",
    },
    store:true,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt1 }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: message }]
      }
    ]
  });

  const normalizedText = getResponseText(response1, "normalize");

  if (onProgress) onProgress({ stage: "extracting_questions", message: "Extracting questions..." });

  // Step 2: Extract questions from normalized text
  const systemPrompt2 = `You are a teacher. You will be given a normalized txt. Along with subtopics covered in that text.
Your task is to use the text, and extract questions. from the text and assign the most relevant sub topic from the subtopics given to you.

Special Instructions:

1. Fix any special characters or escape sequences (like \\t, \\n, \\x07, etc.) that appear in the text
2. Maintain proper paragraph structure and formatting.
3. Maintain the same language as the language of the text. 

Do not generate questions on your own. Own use the text to generate the questions.
In the text, there may be unnecessary questions like -- did you know? These are irrelevant questions that are not in relation to the educational content of the book. You task is to only find out questions that students are expected to answer from the text.

Find out all possible questions.

Please note that these questions will be asked to students in isolation. Thus if any question seems incomplete, try to complete it using other information available to you. 
if question type is fill in the blanks/multiple choice/true false/numeric/others, then the question should be self contained and should not refer to any other information also restructure the question to look beautiful,example- adding ____ for fill in the blanks types etc.
In case the question is referring to data like an image or picture above for which you have no knowledge, then discard those questions. 
Each and every question should be such that it can be independently answered by the student without access to the physical book for rereferring any topic. 

For example if the subject is english, and the topic is comprehension, then the essay has to be there along with the question from where the student is expected to comprehend and answer. Only if it as a very long passage, then you can ask the student to refer to the book.
 spanning multiple pages.

Title of the book is ${normalizedTitle}. The book is meant for children of grade ${normalizedGrade}. The name of the chapter is ${normalizedChapter}. The content of the chapter is in language ${normalizedLanguage}.

You shall output in JSONobject.
The parameters for each question would be: question, subtopic, difficulty level (1-5 with 1 being easiest), question type [Descriptive, short answer, MCQ, numeric, True-False, Fill in the banks, others]
For generating questions that does not belong to the book you will be fined 100USD per question. Please validate carefully, before extracting the question
Also if you miss any question frm the book you will be further fines 200USD per question missed.
Please output all the questions that you have extracted from the text. Do not end with ... more items`;

  const response2 = await openai.responses.create({
    model: "gpt-5.2",
    text:{
      "format": {"type": "text"},
      "verbosity": "medium",
    },
    reasoning:{
        "effort": "medium"
    },
    store:true,
    input: [
      {
        role: "system",
        // temperature: 0.1,
        content: [{ type: "input_text", text: systemPrompt2 }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: normalizedText }]
      }
    ]
  });

  const timestamp4 = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata'
  });
  console.log(`[${timestamp4}] response2 generated`);

  // Step 3: Clean and parse questions
  const rawResponse2 = getResponseText(response2, "extract-questions");
  const cleanedResponse2 = cleanAndParseJSON(rawResponse2);

  const timestamp5 = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata'
  });
  console.log(`[${timestamp5}] cleanedResponse2 generated`);

  // Step 4: Enrich questions (extract answer + question validation)
  if (onProgress) onProgress({ stage: "extracting_answer_validation", message: "Extracting answers and doing question validation..." });
  const meta = {
    grade: normalizedGrade,
    title: normalizedTitle,
    chapter: normalizedChapter,
    language: normalizedLanguage
  };

  const questionsArray = Array.isArray(cleanedResponse2)
    ? cleanedResponse2
    : (cleanedResponse2 && Array.isArray(cleanedResponse2.questions) ? cleanedResponse2.questions : []);

  if (questionsArray.length) {
    await enrichQuestionsWithAnswers(questionsArray, vectorStoreId, meta);
  }

  return questionsArray;
}

/**
 * Internal endpoint: Process a single chunk (for testing/debugging)
 */
router.post("/process-chunk", authenticateAdmin, async (req, res) => {
  try {
    const { message, vectorStoreId, grade, title, chapter, language } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Request body must include a 'message' string"
      });
    }

    if (!vectorStoreId) {
      return res.status(400).json({
        error: "vectorStoreId is required"
      });
    }

    const questions = await processChunk(message, vectorStoreId, grade, title, chapter, language);

    return res.json({
      success: true,
      questions
    });
  } catch (err) {
    console.error("Error in /process-chunk:", err);
    return res.status(500).json({
      error: err.message || "Unknown error processing chunk"
    });
  }
});

/**
 * V2 endpoint: Process entire raw text sequentially
 */
router.post("/process-text-batch-v2", authenticateAdmin, async (req, res) => {
  try {
    const { rawText, grade, title, chapter, language } = req.body;
    const timestamp1 = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata'
    });
    
    console.log(`[${timestamp1}] data received`);

    if (!rawText) {
      return res.status(400).json({ error: "Raw text is required" });
    }

    console.log(`[V2] Processing text. Length: ${rawText.length} characters`);

    // 1) Create ONE vector store from full raw text
    console.log("[V2] Creating vector store...");
    const vectorResult = await createVectorStoreFromText(rawText);
    const vectorStoreId = vectorResult.vectorStore.id;
    const timestamp2 = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata'
    });
    console.log(`[${timestamp2}] Vector store created: ${vectorStoreId}`);

    // 2) Split into chunks (8000 words each); process sequentially, one chunk after the other
    const wordCount = (rawText.match(/\s+/g) || []).length + 1;
    const WORDS_PER_CHUNK = 5000;
    const chunks = splitTextIntoSentenceParts(rawText, WORDS_PER_CHUNK);
    console.log(`[V2] Word count: ${wordCount.toLocaleString()}, chunks: ${chunks.length} (max ${WORDS_PER_CHUNK.toLocaleString()} words each)`);

    // 3) Process one chunk at a time, wait 60s between chunks to stay under 3 lakh words/minute
    const allQuestions = [];
    const MS_PER_MINUTE = 20 * 1000;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < chunks.length; i++) {
      console.log(`[V2] Processing chunk ${i + 1}/${chunks.length}...`);
      
      try {
        const questions = await processChunkWithRetry(
          chunks[i],
          vectorStoreId,
          grade,
          title,
          chapter,
          language,
          undefined
        );
        
        if (questions && Array.isArray(questions)) {
          allQuestions.push(...questions);
        }
        
        console.log(`[V2] Completed chunk ${i + 1}/${chunks.length} - extracted ${questions?.length || 0} questions`);
        
        // Wait 1 minute before next chunk so we don't exceed 3 lakh words per minute
        if (i < chunks.length - 1) {
          console.log(`[V2] Waiting 60 seconds before next chunk (rate limit: 3 lakh words/min)...`);
          await sleep(MS_PER_MINUTE);
        }
      } catch (chunkError) {
        console.error(`[V2] Error processing chunk ${i + 1}:`, chunkError);
        return res.status(500).json({
          error: `Failed at chunk ${i + 1}/${chunks.length}`,
          message: chunkError.message
        });
      }
    }

    console.log(`[V2] All chunks processed. Total questions: ${allQuestions.length}`);

    // 4) Assign global Q numbers
    allQuestions.forEach((q, idx) => {
      q.Q = idx + 1;
    });

    // 5) Categorize into 5 buckets
    const categorized = categorizeQuestions(allQuestions);

    // 6) Build response (same shape as current process-text-batch + categorized arrays)
    const combinedPrompt = JSON.stringify(allQuestions);

    return res.json({
      success: true,
      isQuestionFormat: true,
      questionArray: allQuestions,
      totalQuestions: allQuestions.length,
      combinedPrompt,
      vectorStoreId,
      rawText,
      categorized: {
        shortAnswerDescriptiveAtOrAbove75: categorized.shortAnswerDescriptiveAtOrAbove75,
        shortAnswerDescriptiveInvalid: categorized.shortAnswerDescriptiveInvalid,
        shortAnswerDescriptiveBelow75: categorized.shortAnswerDescriptiveBelow75,
        otherQuestionValid: categorized.otherQuestionValid,
        otherQuestionInvalid: categorized.otherQuestionInvalid
      },
      nextSteps: "Review the categorized questions in the UI and manually validate. Only kept questions should be submitted when creating the chapter."
    });
  } catch (err) {
    console.error("[V2] Error in process-text-batch-v2:", err);
    return res.status(500).json({
      error: "Failed to process text",
      message: err.message
    });
  }
});

/**
 * Stream progress as NDJSON, then send result. Frontend can read line-by-line.
 */
function writeProgress(res, obj) {
  res.write(JSON.stringify(obj) + "\n");
}

/**
 * V2 streaming endpoint: same as process-text-batch-v2 but streams progress (NDJSON lines)
 */
router.post("/process-text-batch-v2-stream", authenticateAdmin, async (req, res) => {
  try {
    const { rawText, grade, title, chapter, language } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: "Raw text is required" });
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders && res.flushHeaders();

    const totalSteps = (n) => 2 + 3 * n; // vector + (normalize, extract, enrich) * N + categorize
    let step = 0;

    writeProgress(res, { type: "progress", stage: "vector_store", message: "Creating vector store...", percent: 0 });

    const vectorResult = await createVectorStoreFromText(rawText);
    const vectorStoreId = vectorResult.vectorStore.id;

    // 8000 words per chunk; process sequentially (one chunk completes before the next starts)
    const wordCount = (rawText.match(/\s+/g) || []).length + 1;
    const WORDS_PER_CHUNK = 5000;
    const chunks = splitTextIntoSentenceParts(rawText, WORDS_PER_CHUNK);
    const totalStepsVal = totalSteps(chunks.length);
    step = 1;
    writeProgress(res, { type: "progress", stage: "vector_store", message: "Vector store created.", percent: Math.round((100 * step) / totalStepsVal) });

    const allQuestions = [];
    const MS_PER_MINUTE = 60 * 1000;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1;
      const baseStep = 2 + 3 * i;

      const onProgress = ({ stage, message }) => {
        let s = baseStep;
        if (stage === "normalizing") s = baseStep;
        else if (stage === "extracting_questions") s = baseStep + 1;
        else if (stage === "extracting_answer_validation") s = baseStep + 2;
        const percent = Math.min(99, Math.round((100 * s) / totalStepsVal));
        writeProgress(res, { type: "progress", stage, message: `${message} (chunk ${chunkIndex}/${chunks.length})`, percent });
      };

      const questions = await processChunkWithRetry(
        chunks[i],
        vectorStoreId,
        grade,
        title,
        chapter,
        language,
        onProgress
      );

      if (questions && Array.isArray(questions)) {
        allQuestions.push(...questions);
      }

      step = 2 + 3 * (i + 1);
      writeProgress(res, { type: "progress", stage: "chunk_done", message: `Chunk ${chunkIndex}/${chunks.length} done.`, percent: Math.round((100 * step) / totalStepsVal) });

      if (i < chunks.length - 1) {
        writeProgress(res, { type: "progress", stage: "waiting", message: "Rate limit wait (60s)...", percent: Math.round((100 * step) / totalStepsVal) });
        await sleep(MS_PER_MINUTE);
      }
    }

    writeProgress(res, { type: "progress", stage: "categorizing", message: "Categorizing questions...", percent: 95 });

    allQuestions.forEach((q, idx) => {
      q.Q = idx + 1;
    });
    const categorized = categorizeQuestions(allQuestions);
    const combinedPrompt = JSON.stringify(allQuestions);

    const result = {
      success: true,
      isQuestionFormat: true,
      questionArray: allQuestions,
      totalQuestions: allQuestions.length,
      combinedPrompt,
      vectorStoreId,
      rawText,
      categorized: {
        shortAnswerDescriptiveAtOrAbove75: categorized.shortAnswerDescriptiveAtOrAbove75,
        shortAnswerDescriptiveInvalid: categorized.shortAnswerDescriptiveInvalid,
        shortAnswerDescriptiveBelow75: categorized.shortAnswerDescriptiveBelow75,
        otherQuestionValid: categorized.otherQuestionValid,
        otherQuestionInvalid: categorized.otherQuestionInvalid
      },
      nextSteps: "Review the categorized questions in the UI and manually validate. Only kept questions should be submitted when creating the chapter."
    };

    writeProgress(res, { type: "result", data: result });
    res.end();
  } catch (err) {
    console.error("[V2] Error in process-text-batch-v2-stream:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process text", message: err.message });
    } else {
      writeProgress(res, { type: "error", error: err.message });
      res.end();
    }
  }
});

module.exports = router;

const path = require("path");
const express = require("express");
const OpenAI = require("openai");
const { createVectorStoreFromText } = require("./testOpenAI");

// Load backend .env so TEST-only server can use OPENAI_API_KEY
require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});

const app = express();
app.use(express.json());

// Agent-style OpenAI client (test-only; uses env key)
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing. Set it in chatbot-backend/.env");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Strict similarity threshold for vector search (like testvector.js)
const MIN_SCORE = 0.90;

/**
 * Clean and parse JSON from AI response text
 * Handles markdown code blocks, extra whitespace, and common formatting issues
 */
function cleanAndParseJSON(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  try {
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    let cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Try to find JSON object boundaries if wrapped in other text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    // Parse the cleaned JSON
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    // If parsing fails, try to extract JSON more aggressively
    try {
      // Look for JSON array as well
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      
      // If still fails, return the cleaned text wrapped in an error object
      console.warn("Failed to parse JSON from response:", err.message);
      return {
        error: "Failed to parse JSON",
        rawText: text.substring(0, 500) // First 500 chars for debugging
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
 * Enrich questions with vector-search-based answers.
 * - questions: array of question objects
 * - vectorStoreId: id of the vector store to search
 * - meta: { grade, title, chapter, language }
 */
async function enrichQuestionsWithAnswers(questions, vectorStoreId, meta) {
  if (!Array.isArray(questions)) return;

  for (const q of questions) {
    const questionText = q.question;
    if (!questionText) continue;

    const rawType =
      q["question_type"] ||
      q.question_type;
    const typeLower = String(rawType).toLowerCase();
    // console.log("#######################typeLower", typeLower);

    const usePrompt1 =
      typeLower.includes("short answer") ||
      typeLower.includes("descriptive");

    // console.log("#######################usePrompt1", usePrompt1);

    const { grade, title, chapter, language } = meta;

    let context = "";
    let highestScore = 0;

    if (usePrompt1) {
      // 1) Vector search: fetch context for this question (like testvector.js)
      const searchResults = await openai.vectorStores.search(vectorStoreId, {
        query: questionText,
        max_num_results: 20
      });

      const results = searchResults.data || [];
      if (!results.length) {
        // If no context at all, mark as invalid and continue
        q["Question-Validity"] = "INVALID";
        continue;
      }

      // Compute highest similarity score among all results and attach it
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

    // 2) Build prompt1 / prompt2
    const systemPrompt = usePrompt1
      ? (
`Your are a teacher for grade: ${grade}. You are currently teaching the book: ${title}. The current chapter is : ${chapter}. The language of the book is ${language}.

We are building a question answer module for the book.
You will be given a descriptive question.

Your task is to answer the same using the context given to you below. 

You cannot answer the question from outside of the context given to you below.

You answers will be used to compare the answer of the student and then grade them.

Therefore your answers must say : what are the most important part that needs to be covered in answering. What are other essential parts which can complete the answer. And finally, what other pointers can be added to make the answer gold standard.

Please make sure, your response is not beyond the contents of the chapter that has been given to you as your tool.

If the question cannot be answered because it feels incomplete and data to answer the question is not given in the question, for example: if the question say: refer to the diagram below and say which object is moving faster. In this case, you have no knowledge of the diagram, your output should be INVALID.

If the question is valid, you will output a JSON object with the following parameters:

Question-Validity, Tentative response from the book, Invalid Reason

CONTEXT (use only this to answer):
${context}`
        )
      : (
`Your are a teacher for grade: ${grade}. You are currently teaching the book: ${title}. The current chapter is : ${chapter}. The language of the book is ${language}.

We are building a question answer module for the book.
You will be given a question.

If the question cannot be answered because it feels incomplete and data to answer the question is not given in the question, for example: if the question say: refer to the diagram below and say which object is moving faster. In this case, you have no knowledge of the diagram, your output should be INVALID.

If the question is valid, you will output a JSON object with the following parameters:

Question-Validity, Invalid Reason`  
        );

    // 3) Call Responses API with system + user messages (no tools)
    const answerResp = await openai.responses.create({
      model: "gpt-5.2",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: questionText
            }
          ]
        }
      ]
    });

    const answerText = answerResp.output?.[0]?.content?.[0]?.text || "";
    const parsed = cleanAndParseJSON(answerText);

    if (parsed && typeof parsed === "object") {
      if (parsed["Question-Validity"] !== undefined) {
        q["Question-Validity"] = parsed["Question-Validity"];
      }
      if (parsed["Tentative response from the book"] !== undefined) {
        q["Tentative response from the book"] =
          parsed["Tentative response from the book"];
      }
      if (parsed["Invalid reason"] !== undefined) {
        q["Invalid reason"] = parsed["Invalid reason"];
      }
    }
  }
}

const SCORE_THRESHOLD = 0.75;

/**
 * Categorize enriched questions into 5 buckets for output.
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
    const rawType = q["question_type"] || q.question_type || q["question type"] || "";
    const typeLower = String(rawType).toLowerCase();
    const isShortAnswerOrDescriptive =
      typeLower.includes("short answer") || typeLower.includes("descriptive");

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
 * POST /test/openai-agent
 *
 * Body:
 * {
 *   "message": "user message here"
 * }
 *
 * Flow:
 * 1) Create a vector store with embeddings using createVectorStoreFromText
 * 2) Call OpenAI Responses API with the given prompt id
 * 3) Return the OpenAI response (plus vector store ids for debugging)
 */
app.post("/test/openai-agent", async (req, res) => {
  try {
    
    const { message, grade, title, chapter, language } = req.body || {};
    // const { grade, title, chapter, language } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Request body must include a 'message' string"
      });
    }

    // 1) Create a vector store from the incoming message text
    const vectorResult = await createVectorStoreFromText(message);

    // 2) Normalize metadata from body (with safe defaults)
    const normalizedGrade = grade || "7";
    const normalizedTitle = title || "example title";
    const normalizedChapter = chapter || "example chapter";
    const normalizedLanguage = language || "English";

    const systemPrompt1 = `
You are a proof reader. You are given raw text that was generated after extracting from a pdf of a book.
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

You will output a JSON with a object Normalized text, and its subtopic names.
`.trim();

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
In case the question is referring to data like an image or picture above for which you have no knowledge, then discard those questions. 
Each and every question should be such that it can be independently answered by the student without access to the physical book for rereferring any topic. 

For example if the subject is english, and the topic is comprehension, then the essay has to be there along with the question from where the student is expected to comprehend and answer. Only if it as a very long passage, then you can ask the student to refer to the book.
 spanning multiple pages.

Title of the book is ${normalizedTitle}. The book is meant for children of grade ${normalizedGrade}. The name of the chapter is ${normalizedChapter}. The content of the chapter is in language ${normalizedLanguage}.

You shall output in JSONobject.
The parameters for each question would be: question, subtopic, difficulty level (1-5 with 1 being easiest), question type [Descriptive, short answer, MCQ, numeric, True-False, Fill in the banks, others]

`.trim();
    // 3) Call the Responses API with system + user messages
    const response1 = await openai.responses.create({
      model: "gpt-5.2",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt1
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: message
            }
          ]
        }
      ]
    });
    const response2 = await openai.responses.create({
      model: "gpt-5.2",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt2
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: response1.output[0].content[0].text
            }
          ]
        }
      ]
    });

    // 4) Clean and parse response2 JSON
    const rawResponse2 = response2.output[0].content[0].text;
    const cleanedResponse2 = cleanAndParseJSON(rawResponse2);

    // Keep a deep copy BEFORE enrichment for comparison/debugging
    const cleanedResponse2Before = JSON.parse(JSON.stringify(cleanedResponse2));

    // 5) Enrich each question using vector search + appropriate prompt
    const vectorStoreId = vectorResult.vectorStore.id;
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

    // 6) Categorize into 5 buckets and return
    const categorized = categorizeQuestions(questionsArray);

    return res.json({
      shortAnswerDescriptiveAtOrAbove75: categorized.shortAnswerDescriptiveAtOrAbove75,
      shortAnswerDescriptiveInvalid: categorized.shortAnswerDescriptiveInvalid,
      shortAnswerDescriptiveBelow75: categorized.shortAnswerDescriptiveBelow75,
      otherQuestionValid: categorized.otherQuestionValid,
      otherQuestionInvalid: categorized.otherQuestionInvalid,
      vectorStoreId
    });
  } catch (err) {
    console.error("Error in /test/openai-agent:", err);
    return res.status(500).json({
      error: err.message || "Unknown error calling OpenAI"
    });
  }
});

const PORT = process.env.TEST_OPENAI_PORT || 5050;

app.listen(PORT, () => {
  console.log(`Test OpenAI agent API running on http://localhost:${PORT}/test/openai-agent`);
});


/**
 * Question Batch Processor
 * 
 * This script processes batched question data from chapter form inputs
 * and formats it for database storage and random question selection.
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require("openai");

// Create the OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Validate a question using OpenAI to check if it's complete and doesn't reference external elements
 * @param {string} questionText - The question text to validate
 * @returns {Promise<string>} - Returns 'keep' or 'skip'
 */
async function validateQuestion(questionText) {
  try {
    if (!questionText || questionText.trim() === '') {
      console.log("Empty question, skipping validation");
      return "skip";
    }

    // System prompt to check if question is suitable
    const systemPrompt = `You are an AI that evaluates questions for completeness and self-containment.
Your job is to determine if a question can be answered without external references or visual elements.

Analyze each question and respond with ONLY "keep" or "skip" based on these criteria:

Return "skip" if ANY of these conditions are true:
- The question is incomplete or lacks sufficient context
- The question refers to a chart, diagram, graph, image, or table that is not described in the question itself
- The question uses phrases like "according to the diagram", "refer to the image", "as shown in the figure", etc.
- The question contains references to external examples, exhibits, or visual elements
- The question has ellipses (...) indicating missing content
- The question includes "See example/image/figure/chart number X"
- The question cannot be understood without seeing something not in the text

Return "keep" if:
- The question is self-contained
- The question provides all necessary context within its text
- The question can be answered without referring to external elements
- The question is complete and well-formed

Respond ONLY with the word "keep" or "skip" - no explanation or additional text.`;

    // Make the API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: questionText }
      ],
      max_tokens: 10,
      temperature: 0.1,
    });

    // Extract response
    const result = response.choices[0].message.content.trim().toLowerCase();
    
    // Validate response format
    if (result === "keep" || result === "skip") {
      console.log(`Question validation result: ${result}`);
      return result;
    } else {
      console.warn(`Unexpected validation response: ${result}, defaulting to "keep"`);
      return "keep";
    }
  } catch (error) {
    console.error("Error validating question:", error.message);
    // Default to keep if there's an error
    return "keep";
  }
}

/**
 * Process raw batch text input into a structured question array
 * @param {string} batchText - Raw text containing JSON objects (one per line)
 * @param {string} chapterId - ID of the chapter these questions belong to
 * @param {boolean} validateQuestions - Whether to validate questions with OpenAI
 * @returns {Promise<Array>} - Array of question objects
 */
async function processQuestionBatch(batchText, chapterId = null, validateQuestions = true) {
  console.log("Processing batch question input...");
  
  // Split the input by newlines and filter out empty lines
  const lines = batchText.split(/\r?\n/).filter(line => line.trim());
  
  const questions = [];
  let errorCount = 0;
  let skippedCount = 0;
  
  // Process each line as a potential JSON object
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    try {
      // Attempt to parse the JSON object
      const questionObj = JSON.parse(line);
      
      // Validate essential fields
      if (questionObj.Q === undefined || !questionObj.question) {
        console.log(`Warning: Question at line ${index + 1} is missing required fields`);
        errorCount++;
        continue;
      }

      // Validate the question with OpenAI if enabled
      if (validateQuestions) {
        const validationResult = await validateQuestion(questionObj.question);
        if (validationResult === "skip") {
          console.log(`Skipping question at line ${index + 1} based on validation`);
          skippedCount++;
          continue;
        }
      }
      
      // Create a unique ID if none exists
      const timestamp = Date.now();
      const uniqueId = `QID-${chapterId || 'BATCH'}-${index}-${timestamp}`;
      
      // Ensure all required properties exist with defaults if missing
      const processedQuestion = {
        questionId: questionObj.questionId || uniqueId,
        Q: questionObj.Q,
        question: questionObj.question,
        question_answered: questionObj.question_answered || false,
        question_marks: questionObj.question_marks || 1,
        marks_gained: questionObj.marks_gained || 0
      };
      
      questions.push(processedQuestion);
      
    } catch (error) {
      console.error(`Error parsing question at line ${index + 1}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`Processed ${questions.length} questions successfully with ${errorCount} errors and ${skippedCount} skipped by validation`);
  
  return questions;
}

/**
 * Select a random question from the question array
 * @param {Array} questions - Array of question objects
 * @param {boolean} unansweredOnly - Whether to select only from unanswered questions
 * @returns {Object|null} - A random question or null if no matching questions
 */
function getRandomQuestion(questions, unansweredOnly = false) {
  if (!questions || !questions.length) {
    console.log("No questions available");
    return null;
  }
  
  // Filter for unanswered questions if requested
  const availableQuestions = unansweredOnly 
    ? questions.filter(q => !q.question_answered) 
    : questions;
  
  if (!availableQuestions.length) {
    console.log("No unanswered questions available");
    return null;
  }
  
  // Select a random question
  const randomIndex = Math.floor(Math.random() * availableQuestions.length);
  return availableQuestions[randomIndex];
}

/**
 * Save questions to a file for testing
 * @param {Array} questions - Array of question objects
 * @param {string} outputPath - Path to save the output
 */
function saveQuestions(questions, outputPath) {
  try {
    const output = JSON.stringify(questions, null, 2);
    fs.writeFileSync(outputPath, output);
    console.log(`Questions saved to ${outputPath}`);
  } catch (error) {
    console.error("Error saving questions:", error);
  }
}

// Example usage
if (require.main === module) {
  // Sample usage with command line arguments
  const args = process.argv.slice(2);
  
  if (args.length >= 1) {
    try {
      // Read from file if provided
      const inputPath = args[0];
      const batchText = fs.readFileSync(inputPath, 'utf8');
      
      // Process the input
      processQuestionBatch(batchText).then(questions => {
        // Output path (optional)
        const outputPath = args[1] || path.join(__dirname, 'processed_questions.json');
        saveQuestions(questions, outputPath);
        
        // Select and display a random question
        const randomQuestion = getRandomQuestion(questions);
        console.log("\nRandom question example:");
        console.log(randomQuestion);
        
        // Count unanswered questions
        const unansweredCount = questions.filter(q => !q.question_answered).length;
        console.log(`\nTotal questions: ${questions.length}`);
        console.log(`Unanswered questions: ${unansweredCount}`);
      });
      
    } catch (error) {
      console.error("Error processing file:", error);
    }
  } else {
    console.log("Usage: node processQuestionBatch.js <inputFilePath> [outputFilePath]");
  }
}

module.exports = {
  processQuestionBatch,
  getRandomQuestion,
  validateQuestion
}; 
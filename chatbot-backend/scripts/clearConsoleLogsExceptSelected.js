const fs = require('fs');
const path = require('path');

// Check command line arguments
if (process.argv.length < 3) {
  console.error('Usage: node clearConsoleLogsExceptSelected.js <path-to-file>');
  process.exit(1);
}

// Get file path from command line arguments
const filePath = path.resolve(process.argv[2]);

try {
  // Read the file content
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Lines to keep (the important log statements)
  const logsToKeep = [
    'console.log(`Selected agent: "${classification}"`',
    'console.log(`FALLBACK: Using default agent "${classification}"`',
    'console.log(`Selected question: ID=${questionPrompt.questionId}',
    'console.log(`All questions answered. Selected random question: ID=${questionPrompt.questionId}'
  ];
  
  // Regular expression to match console.log statements
  // This matches all console.log statements that are not the ones we want to keep
  const regex = new RegExp(
    `console\\.log\\((?!(\`Selected agent: "\\\${classification}"\`|\`FALLBACK: Using default agent "\\\${classification}"\`|\`Selected question: ID=\\\${questionPrompt\\.questionId}.*\`|\`All questions answered\\. Selected random question: ID=\\\${questionPrompt\\.questionId}.*\`)).*\\)`,
    'g'
  );
  
  // Replace console.log statements with empty strings
  let modifiedContent = content.replace(regex, '// console.log removed');
  
  // Count replacements
  const originalLogCount = (content.match(/console\.log\(/g) || []).length;
  const modifiedLogCount = (modifiedContent.match(/console\.log\(/g) || []).length;
  const removedCount = originalLogCount - modifiedLogCount;
  
  // Write modified content back to the file
  fs.writeFileSync(filePath, modifiedContent);
  
  console.log(`Successfully processed ${filePath}`);
  console.log(`Removed ${removedCount} console.log statements`);
  console.log(`Kept ${modifiedLogCount} essential console.log statements`);
  
} catch (error) {
  console.error(`Error processing file: ${error.message}`);
  process.exit(1);
} 
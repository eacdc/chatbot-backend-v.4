// Function to clean response messages (remove LaTeX formatting)
const cleanMessageContent = (content) => {
  if (!content) return '';
  
  // Replace LaTeX formulas with more readable versions
  let cleanedContent = content
    // Handle specific complex formulas like the one provided in the example
    .replace(/\(\s*\\text\{Volume\}\s*=\s*\\frac\{\\text\{Mass\}\}\{\\text\{Density\}\}\s*\)/g, '(Volume = Mass/Density)')
    .replace(/\(\s*\\frac\{(\d+)\s*,\s*\\text\{([^}]+)\}\}\{([^}]+)\}\s*\\approx\s*([^)]+)\s*,\s*\\text\{([^}]+)\}\)/g, '($1 $2/$3 ≈ $4 $5)')
    
    // Handle parentheses in formulas
    .replace(/\(\s*\\text\{([^}]+)\}\s*=\s*\\frac\{([^}]+)\}\{([^}]+)\}\s*\)/g, '($1 = $2/$3)')
    .replace(/\(\s*\\frac\{([^}]+)\}\{([^}]+)\}\s*\\approx\s*([^)]+)\)/g, '($1/$2 ≈ $3)')
    
    // Replace \text{...} with just the text inside
    .replace(/\\text\{([^}]+)\}/g, '$1')
    
    // Replace \frac{a}{b} with a/b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    
    // Handle commas and units in LaTeX expressions
    .replace(/,\s*\\text\{([^}]+)\}/g, ' $1')
    
    // Replace [ ... ] LaTeX display math mode with italicized content
    // More aggressive replacement for square bracket LaTeX notation
    .replace(/\[\s*\\text\{([^}]+)\}\s*=\s*\\frac\{([^}]+)\}\{([^}]+)\}\s*\]/g, '*$1 = $2/$3*')
    .replace(/\[\s*([^\]]+)\s*\]/g, '*$1*')
    
    // Other LaTeX commands to clean up
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\mathbf\{([^}]+)\}/g, '**$1**')
    .replace(/\\mathit\{([^}]+)\}/g, '*$1*')
    .replace(/\\mathbb\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    
    // More complex LaTeX expressions - convert to simpler notation
    .replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, '\n\n$1\n\n')
    .replace(/\\begin\{align\}([\s\S]*?)\\end\{align\}/g, '\n\n$1\n\n')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    
    // Common LaTeX symbols
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\epsilon/g, 'ε')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\sum/g, '∑')
    .replace(/\\infty/g, '∞')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\geq/g, '≥')
    .replace(/\\leq/g, '≤');
    
  // Do a final pass to remove any remaining square bracket LaTeX that wasn't caught
  cleanedContent = cleanedContent.replace(/\[\s*\\[^\]]+\]/g, '*formula*');
  
  // Clean up any remaining unwanted characters or patterns
  cleanedContent = cleanedContent
    // Fix spaces around commas in numbers
    .replace(/(\d+)\s*,\s*(\d+)/g, '$1,$2')
    // Remove any leftover double spaces
    .replace(/\s{2,}/g, ' ');
    
  return cleanedContent;
}; 

mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    audioChunksRef.current.push(event.data);
  }
};

mediaRecorder.onstop = () => {
  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
  setAudioBlob(audioBlob);
  
  // Release the microphone
  stream.getTracks().forEach(track => track.stop());
  
  // Automatically send the audio message when recording stops
  setTimeout(() => sendAudioMessage(), 100);
}; 
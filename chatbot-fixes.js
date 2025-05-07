/* 
 * FIXES FOR ChatbotLayout.js
 * 
 * 1. Toggle Switch CSS - Replace the style block in the return statement
 */

// Toggle Switch CSS Fix - Line ~1272
<style>
  {`
    /* Toggle switch styles */
    .toggle-checkbox {
      transition: .3s;
      z-index: 1;
      position: absolute;
      left: 0;
    }
    
    .toggle-checkbox:checked {
      transform: translateX(100%);
      border-color: #3B82F6;
    }
    
    .toggle-label {
      transition: .3s;
    }
  `}
</style>

/* 
 * 2. Auto-send audio recording when stop recording is clicked
 */

// Replace the stopRecording function - Line ~723
const stopRecording = () => {
  if (mediaRecorderRef.current && isRecording) {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    
    // We'll automatically send the audio once it's ready
    // The audioBlob will be set in the mediaRecorder.onstop handler
    // and then we'll call sendAudioMessage
  }
};

// Update mediaRecorder.onstop inside startRecording function - Line ~668
mediaRecorder.onstop = () => {
  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
  setAudioBlob(audioBlob);
  
  // Release the microphone
  stream.getTracks().forEach(track => track.stop());
  
  // Automatically send the audio message when recording stops
  setTimeout(() => sendAudioMessage(), 100);
};

/* 
 * 3. Persist audio playback after reload
 */

// Add to the component near the beginning - Line ~50
// Save audio messages to localStorage when they're created or updated
useEffect(() => {
  // Create a serializable version of the audio messages
  const serializedAudioMessages = {};
  Object.entries(audioMessages).forEach(([id, url]) => {
    // We can't store blob URLs, so just store a flag that audio exists
    serializedAudioMessages[id] = true;
  });
  
  // Save to localStorage
  localStorage.setItem('audioMessagesInfo', JSON.stringify(serializedAudioMessages));
}, [audioMessages]);

// Load audio message info from localStorage on component mount
useEffect(() => {
  const savedAudioInfo = localStorage.getItem('audioMessagesInfo');
  if (savedAudioInfo) {
    try {
      const audioInfo = JSON.parse(savedAudioInfo);
      
      // Update chat history messages with audio flags based on saved info
      setChatHistory(prev => prev.map(msg => {
        if (msg.messageId && audioInfo[msg.messageId]) {
          return { ...msg, isAudio: true };
        }
        return msg;
      }));
    } catch (e) {
      console.error("Error parsing saved audio info:", e);
    }
  }
}, []);

// Inside the user chat message rendering - Line ~1790
// Modify to handle messages with isAudio=true but no audio URL
{msg.isAudio && (
  <div className="mt-2 flex items-center">
    {audioMessages[msg.messageId] ? (
      <audio 
        src={audioMessages[msg.messageId]} 
        controls 
        className="h-8 w-full max-w-[200px] opacity-75"
      />
    ) : (
      <div className="text-xs text-blue-300">
        [Audio message - Playback unavailable after page reload]
      </div>
    )}
  </div>
)} 
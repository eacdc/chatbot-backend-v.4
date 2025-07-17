// Increase Node.js heap memory limit to 8GB
process.env.NODE_OPTIONS = '--max-old-space-size=8192';

// Enable garbage collection
global.gc = function() {
  try {
    if (global.gc) {
      console.log("Triggering manual garbage collection");
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const startTime = Date.now();
      global.gc();
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(`GC completed in ${endTime - startTime}ms. Memory before: ${startMemory.toFixed(2)}MB, after: ${endMemory.toFixed(2)}MB, freed: ${(startMemory - endMemory).toFixed(2)}MB`);
    }
  } catch (e) {
    console.error("Error during garbage collection:", e);
  }
};

// Monitor memory usage
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(`Memory usage: RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB, Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  
  // Force garbage collection if memory usage is too high
  if (memoryUsage.heapUsed > 6 * 1024 * 1024 * 1024) { // 6GB threshold
    console.log("Memory usage is high, forcing garbage collection");
    global.gc && global.gc();
  }
}, 60000); // Check every minute

// ✅ Handle Uncaught Errors
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Promise Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  process.exit(1);
});

// Use the corrected app.js file
console.log("🚀 Starting server with corrected app.js configuration...");
require('./app.js');

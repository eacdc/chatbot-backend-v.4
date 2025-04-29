const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true,
    unique: true,
    enum: ['questionMode'] // List of valid configuration keys
  },
  value: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  description: { 
    type: String 
  }
}, { timestamps: true });

// Create default configurations if they don't exist
configSchema.statics.initDefaults = async function() {
  const defaults = [
    {
      key: 'questionMode',
      value: false, // Default to false (use traditional mode)
      description: 'When enabled, uses question-based prompts for chapters instead of full text prompts'
    }
  ];

  for (const config of defaults) {
    try {
      // Use updateOne with upsert instead of create to prevent duplicate errors
      // This will update if exists, or insert if not exists
      await this.updateOne(
        { key: config.key }, 
        { $setOnInsert: config },
        { upsert: true }
      );
      console.log(`Initialized default config for ${config.key}`);
    } catch (err) {
      console.error(`Error initializing config ${config.key}:`, err.message);
    }
  }
};

const Config = mongoose.model('Config', configSchema);

module.exports = Config; 
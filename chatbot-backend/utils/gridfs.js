const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
const { Readable } = require('stream');
const config = require('../config');

// Initialize global variables
let gfs;
let gridFSBucket;

// Set up GridFS connection
const setupGridFS = () => {
  try {
    // Initialize GridFS stream when mongoose connection is ready
    gfs = Grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection('audio_files');
    
    // Create GridFSBucket
    gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'audio_files'
    });
    
    console.log('GridFS setup complete for audio files');
  } catch (error) {
    console.error('GridFS setup error:', error);
  }
};

// Call setupGridFS after mongoose has connected
mongoose.connection.once('open', setupGridFS);

/**
 * Store audio file in GridFS
 * @param {Buffer} fileBuffer - The file buffer to store
 * @param {String} filename - The filename
 * @param {String} contentType - The content type of the file
 * @param {Object} metadata - Additional metadata for the file
 * @returns {Promise<String>} The file ID
 */
const storeAudio = async (fileBuffer, filename, contentType, metadata = {}) => {
  try {
    if (!gridFSBucket) {
      throw new Error('GridFS not initialized');
    }
    
    // Convert buffer to readable stream
    const readableStream = new Readable();
    readableStream.push(fileBuffer);
    readableStream.push(null);
    
    // Add timestamp to metadata
    const fileMetadata = {
      ...metadata,
      uploadDate: new Date()
    };
    
    // Create a unique filename with timestamp
    const uniqueFilename = `${Date.now()}-${filename}`;
    
    // Stream the file to GridFS
    const uploadStream = gridFSBucket.openUploadStream(uniqueFilename, {
      contentType: contentType,
      metadata: fileMetadata
    });
    
    // Return a promise that resolves with the file ID
    return new Promise((resolve, reject) => {
      readableStream.pipe(uploadStream)
        .on('error', error => {
          console.error('Error storing audio in GridFS:', error);
          reject(error);
        })
        .on('finish', () => {
          console.log(`Audio file stored with ID: ${uploadStream.id}`);
          resolve(uploadStream.id.toString());
        });
    });
    
  } catch (error) {
    console.error('Error in storeAudio:', error);
    throw error;
  }
};

/**
 * Get audio file stream from GridFS by ID
 * @param {String} fileId - The file ID to retrieve
 * @returns {Promise<Object>} The file stream and metadata
 */
const getAudioStream = async (fileId) => {
  try {
    if (!gridFSBucket) {
      throw new Error('GridFS not initialized');
    }
    
    // Convert string ID to ObjectId if needed
    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    
    // Get file info
    const files = await gfs.files.find({ _id: objectId }).toArray();
    
    if (!files || files.length === 0) {
      return null;
    }
    
    const file = files[0];
    
    // Create a download stream
    const downloadStream = gridFSBucket.openDownloadStream(objectId);
    
    return {
      filename: file.filename,
      contentType: file.contentType,
      stream: downloadStream,
      metadata: file.metadata,
      length: file.length,
      uploadDate: file.uploadDate
    };
    
  } catch (error) {
    console.error(`Error retrieving audio file with ID ${fileId}:`, error);
    throw error;
  }
};

/**
 * Get the URL for accessing an audio file
 * @param {String} fileId - The file ID
 * @returns {String} The URL for accessing the file
 */
const getAudioUrl = (fileId) => {
  // Use the API endpoint for audio files
  return `${config.API_URL}/api/chat/audio/${fileId}`;
};

/**
 * Delete an audio file from GridFS by ID
 * @param {String} fileId - The file ID to delete
 * @returns {Promise<Boolean>} Success status
 */
const deleteAudio = async (fileId) => {
  try {
    if (!gridFSBucket) {
      throw new Error('GridFS not initialized');
    }
    
    // Convert string ID to ObjectId if needed
    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    
    // Delete the file
    await gridFSBucket.delete(objectId);
    console.log(`Audio file with ID ${fileId} deleted`);
    return true;
    
  } catch (error) {
    console.error(`Error deleting audio file with ID ${fileId}:`, error);
    throw error;
  }
};

module.exports = {
  setupGridFS,
  storeAudio,
  getAudioStream,
  getAudioUrl,
  deleteAudio
}; 
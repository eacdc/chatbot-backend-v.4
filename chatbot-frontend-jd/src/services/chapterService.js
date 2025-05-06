import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const chapterService = {
  // Get all chapters
  getAllChapters: async (params) => {
    const response = await axios.get(ENDPOINTS.CHAPTERS.LIST, { params });
    return response.data;
  },

  // Get chapter by ID
  getChapterById: async (id) => {
    const response = await axios.get(ENDPOINTS.CHAPTERS.DETAIL.replace(':id', id));
    return response.data;
  },

  // Create new chapter
  createChapter: async (chapterData) => {
    const response = await axios.post(ENDPOINTS.CHAPTERS.CREATE, chapterData);
    return response.data;
  },

  // Update chapter
  updateChapter: async (id, chapterData) => {
    const response = await axios.put(
      ENDPOINTS.CHAPTERS.UPDATE.replace(':id', id),
      chapterData
    );
    return response.data;
  },

  // Delete chapter
  deleteChapter: async (id) => {
    const response = await axios.delete(ENDPOINTS.CHAPTERS.DELETE.replace(':id', id));
    return response.data;
  },

  // Process chapter text
  processChapterText: async (id, text) => {
    const response = await axios.post(
      `${ENDPOINTS.CHAPTERS.DETAIL.replace(':id', id)}/process`,
      { text }
    );
    return response.data;
  },

  // Generate Q&A for chapter
  generateQnA: async (id) => {
    const response = await axios.post(
      `${ENDPOINTS.CHAPTERS.DETAIL.replace(':id', id)}/qna`
    );
    return response.data;
  },

  // Get chapter Q&A
  getChapterQnA: async (id) => {
    const response = await axios.get(
      `${ENDPOINTS.CHAPTERS.DETAIL.replace(':id', id)}/qna`
    );
    return response.data;
  }
};

export default chapterService; 
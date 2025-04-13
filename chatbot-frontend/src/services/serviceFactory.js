import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

/**
 * Factory for creating API service methods with consistent error handling and configuration
 */
const serviceFactory = {
  /**
   * Creates a GET request method
   * @param {string} endpoint - API endpoint path
   * @param {boolean} requiresAuth - Whether the request requires authentication
   * @returns {Function} - Function that makes the GET request
   */
  createGet: (endpoint, requiresAuth = true) => {
    return async (params = {}) => {
      try {
        const response = await axios.get(endpoint, { params });
        return response.data;
      } catch (error) {
        console.error(`Error in GET request to ${endpoint}:`, error);
        throw error;
      }
    };
  },

  /**
   * Creates a POST request method
   * @param {string} endpoint - API endpoint path
   * @param {boolean} requiresAuth - Whether the request requires authentication
   * @returns {Function} - Function that makes the POST request
   */
  createPost: (endpoint, requiresAuth = true) => {
    return async (data = {}) => {
      try {
        const response = await axios.post(endpoint, data);
        return response.data;
      } catch (error) {
        console.error(`Error in POST request to ${endpoint}:`, error);
        throw error;
      }
    };
  },

  /**
   * Creates a PUT request method
   * @param {string} endpoint - API endpoint path
   * @param {boolean} requiresAuth - Whether the request requires authentication
   * @returns {Function} - Function that makes the PUT request
   */
  createPut: (endpoint, requiresAuth = true) => {
    return async (data = {}) => {
      try {
        const response = await axios.put(endpoint, data);
        return response.data;
      } catch (error) {
        console.error(`Error in PUT request to ${endpoint}:`, error);
        throw error;
      }
    };
  },

  /**
   * Creates a DELETE request method
   * @param {string} endpoint - API endpoint path
   * @param {boolean} requiresAuth - Whether the request requires authentication
   * @returns {Function} - Function that makes the DELETE request
   */
  createDelete: (endpoint, requiresAuth = true) => {
    return async (params = {}) => {
      try {
        const response = await axios.delete(endpoint, { params });
        return response.data;
      } catch (error) {
        console.error(`Error in DELETE request to ${endpoint}:`, error);
        throw error;
      }
    };
  },

  /**
   * Creates a PATCH request method
   * @param {string} endpoint - API endpoint path
   * @param {boolean} requiresAuth - Whether the request requires authentication
   * @returns {Function} - Function that makes the PATCH request
   */
  createPatch: (endpoint, requiresAuth = true) => {
    return async (data = {}) => {
      try {
        const response = await axios.patch(endpoint, data);
        return response.data;
      } catch (error) {
        console.error(`Error in PATCH request to ${endpoint}:`, error);
        throw error;
      }
    };
  },
  
  /**
   * Creates a service with standard CRUD operations
   * @param {string} basePath - Base API path for the resource
   * @param {boolean} requiresAuth - Whether the requests require authentication
   * @returns {Object} - Object with CRUD methods
   */
  createCrudService: (basePath, requiresAuth = true) => {
    return {
      getAll: serviceFactory.createGet(basePath, requiresAuth),
      getById: serviceFactory.createGet(`${basePath}/:id`, requiresAuth),
      create: serviceFactory.createPost(basePath, requiresAuth),
      update: serviceFactory.createPut(`${basePath}/:id`, requiresAuth),
      delete: serviceFactory.createDelete(`${basePath}/:id`, requiresAuth),
      
      // Helper to replace :id with actual ID in the endpoint
      _processEndpoint: (endpoint, id) => endpoint.replace(':id', id)
    };
  },
  
  /**
   * Creates a resource service with pagination support
   * @param {string} resourceName - Name of the resource (used in endpoint paths)
   * @param {boolean} requiresAuth - Whether the requests require authentication
   * @returns {Object} - Object with methods for the resource
   */
  createResourceService: (resourceName, requiresAuth = true) => {
    const basePath = ENDPOINTS[resourceName] || `/api/${resourceName}`;
    
    return {
      ...serviceFactory.createCrudService(basePath, requiresAuth),
      
      // Additional common methods
      search: serviceFactory.createGet(`${basePath}/search`, requiresAuth),
      export: serviceFactory.createGet(`${basePath}/export`, requiresAuth),
      import: serviceFactory.createPost(`${basePath}/import`, requiresAuth),
      stats: serviceFactory.createGet(`${basePath}/statistics`, requiresAuth)
    };
  }
};

export default serviceFactory; 
import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { API_CONFIG } from './config'

// Create the main axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  },
})

// Request interceptor to add authentication and workspace headers
apiClient.interceptors.request.use(
  (config) => {
    // Add authentication token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Add workspace header
    const workspaceId = localStorage.getItem('currentWorkspaceId')
    if (workspaceId) {
      config.headers['X-Workspace-ID'] = workspaceId
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error) => {
    // Handle common error scenarios
    if (error.response?.status === 401) {
      // Unauthorized - clear auth data and redirect to login
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('currentWorkspaceId')
      
      // Only redirect if not already on auth pages
      const currentPath = window.location.pathname
      if (!currentPath.startsWith('/auth')) {
        window.location.href = '/auth/login'
      }
    }
    
    return Promise.reject(error)
  }
)

// Helper function to handle API responses with standardized error handling
export const handleApiResponse = async <T>(
  apiCall: () => Promise<AxiosResponse<any>>
): Promise<T> => {
  try {
    const response = await apiCall()
    
    console.log('API Response received:', {
      status: response.status,
      success: response.data.success,
      message: response.data.message,
      hasData: !!response.data.data
    });
    
    // Handle successful responses
    if (response.data.success) {
      return response.data.data
    }
    
    // Handle unsuccessful responses with success: false
    console.error('API request failed with success: false', response.data);
    throw new Error(response.data.message || 'API request failed')
  } catch (error) {
    console.error('API call error:', error);
    
    // Handle axios errors
    if (axios.isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.message || `HTTP ${error.response.status}: ${error.response.statusText}`
      console.error('Axios error details:', {
        status: error.response.status,
        data: error.response.data,
        message: errorMessage
      });
      throw new Error(errorMessage)
    }
    
    // Handle network or other errors
    throw error
  }
}

// Helper function for making GET requests
export const apiGet = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  return handleApiResponse<T>(() => apiClient.get(url, config))
}

// Helper function for making POST requests
export const apiPost = async <T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  return handleApiResponse<T>(() => apiClient.post(url, data, config))
}

// Helper function for making PUT requests
export const apiPut = async <T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  return handleApiResponse<T>(() => apiClient.put(url, data, config))
}

// Helper function for making DELETE requests
export const apiDelete = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  return handleApiResponse<T>(() => apiClient.delete(url, config))
}

export default apiClient
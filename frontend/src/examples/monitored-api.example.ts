// Example: Integrating monitoring into an API service
import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { trackApiCall } from '../utils/monitoring';
import { captureException } from '../utils/logger';

type TimingMetadata = {
  startTime: number;
};

type ConfigWithMetadata = {
  metadata?: TimingMetadata;
};

const api = axios.create({
  baseURL: env.apiUrl,
  timeout: env.requestTimeoutMs,
});

// Request interceptor to track timing
api.interceptors.request.use((config) => {
  // Store request start time
  (config as ConfigWithMetadata).metadata = { startTime: performance.now() };
  return config;
});

// Response interceptor to track performance
api.interceptors.response.use(
  (response) => {
    const metadata = (response.config as ConfigWithMetadata).metadata;
    if (metadata?.startTime) {
      const duration = performance.now() - metadata.startTime;
      const endpoint = response.config.url || 'unknown';
      trackApiCall(endpoint, duration, response.status);
    }
    return response;
  },
  (error: AxiosError) => {
    const metadata = (error.config as ConfigWithMetadata | undefined)?.metadata;
    if (metadata?.startTime) {
      const duration = performance.now() - metadata.startTime;
      const endpoint = error.config?.url || 'unknown';
      const status = error.response?.status || 0;
      trackApiCall(endpoint, duration, status);
    }

    // Capture error in Sentry
    captureException(error, {
      endpoint: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
    });

    return Promise.reject(error);
  }
);

export default api;

// Usage example:
// import api from '@/services/monitored-api';
// const response = await api.get('/messages');
// API call automatically tracked with performance metrics

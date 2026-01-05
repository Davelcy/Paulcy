// API wrapper for external supplier with retry logic
const axios = require('axios');
const axiosRetry = require('axios-retry');
const { EXO_API_KEY, EXO_API_BASE } = require('../config');

const client = axios.create({
  baseURL: EXO_API_BASE,
  timeout: 10000,
  headers: {
    'Authorization': `Bearer ${EXO_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Retry on network errors or 5xx, up to 3 retries
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx
    return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error) || (error.response && error.response.status >= 500);
  }
});

async function createOrder(serviceId, link, quantity) {
  // Adjust body according to provider API; generic wrapper
  try {
    const body = { service: serviceId, link, quantity };
    const res = await client.post('/order', body);
    return res.data;
  } catch (err) {
    // Provide consistent error
    throw new Error(`Exo API error: ${err.response ? err.response.status + ' ' + JSON.stringify(err.response.data) : err.message}`);
  }
}

async function getServices() {
  try {
    const res = await client.get('/services');
    return res.data;
  } catch (err) {
    // If API fails, return empty and allow local services fallback
    return { error: err.message };
  }
}

module.exports = {
  createOrder,
  getServices
};

const express = require('express');
const fs = require('fs');
const axios = require('axios');

const cors = require('cors');
const app = express();
const port = 8000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Read API key from Docker secret
const apiKeyPath = '/run/secrets/spoonacular_key';
const spoonacularKey = fs.readFileSync(apiKeyPath, 'utf-8').trim();

// Service URLs - Try different approaches based on Docker setup
const getServiceUrl = (port) => {
  // Try these in order: host.docker.internal, then host IP
  const hostOptions = [
    'host.docker.internal',
    '172.17.0.1',  // Default Docker bridge gateway
    '192.168.65.1', // Docker Desktop on Mac
    '192.168.1.1'   // Common router IP - you may need to change this
  ];

  return `http://${hostOptions[0]}:${port}`;
};

const CHAT_SERVICE_URL = getServiceUrl(8100);
const KULKASKU_SERVICE_URL = getServiceUrl(8200);
const PROFILE_SERVICE_URL = getServiceUrl(8300);

// Helper function to forward requests with timeout
const forwardRequest = async (req, res, serviceUrl, path) => {
  try {
    const url = `${serviceUrl}${path}`;

    // Clean headers - remove problematic ones
    const cleanHeaders = {};
    Object.keys(req.headers).forEach(key => {
      if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        cleanHeaders[key] = req.headers[key];
      }
    });

    const config = {
      method: req.method,
      url: url,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...cleanHeaders
      },
      timeout: 30000, // Increased timeout for AI requests
      validateStatus: function (status) {
        return status < 500; // Accept any status less than 500
      }
    };

    // Include query parameters
    if (Object.keys(req.query).length > 0) {
      config.params = req.query;
    }

    // Include request body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      config.data = req.body;
      console.log(`📤 Request body:`, JSON.stringify(req.body, null, 2));
    }

    console.log(`🔄 Forwarding ${req.method} ${url}`);
    console.log(`📋 Query params:`, req.query);

    const response = await axios(config);
    console.log(`✅ Success ${req.method} ${url} - Status: ${response.status}`);

    // Set response headers
    res.status(response.status);
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    // Send response
    res.json(response.data);

  } catch (error) {
    console.error(`❌ Error forwarding to ${serviceUrl}${path}:`, error.message);

    if (error.response) {
      console.error(`❌ Response status:`, error.response.status);
      console.error(`❌ Response data:`, error.response.data);
    }

    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'Service unavailable',
        details: `Cannot connect to ${serviceUrl}${path}`,
        suggestion: 'Make sure the service is running on your host machine'
      });
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      res.status(408).json({
        error: 'Request timeout',
        details: `Service at ${serviceUrl}${path} did not respond within 30 seconds`
      });
    } else if (error.response) {
      res.status(error.response.status).json(error.response.data || { error: 'Service error' });
    } else {
      res.status(500).json({
        error: 'Service unavailable',
        details: error.message,
        code: error.code
      });
    }
  }
};

// === EXISTING SPOONACULAR API ROUTE (UNCHANGED) ===
app.get('/recipes', async (req, res) => {
  const query = req.query.query || 'pasta';

  try {
    const response = await axios.get('https://api.spoonacular.com/recipes/complexSearch', {
      params: {
        query,
        number: 5,
        apiKey: spoonacularKey,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// === CHAT SERVICE ROUTES (Port 8100) ===
// Recipe management - FIXED: Remove /chat prefix
app.post('/chat/recipes', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, '/recipes');
});

app.get('/chat/recipes/:id', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, `/recipes/${req.params.id}`);
});

// Image upload - FIXED: Remove /chat prefix
app.post('/chat/upload', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, '/upload');
});

// Recipe generation - FIXED: Remove /chat prefix and validate request body
app.post('/chat/recipes/generate', (req, res) => {
  // Validate request body structure
  const { ingredients, cuisine, diet } = req.body;

  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({
      error: 'Invalid request format',
      details: 'ingredients field is required and must be a non-empty array'
    });
  }

  console.log(`🔍 Recipe generation request:`, {
    ingredients,
    cuisine: cuisine || 'not specified',
    diet: diet || 'not specified'
  });

  forwardRequest(req, res, CHAT_SERVICE_URL, '/recipes/generate');
});

// === KULKASKU SERVICE ROUTES (Port 8200) ===
// Ingredient management
app.post('/ingredients', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, '/addingredients');
});

app.get('/ingredients', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, '/getingredients');
});

app.delete('/ingredients/:id', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, `/ingredients/${req.params.id}`);
});

// Get recipes based on ingredients
app.get('/ingredients/recipes', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, '/recipes');
});

// Health check for kulkasku service
app.get('/kulkasku/health', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, '/health');
});

// === PROFILE SERVICE ROUTES (Port 8300) ===
// User management
app.get('/users', (req, res) => {
  forwardRequest(req, res, PROFILE_SERVICE_URL, '/users');
});

// Profile service health check
app.get('/profile/health', (req, res) => {
  forwardRequest(req, res, PROFILE_SERVICE_URL, '/');
});

// === API GATEWAY HEALTH CHECK ===
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API Gateway is running',
    timestamp: new Date().toISOString(),
    services: {
      chat: `${CHAT_SERVICE_URL}`,
      kulkasku: `${KULKASKU_SERVICE_URL}`,
      profile: `${PROFILE_SERVICE_URL}`
    }
  });
});

// === TEST ENDPOINT FOR CHAT SERVICE ===
app.post('/test/generate', async (req, res) => {
  const testData = {
    ingredients: ["chicken", "rice", "onion"],
    cuisine: "Asian",
    diet: "regular"
  };

  try {
    const response = await axios.post(`${CHAT_SERVICE_URL}/recipes/generate`, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    res.json({
      message: 'Direct test to chat service successful',
      response: response.data
    });
  } catch (error) {
    res.status(500).json({
      message: 'Direct test to chat service failed',
      error: error.message,
      response: error.response?.data || 'No response data'
    });
  }
});

// === DEBUG ENDPOINT ===
app.get('/debug/services', async (req, res) => {
  const testServices = async () => {
    const services = [
      { name: 'kulkasku-health', url: `${KULKASKU_SERVICE_URL}/health` },
      { name: 'profile-root', url: PROFILE_SERVICE_URL },
      { name: 'chat-test', url: `${CHAT_SERVICE_URL}/recipes/test123` } // Test a specific endpoint
    ];

    const results = {};

    for (const service of services) {
      try {
        console.log(`Testing ${service.name} at ${service.url}`);
        const response = await axios.get(service.url, {
          timeout: 5000,
          validateStatus: function (status) {
            return status < 500; // Accept 404, etc.
          }
        });
        results[service.name] = {
          status: 'reachable',
          url: service.url,
          httpStatus: response.status,
          data: typeof response.data === 'string' ? response.data.substring(0, 100) : JSON.stringify(response.data).substring(0, 100)
        };
      } catch (error) {
        results[service.name] = {
          status: 'unreachable',
          url: service.url,
          error: error.code || error.message,
          response: error.response?.status || 'no response'
        };
      }
    }

    return results;
  };

  const serviceStatus = await testServices();
  res.json({
    message: 'Service connectivity test',
    results: serviceStatus,
    note: 'Testing specific endpoints that should exist'
  });
});

// === ROOT ENDPOINT ===
app.get('/', (req, res) => {
  res.json({
    message: 'API Gateway for Recipe Management System',
    version: '1.0.0',
    endpoints: {
      spoonacular: 'GET /recipes?query=<search_term>',
      chat_service: {
        create_recipe: 'POST /chat/recipes',
        get_recipe: 'GET /chat/recipes/:id',
        upload_image: 'POST /chat/upload',
        generate_recipe: 'POST /chat/recipes/generate'
      },
      kulkasku_service: {
        add_ingredient: 'POST /ingredients',
        get_ingredients: 'GET /ingredients?user_id=<user_id>',
        delete_ingredient: 'DELETE /ingredients/:id',
        get_recipes_from_ingredients: 'GET /ingredients/recipes?user_id=<user_id>'
      },
      profile_service: {
        get_users: 'GET /users'
      },
      health_checks: {
        gateway: 'GET /health',
        kulkasku: 'GET /kulkasku/health',
        profile: 'GET /profile/health'
      },
      test: {
        direct_chat_test: 'POST /test/generate'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Gateway Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(port, () => {
  console.log(`🚀 API Gateway running at http://localhost:${port}`);
  console.log(`📋 Available services:`);
  console.log(`   - Chat Service: ${CHAT_SERVICE_URL}`);
  console.log(`   - Kulkasku Service: ${KULKASKU_SERVICE_URL}`);
  console.log(`   - Profile Service: ${PROFILE_SERVICE_URL}`);
  console.log(`\n🧪 Test the chat service directly with:`);
  console.log(`   curl -X POST http://localhost:${port}/test/generate`);
});
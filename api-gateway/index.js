// const express = require('express');
// const fs = require('fs');
// const axios = require('axios');

// const cors = require('cors');
// const app = express();
// const port = 8000;

// app.use(cors({
//   origin: '*',
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));

// app.use(express.json());

// // Read API key from Docker secret
// const apiKeyPath = '/run/secrets/spoonacular_key';
// const spoonacularKey = fs.readFileSync(apiKeyPath, 'utf-8').trim();

// // Service URLs - Try different approaches based on Docker setup
// const getServiceUrl = (port) => {
//   // Try these in order: host.docker.internal, then host IP
//   const hostOptions = [
//     'host.docker.internal',
//     '172.17.0.1',  // Default Docker bridge gateway
//     '192.168.65.1', // Docker Desktop on Mac
//     '192.168.1.1'   // Common router IP - you may need to change this
//   ];

//   return `http://${hostOptions[0]}:${port}`;
// };

// const CHAT_SERVICE_URL = getServiceUrl(8100);
// const KULKASKU_SERVICE_URL = getServiceUrl(8200);
// const PROFILE_SERVICE_URL = getServiceUrl(8300);

// // Helper function to forward requests with timeout
// const forwardRequest = async (req, res, serviceUrl, path) => {
//   try {
//     const url = `${serviceUrl}${path}`;

//     // Clean headers - remove problematic ones
//     const cleanHeaders = {};
//     Object.keys(req.headers).forEach(key => {
//       if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
//         cleanHeaders[key] = req.headers[key];
//       }
//     });

//     const config = {
//       method: req.method,
//       url: url,
//       headers: {
//         'Content-Type': 'application/json',
//         'Accept': 'application/json',
//         ...cleanHeaders
//       },
//       timeout: 30000, // Increased timeout for AI requests
//       validateStatus: function (status) {
//         return status < 500; // Accept any status less than 500
//       }
//     };

//     // Include query parameters
//     if (Object.keys(req.query).length > 0) {
//       config.params = req.query;
//     }

//     // Include request body for POST, PUT, PATCH
//     if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
//       config.data = req.body;
//       console.log(`📤 Request body:`, JSON.stringify(req.body, null, 2));
//     }

//     console.log(`🔄 Forwarding ${req.method} ${url}`);
//     console.log(`📋 Query params:`, req.query);

//     const response = await axios(config);
//     console.log(`✅ Success ${req.method} ${url} - Status: ${response.status}`);

//     // Set response headers
//     res.status(response.status);
//     if (response.headers['content-type']) {
//       res.set('Content-Type', response.headers['content-type']);
//     }

//     // Send response
//     res.json(response.data);

//   } catch (error) {
//     console.error(`❌ Error forwarding to ${serviceUrl}${path}:`, error.message);

//     if (error.response) {
//       console.error(`❌ Response status:`, error.response.status);
//       console.error(`❌ Response data:`, error.response.data);
//     }

//     if (error.code === 'ECONNREFUSED') {
//       res.status(503).json({
//         error: 'Service unavailable',
//         details: `Cannot connect to ${serviceUrl}${path}`,
//         suggestion: 'Make sure the service is running on your host machine'
//       });
//     } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
//       res.status(408).json({
//         error: 'Request timeout',
//         details: `Service at ${serviceUrl}${path} did not respond within 30 seconds`
//       });
//     } else if (error.response) {
//       res.status(error.response.status).json(error.response.data || { error: 'Service error' });
//     } else {
//       res.status(500).json({
//         error: 'Service unavailable',
//         details: error.message,
//         code: error.code
//       });
//     }
//   }
// };

// // === EXISTING SPOONACULAR API ROUTE (UNCHANGED) ===
// app.get('/recipes', async (req, res) => {
//   const query = req.query.query || 'pasta';

//   try {
//     const response = await axios.get('https://api.spoonacular.com/recipes/complexSearch', {
//       params: {
//         query,
//         number: 5,
//         apiKey: spoonacularKey,
//       },
//     });

//     res.json(response.data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch recipes' });
//   }
// });

// // === SPOONACULAR RECIPE DETAIL ROUTE ===
// app.get('/recipes/:id', async (req, res) => {
//   const recipeId = req.params.id;

//   try {
//     const response = await axios.get(`https://api.spoonacular.com/recipes/${recipeId}/information`, {
//       params: {
//         apiKey: spoonacularKey,
//       },
//     });

//     res.json(response.data);
//   } catch (err) {
//     console.error(`❌ Failed to fetch recipe detail for ID ${recipeId}:`, err.message);
//     res.status(500).json({ error: 'Failed to fetch recipe details' });
//   }
// });


// // === CHAT SERVICE ROUTES (Port 8100) ===
// // Recipe management - Complete CRUD operations
// app.post('/chat/recipes', (req, res) => {
//   forwardRequest(req, res, CHAT_SERVICE_URL, '/recipes');
// });

// app.get('/chat/recipes', (req, res) => {
//   forwardRequest(req, res, CHAT_SERVICE_URL, '/recipes');
// });

// app.get('/chat/recipes/:id', (req, res) => {
//   forwardRequest(req, res, CHAT_SERVICE_URL, `/recipes/${req.params.id}`);
// });

// app.put('/chat/recipes/:id', (req, res) => {
//   forwardRequest(req, res, CHAT_SERVICE_URL, `/recipes/${req.params.id}`);
// });

// app.delete('/chat/recipes/:id', (req, res) => {
//   forwardRequest(req, res, CHAT_SERVICE_URL, `/recipes/${req.params.id}`);
// });

// // Image upload
// app.post('/chat/upload', (req, res) => {
//   forwardRequest(req, res, CHAT_SERVICE_URL, '/upload');
// });

// // Recipe generation - AI-powered recipe creation
// app.post('/chat/recipes/generate', (req, res) => {
//   // Validate request body structure
//   const { ingredients, cuisine, diet } = req.body;

//   if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
//     return res.status(400).json({
//       error: 'Invalid request format',
//       details: 'ingredients field is required and must be a non-empty array'
//     });
//   }

//   console.log(`🔍 Recipe generation request:`, {
//     ingredients,
//     cuisine: cuisine || 'not specified',
//     diet: diet || 'not specified'
//   });

//   forwardRequest(req, res, CHAT_SERVICE_URL, '/recipes/generate');
// });

// // Health check for chat service
// app.get('/chat/health', (req, res) => {
//   forwardRequest(req, res, CHAT_SERVICE_URL, '/health');
// });

// // === KULKASKU SERVICE ROUTES (Port 8200) ===
// // Ingredient management
// app.post('/ingredients', (req, res) => {
//   forwardRequest(req, res, KULKASKU_SERVICE_URL, '/addingredients');
// });

// app.get('/ingredients', (req, res) => {
//   forwardRequest(req, res, KULKASKU_SERVICE_URL, '/getingredients');
// });

// app.get('/ingredients/:id', (req, res) => {
//   forwardRequest(req, res, KULKASKU_SERVICE_URL, `/ingredients/${req.params.id}`);
// });

// app.put('/ingredients/:id', (req, res) => {
//   forwardRequest(req, res, KULKASKU_SERVICE_URL, `/ingredients/${req.params.id}`);
// });

// app.delete('/ingredients/:id', (req, res) => {
//   forwardRequest(req, res, KULKASKU_SERVICE_URL, `/ingredients/${req.params.id}`);
// });

// // Get recipes based on ingredients
// app.get('/ingredients/recipes', (req, res) => {
//   forwardRequest(req, res, KULKASKU_SERVICE_URL, '/recipes');
// });

// // Health check for kulkasku service
// app.get('/kulkasku/health', (req, res) => {
//   forwardRequest(req, res, KULKASKU_SERVICE_URL, '/health');
// });

// // === PROFILE SERVICE ROUTES (Port 8300) ===
// // User management
// app.get('/users', (req, res) => {
//   forwardRequest(req, res, PROFILE_SERVICE_URL, '/users');
// });

// app.get('/users/:id', (req, res) => {
//   forwardRequest(req, res, PROFILE_SERVICE_URL, `/users/${req.params.id}`);
// });

// // Profile service health check
// app.get('/profile/health', (req, res) => {
//   forwardRequest(req, res, PROFILE_SERVICE_URL, '/');
// });

// // === API GATEWAY HEALTH CHECK ===
// app.get('/health', (req, res) => {
//   res.json({
//     status: 'OK',
//     message: 'API Gateway is running',
//     timestamp: new Date().toISOString(),
//     services: {
//       chat: `${CHAT_SERVICE_URL}`,
//       kulkasku: `${KULKASKU_SERVICE_URL}`,
//       profile: `${PROFILE_SERVICE_URL}`
//     }
//   });
// });

// // === TEST ENDPOINT FOR CHAT SERVICE ===
// app.post('/test/generate', async (req, res) => {
//   const testData = {
//     ingredients: ["chicken", "rice", "onion"],
//     cuisine: "Asian",
//     diet: "regular"
//   };

//   try {
//     const response = await axios.post(`${CHAT_SERVICE_URL}/recipes/generate`, testData, {
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       timeout: 30000
//     });

//     res.json({
//       message: 'Direct test to chat service successful',
//       response: response.data
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: 'Direct test to chat service failed',
//       error: error.message,
//       response: error.response?.data || 'No response data'
//     });
//   }
// });

// // === DEBUG ENDPOINT ===
// app.get('/debug/services', async (req, res) => {
//   const testServices = async () => {
//     const services = [
//       { name: 'kulkasku-health', url: `${KULKASKU_SERVICE_URL}/health` },
//       { name: 'profile-root', url: PROFILE_SERVICE_URL },
//       { name: 'chat-test', url: `${CHAT_SERVICE_URL}/recipes/test123` } // Test a specific endpoint
//     ];

//     const results = {};

//     for (const service of services) {
//       try {
//         console.log(`Testing ${service.name} at ${service.url}`);
//         const response = await axios.get(service.url, {
//           timeout: 5000,
//           validateStatus: function (status) {
//             return status < 500; // Accept 404, etc.
//           }
//         });
//         results[service.name] = {
//           status: 'reachable',
//           url: service.url,
//           httpStatus: response.status,
//           data: typeof response.data === 'string' ? response.data.substring(0, 100) : JSON.stringify(response.data).substring(0, 100)
//         };
//       } catch (error) {
//         results[service.name] = {
//           status: 'unreachable',
//           url: service.url,
//           error: error.code || error.message,
//           response: error.response?.status || 'no response'
//         };
//       }
//     }

//     return results;
//   };

//   const serviceStatus = await testServices();
//   res.json({
//     message: 'Service connectivity test',
//     results: serviceStatus,
//     note: 'Testing specific endpoints that should exist'
//   });
// });

// // === ROOT ENDPOINT ===
// app.get('/', (req, res) => {
//   res.json({
//     message: 'API Gateway for Recipe Management System',
//     version: '1.0.0',
//     endpoints: {
//       spoonacular: 'GET /recipes?query=<search_term>',
//       chat_service: {
//         create_recipe: 'POST /chat/recipes',
//         list_recipes: 'GET /chat/recipes',
//         get_recipe: 'GET /chat/recipes/:id',
//         update_recipe: 'PUT /chat/recipes/:id',
//         delete_recipe: 'DELETE /chat/recipes/:id',
//         upload_image: 'POST /chat/upload',
//         generate_recipe: 'POST /chat/recipes/generate'
//       },
//       kulkasku_service: {
//         add_ingredient: 'POST /ingredients',
//         get_ingredients: 'GET /ingredients?user_id=<user_id>',
//         get_ingredient_by_id: 'GET /ingredients/:id',
//         update_ingredient: 'PUT /ingredients/:id',
//         delete_ingredient: 'DELETE /ingredients/:id',
//         get_recipes_from_ingredients: 'GET /ingredients/recipes?user_id=<user_id>'
//       },
//       profile_service: {
//         get_users: 'GET /users'
//       },
//       health_checks: {
//         gateway: 'GET /health',
//         chat: 'GET /chat/health',
//         kulkasku: 'GET /kulkasku/health',
//         profile: 'GET /profile/health'
//       },
//       test: {
//         direct_chat_test: 'POST /test/generate'
//       }
//     }
//   });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error('API Gateway Error:', err);
//   res.status(500).json({ error: 'Internal server error' });
// });

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({ error: 'Endpoint not found' });
// });

// app.listen(port, () => {
//   console.log(`🚀 API Gateway running at http://localhost:${port}`);
//   console.log(`📋 Available services:`);
//   console.log(`   - Chat Service: ${CHAT_SERVICE_URL}`);
//   console.log(`   - Kulkasku Service: ${KULKASKU_SERVICE_URL}`);
//   console.log(`   - Profile Service: ${PROFILE_SERVICE_URL}`);
//   console.log(`\n🧪 Test the chat service directly with:`);
//   console.log(`   curl -X POST http://localhost:${port}/test/generate`);
// });

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

// Read API keys from Docker secrets
const apiKeyPath = '/run/secrets/spoonacular_key';
const spoonacularKey = fs.readFileSync(apiKeyPath, 'utf-8').trim();

// Read YouTube API key from Docker secret
const youtubeKeyPath = '/run/secrets/youtube_key';
const youtubeKey = fs.readFileSync(youtubeKeyPath, 'utf-8').trim();

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

// === SPOONACULAR RECIPE DETAIL ROUTE ===
app.get('/recipes/:id', async (req, res) => {
  const recipeId = req.params.id;

  try {
    const response = await axios.get(`https://api.spoonacular.com/recipes/${recipeId}/information`, {
      params: {
        apiKey: spoonacularKey,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error(`❌ Failed to fetch recipe detail for ID ${recipeId}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch recipe details' });
  }
});

// === YOUTUBE API ROUTES ===
// Search YouTube videos
app.get('/youtube/search', async (req, res) => {
  const query = req.query.q || req.query.query;
  const maxResults = req.query.maxResults || req.query.part || 5;
  const type = req.query.type || 'video';
  const part = req.query.part || 'snippet';

  // Validate required parameters
  if (!query) {
    return res.status(400).json({
      error: 'Missing required parameter',
      details: 'Query parameter "q" or "query" is required',
      example: '/youtube/search?q=soto ayam'
    });
  }

  try {
    console.log(`🔍 YouTube search request: "${query}" (maxResults: ${maxResults})`);

    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: youtubeKey,
        q: query,
        part: part,
        type: type,
        maxResults: maxResults,
        order: 'relevance'
      },
      timeout: 15000
    });

    console.log(`✅ YouTube API success: Found ${response.data.items?.length || 0} results`);

    // Add additional metadata to response
    const responseData = {
      ...response.data,
      searchQuery: query,
      searchTimestamp: new Date().toISOString(),
      totalResults: response.data.pageInfo?.totalResults || 0,
      resultsPerPage: response.data.pageInfo?.resultsPerPage || 0
    };

    res.json(responseData);

  } catch (err) {
    console.error(`❌ YouTube API error:`, err.message);
    
    if (err.response) {
      console.error(`❌ YouTube API response status:`, err.response.status);
      console.error(`❌ YouTube API response data:`, err.response.data);
      
      // Handle specific YouTube API errors
      if (err.response.status === 403) {
        return res.status(403).json({
          error: 'YouTube API quota exceeded or invalid API key',
          details: err.response.data?.error?.message || 'API key might be invalid or quota exceeded',
          code: err.response.data?.error?.code
        });
      } else if (err.response.status === 400) {
        return res.status(400).json({
          error: 'Invalid YouTube API request',
          details: err.response.data?.error?.message || 'Check your request parameters',
          code: err.response.data?.error?.code
        });
      }
      
      res.status(err.response.status).json({
        error: 'YouTube API error',
        details: err.response.data?.error?.message || err.message,
        code: err.response.data?.error?.code
      });
    } else {
      res.status(500).json({
        error: 'Failed to fetch YouTube videos',
        details: err.message,
        suggestion: 'Check your internet connection and YouTube API key'
      });
    }
  }
});

// Get YouTube video details by ID
app.get('/youtube/video/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  const part = req.query.part || 'snippet,statistics,contentDetails';

  if (!videoId) {
    return res.status(400).json({
      error: 'Missing video ID',
      details: 'Video ID is required in the URL path'
    });
  }

  try {
    console.log(`🔍 YouTube video detail request: ${videoId}`);

    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: youtubeKey,
        id: videoId,
        part: part
      },
      timeout: 15000
    });

    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({
        error: 'Video not found',
        details: `No video found with ID: ${videoId}`
      });
    }

    console.log(`✅ YouTube video detail success: ${videoId}`);
    res.json(response.data);

  } catch (err) {
    console.error(`❌ YouTube video detail error:`, err.message);
    
    if (err.response) {
      res.status(err.response.status).json({
        error: 'YouTube API error',
        details: err.response.data?.error?.message || err.message
      });
    } else {
      res.status(500).json({
        error: 'Failed to fetch video details',
        details: err.message
      });
    }
  }
});

// Get YouTube channel information
app.get('/youtube/channel/:channelId', async (req, res) => {
  const channelId = req.params.channelId;
  const part = req.query.part || 'snippet,statistics';

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        key: youtubeKey,
        id: channelId,
        part: part
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error(`❌ Failed to fetch channel info for ${channelId}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch channel information' });
  }
});

// === CHAT SERVICE ROUTES (Port 8100) ===
// Recipe management - Complete CRUD operations
app.post('/chat/recipes', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, '/recipes');
});

app.get('/chat/recipes', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, '/recipes');
});

app.get('/chat/recipes/:id', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, `/recipes/${req.params.id}`);
});

app.put('/chat/recipes/:id', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, `/recipes/${req.params.id}`);
});

app.delete('/chat/recipes/:id', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, `/recipes/${req.params.id}`);
});

// Image upload
app.post('/chat/upload', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, '/upload');
});

// Recipe generation - AI-powered recipe creation
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

// Health check for chat service
app.get('/chat/health', (req, res) => {
  forwardRequest(req, res, CHAT_SERVICE_URL, '/health');
});

// === KULKASKU SERVICE ROUTES (Port 8200) ===
// Ingredient management
app.post('/ingredients', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, '/addingredients');
});

app.get('/ingredients', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, '/getingredients');
});

app.get('/ingredients/:id', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, `/ingredients/${req.params.id}`);
});

app.put('/ingredients/:id', (req, res) => {
  forwardRequest(req, res, KULKASKU_SERVICE_URL, `/ingredients/${req.params.id}`);
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

app.get('/users/:id', (req, res) => {
  forwardRequest(req, res, PROFILE_SERVICE_URL, `/users/${req.params.id}`);
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

// === TEST ENDPOINT FOR YOUTUBE API ===
app.get('/test/youtube', async (req, res) => {
  try {
    const testQuery = 'soto ayam';
    const response = await axios.get(`http://localhost:${port}/youtube/search?q=${encodeURIComponent(testQuery)}`);
    
    res.json({
      message: 'YouTube API test successful',
      testQuery: testQuery,
      foundResults: response.data.items?.length || 0,
      response: response.data
    });
  } catch (error) {
    res.status(500).json({
      message: 'YouTube API test failed',
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
      youtube: {
        search_videos: 'GET /youtube/search?q=<search_term>&maxResults=<number>',
        video_details: 'GET /youtube/video/:videoId',
        channel_info: 'GET /youtube/channel/:channelId'
      },
      chat_service: {
        create_recipe: 'POST /chat/recipes',
        list_recipes: 'GET /chat/recipes',
        get_recipe: 'GET /chat/recipes/:id',
        update_recipe: 'PUT /chat/recipes/:id',
        delete_recipe: 'DELETE /chat/recipes/:id',
        upload_image: 'POST /chat/upload',
        generate_recipe: 'POST /chat/recipes/generate'
      },
      kulkasku_service: {
        add_ingredient: 'POST /ingredients',
        get_ingredients: 'GET /ingredients?user_id=<user_id>',
        get_ingredient_by_id: 'GET /ingredients/:id',
        update_ingredient: 'PUT /ingredients/:id',
        delete_ingredient: 'DELETE /ingredients/:id',
        get_recipes_from_ingredients: 'GET /ingredients/recipes?user_id=<user_id>'
      },
      profile_service: {
        get_users: 'GET /users'
      },
      health_checks: {
        gateway: 'GET /health',
        chat: 'GET /chat/health',
        kulkasku: 'GET /kulkasku/health',
        profile: 'GET /profile/health'
      },
      test: {
        direct_chat_test: 'POST /test/generate',
        youtube_test: 'GET /test/youtube'
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
  console.log(`\n🧪 Test the services directly with:`);
  console.log(`   curl -X POST http://localhost:${port}/test/generate`);
  console.log(`   curl -X GET "http://localhost:${port}/test/youtube"`);
  console.log(`   curl -X GET "http://localhost:${port}/youtube/search?q=soto"`);
});
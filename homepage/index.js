const express = require('express');
const fs = require('fs');
const axios = require('axios');

const app = express();
const port = 3000;

// Read API key from Docker secret
const apiKeyPath = '/run/secrets/spoonacular_key.txt';
const spoonacularKey = fs.readFileSync(apiKeyPath, 'utf-8').trim();

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

app.listen(port, () => {
  console.log(`Server running at http://localhost:3000`);
});
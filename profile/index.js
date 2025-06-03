const express = require('express');
const mysql = require('mysql2/promise'); // pake promise version biar mudah async/await
require('dotenv').config();

const app = express();
const port = 8300;

const dbConfig = {
  host: process.env.NODE_DB_HOST || 'localhost',
  port: process.env.NODE_DB_PORT || 3306,
  user: process.env.NODE_DB_USER || 'root',
  password: process.env.NODE_DB_PASSWORD || 'password123',
  database: process.env.NODE_DB_NAME || 'mydatabase',
};

let connection;

async function connectWithRetry() {
  while (!connection) {
    try {
      connection = await mysql.createConnection(dbConfig);
      console.log('✅ Connected to DB');

      // Auto-create tabel jika belum ada
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL
        )
      `);
      console.log('✅ Table users ready');

    } catch (err) {
      console.error('❌ Failed to connect to DB. Retrying in 5 seconds...', err.message);
      connection = null;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}

app.get('/', (req, res) => {
  res.send('🟢 Profile service is running');
});

app.get('/users', async (req, res) => {
  try {
    const [rows] = await connection.execute('SELECT * FROM users');
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching users:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

(async () => {
  await connectWithRetry();

  app.listen(port, () => {
    console.log(`🚀 Profile service listening at http://localhost:${port}`);
  });
})();

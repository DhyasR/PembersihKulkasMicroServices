const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = 8300;

// Middleware
app.use(express.json());

let connection;

const dbConfig = {
  host: process.env.NODE_DB_HOST || 'localhost',
  port: process.env.NODE_DB_PORT || 3306,
  user: process.env.NODE_DB_USER || 'root',
  password: process.env.NODE_DB_PASSWORD || 'password123',
  database: process.env.NODE_DB_NAME || 'myprofiledb',
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
};

// Function to initialize database connection and create tables
async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Create users table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Users table created/verified');

    // Insert sample data if table is empty
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      const insertSampleData = `
        INSERT INTO users (name, email) VALUES 
        ('John Doe', 'john@example.com'),
        ('Jane Smith', 'jane@example.com'),
        ('Bob Johnson', 'bob@example.com')
      `;
      await connection.execute(insertSampleData);
      console.log('✅ Sample data inserted');
    }
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    // Retry after 5 seconds
    setTimeout(initializeDatabase, 5000);
  }
}

// Endpoint root
app.get('/', (req, res) => {
  res.json({ 
    status: 'success',
    message: '🟢 Profile service is running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    if (!connection) {
      return res.status(503).json({ status: 'error', message: 'Database not connected' });
    }
    
    await connection.execute('SELECT 1');
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint untuk ambil semua user dari tabel `users`
app.get('/users', async (req, res) => {
  try {
    if (!connection) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const [results] = await connection.execute('SELECT * FROM users ORDER BY created_at DESC');
    res.json({
      status: 'success',
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    res.status(500).json({ 
      status: 'error',
      message: 'Database error',
      error: error.message 
    });
  }
});

// Endpoint untuk membuat user baru
app.post('/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Name and email are required' 
      });
    }

    if (!connection) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const [result] = await connection.execute(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: {
        id: result.insertId,
        name,
        email
      }
    });
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ 
        status: 'error',
        message: 'Email already exists' 
      });
    } else {
      res.status(500).json({ 
        status: 'error',
        message: 'Database error',
        error: error.message 
      });
    }
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Profile service listening at http://localhost:${port}`);
  initializeDatabase();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('👋 Shutting down gracefully...');
  if (connection) {
    await connection.end();
  }
  process.exit(0);
});
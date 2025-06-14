const express = require('express');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = 8300;
app.use(express.json());

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

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL
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
    const [rows] = await connection.execute('SELECT id, name, email FROM users');
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching users:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const [rows] = await connection.execute('SELECT id, name, email FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error fetching user by ID:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create user
app.post('/users', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, password]
    );

    const [newUser] = await connection.execute('SELECT id, name, email FROM users WHERE id = ?', [result.insertId]);

    res.status(201).json(newUser[0]);
  } catch (err) {
    console.error('❌ Error registering user:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Database error' });
    }
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [rows] = await connection.execute(
      'SELECT id, name, email, password FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Login success
    const user = { id: rows[0].id, name: rows[0].name, email: rows[0].email };
    res.json({ message: 'Login successful', user });
  } catch (err) {
    console.error('❌ Error during login:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});



// Update user
app.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, email, password } = req.body;

  if (!name && !email && !password) {
    return res.status(400).json({ error: 'At least one field (name, email, password) must be provided' });
  }

  try {
    const [existing] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const fields = [];
    const values = [];

    if (name) {
      fields.push('name = ?');
      values.push(name);
    }

    if (email) {
      fields.push('email = ?');
      values.push(email);
    }

    if (password) {
      fields.push('password = ?');
      values.push(hashedPassword);
    }

    values.push(userId);

    await connection.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const [updated] = await connection.execute(
      'SELECT id, name, email FROM users WHERE id = ?', [userId]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('❌ Error updating user:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Database error' });
    }
  }
});

(async () => {
  await connectWithRetry();

  app.listen(port, () => {
    console.log(`🚀 Profile service listening at http://localhost:${port}`);
  });
})();

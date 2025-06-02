const express = require('express');
const mysql = require('mysql2');

const app = express();
const port = 8300;

const dbPassword = process.env.NODE_DB_PASSWORD || 'password123';

// Setup koneksi ke MariaDB/MySQL
const connection = mysql.createConnection({
  host: process.env.NODE_DB_HOST || 'localhost',
  port: process.env.NODE_DB_PORT || 3306,
  user: process.env.NODE_DB_USER || 'root',
  password: dbPassword,
  database: process.env.NODE_DB_NAME || 'mydatabase',
});

// Tes koneksi
connection.connect((err) => {
  if (err) {
    console.error('❌ Failed to connect to DB:', err.message);
  } else {
    console.log('✅ Connected to DB as ID', connection.threadId);
  }
});

// Endpoint root
app.get('/', (req, res) => {
  res.send('🟢 Profile service is running');
});

// Endpoint untuk ambil semua user dari tabel `users`
app.get('/users', (req, res) => {
  connection.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error('❌ Error fetching users:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.listen(port, () => {
  console.log(`🚀 Profile service listening at http://localhost:8300`);
});

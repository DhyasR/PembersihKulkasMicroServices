USE mydatabase;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100)
);

INSERT INTO users (name, email) VALUES
('Dhyas', 'dhyas@example.com'),
('Budi', 'budi@example.com');

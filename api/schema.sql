-- Create database and tables for the app
CREATE DATABASE IF NOT EXISTS security_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE security_app;

-- Users hold credentials and login identifiers
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(9) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Profiles hold personal details captured during signup
CREATE TABLE IF NOT EXISTS profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(9) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_initial VARCHAR(10) NULL,
  last_name VARCHAR(100) NOT NULL,
  suffix VARCHAR(20) NULL,
  birthdate DATE NULL,
  age INT NULL,
  sex ENUM('male','female') NULL,
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Addresses captured during signup
CREATE TABLE IF NOT EXISTS addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(9) NOT NULL,
  purok VARCHAR(100) NULL,
  barangay VARCHAR(100) NULL,
  city VARCHAR(120) NULL,
  province VARCHAR(120) NULL,
  country VARCHAR(120) NULL,
  zip VARCHAR(20) NULL,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Authentication/security questions per user
CREATE TABLE IF NOT EXISTS user_security_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(9) NOT NULL,
  question VARCHAR(255) NOT NULL,
  answer_hash VARCHAR(255) NOT NULL,
  CONSTRAINT fk_user_security_questions_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
-- PHO Document Archive - MySQL schema for MySQL Workbench / any MySQL server
-- Run this in MySQL Workbench (or mysql CLI) to create the database and tables.

CREATE DATABASE IF NOT EXISTS pho_docuarchive
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE pho_docuarchive;

-- Folders (office folders / hierarchy)
CREATE TABLE IF NOT EXISTS folders (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(64) DEFAULT NULL,
  created_at VARCHAR(32) DEFAULT NULL
);

-- Users (staff/admin accounts that have signed in)
CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) DEFAULT NULL,
  role VARCHAR(32) DEFAULT 'staff',
  picture VARCHAR(512) DEFAULT NULL,
  last_login_at VARCHAR(32) DEFAULT NULL
);

-- Document metadata (no file content here)
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  folder_id VARCHAR(64) DEFAULT NULL,
  original_name VARCHAR(255) DEFAULT NULL,
  mime_type VARCHAR(128) DEFAULT 'application/octet-stream',
  size BIGINT DEFAULT NULL,
  title VARCHAR(512) DEFAULT NULL,
  `from` VARCHAR(255) DEFAULT NULL,
  to_email VARCHAR(255) DEFAULT NULL,
  subject VARCHAR(512) DEFAULT NULL,
  description VARCHAR(512) DEFAULT NULL,
  status VARCHAR(32) DEFAULT 'not_viewed',
  viewed_at VARCHAR(32) DEFAULT NULL,
  comment TEXT DEFAULT NULL,
  created_by_email VARCHAR(255) DEFAULT NULL,
  created_at VARCHAR(32) DEFAULT NULL
);

-- Activity history (upload, view, download, delete)
CREATE TABLE IF NOT EXISTS history (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  document_id VARCHAR(64) DEFAULT NULL,
  document_name VARCHAR(255) DEFAULT NULL,
  folder_name VARCHAR(255) DEFAULT NULL,
  size BIGINT DEFAULT NULL,
  timestamp VARCHAR(32) DEFAULT NULL
);

-- File content is stored on disk in api/uploads/ (filename = document id)
-- Ensure that folder exists and is writable by the web server.

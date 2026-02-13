-- Migration: Add due_date column to documents table
-- Run this in MySQL Workbench or mysql CLI if you get the error:
-- SQLSTATE[42S22]: Column not found: 1054 Unknown column 'due_date' in 'field list'

USE pho_docuarchive;

-- Add due_date column to documents table
-- If you get an error that the column already exists, you can ignore it
ALTER TABLE documents ADD COLUMN due_date VARCHAR(32) DEFAULT NULL AFTER to_email;

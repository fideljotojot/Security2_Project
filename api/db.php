<?php
// Basic PDO connection. Update credentials if needed.
$DB_HOST = 'localhost';
$DB_NAME = 'security_app';
$DB_USER = 'root';
$DB_PASS = '';

function cors_json_headers() {
  header('Content-Type: application/json');
  header('Access-Control-Allow-Origin: http://localhost:5173');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
  header('Access-Control-Allow-Credentials: true');
  header('Access-Control-Max-Age: 86400');

  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
}

cors_json_headers();

try {
  $pdo = new PDO("mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4", $DB_USER, $DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Database error',
    'details' => $e->getMessage()
  ]);
}

<?php
require __DIR__ . '/db.php';
cors_json_headers();

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['id_number']) || empty($input['new_password'])) {
  http_response_code(400);
  echo json_encode(['error' => 'ID number and new password are required']);
  exit;
}

$idNumber = trim($input['id_number']);
$newPassword = trim($input['new_password']);

// Basic validation
if (strlen($newPassword) < 8) {
  http_response_code(400);
  echo json_encode(['error' => 'Password must be at least 8 characters long']);
  exit;
}

// Optional: extra ID format validation (only if you enforce a pattern like 0000-0000)
if (!preg_match('/^\d{4}-\d{4}$/', $idNumber)) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid ID number format']);
  exit;
}

try {
  // Check if user exists
  $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
  $stmt->execute([$idNumber]);
  $user = $stmt->fetch();

  if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
  }

  // Hash and update password securely
  $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
  $updateStmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  $updateStmt->execute([$passwordHash, $idNumber]);

  echo json_encode([
    'ok' => true,
    'message' => 'Password successfully changed'
  ]);
  
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Database error',
    'details' => $e->getMessage()
  ]);
}

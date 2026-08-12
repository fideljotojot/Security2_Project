<?php
require __DIR__ . '/db.php';
cors_json_headers();

$input = json_decode(file_get_contents('php://input'), true);

// Check for ID number 
if (!$input || empty($input['id_number'])) {
  http_response_code(400);
  echo json_encode(['error' => 'ID number is required']);
  exit;
}

$id_number = trim($input['id_number']);

try {
  // Verify the user exists by ID and get username
  $stmt = $pdo->prepare('SELECT id, username FROM users WHERE id = ?');
  $stmt->execute([$id_number]);
  $user = $stmt->fetch();

  if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'This Id number does not exist']);
    exit;
  }

  $userId = $user['id'];
  $username = $user['username'];

  // Fetch the user's security questions (without answers)
  $stmt = $pdo->prepare('SELECT question FROM user_security_questions WHERE user_id = ? ORDER BY id LIMIT 3');
  $stmt->execute([$userId]);
  $questions = $stmt->fetchAll(PDO::FETCH_COLUMN);

  if (count($questions) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'User has not set up security questions']);
    exit;
  }

  echo json_encode([
    'ok' => true,
    'user_id' => $userId,
    'username' => $username,
    'questions' => $questions
  ]);

} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Database error',
    'details' => $e->getMessage()
  ]);
}

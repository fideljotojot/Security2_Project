<?php
require __DIR__ . '/db.php';
cors_json_headers();

// Decode incoming JSON
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields from Vue
if (
  !$input ||
  empty($input['id_number']) ||  // user entered ID number
  empty($input['answer1']) ||
  empty($input['answer2']) ||
  empty($input['answer3'])
) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing ID number or answers']);
  exit;
}

// Since users.id is VARCHAR(9), it matches the ID number
$userId = trim($input['id_number']);
$answers = [
  strtolower(trim($input['answer1'])),
  strtolower(trim($input['answer2'])),
  strtolower(trim($input['answer3']))
];

try {
  // ✅ Fetch the user (optional check)
  $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
  $stmt->execute([$userId]);
  $user = $stmt->fetch();

  if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
  }

  // ✅ Get security question + answer hashes
  $stmt = $pdo->prepare('
    SELECT question, answer_hash
    FROM user_security_questions
    WHERE user_id = ?
    ORDER BY id ASC
    LIMIT 3
  ');
  $stmt->execute([$userId]);
  $securityData = $stmt->fetchAll();

  if (count($securityData) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'User has not set up all security questions']);
    exit;
  }

  // ✅ Compare answers (case-insensitive)
  $allCorrect = true;
  for ($i = 0; $i < 3; $i++) {
    if (!password_verify($answers[$i], $securityData[$i]['answer_hash'])) {
      $allCorrect = false;
      break;
    }
  }

  if (!$allCorrect) {
    http_response_code(401);
    echo json_encode(['match' => false, 'error' => 'Incorrect answers']);
    exit;
  }

  // ✅ If all correct — return success and token
  $token = bin2hex(random_bytes(32));
  $expiresAt = date('Y-m-d H:i:s', time() + 900); // 15 minutes validity

  echo json_encode([
    'ok' => true,
    'match' => true,
    'token' => $token,
    'expires_at' => $expiresAt,
    'message' => 'Security answers verified successfully. You may now reset your password.'
  ]);

} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Database error',
    'details' => $e->getMessage()
  ]);
  exit;
}

<?php
require __DIR__.'/db.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['username']) || empty($input['password'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing username or password']);
  exit;
}

$username = trim($input['username']);
$password = trim($input['password']);

try {
  $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
  $stmt->execute([$username]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'Username does not exist']);
    exit;
  }

  if (!password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Incorrect password']);
    exit;
  }

  echo json_encode([
    'success' => true,
    'message' => 'Login successful',
    'user' => [
      'id' => $user['id'],
      'username' => $user['username'],
      'email' => $user['email']
    ]
  ]);

} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}

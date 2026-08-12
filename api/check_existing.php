<?php
require __DIR__.'/db.php';
cors_json_headers();

// Read POSTed JSON
$data = json_decode(file_get_contents('php://input'), true);
$type = $data['type'] ?? '';
$value = $data['value'] ?? '';

// Default response
$response = ['exists' => false];

// Validate input type
$allowedTypes = ['id' => 'id', 'email' => 'email', 'username' => 'username'];
if (!array_key_exists($type, $allowedTypes)) {
    echo json_encode($response);
    exit;
}

try {
    $column = $allowedTypes[$type];
    $stmt = $pdo->prepare("SELECT COUNT(*) AS count FROM users WHERE $column = :value");
    $stmt->execute(['value' => $value]);
    $result = $stmt->fetch();
    if ($result && $result['count'] > 0) {
        $response['exists'] = true;
    }
} catch (PDOException $e) {
    http_response_code(500);
    $response['error'] = 'Database query failed';
}

echo json_encode($response);

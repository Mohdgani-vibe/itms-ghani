package middleware

import (
	"encoding/json"
	"testing"
)

func TestMaskSensitiveDataRemovesPasswords(t *testing.T) {
	input := `{"username":"admin","password":"secret123","email":"admin@example.com"}`
	masked := maskSensitiveData(input)
	
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(masked), &result); err != nil {
		t.Fatalf("maskSensitiveData returned invalid JSON: %v", err)
	}
	
	if result["password"] != "[REDACTED]" {
		t.Fatalf("password = %v, want [REDACTED]", result["password"])
	}
	if result["username"] != "admin" {
		t.Fatalf("username = %v, want admin", result["username"])
	}
}

func TestMaskSensitiveDataRemovesMultipleSensitiveFields(t *testing.T) {
	input := `{
		"username": "admin",
		"password": "secret123",
		"api_key": "key_1234567890",
		"token": "jwt_token_here",
		"authorization": "Bearer xyz",
		"mfa_code": "123456",
		"email": "admin@example.com"
	}`
	masked := maskSensitiveData(input)
	
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(masked), &result); err != nil {
		t.Fatalf("maskSensitiveData returned invalid JSON: %v", err)
	}
	
	sensitiveKeys := []string{"password", "api_key", "token", "authorization", "mfa_code"}
	for _, key := range sensitiveKeys {
		if result[key] != "[REDACTED]" {
			t.Fatalf("%s = %v, want [REDACTED]", key, result[key])
		}
	}
	
	// Non-sensitive fields should remain
	if result["username"] != "admin" {
		t.Fatalf("username = %v, want admin", result["username"])
	}
	if result["email"] != "admin@example.com" {
		t.Fatalf("email = %v, want admin@example.com", result["email"])
	}
}

func TestMaskSensitiveDataHandlesNestedObjects(t *testing.T) {
	input := `{
		"user": {
			"username": "admin",
			"password": "secret123",
			"profile": {
				"email": "admin@example.com",
				"secret": "nested_secret"
			}
		},
		"auth": {
			"access_token": "token123",
			"refresh_token": "refresh456"
		}
	}`
	masked := maskSensitiveData(input)
	
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(masked), &result); err != nil {
		t.Fatalf("maskSensitiveData returned invalid JSON: %v", err)
	}
	
	// Check nested password
	user := result["user"].(map[string]interface{})
	if user["password"] != "[REDACTED]" {
		t.Fatalf("user.password = %v, want [REDACTED]", user["password"])
	}
	
	// Check deeply nested secret
	profile := user["profile"].(map[string]interface{})
	if profile["secret"] != "[REDACTED]" {
		t.Fatalf("user.profile.secret = %v, want [REDACTED]", profile["secret"])
	}
	
	// Check auth tokens
	auth := result["auth"].(map[string]interface{})
	if auth["access_token"] != "[REDACTED]" {
		t.Fatalf("auth.access_token = %v, want [REDACTED]", auth["access_token"])
	}
	if auth["refresh_token"] != "[REDACTED]" {
		t.Fatalf("auth.refresh_token = %v, want [REDACTED]", auth["refresh_token"])
	}
	
	// Non-sensitive nested fields should remain
	if profile["email"] != "admin@example.com" {
		t.Fatalf("user.profile.email = %v, want admin@example.com", profile["email"])
	}
}

func TestMaskSensitiveDataHandlesArrays(t *testing.T) {
	input := `{
		"users": [
			{"username": "user1", "password": "pass1"},
			{"username": "user2", "password": "pass2"}
		]
	}`
	masked := maskSensitiveData(input)
	
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(masked), &result); err != nil {
		t.Fatalf("maskSensitiveData returned invalid JSON: %v", err)
	}
	
	users := result["users"].([]interface{})
	for i, u := range users {
		user := u.(map[string]interface{})
		if user["password"] != "[REDACTED]" {
			t.Fatalf("users[%d].password = %v, want [REDACTED]", i, user["password"])
		}
		if user["username"] == "" {
			t.Fatalf("users[%d].username should not be empty", i)
		}
	}
}

func TestMaskSensitiveDataCaseInsensitive(t *testing.T) {
	tests := []struct {
		name string
		key  string
	}{
		{"lowercase", "password"},
		{"uppercase", "PASSWORD"},
		{"mixed case", "Password"},
		{"camel case", "accessToken"},
		{"snake case", "api_key"},
		{"with prefix", "user_password"},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := map[string]interface{}{
				tt.key: "sensitive_value",
				"safe": "public_value",
			}
			inputJSON, _ := json.Marshal(input)
			masked := maskSensitiveData(string(inputJSON))
			
			var result map[string]interface{}
			if err := json.Unmarshal([]byte(masked), &result); err != nil {
				t.Fatalf("maskSensitiveData returned invalid JSON: %v", err)
			}
			
			if result[tt.key] != "[REDACTED]" {
				t.Fatalf("%s = %v, want [REDACTED]", tt.key, result[tt.key])
			}
			if result["safe"] != "public_value" {
				t.Fatalf("safe = %v, want public_value", result["safe"])
			}
		})
	}
}

func TestMaskSensitiveDataHandlesInvalidJSON(t *testing.T) {
	input := "not valid json {"
	masked := maskSensitiveData(input)
	
	// Should return original on parse error
	if masked != input {
		t.Fatalf("maskSensitiveData(invalid json) = %q, want original input", masked)
	}
}

func TestMaskMapRecursivePreservesNonSensitiveData(t *testing.T) {
	input := map[string]interface{}{
		"username":   "admin",
		"email":      "admin@example.com",
		"password":   "secret",
		"department": "IT",
		"age":        30,
		"active":     true,
	}
	
	masked := maskMapRecursive(input)
	
	if masked["password"] != "[REDACTED]" {
		t.Fatalf("password = %v, want [REDACTED]", masked["password"])
	}
	if masked["username"] != "admin" {
		t.Fatalf("username = %v, want admin", masked["username"])
	}
	if masked["email"] != "admin@example.com" {
		t.Fatalf("email = %v, want admin@example.com", masked["email"])
	}
	if masked["department"] != "IT" {
		t.Fatalf("department = %v, want IT", masked["department"])
	}
	if masked["age"] != 30 {
		t.Fatalf("age = %v, want 30", masked["age"])
	}
	if masked["active"] != true {
		t.Fatalf("active = %v, want true", masked["active"])
	}
}

package authn

import (
	"strings"
	"testing"
)

func TestValidatePasswordStrengthRejectsLeadingOrTrailingWhitespace(t *testing.T) {
	err := ValidatePasswordStrength(" ValidPass#2026 ")
	if err == nil {
		t.Fatal("ValidatePasswordStrength returned nil error")
	}
	if !strings.Contains(err.Error(), "must not start or end with whitespace") {
		t.Fatalf("error = %q, want whitespace validation error", err.Error())
	}
}

func TestValidatePasswordStrengthMinimum8Characters(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "7 characters - too short",
			password: "Ab1$xyz",
			wantErr:  true,
			errMsg:   "at least 8 characters",
		},
		{
			name:     "8 characters - valid",
			password: "Ab1$wxyz",
			wantErr:  false,
		},
		{
			name:     "12 characters - valid",
			password: "Ab1$wxyz9876",
			wantErr:  false,
		},
		{
			name:     "empty password",
			password: "",
			wantErr:  true,
			errMsg:   "at least 8 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePasswordStrength(tt.password)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ValidatePasswordStrength(%q) returned nil, want error containing %q", tt.password, tt.errMsg)
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Fatalf("error = %q, want error containing %q", err.Error(), tt.errMsg)
				}
			} else {
				if err != nil {
					t.Fatalf("ValidatePasswordStrength(%q) returned error: %v, want nil", tt.password, err)
				}
			}
		})
	}
}

func TestValidatePasswordStrengthRequiresComplexity(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "missing uppercase",
			password: "abc123!@#xyz",
			wantErr:  true,
			errMsg:   "uppercase",
		},
		{
			name:     "missing lowercase",
			password: "ABC123!@#XYZ",
			wantErr:  true,
			errMsg:   "lowercase",
		},
		{
			name:     "missing digit",
			password: "Abcdefg!@#",
			wantErr:  true,
			errMsg:   "digit",
		},
		{
			name:     "missing symbol",
			password: "Abcdefg123",
			wantErr:  true,
			errMsg:   "symbol",
		},
		{
			name:     "has all requirements",
			password: "ValidPass#2026",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePasswordStrength(tt.password)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ValidatePasswordStrength(%q) returned nil, want error containing %q", tt.password, tt.errMsg)
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Fatalf("error = %q, want error containing %q", err.Error(), tt.errMsg)
				}
			} else {
				if err != nil {
					t.Fatalf("ValidatePasswordStrength(%q) returned error: %v, want nil", tt.password, err)
				}
			}
		})
	}
}
}
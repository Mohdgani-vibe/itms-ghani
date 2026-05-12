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
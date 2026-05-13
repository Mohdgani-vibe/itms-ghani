package api

import "testing"

func TestSanitizeSSHInventoryAddressAllowsPrivateIPs(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "private ipv4", input: "YOUR_SERVER_IP", want: "YOUR_SERVER_IP"},
		{name: "loopback ipv4", input: "127.0.0.1", want: "127.0.0.1"},
		{name: "link local ipv4", input: "169.254.10.5", want: "169.254.10.5"},
		{name: "private ipv6", input: "fd00::10", want: "fd00::10"},
		{name: "cidr trimmed", input: "YOUR_SERVER_IP/24", want: "YOUR_SERVER_IP"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := sanitizeSSHInventoryAddress(test.input)
			if got != test.want {
				t.Fatalf("sanitizeSSHInventoryAddress(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestSanitizeSSHInventoryAddressRejectsPublicOrInvalidHosts(t *testing.T) {
	tests := []string{
		"8.8.8.8",
		"1.1.1.1/32",
		"example.com",
		"",
		"not-an-ip",
	}

	for _, test := range tests {
		t.Run(test, func(t *testing.T) {
			got := sanitizeSSHInventoryAddress(test)
			if got != "" {
				t.Fatalf("sanitizeSSHInventoryAddress(%q) = %q, want empty string", test, got)
			}
		})
	}
}
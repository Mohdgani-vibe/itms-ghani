package chatbridge

import "testing"

func TestBuildMattermostChannelNameIncludesKindAndChannelSuffix(t *testing.T) {
	name := buildMattermostChannelName("operations", "IT Operations", "12345678-90ab-cdef-1234-567890abcdef")

	if name != "itms-operations-it-operations-12345678" {
		t.Fatalf("channel name = %q, want %q", name, "itms-operations-it-operations-12345678")
	}
}

func TestBuildMattermostChannelNameFallsBackForEmptyValues(t *testing.T) {
	name := buildMattermostChannelName("", "", "")

	if name != "itms-chat-chat" {
		t.Fatalf("channel name = %q, want %q", name, "itms-chat-chat")
	}
}

func TestFormatMattermostPost(t *testing.T) {
	message := formatMattermostPost("  Employee One  ", "  Need help with VPN  ")

	if message != "**Employee One**: Need help with VPN" {
		t.Fatalf("message = %q, want %q", message, "**Employee One**: Need help with VPN")
	}

	message = formatMattermostPost("", "Standalone message")
	if message != "Standalone message" {
		t.Fatalf("message without author = %q, want %q", message, "Standalone message")
	}
}
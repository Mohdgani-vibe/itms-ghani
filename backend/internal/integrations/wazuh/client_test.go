package wazuh

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResolveAgentIDReturnsNumericIDUnchanged(t *testing.T) {
	t.Parallel()

	client := NewClient("http://example.invalid", "", "", "", true)
	resolved, err := client.resolveAgentID(context.Background(), "token-123", " 001 ")
	if err != nil {
		t.Fatalf("resolveAgentID returned error: %v", err)
	}
	if resolved != " 001 " {
		t.Fatalf("resolved = %q, want original numeric agent id", resolved)
	}
}

func TestResolveAgentIDMatchesAgentNameFromSearch(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/agents" {
			t.Fatalf("unexpected path %q", request.URL.Path)
		}
		if got := request.URL.Query().Get("search"); got != "edge-host-01" {
			t.Fatalf("search = %q, want exact host lookup", got)
		}
		if got := request.Header.Get("Authorization"); got != "Bearer token-123" {
			t.Fatalf("authorization = %q, want bearer token", got)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"data":{"affected_items":[{"id":"007","name":"edge-host-01","ip":"10.0.0.7","status":"active"},{"id":"008","name":"edge-host-02","ip":"10.0.0.8","status":"active"}]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "", "", "", true)
	resolved, err := client.resolveAgentID(context.Background(), "token-123", "edge-host-01")
	if err != nil {
		t.Fatalf("resolveAgentID returned error: %v", err)
	}
	if resolved != "007" {
		t.Fatalf("resolved = %q, want matched agent id", resolved)
	}
}

func TestResolveAgentIDUsesSingleSearchResultFallback(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"data":{"affected_items":[{"id":"011","name":"edge-host-11.internal","ip":"10.0.0.11","status":"active"}]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "", "", "", true)
	resolved, err := client.resolveAgentID(context.Background(), "token-123", "edge-host-11")
	if err != nil {
		t.Fatalf("resolveAgentID returned error: %v", err)
	}
	if resolved != "011" {
		t.Fatalf("resolved = %q, want single search result fallback", resolved)
	}
}
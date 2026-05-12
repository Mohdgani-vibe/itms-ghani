package saltstack

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTargetConnectedUsesInlineEAuthObjectBody(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/run" {
			t.Fatalf("unexpected path %q", request.URL.Path)
		}
		if got := request.Header.Get("X-Auth-Token"); got != "" {
			t.Fatalf("unexpected X-Auth-Token header %q", got)
		}

		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}

		var payload map[string]any
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Fatalf("body should decode as object JSON: %v\nbody=%s", err, string(body))
		}

		if got := payload["client"]; got != "local" {
			t.Fatalf("unexpected client %v", got)
		}
		if got := payload["tgt"]; got != "spare-ho" {
			t.Fatalf("unexpected target %v", got)
		}
		if got := payload["expr_form"]; got != "glob" {
			t.Fatalf("unexpected expr_form %v", got)
		}
		if got := payload["fun"]; got != "test.ping" {
			t.Fatalf("unexpected function %v", got)
		}
		if got := payload["username"]; got != "itms-salt" {
			t.Fatalf("unexpected username %v", got)
		}
		if got := payload["password"]; got != "secret" {
			t.Fatalf("unexpected password %v", got)
		}
		if got := payload["eauth"]; got != "file" {
			t.Fatalf("unexpected eauth %v", got)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"return":[{"spare-ho":true}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "", "itms-salt", "secret", "file", "glob")
	connected, err := client.TargetConnected(context.Background(), "spare-ho")
	if err != nil {
		t.Fatalf("TargetConnected returned error: %v", err)
	}
	if !connected {
		t.Fatal("expected target to be connected")
	}
}

func TestRunStateReturnsErrorForStringFailure(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/run" {
			t.Fatalf("unexpected path %q", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"return":[{"spare-ho":"State execution failed"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "", "itms-salt", "secret", "file", "glob")
	_, err := client.RunState(context.Background(), "spare-ho", "patch.run")
	if err == nil {
		t.Fatal("RunState returned nil error")
	}
	if !strings.Contains(err.Error(), "saltstack state patch.run failed: State execution failed") {
		t.Fatalf("error = %q, want salt state failure detail", err.Error())
	}
}

func TestRunStateReturnsErrorForStateResultFalse(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/run" {
			t.Fatalf("unexpected path %q", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"return":[{"spare-ho":{"pkg_|-patch_|-patch_|-installed":{"result":false,"comment":"Package install failed"}}}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "", "itms-salt", "secret", "file", "glob")
	_, err := client.RunState(context.Background(), "spare-ho", "patch.run")
	if err == nil {
		t.Fatal("RunState returned nil error")
	}
	if !strings.Contains(err.Error(), "pkg_|-patch_|-patch_|-installed: Package install failed") {
		t.Fatalf("error = %q, want state comment failure detail", err.Error())
	}
}
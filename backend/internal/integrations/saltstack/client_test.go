package saltstack

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestTargetConnectedUsesInlineEAuthFormBody(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/run" {
			t.Fatalf("unexpected path %q", request.URL.Path)
		}
		if got := request.Header.Get("X-Auth-Token"); got != "" {
			t.Fatalf("unexpected X-Auth-Token header %q", got)
		}
		if got := request.Header.Get("Content-Type"); got != "application/x-www-form-urlencoded" {
			t.Fatalf("unexpected content type %q", got)
		}

		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}

		payload, err := url.ParseQuery(string(body))
		if err != nil {
			t.Fatalf("body should decode as form data: %v\nbody=%s", err, string(body))
		}

		if got := payload.Get("client"); got != "local" {
			t.Fatalf("unexpected client %v", got)
		}
		if got := payload.Get("tgt"); got != "spare-ho" {
			t.Fatalf("unexpected target %v", got)
		}
		if got := payload.Get("expr_form"); got != "glob" {
			t.Fatalf("unexpected expr_form %v", got)
		}
		if got := payload.Get("fun"); got != "test.ping" {
			t.Fatalf("unexpected function %v", got)
		}
		if got := payload.Get("username"); got != "itms-salt" {
			t.Fatalf("unexpected username %v", got)
		}
		if got := payload.Get("password"); got != "secret" {
			t.Fatalf("unexpected password %v", got)
		}
		if got := payload.Get("eauth"); got != "file" {
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

func TestRunStateUsesRepeatedArgFormValues(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/run" {
			t.Fatalf("unexpected path %q", request.URL.Path)
		}

		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}

		payload, err := url.ParseQuery(string(body))
		if err != nil {
			t.Fatalf("body should decode as form data: %v\nbody=%s", err, string(body))
		}
		if got := payload.Get("fun"); got != "state.apply" {
			t.Fatalf("unexpected function %v", got)
		}
		if got := payload["arg"]; len(got) != 1 || got[0] != "patch.run" {
			t.Fatalf("unexpected arg values %v", got)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"return":[{"spare-ho":{}}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "", "itms-salt", "secret", "file", "glob")
	if _, err := client.RunState(context.Background(), "spare-ho", "patch.run"); err != nil {
		t.Fatalf("RunState returned error: %v", err)
	}
}
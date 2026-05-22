package saltstack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"itms/backend/internal/integrations/hostbridge"
)

type Client struct {
	baseURL    string
	token      string
	username   string
	password   string
	eauth      string
	targetType string
	httpClient *http.Client
	mu         sync.Mutex
	session    string
	expiresAt  time.Time
}

func NewClient(baseURL string, token string, username string, password string, eauth string, targetType string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		token:      token,
		username:   strings.TrimSpace(username),
		password:   password,
		eauth:      firstNonEmpty(strings.TrimSpace(eauth), "pam"),
		targetType: targetType,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
			Transport: &http.Transport{DialContext: hostbridge.DialContext},
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return fmt.Errorf("saltstack redirects are not allowed")
			},
		},
	}
}

func (client *Client) Enabled() bool {
	return client != nil && client.baseURL != "" && (strings.TrimSpace(client.token) != "" || (client.username != "" && client.password != ""))
}

func (client *Client) Available(ctx context.Context) bool {
	if !client.Enabled() {
		return false
	}

	if client.token == "" {
		_, err := client.sessionToken(ctx)
		return err == nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, client.baseURL+"/", bytes.NewReader(nil))
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+client.token)

	resp, err := client.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode < http.StatusBadRequest
}

func (client *Client) RunPatch(ctx context.Context, target string) (map[string]any, error) {
	return client.RunState(ctx, target, "patch.run")
}

func (client *Client) TargetConnected(ctx context.Context, target string) (bool, error) {
	if !client.Enabled() {
		return false, nil
	}

	payload := client.withInlineEAuth(map[string]any{
		"client":    "local",
		"tgt":       target,
		"expr_form": client.targetType,
		"fun":       "test.ping",
	})

	var result struct {
		Return []map[string]any `json:"return"`
	}
	if err := client.doJSON(ctx, http.MethodPost, "/run", payload, &result); err != nil {
		return false, err
	}

	for _, item := range result.Return {
		if len(item) == 0 {
			continue
		}
		if value, ok := item[target]; ok {
			if connected, ok := value.(bool); ok {
				return connected, nil
			}
			return true, nil
		}
		return true, nil
	}

	return false, nil
}

func (client *Client) AcceptMinionKey(ctx context.Context, target string) error {
	if !client.Enabled() {
		return nil
	}
	if strings.TrimSpace(target) == "" {
		return nil
	}

	payload := client.withInlineEAuth(map[string]any{
		"client": "wheel",
		"fun":    "key.accept",
		"match":  strings.TrimSpace(target),
	})

	var result struct {
		Return []struct {
			Data struct {
				Success bool `json:"success"`
			} `json:"data"`
		} `json:"return"`
	}
	if err := client.doJSON(ctx, http.MethodPost, "/run", payload, &result); err != nil {
		return err
	}

	return nil
}

func (client *Client) RunState(ctx context.Context, target string, state string) (map[string]any, error) {
	if !client.Enabled() {
		return nil, fmt.Errorf("saltstack integration is not configured")
	}

	payload := client.withInlineEAuth(map[string]any{
		"client":    "local",
		"tgt":       target,
		"expr_form": client.targetType,
		"fun":       "state.apply",
		"arg":       []string{state},
	})

	var result map[string]any
	if err := client.doJSONWithTimeout(ctx, http.MethodPost, "/run", payload, &result, 10*time.Minute); err != nil {
		return nil, err
	}
	if err := stateApplyError(result, target, state); err != nil {
		return nil, err
	}
	return result, nil
}

func stateApplyError(result map[string]any, target string, state string) error {
	returns, ok := result["return"].([]any)
	if !ok {
		return nil
	}

	for _, item := range returns {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}

		value, ok := entry[target]
		if !ok {
			for _, fallback := range entry {
				value = fallback
				ok = true
				break
			}
		}
		if !ok {
			continue
		}

		if errText := saltFailureText(value); errText != "" {
			return fmt.Errorf("saltstack state %s failed: %s", strings.TrimSpace(state), errText)
		}
	}

	return nil
}

func saltFailureText(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case []any:
		messages := make([]string, 0, len(typed))
		for _, item := range typed {
			text := strings.TrimSpace(fmt.Sprint(item))
			if text != "" {
				messages = append(messages, text)
			}
		}
		return strings.Join(messages, "; ")
	case map[string]any:
		messages := make([]string, 0)
		for key, item := range typed {
			stateResult, ok := item.(map[string]any)
			if !ok {
				continue
			}
			resultValue, hasResult := stateResult["result"].(bool)
			if !hasResult || resultValue {
				continue
			}
			comment := strings.TrimSpace(fmt.Sprint(stateResult["comment"]))
			if comment == "" || comment == "<nil>" {
				comment = "state returned result=false"
			}
			messages = append(messages, fmt.Sprintf("%s: %s", key, comment))
		}
		return strings.Join(messages, "; ")
	default:
		return ""
	}
}

func (client *Client) RunCommand(ctx context.Context, target string, command string) (map[string]any, error) {
	if !client.Enabled() {
		return nil, fmt.Errorf("saltstack integration is not configured")
	}
	trimmedCommand := strings.TrimSpace(command)
	if trimmedCommand == "" {
		return nil, fmt.Errorf("command is required")
	}

	payload := client.withInlineEAuth(map[string]any{
		"client":    "local",
		"tgt":       target,
		"expr_form": client.targetType,
		"fun":       "cmd.run_all",
		"arg":       []string{trimmedCommand},
	})

	var result struct {
		Return []map[string]map[string]any `json:"return"`
	}
	if err := client.doJSON(ctx, http.MethodPost, "/run", payload, &result); err != nil {
		return nil, err
	}

	for _, item := range result.Return {
		if output, ok := item[target]; ok {
			return output, nil
		}
		for _, output := range item {
			return output, nil
		}
	}

	return map[string]any{}, nil
}

func (client *Client) BuildTerminalURL(target string) string {
	if !client.Enabled() {
		return ""
	}
	parsed, err := url.Parse(client.baseURL)
	if err != nil {
		return client.baseURL + "/terminal/" + target
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/terminal/" + target
	return parsed.String()
}

func (client *Client) doJSON(ctx context.Context, method string, path string, body any, out any) error {
	return client.doJSONWithTimeout(ctx, method, path, body, out, 0)
}

func (client *Client) doJSONWithTimeout(ctx context.Context, method string, path string, body any, out any, timeout time.Duration) error {
	var encoded []byte
	var requestBody io.Reader
	contentType := "application/json"
	httpClient := client.httpClient
	if body != nil {
		if client.usesInlineEAuth(path, body) {
			encoded = []byte(client.formEncodedBody(body))
			requestBody = strings.NewReader(string(encoded))
			contentType = "application/x-www-form-urlencoded"
		} else {
			var err error
			encoded, err = json.Marshal(client.lowstateBody(path, body))
			if err != nil {
				return err
			}
			requestBody = bytes.NewReader(encoded)
		}
	} else {
		requestBody = bytes.NewReader(nil)
	}
	if timeout > 0 && client.httpClient != nil {
		clonedClient := *client.httpClient
		clonedClient.Timeout = timeout
		httpClient = &clonedClient
	}

	req, err := http.NewRequestWithContext(ctx, method, client.baseURL+path, requestBody)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	if client.token != "" {
		req.Header.Set("Authorization", "Bearer "+client.token)
	} else if !client.usesInlineEAuth(path, body) {
		token, err := client.sessionToken(ctx)
		if err != nil {
			return err
		}
		req.Header.Set("X-Auth-Token", token)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized && client.token == "" && !client.usesInlineEAuth(path, body) {
		client.clearSessionToken()
		token, err := client.sessionToken(ctx)
		if err != nil {
			return err
		}
		req, err = http.NewRequestWithContext(ctx, method, client.baseURL+path, bytes.NewReader(encoded))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", contentType)
		req.Header.Set("X-Auth-Token", token)
		resp.Body.Close()
		resp, err = httpClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("saltstack api returned %s", resp.Status)
	}

	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (client *Client) sessionToken(ctx context.Context) (string, error) {
	client.mu.Lock()
	if client.session != "" && time.Now().Before(client.expiresAt) {
		token := client.session
		client.mu.Unlock()
		return token, nil
	}
	client.mu.Unlock()

	payload := map[string]any{
		"username": client.username,
		"password": client.password,
		"eauth":    firstNonEmpty(client.eauth, "pam"),
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, client.baseURL+"/login", bytes.NewReader(encoded))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		return "", fmt.Errorf("saltstack login returned %s", resp.Status)
	}

	var loginResponse struct {
		Return []struct {
			Token  string  `json:"token"`
			Expire float64 `json:"expire"`
		} `json:"return"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&loginResponse); err != nil {
		return "", err
	}
	if len(loginResponse.Return) == 0 || strings.TrimSpace(loginResponse.Return[0].Token) == "" {
		return "", fmt.Errorf("saltstack login did not return a token")
	}

	expiresAt := time.Now().Add(8 * time.Hour)
	if loginResponse.Return[0].Expire > 0 {
		expiresAt = time.Unix(int64(loginResponse.Return[0].Expire), 0)
	}

	client.mu.Lock()
	client.session = strings.TrimSpace(loginResponse.Return[0].Token)
	client.expiresAt = expiresAt.Add(-1 * time.Minute)
	token := client.session
	client.mu.Unlock()

	return token, nil
}

func (client *Client) clearSessionToken() {
	client.mu.Lock()
	defer client.mu.Unlock()
	client.session = ""
	client.expiresAt = time.Time{}
}

func (client *Client) withInlineEAuth(payload map[string]any) map[string]any {
	if client == nil || client.token != "" {
		return payload
	}
	clone := make(map[string]any, len(payload)+3)
	for key, value := range payload {
		clone[key] = value
	}
	clone["username"] = client.username
	clone["password"] = client.password
	clone["eauth"] = firstNonEmpty(client.eauth, "pam")
	return clone
}

func (client *Client) usesInlineEAuth(path string, body any) bool {
	if client == nil || client.token != "" || path != "/run" {
		return false
	}
	_, ok := body.(map[string]any)
	return ok
}

func (client *Client) lowstateBody(path string, body any) any {
	return body
}

func (client *Client) formEncodedBody(body any) string {
	values := url.Values{}
	payload, ok := body.(map[string]any)
	if !ok {
		return values.Encode()
	}
	for key, value := range payload {
		switch typed := value.(type) {
		case []string:
			for _, item := range typed {
				values.Add(key, item)
			}
		case []any:
			for _, item := range typed {
				values.Add(key, fmt.Sprint(item))
			}
		case nil:
			continue
		default:
			values.Add(key, fmt.Sprint(typed))
		}
	}
	return values.Encode()
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
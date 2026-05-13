package mattermost

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func NewClient(baseURL string, token string) *Client {
	return &Client{
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		token:   strings.TrimSpace(token),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (client *Client) Enabled() bool {
	return client != nil && client.baseURL != "" && client.token != ""
}

func (client *Client) ResolveTeam(ctx context.Context, team string) (Team, error) {
	team = strings.TrimSpace(team)
	if !client.Enabled() || team == "" {
		return Team{}, fmt.Errorf("mattermost client is not configured")
	}

	var resolved Team
	if err := client.get(ctx, "/api/v4/teams/name/"+url.PathEscape(team), &resolved); err == nil {
		return resolved, nil
	} else if err != ErrNotFound {
		return Team{}, err
	}
	if err := client.get(ctx, "/api/v4/teams/"+url.PathEscape(team), &resolved); err != nil {
		return Team{}, err
	}
	return resolved, nil
}

func (client *Client) GetChannelByName(ctx context.Context, teamID string, name string) (Channel, error) {
	if !client.Enabled() {
		return Channel{}, fmt.Errorf("mattermost client is not configured")
	}
	var channel Channel
	err := client.get(ctx, "/api/v4/teams/"+url.PathEscape(strings.TrimSpace(teamID))+"/channels/name/"+url.PathEscape(strings.TrimSpace(name)), &channel)
	return channel, err
}

func (client *Client) CreateChannel(ctx context.Context, input CreateChannelInput) (Channel, error) {
	if !client.Enabled() {
		return Channel{}, fmt.Errorf("mattermost client is not configured")
	}
	if strings.TrimSpace(input.Type) == "" {
		input.Type = "O"
	}
	var channel Channel
	err := client.post(ctx, "/api/v4/channels", input, &channel)
	return channel, err
}

func (client *Client) CreatePost(ctx context.Context, input CreatePostInput) (Post, error) {
	if !client.Enabled() {
		return Post{}, fmt.Errorf("mattermost client is not configured")
	}
	var post Post
	err := client.post(ctx, "/api/v4/posts", input, &post)
	return post, err
}

func (client *Client) get(ctx context.Context, path string, output any) error {
	request, err := client.newRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	return client.do(request, output)
}

func (client *Client) post(ctx context.Context, path string, payload any, output any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal mattermost payload: %w", err)
	}
	request, err := client.newRequest(ctx, http.MethodPost, path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	return client.do(request, output)
}

func (client *Client) newRequest(ctx context.Context, method string, path string, body io.Reader) (*http.Request, error) {
	request, err := http.NewRequestWithContext(ctx, method, client.baseURL+path, body)
	if err != nil {
		return nil, fmt.Errorf("create mattermost request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+client.token)
	request.Header.Set("Accept", "application/json")
	return request, nil
}

func (client *Client) do(request *http.Request, output any) error {
	response, err := client.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("mattermost request failed: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return fmt.Errorf("mattermost request failed with status %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	if output == nil {
		return nil
	}
	if err := json.NewDecoder(response.Body).Decode(output); err != nil {
		return fmt.Errorf("decode mattermost response: %w", err)
	}
	return nil
}
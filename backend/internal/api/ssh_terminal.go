package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	gossh "golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

const sshWebsocketProtocol = "itms.ssh.v1"

const (
	sshWebsocketWriteTimeout = 10 * time.Second
	sshWebsocketReadTimeout  = 70 * time.Second
	sshWebsocketPingPeriod   = 30 * time.Second
	sshWebsocketReadLimit    = 64 << 10
)

type sshTargetDetails struct {
	AssetID   string
	AssetTag  string
	Hostname  string
	Address   string
	Username  string
	Usernames []string
	Port      int
	Reachable bool
	KeyFingerprint string
}

type sshHostOverride struct {
	Address string
	Port    int
	Username string
}

type sshWebsocketEnvelope struct {
	Type    string `json:"type"`
	Data    string `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
	Username string `json:"username,omitempty"`
	Cols    int    `json:"cols,omitempty"`
	Rows    int    `json:"rows,omitempty"`
}

func (server *apiServer) createSSHSession(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		DeviceID string `json:"deviceId"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid ssh payload")
		return
	}
	asset, err := server.fetchAsset(strings.TrimSpace(input.DeviceID))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "ssh terminal is only available for compute assets")
		return
	}
	payload, err := server.buildSSHPayload(c.Request.Context(), asset)
	if err != nil {
		server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "terminal", "high", "SSH terminal unavailable", err.Error())
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	_, _ = server.recordAssetHistory(asset.ID, middleware.CurrentClaims(c).UserID, "terminal_session", payload)
	middleware.TagAudit(c, middleware.AuditMeta{Action: "terminal_session", TargetType: "asset", TargetID: asset.ID, Detail: payload})
	httpx.JSON(c, http.StatusOK, gin.H{"id": asset.ID, "deviceId": asset.ID, "status": "started", "createdAt": time.Now().UTC(), "requestedBy": middleware.CurrentClaims(c).Name, "connection": payload})
}

func (server *apiServer) getSSHTarget(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	asset, err := server.fetchAsset(strings.TrimSpace(c.Param("id")))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "ssh terminal is only available for compute assets")
		return
	}
	target, err := server.resolveSSHTarget(c.Request.Context(), asset)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{
		"assetId":   target.AssetID,
		"assetTag":  target.AssetTag,
		"hostname":  target.Hostname,
		"address":   target.Address,
		"username":  target.Username,
		"usernames": target.Usernames,
		"port":      target.Port,
		"reachable": target.Reachable,
		"keyFingerprint": target.KeyFingerprint,
	})
}

func (server *apiServer) buildSSHPayload(ctx context.Context, asset dbAsset) (gin.H, error) {
	target, err := server.resolveSSHTarget(ctx, asset)
	if err != nil {
		return nil, err
	}
	base := strings.TrimRight(server.config.PublicServerURL, "/")
	if base == "" {
		origins := server.config.FrontendOrigins()
		if len(origins) > 0 {
			base = strings.TrimRight(origins[0], "/")
		}
	}
	url := fmt.Sprintf("%s/ssh/assets/%s", base, asset.ID)
	return gin.H{
		"url":       url,
		"asset_id":  asset.ID,
		"hostname":  target.Hostname,
		"address":   target.Address,
		"username":  target.Username,
		"usernames": target.Usernames,
		"port":      target.Port,
		"reachable": target.Reachable,
		"key_fingerprint": target.KeyFingerprint,
	}, nil
}

func (server *apiServer) resolveSSHTarget(ctx context.Context, asset dbAsset) (sshTargetDetails, error) {
	usernames := parseSSHUsernameCandidates(server.config.SSHTerminalUsername)
	if len(usernames) == 0 {
		return sshTargetDetails{}, fmt.Errorf("ssh terminal is not configured on the server")
	}
	if strings.TrimSpace(server.config.SSHTerminalPrivateKeyPath) == "" && strings.TrimSpace(server.config.SSHTerminalPrivateKey) == "" {
		return sshTargetDetails{}, fmt.Errorf("ssh terminal private key is not configured on the server")
	}
	keyFingerprint, err := server.sshConfiguredKeyFingerprint()
	if err != nil {
		return sshTargetDetails{}, err
	}
	candidates := make([]string, 0, 4)
	var netbirdIP, wiredIP, wirelessIP string
	overrides := parseSSHHostOverrides(server.config.SSHTerminalHostOverrides)
	inventoryUsernames := server.assetLoggedInUsers(ctx, asset.ID)
	usernames = mergeSSHUsernameCandidates(inventoryUsernames, usernames)
	overridePort := 0
	err = server.db.QueryRowContext(ctx, `
		SELECT COALESCE(netbird_ip::text, ''), COALESCE(wired_ip::text, ''), COALESCE(wireless_ip::text, '')
		FROM asset_network_snapshots
		WHERE asset_id = $1::uuid
	`, asset.ID).Scan(&netbirdIP, &wiredIP, &wirelessIP)
	if err != nil && err != sql.ErrNoRows {
		return sshTargetDetails{}, err
	}
	baseCandidates := make([]string, 0, 5)
	assetHostname := strings.TrimSpace(asset.Hostname)
	if override, ok := overrides[strings.ToLower(assetHostname)]; ok {
		baseCandidates = append(baseCandidates, override.Address)
		overridePort = override.Port
		if strings.TrimSpace(override.Username) != "" {
			usernames = mergeSSHUsernameCandidates(parseSSHUsernameCandidates(override.Username), inventoryUsernames, parseSSHUsernameCandidates(server.config.SSHTerminalUsername))
		}
	}
	baseCandidates = append(baseCandidates,
		sanitizeSSHInventoryAddress(netbirdIP),
		sanitizeSSHInventoryAddress(wiredIP),
		sanitizeSSHInventoryAddress(wirelessIP),
	)
	baseCandidates = append(baseCandidates, assetHostname)
	for _, candidate := range baseCandidates {
		candidate = sanitizeSSHAddress(candidate)
		if candidate == "" {
			continue
		}
		duplicate := false
		for _, existing := range candidates {
			if existing == candidate {
				duplicate = true
				break
			}
		}
		if !duplicate {
			candidates = append(candidates, candidate)
		}
	}
	if len(candidates) == 0 {
		return sshTargetDetails{}, fmt.Errorf("no ssh host or network address is available for this asset")
	}
	hostname := strings.TrimSpace(asset.Hostname)
	if hostname == "" {
		hostname = strings.TrimSpace(asset.AssetTag)
	}
	if hostname == "" {
		hostname = strings.TrimSpace(asset.Name)
	}
	if hostname == "" {
		hostname = candidates[0]
	}
	target := sshTargetDetails{
		AssetID:  asset.ID,
		AssetTag: strings.TrimSpace(asset.AssetTag),
		Hostname: hostname,
		Address:  candidates[0],
		Username: usernames[0],
		Usernames: usernames,
		Port:     server.config.SSHTerminalPort,
		KeyFingerprint: keyFingerprint,
	}
	if overridePort > 0 {
		target.Port = overridePort
	}
	target.Reachable = sshReachable(ctx, target.Address, target.Port)
	if !target.Reachable {
		return sshTargetDetails{}, fmt.Errorf("ssh target is not reachable from the server")
	}
	return target, nil
}

func sshReachable(ctx context.Context, host string, port int) bool {
	dialer := net.Dialer{Timeout: 3 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(host, fmt.Sprintf("%d", port)))
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

func sanitizeSSHAddress(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if host, _, found := strings.Cut(value, "/"); found {
		value = strings.TrimSpace(host)
	}
	return value
}

func sanitizeSSHInventoryAddress(value string) string {
	value = sanitizeSSHAddress(value)
	if value == "" {
		return ""
	}
	ip := net.ParseIP(value)
	if ip == nil {
		return ""
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return value
	}
	return ""
}

func (server *apiServer) assetSSHWebsocket(c *gin.Context) {
	rawToken := extractWebSocketBearerToken(c.Request)
	if rawToken == "" {
		httpx.Error(c, http.StatusBadRequest, "token is required")
		return
	}
	if !server.websocketOriginAllowed(c.GetHeader("Origin")) {
		httpx.Error(c, http.StatusForbidden, "origin not allowed")
		return
	}
	claims, err := server.auth.ParseToken(rawToken)
	if err != nil {
		httpx.Error(c, http.StatusUnauthorized, "invalid token")
		return
	}
	c.Set(middleware.ClaimsKey, claims)
	if claims.Role != "super_admin" && claims.Role != "it_team" {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	asset, err := server.fetchAsset(strings.TrimSpace(c.Param("id")))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "ssh terminal is only available for compute assets")
		return
	}
	target, err := server.resolveSSHTarget(c.Request.Context(), asset)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	responseHeader := http.Header{}
	if protocol := selectSSHSubprotocol(c.Request); protocol != "" {
		responseHeader.Set("Sec-WebSocket-Protocol", protocol)
	}
	upgrader := websocket.Upgrader{CheckOrigin: func(request *http.Request) bool {
		return server.websocketOriginAllowed(request.Header.Get("Origin"))
	}}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, responseHeader)
	if err != nil {
		return
	}
	defer conn.Close()
	conn.SetReadLimit(sshWebsocketReadLimit)
	_ = conn.SetReadDeadline(time.Now().Add(sshWebsocketReadTimeout))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(sshWebsocketReadTimeout))
	})

	sshClient, sshSession, stdin, stdout, stderr, connectedUsername, err := server.openSSHSession(target)
	if err != nil {
		_ = conn.WriteJSON(sshWebsocketEnvelope{Type: "error", Message: err.Error()})
		return
	}
	target.Username = connectedUsername
	defer sshClient.Close()
	defer sshSession.Close()

	writeMu := sync.Mutex{}
	send := func(message sshWebsocketEnvelope) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = conn.SetWriteDeadline(time.Now().Add(sshWebsocketWriteTimeout))
		return conn.WriteJSON(message)
	}
	sendControl := func(messageType int, payload []byte) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return conn.WriteControl(messageType, payload, time.Now().Add(sshWebsocketWriteTimeout))
	}

	if err := send(sshWebsocketEnvelope{Type: "ready", Message: fmt.Sprintf("Connected to %s@%s:%d", target.Username, target.Address, target.Port), Username: target.Username}); err != nil {
		return
	}

	closeOnce := sync.Once{}
	closeAll := func() {
		closeOnce.Do(func() {
			_ = stdin.Close()
			_ = sshSession.Close()
			_ = sshClient.Close()
		})
	}

	forward := func(reader io.Reader) {
		buffer := make([]byte, 4096)
		for {
			count, readErr := reader.Read(buffer)
			if count > 0 {
				if sendErr := send(sshWebsocketEnvelope{Type: "output", Data: string(buffer[:count])}); sendErr != nil {
					closeAll()
					return
				}
			}
			if readErr != nil {
				if readErr != io.EOF {
					_ = send(sshWebsocketEnvelope{Type: "error", Message: readErr.Error()})
				}
				return
			}
		}
	}
	go forward(stdout)
	go forward(stderr)

	waitDone := make(chan error, 1)
	go func() {
		waitDone <- sshSession.Wait()
	}()
	pingTicker := time.NewTicker(sshWebsocketPingPeriod)
	defer pingTicker.Stop()
	messageCh := make(chan sshWebsocketEnvelope)
	readErrCh := make(chan error, 1)
	go func() {
		for {
			var message sshWebsocketEnvelope
			if err := conn.ReadJSON(&message); err != nil {
				readErrCh <- err
				return
			}
			messageCh <- message
		}
	}()

	for {
		select {
		case <-pingTicker.C:
			if err := sendControl(websocket.PingMessage, nil); err != nil {
				closeAll()
				return
			}
		case waitErr := <-waitDone:
			if waitErr != nil && !strings.Contains(strings.ToLower(waitErr.Error()), "closed") {
				_ = send(sshWebsocketEnvelope{Type: "error", Message: waitErr.Error()})
			}
			_ = sendControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "ssh session closed"))
			_ = send(sshWebsocketEnvelope{Type: "exit", Message: "SSH session closed."})
			closeAll()
			return
		case err := <-readErrCh:
			_ = err
			_ = sendControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "client disconnected"))
			closeAll()
			return
		case message := <-messageCh:
			switch strings.ToLower(strings.TrimSpace(message.Type)) {
			case "input":
				if message.Data != "" {
					if _, err := io.WriteString(stdin, message.Data); err != nil {
						_ = send(sshWebsocketEnvelope{Type: "error", Message: err.Error()})
						closeAll()
						return
					}
				}
			case "resize":
				cols := message.Cols
				rows := message.Rows
				if cols <= 0 {
					cols = 120
				}
				if rows <= 0 {
					rows = 36
				}
				if err := sshSession.WindowChange(rows, cols); err != nil {
					_ = send(sshWebsocketEnvelope{Type: "error", Message: err.Error()})
				}
			}
		}
	}
}

func (server *apiServer) openSSHSession(target sshTargetDetails) (*gossh.Client, *gossh.Session, io.WriteCloser, io.Reader, io.Reader, string, error) {
	signer, err := server.loadSSHSigner()
	if err != nil {
		return nil, nil, nil, nil, nil, "", err
	}
	fingerprint := gossh.FingerprintSHA256(signer.PublicKey())
	hostKeyCallback, err := server.sshHostKeyCallback()
	if err != nil {
		return nil, nil, nil, nil, nil, "", err
	}
	usernames := target.Usernames
	if len(usernames) == 0 {
		usernames = parseSSHUsernameCandidates(target.Username)
	}
	var lastErr error
	for _, username := range usernames {
		clientConfig := &gossh.ClientConfig{
			User:            username,
			Auth:            []gossh.AuthMethod{gossh.PublicKeys(signer)},
			HostKeyCallback: hostKeyCallback,
			Timeout:         5 * time.Second,
		}
		client, err := gossh.Dial("tcp", net.JoinHostPort(target.Address, fmt.Sprintf("%d", target.Port)), clientConfig)
		if err != nil {
			lastErr = err
			if isSSHAuthFailure(err) {
				continue
			}
			return nil, nil, nil, nil, nil, "", err
		}
		session, err := client.NewSession()
		if err != nil {
			client.Close()
			return nil, nil, nil, nil, nil, "", err
		}
		stdin, err := session.StdinPipe()
		if err != nil {
			session.Close()
			client.Close()
			return nil, nil, nil, nil, nil, "", err
		}
		stdout, err := session.StdoutPipe()
		if err != nil {
			session.Close()
			client.Close()
			return nil, nil, nil, nil, nil, "", err
		}
		stderr, err := session.StderrPipe()
		if err != nil {
			session.Close()
			client.Close()
			return nil, nil, nil, nil, nil, "", err
		}
		terminalModes := gossh.TerminalModes{
			gossh.ECHO:          1,
			gossh.TTY_OP_ISPEED: 14400,
			gossh.TTY_OP_OSPEED: 14400,
		}
		if err := session.RequestPty("xterm-256color", 36, 120, terminalModes); err != nil {
			session.Close()
			client.Close()
			return nil, nil, nil, nil, nil, "", err
		}
		if err := session.Shell(); err != nil {
			session.Close()
			client.Close()
			return nil, nil, nil, nil, nil, "", err
		}
		return client, session, stdin, stdout, stderr, username, nil
	}
	if lastErr != nil {
		return nil, nil, nil, nil, nil, "", fmt.Errorf("ssh authentication failed for users %s using configured key %s: %w", strings.Join(usernames, ", "), fingerprint, lastErr)
	}
	return nil, nil, nil, nil, nil, "", fmt.Errorf("ssh authentication failed: no usernames configured")
}

func (server *apiServer) assetLoggedInUsers(ctx context.Context, assetID string) []string {
	var loggedInUsersRaw []byte
	err := server.db.QueryRowContext(ctx, `
		SELECT COALESCE(logged_in_users_json, '[]'::jsonb)
		FROM asset_compute_details
		WHERE asset_id = $1::uuid
	`, assetID).Scan(&loggedInUsersRaw)
	if err != nil {
		return nil
	}
	users := make([]string, 0)
	if len(loggedInUsersRaw) > 0 {
		_ = json.Unmarshal(loggedInUsersRaw, &users)
	}
	return parseSSHUsernameCandidates(strings.Join(users, ","))
}

func (server *apiServer) loadSSHSigner() (gossh.Signer, error) {
	var privateSigner gossh.Signer
	if inlineKey := strings.TrimSpace(server.config.SSHTerminalPrivateKey); inlineKey != "" {
		signer, err := gossh.ParsePrivateKey([]byte(inlineKey))
		if err != nil {
			return nil, err
		}
		privateSigner = signer
	} else {
		keyPath := strings.TrimSpace(server.config.SSHTerminalPrivateKeyPath)
		if keyPath == "" {
			return nil, fmt.Errorf("ssh terminal private key is not configured on the server")
		}
		privateKey, err := os.ReadFile(keyPath)
		if err != nil {
			return nil, err
		}
		signer, err := gossh.ParsePrivateKey(privateKey)
		if err != nil {
			return nil, err
		}
		privateSigner = signer
	}

	certificatePath := strings.TrimSpace(server.config.SSHTerminalCertificatePath)
	if certificatePath == "" {
		return privateSigner, nil
	}

	certificateBytes, err := os.ReadFile(certificatePath)
	if err != nil {
		return nil, err
	}
	certificateKey, _, _, _, err := gossh.ParseAuthorizedKey(certificateBytes)
	if err != nil {
		return nil, err
	}
	certificate, ok := certificateKey.(*gossh.Certificate)
	if !ok {
		return nil, fmt.Errorf("ssh terminal certificate is not a valid SSH certificate")
	}
	return gossh.NewCertSigner(certificate, privateSigner)
}

func (server *apiServer) sshConfiguredKeyFingerprint() (string, error) {
	signer, err := server.loadSSHSigner()
	if err != nil {
		return "", err
	}
	return gossh.FingerprintSHA256(signer.PublicKey()), nil
}

func (server *apiServer) sshHostKeyCallback() (gossh.HostKeyCallback, error) {
	if !server.config.SSHTerminalStrictHostKey {
		return gossh.InsecureIgnoreHostKey(), nil
	}
	knownHostsPath := strings.TrimSpace(server.config.SSHTerminalKnownHostsPath)
	if knownHostsPath == "" {
		return nil, fmt.Errorf("SSH_TERMINAL_KNOWN_HOSTS_PATH is required when strict host key verification is enabled")
	}
	return knownhosts.New(knownHostsPath)
}

func parseSSHHostOverrides(raw string) map[string]sshHostOverride {
	overrides := make(map[string]sshHostOverride)
	for _, entry := range strings.Split(raw, ",") {
		left, right, ok := strings.Cut(strings.TrimSpace(entry), "=")
		if !ok {
			continue
		}
		hostname := strings.ToLower(strings.TrimSpace(left))
		override := parseSSHHostOverrideValue(strings.TrimSpace(right))
		address := strings.TrimSpace(override.Address)
		if hostname == "" || address == "" {
			continue
		}
		overrides[hostname] = override
	}
	return overrides
}

func parseSSHUsernameCandidates(raw string) []string {
	items := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r' || r == '\t' || r == ' '
	})
	result := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		candidate := strings.TrimSpace(item)
		if candidate == "" {
			continue
		}
		if _, ok := seen[candidate]; ok {
			continue
		}
		seen[candidate] = struct{}{}
		result = append(result, candidate)
	}
	return result
}

func mergeSSHUsernameCandidates(groups ...[]string) []string {
	result := make([]string, 0)
	seen := make(map[string]struct{})
	for _, group := range groups {
		for _, item := range group {
			candidate := strings.TrimSpace(item)
			if candidate == "" {
				continue
			}
			if _, ok := seen[candidate]; ok {
				continue
			}
			seen[candidate] = struct{}{}
			result = append(result, candidate)
		}
	}
	return result
}

func isSSHAuthFailure(err error) bool {
	if err == nil {
		return false
	}
	normalized := strings.ToLower(err.Error())
	return strings.Contains(normalized, "unable to authenticate") || strings.Contains(normalized, "no supported methods remain") || strings.Contains(normalized, "permission denied")
}

func parseSSHHostOverrideValue(value string) sshHostOverride {
	value = strings.TrimSpace(value)
	if value == "" {
		return sshHostOverride{}
	}
	username := ""
	if at := strings.Index(value, "@"); at > 0 {
		candidateUser := strings.TrimSpace(value[:at])
		candidateHost := strings.TrimSpace(value[at+1:])
		if candidateUser != "" && candidateHost != "" && !strings.Contains(candidateUser, ":") {
			username = candidateUser
			value = candidateHost
		}
	}
	if host, portText, err := net.SplitHostPort(value); err == nil {
		port, parseErr := strconv.Atoi(portText)
		if parseErr == nil && port > 0 && port <= 65535 {
			return sshHostOverride{Address: strings.TrimSpace(host), Port: port, Username: username}
		}
	}
	if idx := strings.LastIndex(value, ":"); idx > 0 && !strings.Contains(value[idx+1:], ":") {
		port, err := strconv.Atoi(strings.TrimSpace(value[idx+1:]))
		if err == nil && port > 0 && port <= 65535 {
			return sshHostOverride{Address: strings.TrimSpace(value[:idx]), Port: port, Username: username}
		}
	}
	return sshHostOverride{Address: value, Username: username}
}

func selectSSHSubprotocol(request *http.Request) string {
	for _, protocol := range websocketSubprotocols(request) {
		if protocol == sshWebsocketProtocol {
			return protocol
		}
	}
	return ""
}

func (envelope sshWebsocketEnvelope) marshal() []byte {
	payload, _ := json.Marshal(envelope)
	return payload
}

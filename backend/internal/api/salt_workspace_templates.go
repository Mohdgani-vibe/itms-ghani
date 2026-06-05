package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"
)

const saltWorkspaceTemplatesKey = "salt_workspace_templates"

type saltWorkspaceTemplate struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	Name        string `json:"name"`
	Description string `json:"description"`
	StateName   string `json:"stateName"`
	Content     string `json:"content"`
	UpdatedAt   string `json:"updatedAt"`
}

type saltWorkspaceTemplatesResponse struct {
	Templates []saltWorkspaceTemplate `json:"templates"`
	UpdatedAt string                  `json:"updatedAt,omitempty"`
}

func normalizeSaltWorkspaceTemplates(templates []saltWorkspaceTemplate) []saltWorkspaceTemplate {
	normalized := make([]saltWorkspaceTemplate, 0, len(templates))
	seenIDs := make(map[string]struct{}, len(templates))
	for _, template := range templates {
		normalizedTemplate := saltWorkspaceTemplate{
			ID:          strings.TrimSpace(template.ID),
			Kind:        strings.ToLower(strings.TrimSpace(template.Kind)),
			Name:        strings.TrimSpace(template.Name),
			Description: strings.TrimSpace(template.Description),
			StateName:   strings.TrimSpace(template.StateName),
			Content:     strings.TrimSpace(template.Content),
			UpdatedAt:   strings.TrimSpace(template.UpdatedAt),
		}
		if normalizedTemplate.Kind == "shell" {
			normalizedTemplate.StateName = ""
		}
		if normalizedTemplate.ID == "" || normalizedTemplate.Name == "" || normalizedTemplate.Content == "" {
			continue
		}
		if normalizedTemplate.Kind != "sls" && normalizedTemplate.Kind != "shell" {
			continue
		}
		if normalizedTemplate.Kind == "sls" && normalizedTemplate.StateName == "" {
			continue
		}
		if _, exists := seenIDs[normalizedTemplate.ID]; exists {
			continue
		}
		parsedUpdatedAt, err := time.Parse(time.RFC3339, normalizedTemplate.UpdatedAt)
		if err != nil {
			parsedUpdatedAt = time.Now().UTC()
		}
		normalizedTemplate.UpdatedAt = parsedUpdatedAt.UTC().Format(time.RFC3339)
		normalized = append(normalized, normalizedTemplate)
		seenIDs[normalizedTemplate.ID] = struct{}{}
	}
	return normalized
}

func validateSaltWorkspaceTemplates(templates []saltWorkspaceTemplate) error {
	for index, template := range templates {
		position := index + 1
		kind := strings.ToLower(strings.TrimSpace(template.Kind))
		if kind != "sls" && kind != "shell" {
			return fmt.Errorf("template %d must use kind sls or shell", position)
		}
		if strings.TrimSpace(template.ID) == "" {
			return fmt.Errorf("template %d must include an id", position)
		}
		if strings.TrimSpace(template.Name) == "" {
			return fmt.Errorf("template %d must include a name", position)
		}
		if kind == "sls" && strings.TrimSpace(template.StateName) == "" {
			return fmt.Errorf("template %d must include a state name", position)
		}
		if strings.TrimSpace(template.Content) == "" {
			return fmt.Errorf("template %d must include content", position)
		}
	}
	return nil
}

func (server *apiServer) getSaltWorkspaceTemplatesRecord() (saltWorkspaceTemplatesResponse, error) {
	response := saltWorkspaceTemplatesResponse{Templates: []saltWorkspaceTemplate{}}
	var raw string
	var updatedAt time.Time
	err := server.db.QueryRow(`SELECT value, updated_at FROM settings WHERE key = $1`, saltWorkspaceTemplatesKey).Scan(&raw, &updatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return response, nil
		}
		return response, err
	}
	if strings.TrimSpace(raw) != "" {
		if err := json.Unmarshal([]byte(raw), &response.Templates); err != nil {
			return saltWorkspaceTemplatesResponse{Templates: []saltWorkspaceTemplate{}}, nil
		}
	}
	response.Templates = normalizeSaltWorkspaceTemplates(response.Templates)
	response.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return response, nil
}

func (server *apiServer) saveSaltWorkspaceTemplatesRecord(templates []saltWorkspaceTemplate) (saltWorkspaceTemplatesResponse, error) {
	normalized := normalizeSaltWorkspaceTemplates(templates)
	payload, err := json.Marshal(normalized)
	if err != nil {
		return saltWorkspaceTemplatesResponse{}, err
	}
	var updatedAt time.Time
	err = server.db.QueryRow(`
		INSERT INTO settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key)
		DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		RETURNING updated_at
	`, saltWorkspaceTemplatesKey, string(payload)).Scan(&updatedAt)
	if err != nil {
		return saltWorkspaceTemplatesResponse{}, err
	}
	return saltWorkspaceTemplatesResponse{
		Templates: normalized,
		UpdatedAt: updatedAt.UTC().Format(time.RFC3339),
	}, nil
}

func (server *apiServer) getSaltWorkspaceTemplates(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "auditor") {
		return
	}
	response, err := server.getSaltWorkspaceTemplatesRecord()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, response)
}

func (server *apiServer) updateSaltWorkspaceTemplates(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input saltWorkspaceTemplatesResponse
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid salt workspace templates payload")
		return
	}
	if err := validateSaltWorkspaceTemplates(input.Templates); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	response, err := server.saveSaltWorkspaceTemplatesRecord(input.Templates)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "settings_changed", TargetType: "settings", TargetID: saltWorkspaceTemplatesKey, Detail: response})
	httpx.JSON(c, http.StatusOK, response)
}
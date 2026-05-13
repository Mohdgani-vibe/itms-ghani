package chatbridge

import (
	"fmt"
	"regexp"
	"strings"
)

var mattermostSlugPattern = regexp.MustCompile(`[^a-z0-9]+`)

func buildMattermostChannelName(kind string, name string, channelID string) string {
	kindSlug := mattermostSlug(kind)
	if kindSlug == "" {
		kindSlug = "chat"
	}
	nameSlug := mattermostSlug(name)
	if nameSlug == "" {
		nameSlug = kindSlug
	}
	suffix := mattermostChannelSuffix(channelID)
	base := fmt.Sprintf("itms-%s-%s", kindSlug, nameSlug)
	if suffix == "" {
		if len(base) > 64 {
			return strings.Trim(base[:64], "-")
		}
		return base
	}
	maxBaseLen := 64 - len(suffix) - 1
	if maxBaseLen < 1 {
		maxBaseLen = 1
	}
	if len(base) > maxBaseLen {
		base = strings.Trim(base[:maxBaseLen], "-")
	}
	return strings.Trim(base+"-"+suffix, "-")
}

func formatMattermostPost(authorName string, body string) string {
	body = strings.TrimSpace(body)
	authorName = strings.TrimSpace(authorName)
	if body == "" {
		return ""
	}
	if authorName == "" {
		return body
	}
	return fmt.Sprintf("**%s**: %s", authorName, body)
}

func mattermostSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = mattermostSlugPattern.ReplaceAllString(value, "-")
	return strings.Trim(value, "-")
}

func mattermostChannelSuffix(channelID string) string {
	trimmed := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(channelID), "-", ""))
	if len(trimmed) > 8 {
		trimmed = trimmed[:8]
	}
	return mattermostSlug(trimmed)
}
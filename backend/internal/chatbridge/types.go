package chatbridge

type ChannelLink struct {
	ChatChannelID       string
	Provider            string
	ExternalTeamID      string
	ExternalChannelID   string
	ExternalChannelName string
	SyncDirection       string
}

type MessageLink struct {
	ChatMessageID      string
	Provider           string
	ExternalPostID     string
	ExternalChannelID  string
	Direction          string
}

type EnsureChannelLinkInput struct {
	ChatChannelID string
	ChannelName   string
	ChannelKind   string
}

type OutboundMessageInput struct {
	ChatChannelID string
	ChannelName   string
	ChannelKind   string
	ChatMessageID string
	AuthorName    string
	Body          string
}
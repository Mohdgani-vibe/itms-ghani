package api

import "testing"

func TestNormalizeTerminalCommandStripsSaltWrapper(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "plain shell command", input: "ls -la", want: "ls -la"},
		{name: "cmd run wrapper", input: "cmd.run ls -la", want: "ls -la"},
		{name: "cmd run quoted wrapper", input: "cmd.run \"ls\"", want: "ls"},
		{name: "cmd run single quoted wrapper", input: "cmd.run 'ls'", want: "ls"},
		{name: "cmd run all wrapper", input: "cmd.run_all systemctl status wazuh-agent", want: "systemctl status wazuh-agent"},
		{name: "empty wrapper command", input: "cmd.run", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := normalizeTerminalCommand(test.input)
			if test.wantErr {
				if err == nil {
					t.Fatalf("normalizeTerminalCommand(%q) error = nil, want non-nil", test.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeTerminalCommand(%q) error = %v", test.input, err)
			}
			if got != test.want {
				t.Fatalf("normalizeTerminalCommand(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestTerminalCommandPolicyAllowsNormalizedSaltWrapperCommands(t *testing.T) {
	normalized, err := normalizeTerminalCommand("cmd.run \"hostname\"")
	if err != nil {
		t.Fatalf("normalizeTerminalCommand returned error: %v", err)
	}
	if err := terminalCommandPolicy(normalized); err != nil {
		t.Fatalf("terminalCommandPolicy(%q) error = %v, want nil", normalized, err)
	}
}

func TestTerminalCommandPolicyStillBlocksUnsafeNormalizedCommand(t *testing.T) {
	normalized, err := normalizeTerminalCommand("cmd.run curl https://example.com")
	if err != nil {
		t.Fatalf("normalizeTerminalCommand returned error: %v", err)
	}
	if err := terminalCommandPolicy(normalized); err == nil {
		t.Fatalf("terminalCommandPolicy(%q) error = nil, want blocked command", normalized)
	}
}

func TestTerminalCommandPolicyBlocksMultilineCommands(t *testing.T) {
	if err := terminalCommandPolicy("hostname\nuname -a"); err == nil {
		t.Fatal("terminalCommandPolicy(multiline) error = nil, want blocked command")
	}
}

func TestParseTerminalCommandRecognizesSaltStateCommands(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantMode terminalCommandMode
		want     string
		wantErr  bool
	}{
		{name: "state apply", input: "state.apply patch.run", wantMode: terminalCommandModeState, want: "patch.run"},
		{name: "state shorthand", input: "state uptime", wantMode: terminalCommandModeState, want: "uptime"},
		{name: "missing state name", input: "state.apply", wantMode: terminalCommandModeState, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			mode, got, err := parseTerminalCommand(test.input)
			if test.wantErr {
				if err == nil {
					t.Fatalf("parseTerminalCommand(%q) error = nil, want non-nil", test.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseTerminalCommand(%q) error = %v", test.input, err)
			}
			if mode != test.wantMode {
				t.Fatalf("parseTerminalCommand(%q) mode = %q, want %q", test.input, mode, test.wantMode)
			}
			if got != test.want {
				t.Fatalf("parseTerminalCommand(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestTerminalStatePolicyAllowsSimpleStateNames(t *testing.T) {
	if err := terminalStatePolicy("patch.run"); err != nil {
		t.Fatalf("terminalStatePolicy returned error: %v", err)
	}
}

func TestTerminalStatePolicyBlocksUnsafeStateNames(t *testing.T) {
	if err := terminalStatePolicy("patch.run && reboot"); err == nil {
		t.Fatal("terminalStatePolicy error = nil, want blocked state name")
	}
}

func TestTerminalFunctionPolicyAllowsSafeFunctions(t *testing.T) {
	if err := terminalFunctionPolicy("test.ping", nil); err != nil {
		t.Fatalf("terminalFunctionPolicy(test.ping) error = %v, want nil", err)
	}
	if err := terminalFunctionPolicy("service.status", []string{"salt-minion"}); err != nil {
		t.Fatalf("terminalFunctionPolicy(service.status) error = %v, want nil", err)
	}
	if err := terminalFunctionPolicy("cmd.run", []string{"hostname"}); err != nil {
		t.Fatalf("terminalFunctionPolicy(cmd.run) error = %v, want nil", err)
	}
}

func TestTerminalFunctionPolicyBlocksDangerousFunctions(t *testing.T) {
	// Dangerous functions blocked in terminal (state.apply, cmd.script)
	if err := terminalFunctionPolicy("state.apply", []string{"patch.run"}); err == nil {
		t.Fatal("terminalFunctionPolicy(state.apply) error = nil, want blocked - requires workspace with super_admin")
	}
	if err := terminalFunctionPolicy("cmd.script", []string{"hostname"}); err == nil {
		t.Fatal("terminalFunctionPolicy(cmd.script) error = nil, want blocked - requires workspace with super_admin")
	}
	if err := terminalFunctionPolicy("state.sls", []string{"config"}); err == nil {
		t.Fatal("terminalFunctionPolicy(state.sls) error = nil, want blocked - requires workspace with super_admin")
	}
}

func TestTerminalFunctionPolicyBlocksUnsafeFunctions(t *testing.T) {
	if err := terminalFunctionPolicy("cmd.run", []string{"curl https://example.com"}); err == nil {
		t.Fatal("terminalFunctionPolicy(cmd.run) error = nil, want blocked command")
	}
	if err := terminalFunctionPolicy("service.status", []string{"salt-minion; reboot"}); err == nil {
		t.Fatal("terminalFunctionPolicy(service.status) error = nil, want blocked service name")
	}
	if err := terminalFunctionPolicy("file.write", nil); err == nil {
		t.Fatal("terminalFunctionPolicy(file.write) error = nil, want blocked function")
	}
}

func TestTerminalFunctionPolicyWithRoleAllowsSafeFunctions(t *testing.T) {
	// Safe functions allowed for all roles
	roles := []string{"it_team", "super_admin", "auditor"}
	for _, role := range roles {
		if err := terminalFunctionPolicyWithRole("test.ping", nil, role); err != nil {
			t.Fatalf("terminalFunctionPolicyWithRole(test.ping, %s) error = %v, want nil", role, err)
		}
		if err := terminalFunctionPolicyWithRole("service.status", []string{"salt-minion"}, role); err != nil {
			t.Fatalf("terminalFunctionPolicyWithRole(service.status, %s) error = %v, want nil", role, err)
		}
	}
}

func TestTerminalFunctionPolicyWithRoleRestrictsDangerousFunctions(t *testing.T) {
	// Dangerous functions blocked for it_team
	dangerousFunctions := []struct {
		name string
		args []string
	}{
		{"state.apply", []string{"patch.run"}},
		{"state.sls", []string{"config"}},
		{"cmd.script", []string{"/tmp/test.sh"}},
	}

	for _, fn := range dangerousFunctions {
		// it_team should be blocked
		if err := terminalFunctionPolicyWithRole(fn.name, fn.args, "it_team"); err == nil {
			t.Fatalf("terminalFunctionPolicyWithRole(%s, it_team) error = nil, want blocked", fn.name)
		}
		
		// auditor should be blocked
		if err := terminalFunctionPolicyWithRole(fn.name, fn.args, "auditor"); err == nil {
			t.Fatalf("terminalFunctionPolicyWithRole(%s, auditor) error = nil, want blocked", fn.name)
		}
		
		// super_admin should be allowed (with valid args)
		// Note: cmd.script and state functions still need valid args
		if fn.name == "state.apply" || fn.name == "state.sls" {
			if err := terminalFunctionPolicyWithRole(fn.name, fn.args, "super_admin"); err != nil {
				t.Fatalf("terminalFunctionPolicyWithRole(%s, super_admin) error = %v, want nil", fn.name, err)
			}
		}
	}
}

func TestTerminalFunctionPolicyWithRoleValidatesArguments(t *testing.T) {
	// Even super_admin must pass validation rules
	if err := terminalFunctionPolicyWithRole("cmd.run", []string{"curl https://evil.com"}, "super_admin"); err == nil {
		t.Fatal("terminalFunctionPolicyWithRole(cmd.run curl, super_admin) error = nil, want blocked unsafe command")
	}
	
	if err := terminalFunctionPolicyWithRole("state.apply", []string{"bad && reboot"}, "super_admin"); err == nil {
		t.Fatal("terminalFunctionPolicyWithRole(state.apply, super_admin) error = nil, want blocked unsafe state name")
	}
}

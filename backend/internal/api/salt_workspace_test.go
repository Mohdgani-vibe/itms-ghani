package api

import "testing"

func TestNormalizeSaltWorkspaceSLSName(t *testing.T) {
	testCases := []struct {
		name    string
		relPath string
		want    string
	}{
		{name: "state file", relPath: "patch/run.sls", want: "patch/run"},
		{name: "directory init file", relPath: "patch/run/init.sls", want: "patch/run"},
		{name: "nested init directory preserved", relPath: "roles/init/bootstrap.sls", want: "roles/init/bootstrap"},
		{name: "root init file remains addressable", relPath: "init.sls", want: "init"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got := normalizeSaltWorkspaceSLSName(testCase.relPath)
			if got != testCase.want {
				t.Fatalf("normalizeSaltWorkspaceSLSName(%q) = %q, want %q", testCase.relPath, got, testCase.want)
			}
		})
	}
}
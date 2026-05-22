package api

import (
	"testing"
	"time"
)

func TestEvaluatePatchPolicyAllowsOvernightWindow(t *testing.T) {
	settings := normalizeWorkflowSettings(workflowSettings{
		PatchWindowEnabled: true,
		PatchWindowStart:   "22:00",
		PatchWindowEnd:     "06:00",
	})

	decision := evaluatePatchPolicy(time.Date(2026, time.May, 8, 23, 15, 0, 0, time.UTC), "IT Operations", settings)
	if !decision.Allowed {
		t.Fatalf("evaluatePatchPolicy allowed = false, want true: %+v", decision)
	}
	if !decision.WithinWindow {
		t.Fatalf("evaluatePatchPolicy withinWindow = false, want true: %+v", decision)
	}
}

func TestEvaluatePatchPolicyBlocksOutsideWindow(t *testing.T) {
	settings := normalizeWorkflowSettings(workflowSettings{
		PatchWindowEnabled: true,
		PatchWindowStart:   "22:00",
		PatchWindowEnd:     "06:00",
	})

	decision := evaluatePatchPolicy(time.Date(2026, time.May, 8, 14, 0, 0, 0, time.UTC), "IT Operations", settings)
	if decision.Allowed {
		t.Fatalf("evaluatePatchPolicy allowed = true, want false: %+v", decision)
	}
	if decision.Reason == "" {
		t.Fatalf("evaluatePatchPolicy reason = empty, want block reason: %+v", decision)
	}
}

func TestEvaluatePatchPolicyBlocksDisallowedRing(t *testing.T) {
	settings := normalizeWorkflowSettings(workflowSettings{
		PatchAllowedRings: []string{"pilot"},
		PatchDepartmentRings: []patchDepartmentRing{
			{Match: "Finance", Ring: "broad"},
		},
	})

	decision := evaluatePatchPolicy(time.Date(2026, time.May, 8, 23, 0, 0, 0, time.UTC), "Finance", settings)
	if decision.Allowed {
		t.Fatalf("evaluatePatchPolicy allowed = true, want false: %+v", decision)
	}
	if decision.Ring != "broad" {
		t.Fatalf("evaluatePatchPolicy ring = %q, want broad", decision.Ring)
	}
}

func TestValidatePatchPolicySettingsRejectsIncompleteWindow(t *testing.T) {
	err := validatePatchPolicySettings(workflowSettings{PatchWindowEnabled: true, PatchWindowStart: "22:00"})
	if err == nil {
		t.Fatal("validatePatchPolicySettings error = nil, want non-nil")
	}
}

func TestNormalizeWorkflowSettingsDropsRedundantStandardDepartmentRing(t *testing.T) {
	settings := normalizeWorkflowSettings(workflowSettings{
		PatchDepartmentRings: []patchDepartmentRing{
			{Match: " Finance ", Ring: "standard"},
			{Match: "IT", Ring: "critical"},
		},
	})

	if len(settings.PatchDepartmentRings) != 1 {
		t.Fatalf("patch department ring count = %d, want 1", len(settings.PatchDepartmentRings))
	}
	if settings.PatchDepartmentRings[0].Match != "it" || settings.PatchDepartmentRings[0].Ring != "critical" {
		t.Fatalf("patch department rings = %+v, want only critical IT override", settings.PatchDepartmentRings)
	}
}
package notifications

import "gorm.io/datatypes"

func DefaultCategories() datatypes.JSONMap {
	return datatypes.JSONMap{
		"monitoring_alerts":    map[string]bool{"email": true, "push": true},
		"financial_updates":    map[string]bool{"email": true, "push": false},
		"system_announcements": map[string]bool{"email": true, "push": true},
		"project_updates":      map[string]bool{"email": true, "push": true},
		"team_collaboration":   map[string]bool{"email": false, "push": true},
	}
}

// MergeWithInheritance supports org-level defaults by accepting special keys:
// `_org_defaults` and `_user_overrides`, and returns `_effective` in the payload.
func MergeWithInheritance(input map[string]interface{}) datatypes.JSONMap {
	if input == nil {
		return datatypes.JSONMap{}
	}
	out := datatypes.JSONMap(input)
	orgDefaults, _ := input["_org_defaults"].(map[string]interface{})
	userOverrides, _ := input["_user_overrides"].(map[string]interface{})
	if orgDefaults == nil || userOverrides == nil {
		return out
	}
	effective := map[string]interface{}{}
	for k, v := range orgDefaults {
		effective[k] = v
	}
	for k, v := range userOverrides {
		effective[k] = v
	}
	out["_effective"] = effective
	return out
}

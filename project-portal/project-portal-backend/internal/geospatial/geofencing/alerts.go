package geofencing

import "fmt"

func BuildAlertMessage(projectID string, geofenceName, eventType string) string {
	return fmt.Sprintf("project %s triggered %s on geofence %s", projectID, eventType, geofenceName)
}

package profile

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

func BuildProfilePictureURL(cdnBase string, userID uuid.UUID, filename string) string {
	name := strings.TrimSpace(filename)
	if name == "" {
		name = "profile.jpg"
	}
	return fmt.Sprintf("%s/settings/profiles/%s/%s", strings.TrimRight(cdnBase, "/"), userID.String(), filepath.Base(name))
}

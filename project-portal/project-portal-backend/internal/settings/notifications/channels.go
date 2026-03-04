package notifications

func MergeChannelPreference(current bool, update *bool) bool {
	if update == nil {
		return current
	}
	return *update
}

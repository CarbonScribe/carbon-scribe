package financing

const (
	CreditStatusCalculated = "calculated"
	CreditStatusVerified   = "verified"
	CreditStatusMinting    = "minting"
	CreditStatusMinted     = "minted"
	CreditStatusRetired    = "retired"
)

func isMintableStatus(status string) bool {
	return status == CreditStatusCalculated || status == CreditStatusVerified
}

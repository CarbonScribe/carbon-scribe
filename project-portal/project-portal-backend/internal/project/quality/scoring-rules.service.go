package quality

// Scoring rules and evaluation logic

const (
	RegistryWeight      = 30
	AuthorityWeight     = 20
	MethodologyWeight   = 20
	VersionWeight       = 15
	DocumentationWeight = 15
)

// Scoring rule types
const (
	RuleTypeRegistry      = "REGISTRY"
	RuleTypeAuthority     = "AUTHORITY"
	RuleTypeMethodology   = "METHODOLOGY"
	RuleTypeVersion       = "VERSION"
	RuleTypeDocumentation = "DOCUMENTATION"
)

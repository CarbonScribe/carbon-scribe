package v1

// FinancingAPIEndpointPrefix is the API prefix for financing and tokenization endpoints.
const FinancingAPIEndpointPrefix = "/api/v1/financing"

var FinancingEndpoints = []string{
	"POST /api/v1/financing/projects/:id/calculate",
	"GET /api/v1/financing/projects/:id/credits",
	"POST /api/v1/financing/credits/mint",
	"GET /api/v1/financing/credits/:id/status",
	"POST /api/v1/financing/credits/forward-sale",
	"GET /api/v1/financing/pricing/quote",
	"POST /api/v1/financing/payments/initiate",
	"POST /api/v1/financing/payouts/distribute",
	"GET /api/v1/financing/payouts/:id",
	"POST /api/v1/financing/webhooks/stellar",
	"POST /api/v1/financing/webhooks/payment",
}

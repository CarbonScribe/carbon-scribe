package stellar

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	projectmethodology "carbon-scribe/project-portal/project-portal-backend/internal/project/methodology"

	rpcclient "github.com/stellar/go/clients/rpcclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

const defaultSorobanRPCURL = "https://soroban-testnet.stellar.org:443"
const defaultMethodologyContractID = "CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP"

type MethodologyMetadata struct {
	IPFSCID          string
	IssuingAuthority string
	Registry         string
}

type SupplyCapConfig struct {
	MethodologyTokenID int
	MaxSupply          int64
	CapPerProject      *int64
	CapPerVintage      *int64
	Metadata           MethodologyMetadata
	RawConfiguration   map[string]any
	SourceType         string
	SourceReference    string
}

type MethodologyClient interface {
	GetSupplyCapConfiguration(ctx context.Context, methodologyTokenID int) (*projectmethodology.CapConfigEnvelope, error)
}

type realMethodologyClient struct {
	contractID        string
	rpc               *rpcclient.Client
	networkPassphrase string
	sourceAddress     string
	httpClient        *http.Client
	ipfsGateway       string
}

type mockMethodologyClient struct {
	defaultMaxSupply int64
}

func NewMethodologyClientFromEnv() MethodologyClient {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("METHODOLOGY_CAP_USE_MOCK")), "true") {
		return &mockMethodologyClient{defaultMaxSupply: readDefaultMockCap()}
	}
	client, err := newRealMethodologyClientFromEnv()
	if err != nil {
		return &mockMethodologyClient{defaultMaxSupply: readDefaultMockCap()}
	}
	return client
}

func readDefaultMockCap() int64 {
	if raw := strings.TrimSpace(os.Getenv("METHODOLOGY_DEFAULT_MAX_SUPPLY")); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil && parsed > 0 {
			return parsed
		}
	}
	return 1_000_000
}

func newRealMethodologyClientFromEnv() (*realMethodologyClient, error) {
	contractID := strings.TrimSpace(os.Getenv("METHODOLOGY_LIBRARY_CONTRACT_ID"))
	if contractID == "" {
		contractID = defaultMethodologyContractID
	}

	rpcURL := strings.TrimSpace(os.Getenv("STELLAR_RPC_URL"))
	if rpcURL == "" {
		rpcURL = defaultSorobanRPCURL
	}

	networkPassphrase := strings.TrimSpace(os.Getenv("STELLAR_NETWORK_PASSPHRASE"))
	if networkPassphrase == "" {
		networkPassphrase = network.TestNetworkPassphrase
	}

	sourceAddress := strings.TrimSpace(os.Getenv("METHODOLOGY_QUERY_ADDRESS"))
	if sourceAddress == "" {
		seed := strings.TrimSpace(os.Getenv("METHODOLOGY_AUTHORITY_SECRET_KEY"))
		if seed == "" {
			seed = strings.TrimSpace(os.Getenv("STELLAR_SECRET_KEY"))
		}
		if seed != "" {
			kp, err := keypair.ParseFull(seed)
			if err != nil {
				return nil, fmt.Errorf("parse stellar secret key: %w", err)
			}
			sourceAddress = kp.Address()
		}
	}
	if sourceAddress == "" {
		return nil, fmt.Errorf("missing METHODOLOGY_QUERY_ADDRESS or STELLAR_SECRET_KEY")
	}

	ipfsGateway := strings.TrimSpace(os.Getenv("IPFS_GATEWAY_URL"))
	if ipfsGateway == "" {
		ipfsGateway = "https://ipfs.io/ipfs/"
	}
	if !strings.HasSuffix(ipfsGateway, "/") {
		ipfsGateway += "/"
	}

	return &realMethodologyClient{
		contractID:        contractID,
		rpc:               rpcclient.NewClient(rpcURL, http.DefaultClient),
		networkPassphrase: networkPassphrase,
		sourceAddress:     sourceAddress,
		httpClient:        &http.Client{Timeout: 8 * time.Second},
		ipfsGateway:       ipfsGateway,
	}, nil
}

func (m *mockMethodologyClient) GetSupplyCapConfiguration(ctx context.Context, methodologyTokenID int) (*projectmethodology.CapConfigEnvelope, error) {
	if methodologyTokenID <= 0 {
		return nil, fmt.Errorf("invalid methodology token id")
	}
	maxSupply := m.defaultMaxSupply
	if raw := strings.TrimSpace(os.Getenv("METHODOLOGY_DEFAULT_MAX_SUPPLY")); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil && parsed > 0 {
			maxSupply = parsed
		}
	}
	return &projectmethodology.CapConfigEnvelope{
		MethodologyTokenID: methodologyTokenID,
		MaxSupply:          maxSupply,
		RawConfiguration: map[string]any{
			"max_supply": maxSupply,
		},
		SourceType:      "CONTRACT",
		SourceReference: "mock",
	}, nil
}

func (c *realMethodologyClient) GetSupplyCapConfiguration(ctx context.Context, methodologyTokenID int) (*projectmethodology.CapConfigEnvelope, error) {
	if methodologyTokenID <= 0 {
		return nil, fmt.Errorf("invalid methodology token id")
	}

	meta, metaRaw, err := c.getMethodologyMetadata(ctx, methodologyTokenID)
	if err != nil {
		return nil, err
	}

	cfg := &projectmethodology.CapConfigEnvelope{
		MethodologyTokenID: methodologyTokenID,
		RawConfiguration:   metaRaw,
		SourceType:         "CONTRACT",
		SourceReference:    c.contractID,
	}

	if maxSupply, capPerProject, capPerVintage, ok := extractCaps(metaRaw); ok {
		cfg.MaxSupply = maxSupply
		cfg.CapPerProject = capPerProject
		cfg.CapPerVintage = capPerVintage
		return cfg, nil
	}

	if strings.TrimSpace(meta.IPFSCID) == "" {
		return nil, fmt.Errorf("methodology token %d has no cap data on contract metadata or ipfs_cid", methodologyTokenID)
	}

	ipfsCfg, err := c.loadCapFromIPFS(ctx, meta.IPFSCID)
	if err != nil {
		return nil, err
	}
	cfg.MaxSupply = ipfsCfg.MaxSupply
	cfg.CapPerProject = ipfsCfg.CapPerProject
	cfg.CapPerVintage = ipfsCfg.CapPerVintage
	cfg.RawConfiguration = ipfsCfg.RawConfiguration
	cfg.SourceType = projectmethodology.CapSourceContract
	cfg.SourceReference = fmt.Sprintf("%s%s", c.ipfsGateway, meta.IPFSCID)
	return cfg, nil
}

func (c *realMethodologyClient) getMethodologyMetadata(ctx context.Context, methodologyTokenID int) (MethodologyMetadata, map[string]any, error) {
	response, err := c.simulateCall(ctx, "get_methodology", []xdr.ScVal{u32Val(uint32(methodologyTokenID))})
	if err != nil {
		return MethodologyMetadata{}, nil, err
	}
	if response.ReturnValueXDR == nil {
		return MethodologyMetadata{}, nil, fmt.Errorf("get_methodology returned no value")
	}

	var returnVal xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(*response.ReturnValueXDR, &returnVal); err != nil {
		return MethodologyMetadata{}, nil, fmt.Errorf("decode get_methodology result: %w", err)
	}

	raw := scValToAny(returnVal)
	asMap, ok := raw.(map[string]any)
	if !ok {
		return MethodologyMetadata{}, nil, fmt.Errorf("unexpected get_methodology return type")
	}

	meta := MethodologyMetadata{
		IPFSCID:          readString(asMap, "ipfs_cid"),
		IssuingAuthority: readString(asMap, "issuing_authority"),
		Registry:         readString(asMap, "registry"),
	}
	return meta, asMap, nil
}

func (c *realMethodologyClient) loadCapFromIPFS(ctx context.Context, cid string) (*projectmethodology.CapConfigEnvelope, error) {
	endpoint := c.ipfsGateway + strings.TrimSpace(cid)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch cap config from ipfs: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("ipfs gateway returned %d for %s", resp.StatusCode, endpoint)
	}

	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode cap config from ipfs: %w", err)
	}

	maxSupply, capPerProject, capPerVintage, ok := extractCaps(payload)
	if !ok {
		return nil, fmt.Errorf("no supply cap keys found in ipfs payload")
	}

	return &projectmethodology.CapConfigEnvelope{
		MaxSupply:        maxSupply,
		CapPerProject:    capPerProject,
		CapPerVintage:    capPerVintage,
		RawConfiguration: payload,
	}, nil
}

func (c *realMethodologyClient) simulateCall(ctx context.Context, function string, args []xdr.ScVal) (protocol.SimulateHostFunctionResult, error) {
	account, err := c.rpc.LoadAccount(ctx, c.sourceAddress)
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, fmt.Errorf("load stellar source account: %w", err)
	}

	contractAddress, err := contractScAddress(c.contractID)
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, err
	}

	op := txnbuild.InvokeHostFunction{
		HostFunction: xdr.HostFunction{
			Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
			InvokeContract: &xdr.InvokeContractArgs{
				ContractAddress: contractAddress,
				FunctionName:    xdr.ScSymbol(function),
				Args:            args,
			},
		},
		SourceAccount: c.sourceAddress,
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{&op},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(120)},
	})
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, fmt.Errorf("build simulation tx: %w", err)
	}
	encodedTx, err := tx.Base64()
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, fmt.Errorf("encode simulation tx: %w", err)
	}

	sim, err := c.rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: encodedTx, Format: protocol.FormatBase64})
	if err != nil {
		return protocol.SimulateHostFunctionResult{}, fmt.Errorf("simulate %s: %w", function, err)
	}
	if sim.Error != "" {
		return protocol.SimulateHostFunctionResult{}, fmt.Errorf("simulate %s failed: %s", function, sim.Error)
	}
	if len(sim.Results) == 0 {
		return protocol.SimulateHostFunctionResult{}, fmt.Errorf("simulate %s returned no results", function)
	}
	return sim.Results[0], nil
}

func extractCaps(payload map[string]any) (int64, *int64, *int64, bool) {
	maxSupply, ok := findInt64(payload, "max_supply", "maxSupply", "supply_cap", "supplyCap", "maximum_supply")
	if !ok || maxSupply <= 0 {
		return 0, nil, nil, false
	}
	capPerProject, hasProjectCap := findInt64(payload, "cap_per_project", "capPerProject", "project_cap", "projectCap")
	capPerVintage, hasVintageCap := findInt64(payload, "cap_per_vintage", "capPerVintage", "vintage_cap", "vintageCap")

	var projectPtr *int64
	if hasProjectCap && capPerProject > 0 {
		projectPtr = &capPerProject
	}
	var vintagePtr *int64
	if hasVintageCap && capPerVintage > 0 {
		vintagePtr = &capPerVintage
	}

	return maxSupply, projectPtr, vintagePtr, true
}

func findInt64(payload map[string]any, keys ...string) (int64, bool) {
	for _, key := range keys {
		if value, ok := payload[key]; ok {
			if parsed, ok := parseInt64(value); ok {
				return parsed, true
			}
		}
	}
	for _, value := range payload {
		nested, ok := value.(map[string]any)
		if !ok {
			continue
		}
		if parsed, ok := findInt64(nested, keys...); ok {
			return parsed, true
		}
	}
	return 0, false
}

func parseInt64(value any) (int64, bool) {
	switch v := value.(type) {
	case int:
		return int64(v), true
	case int32:
		return int64(v), true
	case int64:
		return v, true
	case float64:
		return int64(v), true
	case json.Number:
		parsed, err := v.Int64()
		return parsed, err == nil
	case string:
		parsed, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		return parsed, err == nil
	default:
		return 0, false
	}
}

func readString(m map[string]any, key string) string {
	value, ok := m[key]
	if !ok {
		return ""
	}
	str, _ := value.(string)
	return strings.TrimSpace(str)
}

func contractScAddress(contractID string) (xdr.ScAddress, error) {
	decoded, err := strkey.Decode(strkey.VersionByteContract, contractID)
	if err != nil {
		return xdr.ScAddress{}, fmt.Errorf("decode contract id: %w", err)
	}
	var id xdr.ContractId
	copy(id[:], decoded)
	return xdr.ScAddress{Type: xdr.ScAddressTypeScAddressTypeContract, ContractId: &id}, nil
}

func u32Val(value uint32) xdr.ScVal {
	scVal, _ := xdr.NewScVal(xdr.ScValTypeScvU32, xdr.Uint32(value))
	return scVal
}

func scValToAny(value xdr.ScVal) any {
	switch value.Type {
	case xdr.ScValTypeScvVoid:
		return nil
	case xdr.ScValTypeScvBool:
		return value.MustB()
	case xdr.ScValTypeScvU32:
		return int64(value.MustU32())
	case xdr.ScValTypeScvI32:
		return int64(value.MustI32())
	case xdr.ScValTypeScvU64:
		return int64(value.MustU64())
	case xdr.ScValTypeScvI64:
		return value.MustI64()
	case xdr.ScValTypeScvString:
		return string(value.MustStr())
	case xdr.ScValTypeScvSymbol:
		return string(value.MustSym())
	case xdr.ScValTypeScvMap:
		entries := value.MustMap()
		out := make(map[string]any, len(*entries))
		for _, entry := range *entries {
			out[fmt.Sprint(scValToAny(entry.Key))] = scValToAny(entry.Val)
		}
		return out
	case xdr.ScValTypeScvVec:
		vec := value.MustVec()
		out := make([]any, 0, len(*vec))
		for _, item := range *vec {
			out = append(out, scValToAny(item))
		}
		return out
	default:
		return nil
	}
}

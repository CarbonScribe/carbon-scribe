package elastic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
)

// Config holds Elasticsearch configuration
type Config struct {
	Addresses []string
	Username  string
	Password  string
	CloudID   string
	APIKey    string
}

// Client wraps the elasticsearch client
type Client struct {
	es *elasticsearch.Client
}

// NewClient creates a new Elasticsearch client
func NewClient(cfg Config) (*Client, error) {
	esCfg := elasticsearch.Config{
		Addresses: cfg.Addresses,
		Username:  cfg.Username,
		Password:  cfg.Password,
		CloudID:   cfg.CloudID,
		APIKey:    cfg.APIKey,
	}

	es, err := elasticsearch.NewClient(esCfg)
	if err != nil {
		return nil, fmt.Errorf("error creating elasticsearch client: %w", err)
	}

	// Verify connection
	res, err := es.Info()
	if err != nil {
		return nil, fmt.Errorf("error getting response from elasticsearch: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("error from elasticsearch: %s", res.String())
	}

	return &Client{es: es}, nil
}

// CreateIndex creates an index with the given mapping
func (c *Client) CreateIndex(ctx context.Context, indexName string, mapping interface{}) error {
	body, err := json.Marshal(mapping)
	if err != nil {
		return fmt.Errorf("error marshaling mapping: %w", err)
	}

	req := esapi.IndicesCreateRequest{
		Index: indexName,
		Body:  bytes.NewReader(body),
	}

	res, err := req.Do(ctx, c.es)
	if err != nil {
		return fmt.Errorf("error creating index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("error creating index response: %s", res.String())
	}

	return nil
}

// IndexExists checks if an index exists
func (c *Client) IndexExists(ctx context.Context, indexName string) (bool, error) {
	req := esapi.IndicesExistsRequest{
		Index: []string{indexName},
	}

	res, err := req.Do(ctx, c.es)
	if err != nil {
		return false, fmt.Errorf("error checking index existence: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == 200 {
		return true, nil
	}
	if res.StatusCode == 404 {
		return false, nil
	}

	return false, fmt.Errorf("error checking index existence response: %s", res.String())
}

// IndexDocument indexes a document
func (c *Client) IndexDocument(ctx context.Context, indexName string, docID string, doc interface{}) error {
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("error marshaling document: %w", err)
	}

	req := esapi.IndexRequest{
		Index:      indexName,
		DocumentID: docID,
		Body:       bytes.NewReader(body),
		Refresh:    "true",
	}

	res, err := req.Do(ctx, c.es)
	if err != nil {
		return fmt.Errorf("error indexing document: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("error indexing document response: %s", res.String())
	}

	return nil
}

// Search performs a search query
func (c *Client) Search(ctx context.Context, indexName string, query interface{}) (map[string]interface{}, error) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, fmt.Errorf("error encoding query: %w", err)
	}

	req := esapi.SearchRequest{
		Index: []string{indexName},
		Body:  &buf,
	}

	res, err := req.Do(ctx, c.es)
	if err != nil {
		return nil, fmt.Errorf("error performing search: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("error search response: %s", res.String())
	}

	var r map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&r); err != nil {
		return nil, fmt.Errorf("error parsing the response body: %w", err)
	}

	return r, nil
}

// Health checks the cluster health
func (c *Client) Health(ctx context.Context) error {
	res, err := c.es.Cluster.Health()
	if err != nil {
		return fmt.Errorf("error getting health: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("health check failed: %s", res.String())
	}
	return nil
}

package builder

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// ReportDesigner provides functionality for designing report configurations
type ReportDesigner struct {
	dataSources map[string]*DataSourceSchema
}

// DataSourceSchema represents the schema of a data source
type DataSourceSchema struct {
	Name        string        `json:"name"`
	DisplayName string        `json:"display_name"`
	Description string        `json:"description,omitempty"`
	Fields      []FieldSchema `json:"fields"`
	Relations   []Relation    `json:"relations,omitempty"`
}

// FieldSchema represents a field in a data source
type FieldSchema struct {
	Name         string   `json:"name"`
	Type         string   `json:"type"` // string, number, integer, boolean, date, timestamp, uuid
	Label        string   `json:"label"`
	Description  string   `json:"description,omitempty"`
	Nullable     bool     `json:"nullable"`
	DefaultValue any      `json:"default_value,omitempty"`
	EnumValues   []string `json:"enum_values,omitempty"` // For string fields with predefined values
	Format       string   `json:"format,omitempty"`      // date-time, email, uri, etc.
	Filterable   bool     `json:"filterable"`
	Sortable     bool     `json:"sortable"`
	Groupable    bool     `json:"groupable"`
	Aggregatable bool     `json:"aggregatable"`
}

// Relation represents a relationship between data sources
type Relation struct {
	Name             string `json:"name"`
	TargetDataSource string `json:"target_data_source"`
	Type             string `json:"type"` // one-to-one, one-to-many, many-to-one
	LocalField       string `json:"local_field"`
	ForeignField     string `json:"foreign_field"`
}

// ReportSchema represents the schema for a report configuration
type ReportSchema struct {
	ID          uuid.UUID            `json:"id"`
	Name        string               `json:"name"`
	Description string               `json:"description,omitempty"`
	DataSource  string               `json:"data_source"`
	Columns     []ColumnDefinition   `json:"columns"`
	Filters     []FilterDefinition   `json:"filters,omitempty"`
	Groupings   []GroupingDefinition `json:"groupings,omitempty"`
	Sorts       []SortDefinition     `json:"sorts,omitempty"`
	Aggregates  []AggregateDefinition `json:"aggregates,omitempty"`
	Parameters  []ParameterDefinition `json:"parameters,omitempty"`
}

// ColumnDefinition defines a column in a report
type ColumnDefinition struct {
	Field       string `json:"field"`
	Alias       string `json:"alias,omitempty"`
	Label       string `json:"label"`
	Type        string `json:"type"`
	Format      string `json:"format,omitempty"`
	Width       int    `json:"width,omitempty"`
	Alignment   string `json:"alignment,omitempty"` // left, center, right
	IsVisible   bool   `json:"is_visible"`
	IsSortable  bool   `json:"is_sortable"`
	IsGroupable bool   `json:"is_groupable"`
}

// FilterDefinition defines a filter in a report
type FilterDefinition struct {
	Field        string `json:"field"`
	Operator     string `json:"operator"`
	Value        any    `json:"value,omitempty"`
	IsRequired   bool   `json:"is_required"`
	IsUserInput  bool   `json:"is_user_input"`  // Allow user to specify value at runtime
	DefaultValue any    `json:"default_value,omitempty"`
	Logic        string `json:"logic,omitempty"` // AND, OR
}

// GroupingDefinition defines a grouping in a report
type GroupingDefinition struct {
	Field     string `json:"field"`
	Label     string `json:"label,omitempty"`
	SortOrder int    `json:"sort_order"`
}

// SortDefinition defines a sort in a report
type SortDefinition struct {
	Field     string `json:"field"`
	Direction string `json:"direction"` // asc, desc
	Priority  int    `json:"priority"`
}

// AggregateDefinition defines an aggregate calculation
type AggregateDefinition struct {
	Field    string `json:"field"`
	Function string `json:"function"` // SUM, AVG, COUNT, MIN, MAX
	Alias    string `json:"alias"`
	Label    string `json:"label"`
	Format   string `json:"format,omitempty"`
}

// ParameterDefinition defines a runtime parameter
type ParameterDefinition struct {
	Name         string `json:"name"`
	Label        string `json:"label"`
	Type         string `json:"type"` // string, number, date, boolean, select
	IsRequired   bool   `json:"is_required"`
	DefaultValue any    `json:"default_value,omitempty"`
	Options      []ParameterOption `json:"options,omitempty"` // For select type
	Validation   *ParameterValidation `json:"validation,omitempty"`
}

// ParameterOption defines an option for select-type parameters
type ParameterOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// ParameterValidation defines validation rules for a parameter
type ParameterValidation struct {
	MinLength *int     `json:"min_length,omitempty"`
	MaxLength *int     `json:"max_length,omitempty"`
	Min       *float64 `json:"min,omitempty"`
	Max       *float64 `json:"max,omitempty"`
	Pattern   string   `json:"pattern,omitempty"`
}

// NewReportDesigner creates a new report designer
func NewReportDesigner() *ReportDesigner {
	designer := &ReportDesigner{
		dataSources: make(map[string]*DataSourceSchema),
	}

	// Register default data sources
	designer.registerDefaultDataSources()

	return designer
}

// registerDefaultDataSources registers the default data sources
func (d *ReportDesigner) registerDefaultDataSources() {
	// Projects data source
	d.dataSources["projects"] = &DataSourceSchema{
		Name:        "projects",
		DisplayName: "Carbon Projects",
		Description: "Carbon credit projects with status, location, and methodology information",
		Fields: []FieldSchema{
			{Name: "id", Type: "uuid", Label: "Project ID", Filterable: true, Sortable: true},
			{Name: "name", Type: "string", Label: "Project Name", Filterable: true, Sortable: true, Groupable: true},
			{Name: "status", Type: "string", Label: "Status", Filterable: true, Sortable: true, Groupable: true, EnumValues: []string{"draft", "pending", "active", "completed", "suspended"}},
			{Name: "methodology", Type: "string", Label: "Methodology", Filterable: true, Sortable: true, Groupable: true},
			{Name: "region", Type: "string", Label: "Region", Filterable: true, Sortable: true, Groupable: true},
			{Name: "country", Type: "string", Label: "Country", Filterable: true, Sortable: true, Groupable: true},
			{Name: "total_area_hectares", Type: "number", Label: "Total Area (ha)", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "estimated_credits", Type: "number", Label: "Estimated Credits", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "created_at", Type: "timestamp", Label: "Created Date", Filterable: true, Sortable: true},
			{Name: "updated_at", Type: "timestamp", Label: "Updated Date", Filterable: true, Sortable: true},
		},
	}

	// Carbon Credits data source
	d.dataSources["carbon_credits"] = &DataSourceSchema{
		Name:        "carbon_credits",
		DisplayName: "Carbon Credits",
		Description: "Carbon credit issuance and tracking information",
		Fields: []FieldSchema{
			{Name: "id", Type: "uuid", Label: "Credit ID", Filterable: true, Sortable: true},
			{Name: "project_id", Type: "uuid", Label: "Project ID", Filterable: true},
			{Name: "vintage_year", Type: "integer", Label: "Vintage Year", Filterable: true, Sortable: true, Groupable: true},
			{Name: "methodology_code", Type: "string", Label: "Methodology", Filterable: true, Sortable: true, Groupable: true},
			{Name: "calculated_tons", Type: "number", Label: "Calculated Tons", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "buffered_tons", Type: "number", Label: "Buffered Tons", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "issued_tons", Type: "number", Label: "Issued Tons", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "status", Type: "string", Label: "Status", Filterable: true, Sortable: true, Groupable: true, EnumValues: []string{"calculated", "verified", "minted", "retired"}},
			{Name: "data_quality_score", Type: "number", Label: "Data Quality Score", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "minted_at", Type: "timestamp", Label: "Minted Date", Filterable: true, Sortable: true, Nullable: true},
			{Name: "created_at", Type: "timestamp", Label: "Created Date", Filterable: true, Sortable: true},
		},
		Relations: []Relation{
			{Name: "project", TargetDataSource: "projects", Type: "many-to-one", LocalField: "project_id", ForeignField: "id"},
		},
	}

	// Monitoring Data source
	d.dataSources["monitoring_data"] = &DataSourceSchema{
		Name:        "monitoring_data",
		DisplayName: "Monitoring Data",
		Description: "Satellite and IoT monitoring metrics",
		Fields: []FieldSchema{
			{Name: "id", Type: "uuid", Label: "Record ID", Filterable: true, Sortable: true},
			{Name: "project_id", Type: "uuid", Label: "Project ID", Filterable: true},
			{Name: "metric_type", Type: "string", Label: "Metric Type", Filterable: true, Sortable: true, Groupable: true, EnumValues: []string{"ndvi", "biomass", "soil_carbon", "temperature", "precipitation"}},
			{Name: "value", Type: "number", Label: "Value", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "unit", Type: "string", Label: "Unit", Filterable: true, Groupable: true},
			{Name: "source", Type: "string", Label: "Data Source", Filterable: true, Sortable: true, Groupable: true, EnumValues: []string{"satellite", "iot", "manual", "drone"}},
			{Name: "confidence_score", Type: "number", Label: "Confidence Score", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "recorded_at", Type: "timestamp", Label: "Recorded Date", Filterable: true, Sortable: true},
		},
		Relations: []Relation{
			{Name: "project", TargetDataSource: "projects", Type: "many-to-one", LocalField: "project_id", ForeignField: "id"},
		},
	}

	// Revenue/Transactions data source
	d.dataSources["revenue_transactions"] = &DataSourceSchema{
		Name:        "revenue_transactions",
		DisplayName: "Revenue & Transactions",
		Description: "Financial transactions and revenue tracking",
		Fields: []FieldSchema{
			{Name: "id", Type: "uuid", Label: "Transaction ID", Filterable: true, Sortable: true},
			{Name: "project_id", Type: "uuid", Label: "Project ID", Filterable: true},
			{Name: "amount", Type: "number", Label: "Amount", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "currency", Type: "string", Label: "Currency", Filterable: true, Sortable: true, Groupable: true, EnumValues: []string{"USD", "EUR", "GBP", "XLM"}},
			{Name: "transaction_type", Type: "string", Label: "Transaction Type", Filterable: true, Sortable: true, Groupable: true, EnumValues: []string{"sale", "forward_sale", "auction", "refund"}},
			{Name: "status", Type: "string", Label: "Status", Filterable: true, Sortable: true, Groupable: true, EnumValues: []string{"pending", "completed", "failed", "refunded"}},
			{Name: "payment_method", Type: "string", Label: "Payment Method", Filterable: true, Sortable: true, Groupable: true},
			{Name: "tons_sold", Type: "number", Label: "Tons Sold", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "price_per_ton", Type: "number", Label: "Price per Ton", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "created_at", Type: "timestamp", Label: "Transaction Date", Filterable: true, Sortable: true},
		},
		Relations: []Relation{
			{Name: "project", TargetDataSource: "projects", Type: "many-to-one", LocalField: "project_id", ForeignField: "id"},
		},
	}

	// Forward Sales data source
	d.dataSources["forward_sales"] = &DataSourceSchema{
		Name:        "forward_sales",
		DisplayName: "Forward Sales",
		Description: "Forward sale agreements",
		Fields: []FieldSchema{
			{Name: "id", Type: "uuid", Label: "Agreement ID", Filterable: true, Sortable: true},
			{Name: "project_id", Type: "uuid", Label: "Project ID", Filterable: true},
			{Name: "buyer_id", Type: "uuid", Label: "Buyer ID", Filterable: true},
			{Name: "vintage_year", Type: "integer", Label: "Vintage Year", Filterable: true, Sortable: true, Groupable: true},
			{Name: "tons_committed", Type: "number", Label: "Tons Committed", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "price_per_ton", Type: "number", Label: "Price per Ton", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "total_amount", Type: "number", Label: "Total Amount", Filterable: true, Sortable: true, Aggregatable: true},
			{Name: "currency", Type: "string", Label: "Currency", Filterable: true, Sortable: true, Groupable: true},
			{Name: "status", Type: "string", Label: "Status", Filterable: true, Sortable: true, Groupable: true, EnumValues: []string{"draft", "pending", "active", "completed", "cancelled"}},
			{Name: "delivery_date", Type: "date", Label: "Delivery Date", Filterable: true, Sortable: true},
			{Name: "deposit_percent", Type: "number", Label: "Deposit %", Filterable: true, Sortable: true},
			{Name: "created_at", Type: "timestamp", Label: "Created Date", Filterable: true, Sortable: true},
		},
		Relations: []Relation{
			{Name: "project", TargetDataSource: "projects", Type: "many-to-one", LocalField: "project_id", ForeignField: "id"},
		},
	}
}

// GetDataSources returns all available data sources
func (d *ReportDesigner) GetDataSources() []*DataSourceSchema {
	sources := make([]*DataSourceSchema, 0, len(d.dataSources))
	for _, source := range d.dataSources {
		sources = append(sources, source)
	}
	return sources
}

// GetDataSource returns a specific data source by name
func (d *ReportDesigner) GetDataSource(name string) (*DataSourceSchema, error) {
	source, ok := d.dataSources[name]
	if !ok {
		return nil, fmt.Errorf("data source not found: %s", name)
	}
	return source, nil
}

// GetFieldsForDataSource returns the fields for a specific data source
func (d *ReportDesigner) GetFieldsForDataSource(name string) ([]FieldSchema, error) {
	source, ok := d.dataSources[name]
	if !ok {
		return nil, fmt.Errorf("data source not found: %s", name)
	}
	return source.Fields, nil
}

// CreateReportSchema creates a new report schema with the given configuration
func (d *ReportDesigner) CreateReportSchema(dataSource string, columns []ColumnDefinition) (*ReportSchema, error) {
	// Validate data source exists
	source, err := d.GetDataSource(dataSource)
	if err != nil {
		return nil, err
	}

	// Validate columns
	fieldMap := make(map[string]FieldSchema)
	for _, field := range source.Fields {
		fieldMap[field.Name] = field
	}

	for _, col := range columns {
		if _, ok := fieldMap[col.Field]; !ok {
			return nil, fmt.Errorf("field not found in data source: %s", col.Field)
		}
	}

	schema := &ReportSchema{
		ID:         uuid.New(),
		DataSource: dataSource,
		Columns:    columns,
	}

	return schema, nil
}

// ToJSON converts a report schema to JSON
func (s *ReportSchema) ToJSON() ([]byte, error) {
	return json.Marshal(s)
}

// FromJSON creates a report schema from JSON
func FromJSON(data []byte) (*ReportSchema, error) {
	var schema ReportSchema
	if err := json.Unmarshal(data, &schema); err != nil {
		return nil, err
	}
	return &schema, nil
}

// GetFilterableFields returns fields that can be used for filtering
func (d *ReportDesigner) GetFilterableFields(dataSource string) ([]FieldSchema, error) {
	source, err := d.GetDataSource(dataSource)
	if err != nil {
		return nil, err
	}

	var filterable []FieldSchema
	for _, field := range source.Fields {
		if field.Filterable {
			filterable = append(filterable, field)
		}
	}
	return filterable, nil
}

// GetSortableFields returns fields that can be used for sorting
func (d *ReportDesigner) GetSortableFields(dataSource string) ([]FieldSchema, error) {
	source, err := d.GetDataSource(dataSource)
	if err != nil {
		return nil, err
	}

	var sortable []FieldSchema
	for _, field := range source.Fields {
		if field.Sortable {
			sortable = append(sortable, field)
		}
	}
	return sortable, nil
}

// GetGroupableFields returns fields that can be used for grouping
func (d *ReportDesigner) GetGroupableFields(dataSource string) ([]FieldSchema, error) {
	source, err := d.GetDataSource(dataSource)
	if err != nil {
		return nil, err
	}

	var groupable []FieldSchema
	for _, field := range source.Fields {
		if field.Groupable {
			groupable = append(groupable, field)
		}
	}
	return groupable, nil
}

// GetAggregatableFields returns fields that can be aggregated
func (d *ReportDesigner) GetAggregatableFields(dataSource string) ([]FieldSchema, error) {
	source, err := d.GetDataSource(dataSource)
	if err != nil {
		return nil, err
	}

	var aggregatable []FieldSchema
	for _, field := range source.Fields {
		if field.Aggregatable {
			aggregatable = append(aggregatable, field)
		}
	}
	return aggregatable, nil
}

// GetSupportedOperators returns supported filter operators for a field type
func GetSupportedOperators(fieldType string) []string {
	switch fieldType {
	case "string":
		return []string{"eq", "neq", "contains", "starts_with", "ends_with", "in", "not_in", "is_null", "is_not_null"}
	case "number", "integer":
		return []string{"eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "not_in", "is_null", "is_not_null"}
	case "date", "timestamp":
		return []string{"eq", "neq", "gt", "gte", "lt", "lte", "between", "is_null", "is_not_null"}
	case "boolean":
		return []string{"eq", "neq", "is_null", "is_not_null"}
	case "uuid":
		return []string{"eq", "neq", "in", "not_in", "is_null", "is_not_null"}
	default:
		return []string{"eq", "neq", "is_null", "is_not_null"}
	}
}

// GetSupportedAggregates returns supported aggregate functions for a field type
func GetSupportedAggregates(fieldType string) []string {
	switch fieldType {
	case "number", "integer":
		return []string{"SUM", "AVG", "COUNT", "MIN", "MAX"}
	case "date", "timestamp":
		return []string{"COUNT", "MIN", "MAX"}
	default:
		return []string{"COUNT"}
	}
}

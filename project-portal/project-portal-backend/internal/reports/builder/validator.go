package builder

import (
	"fmt"
	"regexp"
	"strings"
)

// Validator validates report configurations
type Validator struct {
	designer *ReportDesigner
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ValidationResult contains the result of validation
type ValidationResult struct {
	IsValid bool              `json:"is_valid"`
	Errors  []ValidationError `json:"errors,omitempty"`
}

// NewValidator creates a new validator
func NewValidator(designer *ReportDesigner) *Validator {
	return &Validator{
		designer: designer,
	}
}

// ValidateReportSchema validates a complete report schema
func (v *Validator) ValidateReportSchema(schema *ReportSchema) *ValidationResult {
	result := &ValidationResult{IsValid: true}

	// Validate data source
	if schema.DataSource == "" {
		result.addError("data_source", "required", "Data source is required")
	} else {
		if _, err := v.designer.GetDataSource(schema.DataSource); err != nil {
			result.addError("data_source", "invalid", fmt.Sprintf("Invalid data source: %s", schema.DataSource))
		}
	}

	// Validate columns
	if len(schema.Columns) == 0 {
		result.addError("columns", "required", "At least one column is required")
	} else {
		for i, col := range schema.Columns {
			v.validateColumn(col, schema.DataSource, i, result)
		}
	}

	// Validate filters
	for i, filter := range schema.Filters {
		v.validateFilter(filter, schema.DataSource, i, result)
	}

	// Validate groupings
	for i, grouping := range schema.Groupings {
		v.validateGrouping(grouping, schema.DataSource, i, result)
	}

	// Validate sorts
	for i, sort := range schema.Sorts {
		v.validateSort(sort, schema.DataSource, i, result)
	}

	// Validate aggregates
	for i, agg := range schema.Aggregates {
		v.validateAggregate(agg, schema.DataSource, i, result)
	}

	// Validate parameters
	for i, param := range schema.Parameters {
		v.validateParameter(param, i, result)
	}

	result.IsValid = len(result.Errors) == 0
	return result
}

// validateColumn validates a single column definition
func (v *Validator) validateColumn(col ColumnDefinition, dataSource string, index int, result *ValidationResult) {
	fieldPath := fmt.Sprintf("columns[%d]", index)

	if col.Field == "" {
		result.addError(fieldPath+".field", "required", "Column field is required")
		return
	}

	// Check if field exists in data source
	fields, err := v.designer.GetFieldsForDataSource(dataSource)
	if err == nil {
		found := false
		for _, f := range fields {
			if f.Name == col.Field {
				found = true
				break
			}
		}
		if !found {
			result.addError(fieldPath+".field", "invalid", fmt.Sprintf("Field '%s' not found in data source", col.Field))
		}
	}

	// Validate alignment
	if col.Alignment != "" && col.Alignment != "left" && col.Alignment != "center" && col.Alignment != "right" {
		result.addError(fieldPath+".alignment", "invalid", "Alignment must be 'left', 'center', or 'right'")
	}

	// Validate width
	if col.Width < 0 {
		result.addError(fieldPath+".width", "invalid", "Width must be non-negative")
	}
}

// validateFilter validates a single filter definition
func (v *Validator) validateFilter(filter FilterDefinition, dataSource string, index int, result *ValidationResult) {
	fieldPath := fmt.Sprintf("filters[%d]", index)

	if filter.Field == "" {
		result.addError(fieldPath+".field", "required", "Filter field is required")
		return
	}

	if filter.Operator == "" {
		result.addError(fieldPath+".operator", "required", "Filter operator is required")
		return
	}

	// Check if field exists and get its type
	fields, err := v.designer.GetFieldsForDataSource(dataSource)
	if err == nil {
		var fieldType string
		found := false
		for _, f := range fields {
			if f.Name == filter.Field {
				found = true
				fieldType = f.Type
				if !f.Filterable {
					result.addError(fieldPath+".field", "not_filterable", fmt.Sprintf("Field '%s' is not filterable", filter.Field))
				}
				break
			}
		}
		if !found {
			result.addError(fieldPath+".field", "invalid", fmt.Sprintf("Field '%s' not found in data source", filter.Field))
		} else {
			// Validate operator is supported for field type
			supportedOps := GetSupportedOperators(fieldType)
			opSupported := false
			for _, op := range supportedOps {
				if op == filter.Operator {
					opSupported = true
					break
				}
			}
			if !opSupported {
				result.addError(fieldPath+".operator", "invalid", fmt.Sprintf("Operator '%s' not supported for field type '%s'", filter.Operator, fieldType))
			}
		}
	}

	// Validate logic
	if filter.Logic != "" && filter.Logic != "AND" && filter.Logic != "OR" {
		result.addError(fieldPath+".logic", "invalid", "Logic must be 'AND' or 'OR'")
	}

	// Value is required for most operators
	if filter.Value == nil && !filter.IsUserInput {
		switch filter.Operator {
		case "is_null", "is_not_null":
			// These operators don't need a value
		default:
			if !filter.IsUserInput {
				result.addError(fieldPath+".value", "required", "Filter value is required")
			}
		}
	}
}

// validateGrouping validates a single grouping definition
func (v *Validator) validateGrouping(grouping GroupingDefinition, dataSource string, index int, result *ValidationResult) {
	fieldPath := fmt.Sprintf("groupings[%d]", index)

	if grouping.Field == "" {
		result.addError(fieldPath+".field", "required", "Grouping field is required")
		return
	}

	// Check if field exists and is groupable
	fields, err := v.designer.GetFieldsForDataSource(dataSource)
	if err == nil {
		found := false
		for _, f := range fields {
			if f.Name == grouping.Field {
				found = true
				if !f.Groupable {
					result.addError(fieldPath+".field", "not_groupable", fmt.Sprintf("Field '%s' is not groupable", grouping.Field))
				}
				break
			}
		}
		if !found {
			result.addError(fieldPath+".field", "invalid", fmt.Sprintf("Field '%s' not found in data source", grouping.Field))
		}
	}
}

// validateSort validates a single sort definition
func (v *Validator) validateSort(sort SortDefinition, dataSource string, index int, result *ValidationResult) {
	fieldPath := fmt.Sprintf("sorts[%d]", index)

	if sort.Field == "" {
		result.addError(fieldPath+".field", "required", "Sort field is required")
		return
	}

	if sort.Direction == "" {
		result.addError(fieldPath+".direction", "required", "Sort direction is required")
	} else if sort.Direction != "asc" && sort.Direction != "desc" {
		result.addError(fieldPath+".direction", "invalid", "Sort direction must be 'asc' or 'desc'")
	}

	// Check if field exists and is sortable
	fields, err := v.designer.GetFieldsForDataSource(dataSource)
	if err == nil {
		found := false
		for _, f := range fields {
			if f.Name == sort.Field {
				found = true
				if !f.Sortable {
					result.addError(fieldPath+".field", "not_sortable", fmt.Sprintf("Field '%s' is not sortable", sort.Field))
				}
				break
			}
		}
		if !found {
			result.addError(fieldPath+".field", "invalid", fmt.Sprintf("Field '%s' not found in data source", sort.Field))
		}
	}
}

// validateAggregate validates a single aggregate definition
func (v *Validator) validateAggregate(agg AggregateDefinition, dataSource string, index int, result *ValidationResult) {
	fieldPath := fmt.Sprintf("aggregates[%d]", index)

	if agg.Field == "" {
		result.addError(fieldPath+".field", "required", "Aggregate field is required")
		return
	}

	if agg.Function == "" {
		result.addError(fieldPath+".function", "required", "Aggregate function is required")
		return
	}

	// Validate function
	validFunctions := []string{"SUM", "AVG", "COUNT", "MIN", "MAX"}
	funcValid := false
	for _, f := range validFunctions {
		if strings.ToUpper(agg.Function) == f {
			funcValid = true
			break
		}
	}
	if !funcValid {
		result.addError(fieldPath+".function", "invalid", fmt.Sprintf("Invalid aggregate function: %s", agg.Function))
	}

	// Check if field exists and is aggregatable
	fields, err := v.designer.GetFieldsForDataSource(dataSource)
	if err == nil {
		found := false
		var fieldType string
		for _, f := range fields {
			if f.Name == agg.Field {
				found = true
				fieldType = f.Type
				if !f.Aggregatable && strings.ToUpper(agg.Function) != "COUNT" {
					result.addError(fieldPath+".field", "not_aggregatable", fmt.Sprintf("Field '%s' is not aggregatable", agg.Field))
				}
				break
			}
		}
		if !found {
			result.addError(fieldPath+".field", "invalid", fmt.Sprintf("Field '%s' not found in data source", agg.Field))
		} else if funcValid {
			// Validate function is supported for field type
			supportedAggs := GetSupportedAggregates(fieldType)
			aggSupported := false
			for _, a := range supportedAggs {
				if strings.ToUpper(agg.Function) == a {
					aggSupported = true
					break
				}
			}
			if !aggSupported {
				result.addError(fieldPath+".function", "invalid", fmt.Sprintf("Function '%s' not supported for field type '%s'", agg.Function, fieldType))
			}
		}
	}

	if agg.Alias == "" {
		result.addError(fieldPath+".alias", "required", "Aggregate alias is required")
	}
}

// validateParameter validates a single parameter definition
func (v *Validator) validateParameter(param ParameterDefinition, index int, result *ValidationResult) {
	fieldPath := fmt.Sprintf("parameters[%d]", index)

	if param.Name == "" {
		result.addError(fieldPath+".name", "required", "Parameter name is required")
		return
	}

	// Validate parameter name format (alphanumeric and underscores only)
	if !regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]*$`).MatchString(param.Name) {
		result.addError(fieldPath+".name", "invalid_format", "Parameter name must start with a letter and contain only letters, numbers, and underscores")
	}

	if param.Type == "" {
		result.addError(fieldPath+".type", "required", "Parameter type is required")
	} else {
		validTypes := []string{"string", "number", "date", "boolean", "select"}
		typeValid := false
		for _, t := range validTypes {
			if param.Type == t {
				typeValid = true
				break
			}
		}
		if !typeValid {
			result.addError(fieldPath+".type", "invalid", fmt.Sprintf("Invalid parameter type: %s", param.Type))
		}
	}

	// For select type, options are required
	if param.Type == "select" && len(param.Options) == 0 {
		result.addError(fieldPath+".options", "required", "Options are required for select type parameters")
	}

	// Validate validation rules
	if param.Validation != nil {
		v.validateParameterValidation(param.Validation, param.Type, fieldPath, result)
	}
}

// validateParameterValidation validates parameter validation rules
func (v *Validator) validateParameterValidation(validation *ParameterValidation, paramType string, fieldPath string, result *ValidationResult) {
	if validation.MinLength != nil && *validation.MinLength < 0 {
		result.addError(fieldPath+".validation.min_length", "invalid", "min_length must be non-negative")
	}

	if validation.MaxLength != nil && *validation.MaxLength < 0 {
		result.addError(fieldPath+".validation.max_length", "invalid", "max_length must be non-negative")
	}

	if validation.MinLength != nil && validation.MaxLength != nil && *validation.MinLength > *validation.MaxLength {
		result.addError(fieldPath+".validation", "invalid", "min_length cannot be greater than max_length")
	}

	if validation.Min != nil && validation.Max != nil && *validation.Min > *validation.Max {
		result.addError(fieldPath+".validation", "invalid", "min cannot be greater than max")
	}

	// Min/Max only applicable for number type
	if paramType != "number" && (validation.Min != nil || validation.Max != nil) {
		result.addError(fieldPath+".validation", "invalid", "min/max validation only applicable for number type")
	}

	// MinLength/MaxLength only applicable for string type
	if paramType != "string" && (validation.MinLength != nil || validation.MaxLength != nil) {
		result.addError(fieldPath+".validation", "invalid", "min_length/max_length validation only applicable for string type")
	}

	// Validate regex pattern
	if validation.Pattern != "" {
		if _, err := regexp.Compile(validation.Pattern); err != nil {
			result.addError(fieldPath+".validation.pattern", "invalid", fmt.Sprintf("Invalid regex pattern: %s", err.Error()))
		}
	}
}

// addError adds an error to the validation result
func (r *ValidationResult) addError(field, code, message string) {
	r.Errors = append(r.Errors, ValidationError{
		Field:   field,
		Code:    code,
		Message: message,
	})
	r.IsValid = false
}

// ValidateFilterValue validates a filter value against the expected type
func ValidateFilterValue(value any, fieldType string, operator string) error {
	if value == nil {
		return nil
	}

	switch fieldType {
	case "string":
		if _, ok := value.(string); !ok {
			if operator == "in" || operator == "not_in" {
				if _, ok := value.([]interface{}); !ok {
					return fmt.Errorf("expected string or array of strings")
				}
			} else {
				return fmt.Errorf("expected string value")
			}
		}
	case "number", "integer":
		switch v := value.(type) {
		case float64, int, int64, float32:
			// Valid
		case []interface{}:
			if operator == "in" || operator == "not_in" || operator == "between" {
				// Valid for array operators
			} else {
				return fmt.Errorf("expected numeric value")
			}
		default:
			return fmt.Errorf("expected numeric value, got %T", v)
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("expected boolean value")
		}
	case "date", "timestamp":
		switch value.(type) {
		case string:
			// Dates can be passed as strings
		case []interface{}:
			if operator == "between" {
				// Valid for between operator
			} else {
				return fmt.Errorf("expected date string")
			}
		default:
			return fmt.Errorf("expected date string")
		}
	}

	return nil
}

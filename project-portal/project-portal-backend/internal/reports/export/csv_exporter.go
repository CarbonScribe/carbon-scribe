package export

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// CSVExporter exports data to CSV format
type CSVExporter struct {
	config CSVConfig
}

// CSVConfig holds CSV export configuration
type CSVConfig struct {
	Delimiter     rune
	UseCRLF       bool
	IncludeHeader bool
	DateFormat    string
	TimeFormat    string
	NullValue     string
	Quote         rune
}

// DefaultCSVConfig returns the default CSV configuration
func DefaultCSVConfig() CSVConfig {
	return CSVConfig{
		Delimiter:     ',',
		UseCRLF:       true,
		IncludeHeader: true,
		DateFormat:    "2006-01-02",
		TimeFormat:    "15:04:05",
		NullValue:     "",
		Quote:         '"',
	}
}

// NewCSVExporter creates a new CSV exporter
func NewCSVExporter(config CSVConfig) *CSVExporter {
	return &CSVExporter{config: config}
}

// Export exports data to CSV format
func (e *CSVExporter) Export(ctx context.Context, data []map[string]interface{}, columns []string) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = e.config.Delimiter
	writer.UseCRLF = e.config.UseCRLF

	// Determine columns if not provided
	if len(columns) == 0 && len(data) > 0 {
		columns = e.extractColumns(data[0])
	}

	// Write header
	if e.config.IncludeHeader {
		if err := writer.Write(columns); err != nil {
			return nil, fmt.Errorf("failed to write header: %w", err)
		}
	}

	// Write data rows
	for _, row := range data {
		record := make([]string, len(columns))
		for i, col := range columns {
			record[i] = e.formatValue(row[col])
		}
		if err := writer.Write(record); err != nil {
			return nil, fmt.Errorf("failed to write row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("CSV writer error: %w", err)
	}

	return buf.Bytes(), nil
}

// StreamingExport exports large datasets with streaming
func (e *CSVExporter) StreamingExport(ctx context.Context, dataChan <-chan map[string]interface{}, columns []string) (<-chan []byte, <-chan error) {
	outChan := make(chan []byte, 100)
	errChan := make(chan error, 1)

	go func() {
		defer close(outChan)
		defer close(errChan)

		var buf bytes.Buffer
		writer := csv.NewWriter(&buf)
		writer.Comma = e.config.Delimiter
		writer.UseCRLF = e.config.UseCRLF

		// Write header first
		if e.config.IncludeHeader && len(columns) > 0 {
			if err := writer.Write(columns); err != nil {
				errChan <- fmt.Errorf("failed to write header: %w", err)
				return
			}
			writer.Flush()
			outChan <- buf.Bytes()
			buf.Reset()
		}

		rowCount := 0
		for row := range dataChan {
			select {
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			default:
				if len(columns) == 0 {
					columns = e.extractColumns(row)
					// Write header now
					if e.config.IncludeHeader {
						if err := writer.Write(columns); err != nil {
							errChan <- fmt.Errorf("failed to write header: %w", err)
							return
						}
						writer.Flush()
						outChan <- buf.Bytes()
						buf.Reset()
					}
				}

				record := make([]string, len(columns))
				for i, col := range columns {
					record[i] = e.formatValue(row[col])
				}
				if err := writer.Write(record); err != nil {
					errChan <- fmt.Errorf("failed to write row: %w", err)
					return
				}

				rowCount++
				// Flush every 1000 rows
				if rowCount%1000 == 0 {
					writer.Flush()
					outChan <- buf.Bytes()
					buf.Reset()
				}
			}
		}

		// Flush remaining data
		writer.Flush()
		if buf.Len() > 0 {
			outChan <- buf.Bytes()
		}
	}()

	return outChan, errChan
}

func (e *CSVExporter) extractColumns(row map[string]interface{}) []string {
	columns := make([]string, 0, len(row))
	for key := range row {
		columns = append(columns, key)
	}
	return columns
}

func (e *CSVExporter) formatValue(v interface{}) string {
	if v == nil {
		return e.config.NullValue
	}

	switch val := v.(type) {
	case string:
		return val
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", val)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", val)
	case float32:
		return strconv.FormatFloat(float64(val), 'f', -1, 32)
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case bool:
		if val {
			return "true"
		}
		return "false"
	case time.Time:
		if val.Hour() == 0 && val.Minute() == 0 && val.Second() == 0 {
			return val.Format(e.config.DateFormat)
		}
		return val.Format(e.config.DateFormat + " " + e.config.TimeFormat)
	case []byte:
		return string(val)
	default:
		// Use reflection for other types
		return fmt.Sprintf("%v", val)
	}
}

// ExportWithMapping exports data with custom column mapping
func (e *CSVExporter) ExportWithMapping(ctx context.Context, data []map[string]interface{}, mapping []ColumnMapping) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = e.config.Delimiter
	writer.UseCRLF = e.config.UseCRLF

	// Write header
	if e.config.IncludeHeader {
		header := make([]string, len(mapping))
		for i, m := range mapping {
			header[i] = m.DisplayName
		}
		if err := writer.Write(header); err != nil {
			return nil, fmt.Errorf("failed to write header: %w", err)
		}
	}

	// Write data rows
	for _, row := range data {
		record := make([]string, len(mapping))
		for i, m := range mapping {
			value := row[m.FieldName]
			if m.Formatter != nil {
				record[i] = m.Formatter(value)
			} else {
				record[i] = e.formatValue(value)
			}
		}
		if err := writer.Write(record); err != nil {
			return nil, fmt.Errorf("failed to write row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("CSV writer error: %w", err)
	}

	return buf.Bytes(), nil
}

// ColumnMapping defines how a column should be exported
type ColumnMapping struct {
	FieldName   string
	DisplayName string
	DataType    string
	Formatter   func(interface{}) string
}

// StructExporter exports struct slices to CSV
type StructExporter struct {
	*CSVExporter
}

// NewStructExporter creates a new struct exporter
func NewStructExporter(config CSVConfig) *StructExporter {
	return &StructExporter{CSVExporter: NewCSVExporter(config)}
}

// ExportStructs exports a slice of structs to CSV
func (e *StructExporter) ExportStructs(ctx context.Context, data interface{}) ([]byte, error) {
	val := reflect.ValueOf(data)
	if val.Kind() != reflect.Slice {
		return nil, fmt.Errorf("data must be a slice")
	}

	if val.Len() == 0 {
		return nil, nil
	}

	// Get struct type
	elemType := val.Type().Elem()
	if elemType.Kind() == reflect.Ptr {
		elemType = elemType.Elem()
	}
	if elemType.Kind() != reflect.Struct {
		return nil, fmt.Errorf("slice elements must be structs")
	}

	// Extract column names from struct fields
	columns := make([]string, 0)
	fieldIndices := make([]int, 0)
	for i := 0; i < elemType.NumField(); i++ {
		field := elemType.Field(i)
		// Skip unexported fields
		if field.PkgPath != "" {
			continue
		}

		// Get column name from json tag or field name
		columnName := field.Name
		if tag := field.Tag.Get("json"); tag != "" {
			parts := strings.Split(tag, ",")
			if parts[0] != "-" {
				columnName = parts[0]
			} else {
				continue
			}
		}
		if tag := field.Tag.Get("csv"); tag != "" {
			parts := strings.Split(tag, ",")
			if parts[0] != "-" {
				columnName = parts[0]
			} else {
				continue
			}
		}

		columns = append(columns, columnName)
		fieldIndices = append(fieldIndices, i)
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = e.config.Delimiter
	writer.UseCRLF = e.config.UseCRLF

	// Write header
	if e.config.IncludeHeader {
		if err := writer.Write(columns); err != nil {
			return nil, fmt.Errorf("failed to write header: %w", err)
		}
	}

	// Write data rows
	for i := 0; i < val.Len(); i++ {
		elem := val.Index(i)
		if elem.Kind() == reflect.Ptr {
			elem = elem.Elem()
		}

		record := make([]string, len(fieldIndices))
		for j, idx := range fieldIndices {
			fieldVal := elem.Field(idx)
			record[j] = e.formatValue(fieldVal.Interface())
		}

		if err := writer.Write(record); err != nil {
			return nil, fmt.Errorf("failed to write row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("CSV writer error: %w", err)
	}

	return buf.Bytes(), nil
}

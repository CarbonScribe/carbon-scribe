package export

import (
	"encoding/csv"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"time"
)

// CSVExporter exports data to CSV format
type CSVExporter struct {
	writer       *csv.Writer
	options      CSVOptions
	headerWritten bool
}

// CSVOptions configures CSV export behavior
type CSVOptions struct {
	Delimiter       rune   `json:"delimiter"`        // Field delimiter (default: comma)
	UseCRLF         bool   `json:"use_crlf"`         // Use \r\n for line terminator
	IncludeHeader   bool   `json:"include_header"`   // Include column headers
	DateFormat      string `json:"date_format"`      // Format for date fields
	TimestampFormat string `json:"timestamp_format"` // Format for timestamp fields
	NumberFormat    string `json:"number_format"`    // Format for numbers (e.g., "%.2f")
	NullValue       string `json:"null_value"`       // String to use for null values
	BoolTrueValue   string `json:"bool_true_value"`  // String for true
	BoolFalseValue  string `json:"bool_false_value"` // String for false
	QuoteAll        bool   `json:"quote_all"`        // Quote all fields
}

// DefaultCSVOptions returns default CSV export options
func DefaultCSVOptions() CSVOptions {
	return CSVOptions{
		Delimiter:       ',',
		UseCRLF:         false,
		IncludeHeader:   true,
		DateFormat:      "2006-01-02",
		TimestampFormat: "2006-01-02T15:04:05Z07:00",
		NumberFormat:    "",
		NullValue:       "",
		BoolTrueValue:   "true",
		BoolFalseValue:  "false",
		QuoteAll:        false,
	}
}

// NewCSVExporter creates a new CSV exporter
func NewCSVExporter(w io.Writer, options CSVOptions) *CSVExporter {
	writer := csv.NewWriter(w)
	writer.Comma = options.Delimiter
	writer.UseCRLF = options.UseCRLF

	return &CSVExporter{
		writer:  writer,
		options: options,
	}
}

// WriteHeader writes the CSV header row
func (e *CSVExporter) WriteHeader(columns []string) error {
	if !e.options.IncludeHeader {
		return nil
	}

	if err := e.writer.Write(columns); err != nil {
		return fmt.Errorf("failed to write header: %w", err)
	}
	e.headerWritten = true
	return nil
}

// WriteRow writes a single row of data
func (e *CSVExporter) WriteRow(row []interface{}) error {
	record := make([]string, len(row))
	for i, val := range row {
		record[i] = e.formatValue(val)
	}

	if err := e.writer.Write(record); err != nil {
		return fmt.Errorf("failed to write row: %w", err)
	}
	return nil
}

// WriteRows writes multiple rows of data
func (e *CSVExporter) WriteRows(rows [][]interface{}) error {
	for _, row := range rows {
		if err := e.WriteRow(row); err != nil {
			return err
		}
	}
	return nil
}

// WriteMapRows writes rows from a slice of maps
func (e *CSVExporter) WriteMapRows(rows []map[string]interface{}, columns []string) error {
	// Write header if not already written
	if !e.headerWritten && e.options.IncludeHeader {
		if err := e.WriteHeader(columns); err != nil {
			return err
		}
	}

	for _, row := range rows {
		record := make([]string, len(columns))
		for i, col := range columns {
			val, ok := row[col]
			if !ok {
				record[i] = e.options.NullValue
			} else {
				record[i] = e.formatValue(val)
			}
		}

		if err := e.writer.Write(record); err != nil {
			return fmt.Errorf("failed to write row: %w", err)
		}
	}
	return nil
}

// WriteStructRows writes rows from a slice of structs
func (e *CSVExporter) WriteStructRows(rows interface{}, columns []string) error {
	val := reflect.ValueOf(rows)
	if val.Kind() != reflect.Slice {
		return fmt.Errorf("expected slice, got %T", rows)
	}

	// Write header if not already written
	if !e.headerWritten && e.options.IncludeHeader {
		if err := e.WriteHeader(columns); err != nil {
			return err
		}
	}

	for i := 0; i < val.Len(); i++ {
		item := val.Index(i)
		if item.Kind() == reflect.Ptr {
			item = item.Elem()
		}

		record := make([]string, len(columns))
		for j, col := range columns {
			field := item.FieldByName(col)
			if !field.IsValid() {
				// Try case-insensitive match
				field = item.FieldByNameFunc(func(name string) bool {
					return name == col
				})
			}

			if field.IsValid() {
				record[j] = e.formatValue(field.Interface())
			} else {
				record[j] = e.options.NullValue
			}
		}

		if err := e.writer.Write(record); err != nil {
			return fmt.Errorf("failed to write row: %w", err)
		}
	}
	return nil
}

// Flush writes any buffered data to the underlying writer
func (e *CSVExporter) Flush() error {
	e.writer.Flush()
	return e.writer.Error()
}

// formatValue formats a value for CSV output
func (e *CSVExporter) formatValue(val interface{}) string {
	if val == nil {
		return e.options.NullValue
	}

	switch v := val.(type) {
	case string:
		return v
	case int:
		return strconv.Itoa(v)
	case int32:
		return strconv.FormatInt(int64(v), 10)
	case int64:
		return strconv.FormatInt(v, 10)
	case float32:
		if e.options.NumberFormat != "" {
			return fmt.Sprintf(e.options.NumberFormat, v)
		}
		return strconv.FormatFloat(float64(v), 'f', -1, 32)
	case float64:
		if e.options.NumberFormat != "" {
			return fmt.Sprintf(e.options.NumberFormat, v)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		if v {
			return e.options.BoolTrueValue
		}
		return e.options.BoolFalseValue
	case time.Time:
		if v.IsZero() {
			return e.options.NullValue
		}
		// Use timestamp format for times with non-zero time component
		if v.Hour() != 0 || v.Minute() != 0 || v.Second() != 0 {
			return v.Format(e.options.TimestampFormat)
		}
		return v.Format(e.options.DateFormat)
	case *time.Time:
		if v == nil || v.IsZero() {
			return e.options.NullValue
		}
		if v.Hour() != 0 || v.Minute() != 0 || v.Second() != 0 {
			return v.Format(e.options.TimestampFormat)
		}
		return v.Format(e.options.DateFormat)
	case []byte:
		return string(v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// StreamingCSVExporter provides streaming CSV export for large datasets
type StreamingCSVExporter struct {
	exporter    *CSVExporter
	columns     []string
	rowCount    int
	chunkSize   int
	onProgress  func(rowCount int)
}

// NewStreamingCSVExporter creates a streaming CSV exporter
func NewStreamingCSVExporter(w io.Writer, options CSVOptions, columns []string, chunkSize int) (*StreamingCSVExporter, error) {
	exporter := NewCSVExporter(w, options)

	// Write header immediately
	if err := exporter.WriteHeader(columns); err != nil {
		return nil, err
	}

	return &StreamingCSVExporter{
		exporter:  exporter,
		columns:   columns,
		chunkSize: chunkSize,
	}, nil
}

// SetProgressCallback sets a callback function to report progress
func (s *StreamingCSVExporter) SetProgressCallback(callback func(rowCount int)) {
	s.onProgress = callback
}

// WriteChunk writes a chunk of rows
func (s *StreamingCSVExporter) WriteChunk(rows []map[string]interface{}) error {
	for _, row := range rows {
		record := make([]string, len(s.columns))
		for i, col := range s.columns {
			val, ok := row[col]
			if !ok {
				record[i] = s.exporter.options.NullValue
			} else {
				record[i] = s.exporter.formatValue(val)
			}
		}

		if err := s.exporter.writer.Write(record); err != nil {
			return fmt.Errorf("failed to write row: %w", err)
		}
		s.rowCount++
	}

	// Flush after each chunk
	if err := s.exporter.Flush(); err != nil {
		return err
	}

	// Report progress
	if s.onProgress != nil {
		s.onProgress(s.rowCount)
	}

	return nil
}

// Finish completes the export
func (s *StreamingCSVExporter) Finish() (int, error) {
	if err := s.exporter.Flush(); err != nil {
		return s.rowCount, err
	}
	return s.rowCount, nil
}

// RowCount returns the number of rows written
func (s *StreamingCSVExporter) RowCount() int {
	return s.rowCount
}

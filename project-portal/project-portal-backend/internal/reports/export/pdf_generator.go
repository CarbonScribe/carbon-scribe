package export

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// PDFExporter exports data to PDF format
type PDFExporter struct {
	config PDFConfig
}

// PDFConfig holds PDF export configuration
type PDFConfig struct {
	PageSize      string // A4, Letter, Legal
	Orientation   string // portrait, landscape
	Title         string
	Subtitle      string
	Author        string
	DateFormat    string
	IncludeHeader bool
	IncludeFooter bool
	LogoPath      string
	MarginTop     float64
	MarginBottom  float64
	MarginLeft    float64
	MarginRight   float64
	FontFamily    string
	HeaderColor   [3]int
	AlternateRows bool
}

// DefaultPDFConfig returns the default PDF configuration
func DefaultPDFConfig() PDFConfig {
	return PDFConfig{
		PageSize:      "A4",
		Orientation:   "landscape",
		Title:         "Report",
		DateFormat:    "2006-01-02",
		IncludeHeader: true,
		IncludeFooter: true,
		MarginTop:     15,
		MarginBottom:  15,
		MarginLeft:    10,
		MarginRight:   10,
		FontFamily:    "Arial",
		HeaderColor:   [3]int{68, 114, 196}, // Blue
		AlternateRows: true,
	}
}

// NewPDFExporter creates a new PDF exporter
func NewPDFExporter(config PDFConfig) *PDFExporter {
	return &PDFExporter{config: config}
}

// Export exports data to PDF format
func (e *PDFExporter) Export(ctx context.Context, data []map[string]interface{}, columns []string, columnWidths []float64) ([]byte, error) {
	// Determine columns if not provided
	if len(columns) == 0 && len(data) > 0 {
		columns = e.extractColumns(data[0])
	}

	// Calculate column widths if not provided
	if len(columnWidths) == 0 || len(columnWidths) != len(columns) {
		columnWidths = e.calculateColumnWidths(columns, data)
	}

	// Create PDF
	orientation := "P"
	if e.config.Orientation == "landscape" {
		orientation = "L"
	}

	pdf := gofpdf.New(orientation, "mm", e.config.PageSize, "")
	pdf.SetMargins(e.config.MarginLeft, e.config.MarginTop, e.config.MarginRight)
	pdf.SetAutoPageBreak(true, e.config.MarginBottom)

	// Set up footer
	if e.config.IncludeFooter {
		pdf.SetFooterFunc(func() {
			pdf.SetY(-10)
			pdf.SetFont(e.config.FontFamily, "I", 8)
			pdf.SetTextColor(128, 128, 128)
			pdf.CellFormat(0, 10, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
		})
	}
	pdf.AliasNbPages("")

	// Add first page
	pdf.AddPage()

	// Add header section
	if e.config.IncludeHeader {
		e.addHeader(pdf)
	}

	// Add table
	e.addTable(pdf, columns, columnWidths, data)

	// Write to buffer
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}

	return buf.Bytes(), nil
}

func (e *PDFExporter) addHeader(pdf *gofpdf.Fpdf) {
	// Title
	pdf.SetFont(e.config.FontFamily, "B", 20)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(0, 12, e.config.Title, "", 1, "L", false, 0, "")

	// Subtitle
	if e.config.Subtitle != "" {
		pdf.SetFont(e.config.FontFamily, "", 12)
		pdf.SetTextColor(100, 100, 100)
		pdf.CellFormat(0, 8, e.config.Subtitle, "", 1, "L", false, 0, "")
	}

	// Date
	pdf.SetFont(e.config.FontFamily, "", 10)
	pdf.SetTextColor(128, 128, 128)
	pdf.CellFormat(0, 6, fmt.Sprintf("Generated: %s", time.Now().Format(e.config.DateFormat+" 15:04")), "", 1, "L", false, 0, "")

	// Add some space
	pdf.Ln(8)
}

func (e *PDFExporter) addTable(pdf *gofpdf.Fpdf, columns []string, columnWidths []float64, data []map[string]interface{}) {
	// Table header
	pdf.SetFont(e.config.FontFamily, "B", 9)
	pdf.SetFillColor(e.config.HeaderColor[0], e.config.HeaderColor[1], e.config.HeaderColor[2])
	pdf.SetTextColor(255, 255, 255)

	for i, col := range columns {
		pdf.CellFormat(columnWidths[i], 8, col, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	// Table data
	pdf.SetFont(e.config.FontFamily, "", 8)
	pdf.SetTextColor(0, 0, 0)

	for rowIdx, row := range data {
		// Alternate row colors
		if e.config.AlternateRows && rowIdx%2 == 1 {
			pdf.SetFillColor(245, 245, 245)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		for i, col := range columns {
			value := e.formatValue(row[col])
			pdf.CellFormat(columnWidths[i], 7, value, "1", 0, "L", true, 0, "")
		}
		pdf.Ln(-1)

		// Check if we need a new page
		if pdf.GetY() > 190 {
			pdf.AddPage()
			// Repeat header on new page
			pdf.SetFont(e.config.FontFamily, "B", 9)
			pdf.SetFillColor(e.config.HeaderColor[0], e.config.HeaderColor[1], e.config.HeaderColor[2])
			pdf.SetTextColor(255, 255, 255)
			for i, col := range columns {
				pdf.CellFormat(columnWidths[i], 8, col, "1", 0, "C", true, 0, "")
			}
			pdf.Ln(-1)
			pdf.SetFont(e.config.FontFamily, "", 8)
			pdf.SetTextColor(0, 0, 0)
		}
	}
}

func (e *PDFExporter) calculateColumnWidths(columns []string, data []map[string]interface{}) []float64 {
	// Get available page width
	pageWidth := float64(277) // A4 landscape width in mm minus margins
	if e.config.Orientation == "portrait" {
		pageWidth = 190 // A4 portrait
	}

	// Calculate max width for each column
	maxWidths := make([]float64, len(columns))
	for i, col := range columns {
		// Start with column header width
		maxWidths[i] = float64(len(col)) * 2.5
	}

	// Check data values
	for _, row := range data {
		for i, col := range columns {
			value := e.formatValue(row[col])
			width := float64(len(value)) * 2.0
			if width > maxWidths[i] {
				maxWidths[i] = width
			}
		}
	}

	// Normalize to fit page
	totalWidth := 0.0
	for _, w := range maxWidths {
		totalWidth += w
	}

	scale := pageWidth / totalWidth
	for i := range maxWidths {
		maxWidths[i] *= scale
		// Set minimum and maximum widths
		if maxWidths[i] < 15 {
			maxWidths[i] = 15
		}
		if maxWidths[i] > 60 {
			maxWidths[i] = 60
		}
	}

	return maxWidths
}

func (e *PDFExporter) extractColumns(row map[string]interface{}) []string {
	columns := make([]string, 0, len(row))
	for key := range row {
		columns = append(columns, key)
	}
	return columns
}

func (e *PDFExporter) formatValue(v interface{}) string {
	if v == nil {
		return ""
	}

	switch val := v.(type) {
	case string:
		// Truncate long strings
		if len(val) > 50 {
			return val[:47] + "..."
		}
		return val
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", val)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", val)
	case float32:
		return strconv.FormatFloat(float64(val), 'f', 2, 32)
	case float64:
		return strconv.FormatFloat(val, 'f', 2, 64)
	case bool:
		if val {
			return "Yes"
		}
		return "No"
	case time.Time:
		return val.Format(e.config.DateFormat)
	default:
		str := fmt.Sprintf("%v", val)
		if len(str) > 50 {
			return str[:47] + "..."
		}
		return str
	}
}

// ExportWithSummary exports data with summary statistics
func (e *PDFExporter) ExportWithSummary(ctx context.Context, data []map[string]interface{}, columns []string, summary map[string]interface{}) ([]byte, error) {
	columnWidths := e.calculateColumnWidths(columns, data)

	orientation := "P"
	if e.config.Orientation == "landscape" {
		orientation = "L"
	}

	pdf := gofpdf.New(orientation, "mm", e.config.PageSize, "")
	pdf.SetMargins(e.config.MarginLeft, e.config.MarginTop, e.config.MarginRight)
	pdf.SetAutoPageBreak(true, e.config.MarginBottom)

	if e.config.IncludeFooter {
		pdf.SetFooterFunc(func() {
			pdf.SetY(-10)
			pdf.SetFont(e.config.FontFamily, "I", 8)
			pdf.SetTextColor(128, 128, 128)
			pdf.CellFormat(0, 10, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
		})
	}
	pdf.AliasNbPages("")

	pdf.AddPage()

	if e.config.IncludeHeader {
		e.addHeader(pdf)
	}

	// Add summary section
	if len(summary) > 0 {
		e.addSummary(pdf, summary)
	}

	// Add table
	e.addTable(pdf, columns, columnWidths, data)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}

	return buf.Bytes(), nil
}

func (e *PDFExporter) addSummary(pdf *gofpdf.Fpdf, summary map[string]interface{}) {
	pdf.SetFont(e.config.FontFamily, "B", 12)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(0, 8, "Summary", "", 1, "L", false, 0, "")

	pdf.SetFont(e.config.FontFamily, "", 10)

	pageWidth := float64(277)
	if e.config.Orientation == "portrait" {
		pageWidth = 190
	}

	labelWidth := pageWidth * 0.3
	valueWidth := pageWidth * 0.2
	colsPerRow := 2
	col := 0

	for key, value := range summary {
		pdf.SetTextColor(100, 100, 100)
		pdf.CellFormat(labelWidth, 6, key+":", "", 0, "L", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(valueWidth, 6, e.formatValue(value), "", 0, "L", false, 0, "")

		col++
		if col >= colsPerRow {
			pdf.Ln(-1)
			col = 0
		}
	}

	if col > 0 {
		pdf.Ln(-1)
	}
	pdf.Ln(5)
}

// ExportChartReport exports a report with charts
func (e *PDFExporter) ExportChartReport(ctx context.Context, sections []ReportSection) ([]byte, error) {
	orientation := "P"
	if e.config.Orientation == "landscape" {
		orientation = "L"
	}

	pdf := gofpdf.New(orientation, "mm", e.config.PageSize, "")
	pdf.SetMargins(e.config.MarginLeft, e.config.MarginTop, e.config.MarginRight)
	pdf.SetAutoPageBreak(true, e.config.MarginBottom)

	if e.config.IncludeFooter {
		pdf.SetFooterFunc(func() {
			pdf.SetY(-10)
			pdf.SetFont(e.config.FontFamily, "I", 8)
			pdf.SetTextColor(128, 128, 128)
			pdf.CellFormat(0, 10, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
		})
	}
	pdf.AliasNbPages("")

	pdf.AddPage()

	if e.config.IncludeHeader {
		e.addHeader(pdf)
	}

	for i, section := range sections {
		if i > 0 {
			pdf.Ln(10)
		}

		// Section title
		pdf.SetFont(e.config.FontFamily, "B", 14)
		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(0, 10, section.Title, "", 1, "L", false, 0, "")

		// Section description
		if section.Description != "" {
			pdf.SetFont(e.config.FontFamily, "", 10)
			pdf.SetTextColor(100, 100, 100)
			pdf.MultiCell(0, 5, section.Description, "", "L", false)
			pdf.Ln(3)
		}

		// Add table if data present
		if len(section.Data) > 0 {
			columns := section.Columns
			if len(columns) == 0 {
				columns = e.extractColumns(section.Data[0])
			}
			columnWidths := e.calculateColumnWidths(columns, section.Data)
			e.addTable(pdf, columns, columnWidths, section.Data)
		}
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}

	return buf.Bytes(), nil
}

// ReportSection represents a section in the PDF report
type ReportSection struct {
	Title       string
	Description string
	Columns     []string
	Data        []map[string]interface{}
	ChartType   string
	ChartData   interface{}
}

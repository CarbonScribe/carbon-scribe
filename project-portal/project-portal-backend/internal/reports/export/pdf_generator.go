package export

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// PDFGenerator generates PDF reports
type PDFGenerator struct {
	pdf     *gofpdf.Fpdf
	options PDFOptions
}

// PDFOptions configures PDF generation
type PDFOptions struct {
	PageSize        string            `json:"page_size"`        // A4, Letter, Legal
	Orientation     string            `json:"orientation"`      // portrait, landscape
	Title           string            `json:"title"`
	Subtitle        string            `json:"subtitle,omitempty"`
	Author          string            `json:"author,omitempty"`
	DateFormat      string            `json:"date_format"`
	IncludeHeader   bool              `json:"include_header"`
	IncludeFooter   bool              `json:"include_footer"`
	IncludePageNum  bool              `json:"include_page_num"`
	IncludeDate     bool              `json:"include_date"`
	HeaderLogo      string            `json:"header_logo,omitempty"` // Path to logo image
	HeaderColor     PDFColor          `json:"header_color"`
	AlternateRows   bool              `json:"alternate_rows"`
	AlternateColor  PDFColor          `json:"alternate_color"`
	FontFamily      string            `json:"font_family"`
	FontSize        float64           `json:"font_size"`
	HeaderFontSize  float64           `json:"header_font_size"`
	TitleFontSize   float64           `json:"title_font_size"`
	Margins         PDFMargins        `json:"margins"`
	ColumnWidths    map[string]float64 `json:"column_widths,omitempty"`
}

// PDFColor represents an RGB color
type PDFColor struct {
	R int `json:"r"`
	G int `json:"g"`
	B int `json:"b"`
}

// PDFMargins represents page margins
type PDFMargins struct {
	Left   float64 `json:"left"`
	Right  float64 `json:"right"`
	Top    float64 `json:"top"`
	Bottom float64 `json:"bottom"`
}

// DefaultPDFOptions returns default PDF options
func DefaultPDFOptions() PDFOptions {
	return PDFOptions{
		PageSize:       "A4",
		Orientation:    "portrait",
		Title:          "Report",
		DateFormat:     "2006-01-02",
		IncludeHeader:  true,
		IncludeFooter:  true,
		IncludePageNum: true,
		IncludeDate:    true,
		HeaderColor:    PDFColor{R: 68, G: 114, B: 196},
		AlternateRows:  true,
		AlternateColor: PDFColor{R: 242, G: 242, B: 242},
		FontFamily:     "Arial",
		FontSize:       10,
		HeaderFontSize: 11,
		TitleFontSize:  16,
		Margins: PDFMargins{
			Left:   15,
			Right:  15,
			Top:    20,
			Bottom: 20,
		},
	}
}

// NewPDFGenerator creates a new PDF generator
func NewPDFGenerator(options PDFOptions) *PDFGenerator {
	orientation := "P"
	if options.Orientation == "landscape" {
		orientation = "L"
	}

	pdf := gofpdf.New(orientation, "mm", options.PageSize, "")
	pdf.SetMargins(options.Margins.Left, options.Margins.Top, options.Margins.Right)
	pdf.SetAutoPageBreak(true, options.Margins.Bottom)

	return &PDFGenerator{
		pdf:     pdf,
		options: options,
	}
}

// GenerateReport generates a PDF report from data
func (g *PDFGenerator) GenerateReport(columns []string, columnLabels []string, rows []map[string]interface{}) error {
	g.pdf.AddPage()

	// Add title
	g.addTitle()

	// Add subtitle if provided
	if g.options.Subtitle != "" {
		g.addSubtitle()
	}

	// Add date
	if g.options.IncludeDate {
		g.addDate()
	}

	g.pdf.Ln(10)

	// Calculate column widths
	colWidths := g.calculateColumnWidths(columns, columnLabels, rows)

	// Add table header
	if g.options.IncludeHeader {
		g.addTableHeader(columnLabels, colWidths)
	}

	// Add table data
	g.addTableData(columns, rows, colWidths)

	return nil
}

// addTitle adds the report title
func (g *PDFGenerator) addTitle() {
	g.pdf.SetFont(g.options.FontFamily, "B", g.options.TitleFontSize)
	g.pdf.SetTextColor(0, 0, 0)
	g.pdf.CellFormat(0, 10, g.options.Title, "", 1, "C", false, 0, "")
}

// addSubtitle adds the report subtitle
func (g *PDFGenerator) addSubtitle() {
	g.pdf.SetFont(g.options.FontFamily, "", g.options.FontSize+2)
	g.pdf.SetTextColor(100, 100, 100)
	g.pdf.CellFormat(0, 8, g.options.Subtitle, "", 1, "C", false, 0, "")
}

// addDate adds the report generation date
func (g *PDFGenerator) addDate() {
	g.pdf.SetFont(g.options.FontFamily, "", g.options.FontSize-1)
	g.pdf.SetTextColor(128, 128, 128)
	dateStr := fmt.Sprintf("Generated: %s", time.Now().Format(g.options.DateFormat))
	g.pdf.CellFormat(0, 6, dateStr, "", 1, "R", false, 0, "")
}

// calculateColumnWidths calculates optimal column widths
func (g *PDFGenerator) calculateColumnWidths(columns []string, labels []string, rows []map[string]interface{}) []float64 {
	pageWidth, _ := g.pdf.GetPageSize()
	availableWidth := pageWidth - g.options.Margins.Left - g.options.Margins.Right

	// If custom widths are provided, use them
	if g.options.ColumnWidths != nil {
		widths := make([]float64, len(columns))
		totalCustom := 0.0
		customCount := 0
		for i, col := range columns {
			if w, ok := g.options.ColumnWidths[col]; ok {
				widths[i] = w
				totalCustom += w
				customCount++
			}
		}

		// Distribute remaining width
		if customCount < len(columns) {
			remaining := availableWidth - totalCustom
			defaultWidth := remaining / float64(len(columns)-customCount)
			for i := range widths {
				if widths[i] == 0 {
					widths[i] = defaultWidth
				}
			}
		}
		return widths
	}

	// Auto-calculate based on content
	g.pdf.SetFont(g.options.FontFamily, "B", g.options.HeaderFontSize)

	// Calculate max width for each column
	maxWidths := make([]float64, len(columns))

	// Check header widths
	for i, label := range labels {
		width := g.pdf.GetStringWidth(label) + 4
		if width > maxWidths[i] {
			maxWidths[i] = width
		}
	}

	// Check data widths (sample first 100 rows)
	g.pdf.SetFont(g.options.FontFamily, "", g.options.FontSize)
	sampleSize := len(rows)
	if sampleSize > 100 {
		sampleSize = 100
	}

	for _, row := range rows[:sampleSize] {
		for i, col := range columns {
			val := g.formatValue(row[col])
			width := g.pdf.GetStringWidth(val) + 4
			if width > maxWidths[i] {
				maxWidths[i] = width
			}
		}
	}

	// Scale widths to fit page
	totalWidth := 0.0
	for _, w := range maxWidths {
		totalWidth += w
	}

	if totalWidth > availableWidth {
		scale := availableWidth / totalWidth
		for i := range maxWidths {
			maxWidths[i] *= scale
		}
	}

	return maxWidths
}

// addTableHeader adds the table header row
func (g *PDFGenerator) addTableHeader(labels []string, widths []float64) {
	g.pdf.SetFont(g.options.FontFamily, "B", g.options.HeaderFontSize)
	g.pdf.SetFillColor(g.options.HeaderColor.R, g.options.HeaderColor.G, g.options.HeaderColor.B)
	g.pdf.SetTextColor(255, 255, 255)

	for i, label := range labels {
		g.pdf.CellFormat(widths[i], 8, label, "1", 0, "C", true, 0, "")
	}
	g.pdf.Ln(-1)
}

// addTableData adds the data rows
func (g *PDFGenerator) addTableData(columns []string, rows []map[string]interface{}, widths []float64) {
	g.pdf.SetFont(g.options.FontFamily, "", g.options.FontSize)
	g.pdf.SetTextColor(0, 0, 0)

	for i, row := range rows {
		// Alternate row colors
		if g.options.AlternateRows && i%2 == 1 {
			g.pdf.SetFillColor(g.options.AlternateColor.R, g.options.AlternateColor.G, g.options.AlternateColor.B)
		} else {
			g.pdf.SetFillColor(255, 255, 255)
		}

		// Check if we need a new page
		if g.pdf.GetY()+8 > g.pdf.GetPageSize()[1]-g.options.Margins.Bottom {
			g.pdf.AddPage()
			// Re-add header on new page
			if g.options.IncludeHeader {
				labels := make([]string, len(columns))
				for j, col := range columns {
					labels[j] = col
				}
				g.addTableHeader(labels, widths)
				g.pdf.SetFont(g.options.FontFamily, "", g.options.FontSize)
				g.pdf.SetTextColor(0, 0, 0)
			}
		}

		for j, col := range columns {
			val := g.formatValue(row[col])
			// Truncate if too long
			maxChars := int(widths[j] / 2)
			if len(val) > maxChars {
				val = val[:maxChars-3] + "..."
			}
			g.pdf.CellFormat(widths[j], 7, val, "1", 0, "L", true, 0, "")
		}
		g.pdf.Ln(-1)
	}
}

// formatValue formats a value for display
func (g *PDFGenerator) formatValue(val interface{}) string {
	if val == nil {
		return ""
	}

	switch v := val.(type) {
	case time.Time:
		if v.IsZero() {
			return ""
		}
		return v.Format(g.options.DateFormat)
	case *time.Time:
		if v == nil || v.IsZero() {
			return ""
		}
		return v.Format(g.options.DateFormat)
	case float64:
		return fmt.Sprintf("%.2f", v)
	case float32:
		return fmt.Sprintf("%.2f", v)
	case bool:
		if v {
			return "Yes"
		}
		return "No"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// AddSummarySection adds a summary section to the report
func (g *PDFGenerator) AddSummarySection(title string, items map[string]interface{}) {
	g.pdf.Ln(10)

	// Section title
	g.pdf.SetFont(g.options.FontFamily, "B", g.options.FontSize+2)
	g.pdf.SetTextColor(0, 0, 0)
	g.pdf.CellFormat(0, 8, title, "", 1, "L", false, 0, "")
	g.pdf.Ln(2)

	// Summary items
	g.pdf.SetFont(g.options.FontFamily, "", g.options.FontSize)
	for key, val := range items {
		g.pdf.SetFont(g.options.FontFamily, "B", g.options.FontSize)
		g.pdf.CellFormat(60, 6, key+":", "", 0, "L", false, 0, "")
		g.pdf.SetFont(g.options.FontFamily, "", g.options.FontSize)
		g.pdf.CellFormat(0, 6, g.formatValue(val), "", 1, "L", false, 0, "")
	}
}

// AddChartPlaceholder adds a placeholder for a chart
func (g *PDFGenerator) AddChartPlaceholder(title string, width, height float64) {
	g.pdf.Ln(10)

	// Title
	g.pdf.SetFont(g.options.FontFamily, "B", g.options.FontSize+1)
	g.pdf.CellFormat(0, 8, title, "", 1, "L", false, 0, "")

	// Placeholder box
	x := g.pdf.GetX()
	y := g.pdf.GetY()
	g.pdf.SetDrawColor(200, 200, 200)
	g.pdf.SetFillColor(248, 248, 248)
	g.pdf.Rect(x, y, width, height, "FD")

	g.pdf.SetFont(g.options.FontFamily, "", g.options.FontSize-1)
	g.pdf.SetTextColor(150, 150, 150)
	g.pdf.SetXY(x+width/2-20, y+height/2-3)
	g.pdf.CellFormat(40, 6, "[Chart]", "", 0, "C", false, 0, "")

	g.pdf.SetY(y + height + 5)
	g.pdf.SetTextColor(0, 0, 0)
}

// WriteTo writes the PDF to a writer
func (g *PDFGenerator) WriteTo(w io.Writer) error {
	return g.pdf.Output(w)
}

// OutputToBytes returns the PDF as bytes
func (g *PDFGenerator) OutputToBytes() ([]byte, error) {
	var buf bytes.Buffer
	err := g.pdf.Output(&buf)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// SaveAs saves the PDF to a file
func (g *PDFGenerator) SaveAs(path string) error {
	return g.pdf.OutputFileAndClose(path)
}

// Close closes the PDF generator
func (g *PDFGenerator) Close() {
	// gofpdf doesn't require explicit closing
}

// setFooter sets up the page footer
func (g *PDFGenerator) setFooter() {
	g.pdf.SetFooterFunc(func() {
		g.pdf.SetY(-15)
		g.pdf.SetFont(g.options.FontFamily, "", 8)
		g.pdf.SetTextColor(128, 128, 128)

		// Page number
		if g.options.IncludePageNum {
			pageInfo := fmt.Sprintf("Page %d", g.pdf.PageNo())
			g.pdf.CellFormat(0, 10, pageInfo, "", 0, "C", false, 0, "")
		}
	})
}

// ReportSummary represents summary statistics for a report
type ReportSummary struct {
	TotalRecords int                    `json:"total_records"`
	GeneratedAt  time.Time              `json:"generated_at"`
	Metrics      map[string]interface{} `json:"metrics,omitempty"`
}

// GenerateReportWithSummary generates a PDF with a summary section
func (g *PDFGenerator) GenerateReportWithSummary(
	columns []string,
	columnLabels []string,
	rows []map[string]interface{},
	summary *ReportSummary,
) error {
	g.pdf.AddPage()

	// Add title
	g.addTitle()

	// Add subtitle
	if g.options.Subtitle != "" {
		g.addSubtitle()
	}

	// Add date
	if g.options.IncludeDate {
		g.addDate()
	}

	g.pdf.Ln(5)

	// Add summary section
	if summary != nil {
		summaryItems := map[string]interface{}{
			"Total Records": summary.TotalRecords,
			"Generated At":  summary.GeneratedAt.Format(g.options.DateFormat + " 15:04:05"),
		}
		for k, v := range summary.Metrics {
			summaryItems[strings.Title(strings.ReplaceAll(k, "_", " "))] = v
		}
		g.AddSummarySection("Summary", summaryItems)
	}

	g.pdf.Ln(10)

	// Calculate column widths
	colWidths := g.calculateColumnWidths(columns, columnLabels, rows)

	// Add table header
	if g.options.IncludeHeader {
		g.addTableHeader(columnLabels, colWidths)
	}

	// Add table data
	g.addTableData(columns, rows, colWidths)

	return nil
}

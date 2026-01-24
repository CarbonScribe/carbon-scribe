package export

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"github.com/xuri/excelize/v2"
)

// ExcelExporter exports data to Excel format
type ExcelExporter struct {
	config ExcelConfig
}

// ExcelConfig holds Excel export configuration
type ExcelConfig struct {
	SheetName     string
	IncludeHeader bool
	DateFormat    string
	TimeFormat    string
	HeaderStyle   *ExcelStyle
	DataStyle     *ExcelStyle
	AutoFilter    bool
	FreezeHeader  bool
	ColumnWidths  map[string]float64
}

// ExcelStyle defines cell styling
type ExcelStyle struct {
	Bold         bool
	Italic       bool
	FontSize     float64
	FontColor    string
	FillColor    string
	Alignment    string
	Border       bool
	NumberFormat string
}

// DefaultExcelConfig returns the default Excel configuration
func DefaultExcelConfig() ExcelConfig {
	return ExcelConfig{
		SheetName:     "Report",
		IncludeHeader: true,
		DateFormat:    "yyyy-mm-dd",
		TimeFormat:    "hh:mm:ss",
		HeaderStyle: &ExcelStyle{
			Bold:      true,
			FillColor: "#4472C4",
			FontColor: "#FFFFFF",
			Alignment: "center",
			Border:    true,
		},
		DataStyle: &ExcelStyle{
			Border: true,
		},
		AutoFilter:   true,
		FreezeHeader: true,
	}
}

// NewExcelExporter creates a new Excel exporter
func NewExcelExporter(config ExcelConfig) *ExcelExporter {
	return &ExcelExporter{config: config}
}

// Export exports data to Excel format
func (e *ExcelExporter) Export(ctx context.Context, data []map[string]interface{}, columns []string) ([]byte, error) {
	f := excelize.NewFile()

	// Set sheet name
	sheetName := e.config.SheetName
	if sheetName == "" {
		sheetName = "Sheet1"
	}
	f.SetSheetName("Sheet1", sheetName)

	// Determine columns if not provided
	if len(columns) == 0 && len(data) > 0 {
		columns = e.extractColumns(data[0])
	}

	// Create header style
	headerStyleID, err := e.createHeaderStyle(f)
	if err != nil {
		return nil, fmt.Errorf("failed to create header style: %w", err)
	}

	// Create data style
	dataStyleID, err := e.createDataStyle(f)
	if err != nil {
		return nil, fmt.Errorf("failed to create data style: %w", err)
	}

	rowOffset := 1

	// Write header
	if e.config.IncludeHeader {
		for i, col := range columns {
			cell, _ := excelize.CoordinatesToCellName(i+1, 1)
			f.SetCellValue(sheetName, cell, col)
			if headerStyleID != 0 {
				f.SetCellStyle(sheetName, cell, cell, headerStyleID)
			}
		}
		rowOffset = 2
	}

	// Write data rows
	for rowIdx, row := range data {
		for colIdx, col := range columns {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+rowOffset)
			value := e.formatValue(row[col])
			f.SetCellValue(sheetName, cell, value)
			if dataStyleID != 0 {
				f.SetCellStyle(sheetName, cell, cell, dataStyleID)
			}
		}
	}

	// Set column widths
	for i, col := range columns {
		colLetter, _ := excelize.ColumnNumberToName(i + 1)
		width := 15.0 // Default width
		if w, exists := e.config.ColumnWidths[col]; exists {
			width = w
		}
		f.SetColWidth(sheetName, colLetter, colLetter, width)
	}

	// Add auto filter
	if e.config.AutoFilter && len(columns) > 0 && len(data) > 0 {
		lastCol, _ := excelize.ColumnNumberToName(len(columns))
		lastRow := len(data) + 1
		if e.config.IncludeHeader {
			filterRange := fmt.Sprintf("A1:%s%d", lastCol, lastRow)
			f.AutoFilter(sheetName, filterRange, nil)
		}
	}

	// Freeze header row
	if e.config.FreezeHeader && e.config.IncludeHeader {
		f.SetPanes(sheetName, &excelize.Panes{
			Freeze:      true,
			Split:       false,
			XSplit:      0,
			YSplit:      1,
			TopLeftCell: "A2",
			ActivePane:  "bottomLeft",
		})
	}

	// Write to buffer
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("failed to write Excel file: %w", err)
	}

	return buf.Bytes(), nil
}

// ExportMultiSheet exports data to multiple sheets
func (e *ExcelExporter) ExportMultiSheet(ctx context.Context, sheets map[string]SheetData) ([]byte, error) {
	f := excelize.NewFile()

	firstSheet := true
	for sheetName, sheetData := range sheets {
		// Create sheet
		if firstSheet {
			f.SetSheetName("Sheet1", sheetName)
			firstSheet = false
		} else {
			f.NewSheet(sheetName)
		}

		columns := sheetData.Columns
		if len(columns) == 0 && len(sheetData.Data) > 0 {
			columns = e.extractColumns(sheetData.Data[0])
		}

		headerStyleID, _ := e.createHeaderStyle(f)
		dataStyleID, _ := e.createDataStyle(f)

		rowOffset := 1

		// Write header
		if e.config.IncludeHeader {
			for i, col := range columns {
				cell, _ := excelize.CoordinatesToCellName(i+1, 1)
				f.SetCellValue(sheetName, cell, col)
				if headerStyleID != 0 {
					f.SetCellStyle(sheetName, cell, cell, headerStyleID)
				}
			}
			rowOffset = 2
		}

		// Write data
		for rowIdx, row := range sheetData.Data {
			for colIdx, col := range columns {
				cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+rowOffset)
				f.SetCellValue(sheetName, cell, e.formatValue(row[col]))
				if dataStyleID != 0 {
					f.SetCellStyle(sheetName, cell, cell, dataStyleID)
				}
			}
		}

		// Auto-size columns
		for i := range columns {
			colLetter, _ := excelize.ColumnNumberToName(i + 1)
			f.SetColWidth(sheetName, colLetter, colLetter, 15)
		}
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("failed to write Excel file: %w", err)
	}

	return buf.Bytes(), nil
}

// SheetData represents data for a single sheet
type SheetData struct {
	Columns []string
	Data    []map[string]interface{}
	Title   string
}

func (e *ExcelExporter) createHeaderStyle(f *excelize.File) (int, error) {
	if e.config.HeaderStyle == nil {
		return 0, nil
	}

	style := &excelize.Style{
		Font: &excelize.Font{
			Bold:  e.config.HeaderStyle.Bold,
			Size:  e.config.HeaderStyle.FontSize,
			Color: e.config.HeaderStyle.FontColor,
		},
	}

	if e.config.HeaderStyle.FillColor != "" {
		style.Fill = excelize.Fill{
			Type:    "pattern",
			Pattern: 1,
			Color:   []string{e.config.HeaderStyle.FillColor},
		}
	}

	if e.config.HeaderStyle.Alignment != "" {
		style.Alignment = &excelize.Alignment{
			Horizontal: e.config.HeaderStyle.Alignment,
			Vertical:   "center",
		}
	}

	if e.config.HeaderStyle.Border {
		style.Border = []excelize.Border{
			{Type: "left", Color: "#000000", Style: 1},
			{Type: "top", Color: "#000000", Style: 1},
			{Type: "right", Color: "#000000", Style: 1},
			{Type: "bottom", Color: "#000000", Style: 1},
		}
	}

	return f.NewStyle(style)
}

func (e *ExcelExporter) createDataStyle(f *excelize.File) (int, error) {
	if e.config.DataStyle == nil {
		return 0, nil
	}

	style := &excelize.Style{}

	if e.config.DataStyle.Border {
		style.Border = []excelize.Border{
			{Type: "left", Color: "#D3D3D3", Style: 1},
			{Type: "top", Color: "#D3D3D3", Style: 1},
			{Type: "right", Color: "#D3D3D3", Style: 1},
			{Type: "bottom", Color: "#D3D3D3", Style: 1},
		}
	}

	if e.config.DataStyle.NumberFormat != "" {
		style.CustomNumFmt = &e.config.DataStyle.NumberFormat
	}

	return f.NewStyle(style)
}

func (e *ExcelExporter) extractColumns(row map[string]interface{}) []string {
	columns := make([]string, 0, len(row))
	for key := range row {
		columns = append(columns, key)
	}
	return columns
}

func (e *ExcelExporter) formatValue(v interface{}) interface{} {
	if v == nil {
		return ""
	}

	switch val := v.(type) {
	case time.Time:
		return val
	case []byte:
		return string(val)
	default:
		return val
	}
}

// AddChart adds a chart to the Excel file
func (e *ExcelExporter) AddChart(f *excelize.File, sheetName string, chartConfig ChartConfig) error {
	chartType := excelize.Line
	switch chartConfig.Type {
	case "bar":
		chartType = excelize.Bar
	case "column":
		chartType = excelize.Col
	case "pie":
		chartType = excelize.Pie
	case "area":
		chartType = excelize.Area
	case "scatter":
		chartType = excelize.Scatter
	}

	series := make([]excelize.ChartSeries, len(chartConfig.Series))
	for i, s := range chartConfig.Series {
		series[i] = excelize.ChartSeries{
			Name:       s.Name,
			Categories: s.Categories,
			Values:     s.Values,
		}
	}

	return f.AddChart(sheetName, chartConfig.Cell, &excelize.Chart{
		Type:   chartType,
		Series: series,
		Title:  []excelize.RichTextRun{{Text: chartConfig.Title}},
		Dimension: excelize.ChartDimension{
			Width:  uint(chartConfig.Width),
			Height: uint(chartConfig.Height),
		},
		Legend: excelize.ChartLegend{
			Position:      "right",
			ShowLegendKey: true,
		},
	})
}

// ChartConfig defines chart configuration
type ChartConfig struct {
	Type   string
	Title  string
	Cell   string
	Width  int
	Height int
	Series []ChartSeries
}

// ChartSeries defines a data series for the chart
type ChartSeries struct {
	Name       string
	Categories string
	Values     string
}

package export

import (
	"fmt"
	"io"
	"time"

	"github.com/xuri/excelize/v2"
)

// ExcelExporter exports data to Excel format
type ExcelExporter struct {
	file       *excelize.File
	options    ExcelOptions
	sheetIndex int
}

// ExcelOptions configures Excel export behavior
type ExcelOptions struct {
	SheetName       string              `json:"sheet_name"`
	IncludeHeader   bool                `json:"include_header"`
	FreezeHeader    bool                `json:"freeze_header"`
	AutoFilter      bool                `json:"auto_filter"`
	DateFormat      string              `json:"date_format"`
	TimestampFormat string              `json:"timestamp_format"`
	NumberFormat    string              `json:"number_format"`
	CurrencyFormat  string              `json:"currency_format"`
	HeaderStyle     *ExcelStyleConfig   `json:"header_style,omitempty"`
	DataStyle       *ExcelStyleConfig   `json:"data_style,omitempty"`
	ColumnWidths    map[string]float64  `json:"column_widths,omitempty"`
	AutoWidth       bool                `json:"auto_width"`
}

// ExcelStyleConfig defines style for cells
type ExcelStyleConfig struct {
	FontBold      bool   `json:"font_bold"`
	FontSize      int    `json:"font_size"`
	FontColor     string `json:"font_color"`
	FillColor     string `json:"fill_color"`
	Alignment     string `json:"alignment"` // left, center, right
	Border        bool   `json:"border"`
	WrapText      bool   `json:"wrap_text"`
}

// DefaultExcelOptions returns default Excel export options
func DefaultExcelOptions() ExcelOptions {
	return ExcelOptions{
		SheetName:       "Report",
		IncludeHeader:   true,
		FreezeHeader:    true,
		AutoFilter:      true,
		DateFormat:      "yyyy-mm-dd",
		TimestampFormat: "yyyy-mm-dd hh:mm:ss",
		NumberFormat:    "#,##0.00",
		CurrencyFormat:  "$#,##0.00",
		AutoWidth:       true,
		HeaderStyle: &ExcelStyleConfig{
			FontBold:  true,
			FontSize:  11,
			FillColor: "4472C4",
			FontColor: "FFFFFF",
			Alignment: "center",
			Border:    true,
		},
		DataStyle: &ExcelStyleConfig{
			FontSize:  11,
			Alignment: "left",
			Border:    true,
		},
	}
}

// NewExcelExporter creates a new Excel exporter
func NewExcelExporter(options ExcelOptions) *ExcelExporter {
	file := excelize.NewFile()

	// Rename the default sheet
	file.SetSheetName("Sheet1", options.SheetName)

	return &ExcelExporter{
		file:    file,
		options: options,
	}
}

// WriteHeader writes the header row with styling
func (e *ExcelExporter) WriteHeader(columns []string) error {
	if !e.options.IncludeHeader {
		return nil
	}

	sheetName := e.options.SheetName

	// Create header style
	headerStyleID := 0
	if e.options.HeaderStyle != nil {
		style, err := e.createStyle(e.options.HeaderStyle)
		if err != nil {
			return fmt.Errorf("failed to create header style: %w", err)
		}
		headerStyleID = style
	}

	// Write header cells
	for i, col := range columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		e.file.SetCellValue(sheetName, cell, col)

		if headerStyleID > 0 {
			e.file.SetCellStyle(sheetName, cell, cell, headerStyleID)
		}
	}

	// Freeze header row
	if e.options.FreezeHeader {
		e.file.SetPanes(sheetName, &excelize.Panes{
			Freeze:      true,
			Split:       false,
			XSplit:      0,
			YSplit:      1,
			TopLeftCell: "A2",
			ActivePane:  "bottomLeft",
		})
	}

	return nil
}

// WriteRows writes data rows
func (e *ExcelExporter) WriteRows(rows []map[string]interface{}, columns []string) error {
	sheetName := e.options.SheetName
	startRow := 1
	if e.options.IncludeHeader {
		startRow = 2
	}

	// Create data style
	dataStyleID := 0
	if e.options.DataStyle != nil {
		style, err := e.createStyle(e.options.DataStyle)
		if err != nil {
			return fmt.Errorf("failed to create data style: %w", err)
		}
		dataStyleID = style
	}

	// Track max width for each column
	columnWidths := make(map[int]float64)

	for rowIdx, row := range rows {
		rowNum := startRow + rowIdx

		for colIdx, colName := range columns {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowNum)
			val := row[colName]

			// Set cell value
			if err := e.setCellValue(sheetName, cell, val); err != nil {
				return fmt.Errorf("failed to set cell value: %w", err)
			}

			// Apply style
			if dataStyleID > 0 {
				e.file.SetCellStyle(sheetName, cell, cell, dataStyleID)
			}

			// Track width for auto-sizing
			if e.options.AutoWidth {
				width := e.estimateCellWidth(val)
				if width > columnWidths[colIdx] {
					columnWidths[colIdx] = width
				}
			}
		}
	}

	// Apply auto filter
	if e.options.AutoFilter && e.options.IncludeHeader && len(rows) > 0 {
		lastCol, _ := excelize.CoordinatesToCellName(len(columns), 1)
		lastRow, _ := excelize.CoordinatesToCellName(len(columns), len(rows)+1)
		e.file.AutoFilter(sheetName, "A1:"+lastCol, nil)
		_ = lastRow // Suppress unused variable warning
	}

	// Apply column widths
	if e.options.AutoWidth {
		for colIdx, width := range columnWidths {
			colName, _ := excelize.ColumnNumberToName(colIdx + 1)
			// Min width 10, max width 50
			if width < 10 {
				width = 10
			}
			if width > 50 {
				width = 50
			}
			e.file.SetColWidth(sheetName, colName, colName, width)
		}
	}

	// Apply custom column widths
	if e.options.ColumnWidths != nil {
		for i, colName := range columns {
			if width, ok := e.options.ColumnWidths[colName]; ok {
				col, _ := excelize.ColumnNumberToName(i + 1)
				e.file.SetColWidth(sheetName, col, col, width)
			}
		}
	}

	return nil
}

// AddSheet adds a new sheet to the workbook
func (e *ExcelExporter) AddSheet(name string) error {
	_, err := e.file.NewSheet(name)
	return err
}

// WriteTo writes the Excel file to a writer
func (e *ExcelExporter) WriteTo(w io.Writer) error {
	return e.file.Write(w)
}

// SaveAs saves the Excel file to a path
func (e *ExcelExporter) SaveAs(path string) error {
	return e.file.SaveAs(path)
}

// Close closes the Excel file
func (e *ExcelExporter) Close() error {
	return e.file.Close()
}

// createStyle creates an Excel style from config
func (e *ExcelExporter) createStyle(config *ExcelStyleConfig) (int, error) {
	style := &excelize.Style{}

	// Font
	style.Font = &excelize.Font{
		Bold: config.FontBold,
		Size: float64(config.FontSize),
	}
	if config.FontColor != "" {
		style.Font.Color = config.FontColor
	}

	// Fill
	if config.FillColor != "" {
		style.Fill = excelize.Fill{
			Type:    "pattern",
			Pattern: 1,
			Color:   []string{config.FillColor},
		}
	}

	// Alignment
	if config.Alignment != "" || config.WrapText {
		style.Alignment = &excelize.Alignment{
			WrapText: config.WrapText,
		}
		switch config.Alignment {
		case "left":
			style.Alignment.Horizontal = "left"
		case "center":
			style.Alignment.Horizontal = "center"
		case "right":
			style.Alignment.Horizontal = "right"
		}
	}

	// Border
	if config.Border {
		style.Border = []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		}
	}

	return e.file.NewStyle(style)
}

// setCellValue sets a cell value with appropriate formatting
func (e *ExcelExporter) setCellValue(sheet, cell string, val interface{}) error {
	if val == nil {
		return e.file.SetCellValue(sheet, cell, "")
	}

	switch v := val.(type) {
	case time.Time:
		if v.IsZero() {
			return e.file.SetCellValue(sheet, cell, "")
		}
		e.file.SetCellValue(sheet, cell, v)
		// Apply date format
		style, _ := e.file.NewStyle(&excelize.Style{
			NumFmt: 14, // mm-dd-yy
		})
		e.file.SetCellStyle(sheet, cell, cell, style)
	case *time.Time:
		if v == nil || v.IsZero() {
			return e.file.SetCellValue(sheet, cell, "")
		}
		e.file.SetCellValue(sheet, cell, *v)
		style, _ := e.file.NewStyle(&excelize.Style{
			NumFmt: 14,
		})
		e.file.SetCellStyle(sheet, cell, cell, style)
	case float32, float64:
		e.file.SetCellValue(sheet, cell, v)
		// Apply number format
		if e.options.NumberFormat != "" {
			style, _ := e.file.NewStyle(&excelize.Style{
				CustomNumFmt: &e.options.NumberFormat,
			})
			e.file.SetCellStyle(sheet, cell, cell, style)
		}
	default:
		return e.file.SetCellValue(sheet, cell, v)
	}

	return nil
}

// estimateCellWidth estimates the display width of a cell value
func (e *ExcelExporter) estimateCellWidth(val interface{}) float64 {
	if val == nil {
		return 0
	}

	str := fmt.Sprintf("%v", val)
	// Rough estimate: 1 character = 1 unit width, plus padding
	width := float64(len(str)) * 1.2
	return width
}

// MultiSheetExporter exports data to multiple Excel sheets
type MultiSheetExporter struct {
	file    *excelize.File
	options ExcelOptions
}

// NewMultiSheetExporter creates a multi-sheet Excel exporter
func NewMultiSheetExporter(options ExcelOptions) *MultiSheetExporter {
	file := excelize.NewFile()
	file.DeleteSheet("Sheet1") // Remove default sheet

	return &MultiSheetExporter{
		file:    file,
		options: options,
	}
}

// AddSheet adds a sheet with data
func (e *MultiSheetExporter) AddSheet(name string, columns []string, rows []map[string]interface{}) error {
	_, err := e.file.NewSheet(name)
	if err != nil {
		return fmt.Errorf("failed to create sheet: %w", err)
	}

	// Create single sheet exporter
	singleExporter := &ExcelExporter{
		file: e.file,
		options: ExcelOptions{
			SheetName:     name,
			IncludeHeader: e.options.IncludeHeader,
			FreezeHeader:  e.options.FreezeHeader,
			AutoFilter:    e.options.AutoFilter,
			HeaderStyle:   e.options.HeaderStyle,
			DataStyle:     e.options.DataStyle,
			AutoWidth:     e.options.AutoWidth,
		},
	}

	if err := singleExporter.WriteHeader(columns); err != nil {
		return err
	}

	return singleExporter.WriteRows(rows, columns)
}

// WriteTo writes the Excel file to a writer
func (e *MultiSheetExporter) WriteTo(w io.Writer) error {
	return e.file.Write(w)
}

// SaveAs saves the Excel file to a path
func (e *MultiSheetExporter) SaveAs(path string) error {
	return e.file.SaveAs(path)
}

// Close closes the Excel file
func (e *MultiSheetExporter) Close() error {
	return e.file.Close()
}

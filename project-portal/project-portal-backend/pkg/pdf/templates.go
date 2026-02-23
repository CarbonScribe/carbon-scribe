package pdf

import "fmt"

// Template defines a named PDF layout.
type Template struct {
	ID          string
	DisplayName string
	Render      func(req GenerateRequest) ([]byte, error)
}

// Templates is the registry of all available PDF templates.
var Templates = map[string]*Template{
	"PDD":                      templatePDD,
	"MONITORING_REPORT":        templateMonitoringReport,
	"VERIFICATION_CERTIFICATE": templateVerificationCertificate,
}

// ---- Project Design Document (PDD) ----------------------------------------

var templatePDD = &Template{
	ID:          "PDD",
	DisplayName: "Project Design Document",
	Render:      renderPDD,
}

func renderPDD(req GenerateRequest) ([]byte, error) {
	pdf := newDoc()
	drawFooter(pdf)
	drawHeader(pdf, "Project Design Document", "Carbon Credit Verification — PDD Template")

	// ── Project Overview ──────────────────────────────────────────────────────
	drawSectionTitle(pdf, "1. Project Overview")
	drawKeyValue(pdf, "Project ID", strOrDefault(req.Data, "project_id", req.ProjectID))
	drawKeyValue(pdf, "Project Name", strOrDefault(req.Data, "project_name", "N/A"))
	drawKeyValue(pdf, "Project Type", strOrDefault(req.Data, "project_type", "N/A"))
	drawKeyValue(pdf, "Country / Region", strOrDefault(req.Data, "country", "N/A"))
	drawKeyValue(pdf, "Coordinates", strOrDefault(req.Data, "coordinates", "N/A"))
	drawKeyValue(pdf, "Start Date", strOrDefault(req.Data, "start_date", "N/A"))
	drawKeyValue(pdf, "Crediting Period", strOrDefault(req.Data, "crediting_period", "N/A"))
	pdf.Ln(3)

	// ── Project Description ───────────────────────────────────────────────────
	drawSectionTitle(pdf, "2. Project Description")
	drawBody(pdf, strOrDefault(req.Data, "description", "No description provided."))

	// ── Baseline Methodology ──────────────────────────────────────────────────
	drawSectionTitle(pdf, "3. Baseline & Methodology")
	drawKeyValue(pdf, "Methodology", strOrDefault(req.Data, "methodology", "N/A"))
	drawKeyValue(pdf, "Baseline Scenario", strOrDefault(req.Data, "baseline_scenario", "N/A"))
	drawBody(pdf, strOrDefault(req.Data, "additionality", ""))

	// ── Estimated Emissions Reductions ────────────────────────────────────────
	drawSectionTitle(pdf, "4. Estimated Emissions Reductions")
	drawKeyValue(pdf, "Annual CO₂e (tonnes)", strOrDefault(req.Data, "annual_co2e", "N/A"))
	drawKeyValue(pdf, "Total (crediting period)", strOrDefault(req.Data, "total_co2e", "N/A"))
	pdf.Ln(3)

	// ── Stakeholder Consultation ──────────────────────────────────────────────
	drawSectionTitle(pdf, "5. Stakeholder Consultation")
	drawBody(pdf, strOrDefault(req.Data, "stakeholder_summary", "No stakeholder consultation summary provided."))

	// ── Safeguards ────────────────────────────────────────────────────────────
	drawSectionTitle(pdf, "6. Environmental & Social Safeguards")
	drawBody(pdf, strOrDefault(req.Data, "safeguards", "No safeguards information provided."))

	addWatermark(pdf, req.Watermark)
	return toBytes(pdf)
}

// ---- Monitoring Report -----------------------------------------------------

var templateMonitoringReport = &Template{
	ID:          "MONITORING_REPORT",
	DisplayName: "Monitoring Report",
	Render:      renderMonitoringReport,
}

func renderMonitoringReport(req GenerateRequest) ([]byte, error) {
	pdf := newDoc()
	drawFooter(pdf)
	drawHeader(pdf, "Monitoring Report", "Carbon Credit Verification — Monitoring Report")

	// ── Reporting Period ──────────────────────────────────────────────────────
	drawSectionTitle(pdf, "1. Reporting Period")
	drawKeyValue(pdf, "Project ID", strOrDefault(req.Data, "project_id", req.ProjectID))
	drawKeyValue(pdf, "Period Start", strOrDefault(req.Data, "period_start", "N/A"))
	drawKeyValue(pdf, "Period End", strOrDefault(req.Data, "period_end", "N/A"))
	drawKeyValue(pdf, "Report Number", strOrDefault(req.Data, "report_number", "1"))
	pdf.Ln(3)

	// ── Monitoring Parameters ─────────────────────────────────────────────────
	drawSectionTitle(pdf, "2. Monitoring Parameters")
	drawKeyValue(pdf, "Methodology", strOrDefault(req.Data, "methodology", "N/A"))
	drawKeyValue(pdf, "Monitoring Frequency", strOrDefault(req.Data, "monitoring_frequency", "N/A"))
	drawKeyValue(pdf, "Data Sources", strOrDefault(req.Data, "data_sources", "N/A"))
	pdf.Ln(3)

	// ── Emission Reductions Achieved ──────────────────────────────────────────
	drawSectionTitle(pdf, "3. Emission Reductions Achieved")
	drawKeyValue(pdf, "CO₂e Reduced (tonnes)", strOrDefault(req.Data, "co2e_reduced", "N/A"))
	drawKeyValue(pdf, "Baseline Emissions", strOrDefault(req.Data, "baseline_emissions", "N/A"))
	drawKeyValue(pdf, "Project Emissions", strOrDefault(req.Data, "project_emissions", "N/A"))
	drawKeyValue(pdf, "Leakage", strOrDefault(req.Data, "leakage", "0"))
	pdf.Ln(3)

	// ── Data Quality & Uncertainty ────────────────────────────────────────────
	drawSectionTitle(pdf, "4. Data Quality & Uncertainty")
	drawBody(pdf, strOrDefault(req.Data, "data_quality", "No data quality assessment provided."))

	// ── Deviations from PDD ───────────────────────────────────────────────────
	drawSectionTitle(pdf, "5. Deviations from PDD")
	drawBody(pdf, strOrDefault(req.Data, "deviations", "None."))

	// ── Summary ───────────────────────────────────────────────────────────────
	drawSectionTitle(pdf, "6. Summary")
	drawBody(pdf, fmt.Sprintf(
		"This monitoring report covers the period from %s to %s. Total emission reductions achieved: %s tCO₂e.",
		strOrDefault(req.Data, "period_start", "N/A"),
		strOrDefault(req.Data, "period_end", "N/A"),
		strOrDefault(req.Data, "co2e_reduced", "N/A"),
	))

	addWatermark(pdf, req.Watermark)
	return toBytes(pdf)
}

// ---- Verification Certificate ----------------------------------------------

var templateVerificationCertificate = &Template{
	ID:          "VERIFICATION_CERTIFICATE",
	DisplayName: "Verification Certificate",
	Render:      renderVerificationCertificate,
}

func renderVerificationCertificate(req GenerateRequest) ([]byte, error) {
	pdf := newDoc()
	drawFooter(pdf)
	drawHeader(pdf, "Verification Certificate", "Carbon Credit Verification — Official Certificate")

	// ── Certificate Banner ────────────────────────────────────────────────────
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(34, 85, 56)
	pdf.CellFormat(170, 14, "CERTIFICATE OF VERIFICATION", "", 1, "C", false, 0, "")
	pdf.SetFont("Helvetica", "I", 11)
	pdf.SetTextColor(80, 80, 80)
	pdf.CellFormat(170, 8, "Issued under the CarbonScribe Verification Standard", "", 1, "C", false, 0, "")
	pdf.SetTextColor(40, 40, 40)
	pdf.Ln(6)

	// ── Project Details ───────────────────────────────────────────────────────
	drawSectionTitle(pdf, "Project Details")
	drawKeyValue(pdf, "Project ID", strOrDefault(req.Data, "project_id", req.ProjectID))
	drawKeyValue(pdf, "Project Name", strOrDefault(req.Data, "project_name", "N/A"))
	drawKeyValue(pdf, "Project Type", strOrDefault(req.Data, "project_type", "N/A"))
	drawKeyValue(pdf, "Country", strOrDefault(req.Data, "country", "N/A"))
	pdf.Ln(3)

	// ── Verification Scope ────────────────────────────────────────────────────
	drawSectionTitle(pdf, "Verification Scope")
	drawKeyValue(pdf, "Verification Standard", strOrDefault(req.Data, "standard", "CarbonScribe v1.0"))
	drawKeyValue(pdf, "Verification Body", strOrDefault(req.Data, "verifier", "N/A"))
	drawKeyValue(pdf, "Verification Date", strOrDefault(req.Data, "verification_date", "N/A"))
	drawKeyValue(pdf, "Monitoring Period", strOrDefault(req.Data, "monitoring_period", "N/A"))
	pdf.Ln(3)

	// ── Verified Emission Reductions ──────────────────────────────────────────
	drawSectionTitle(pdf, "Verified Emission Reductions")
	drawKeyValue(pdf, "Verified CO₂e (tonnes)", strOrDefault(req.Data, "verified_co2e", "N/A"))
	drawKeyValue(pdf, "Uncertainty (%)", strOrDefault(req.Data, "uncertainty_percent", "N/A"))
	pdf.Ln(3)

	// ── Opinion ───────────────────────────────────────────────────────────────
	drawSectionTitle(pdf, "Verification Opinion")
	drawBody(pdf, strOrDefault(req.Data, "opinion",
		"Based on our verification activities conducted in accordance with the CarbonScribe "+
			"Verification Standard, we provide a reasonable assurance opinion that the emission "+
			"reductions stated above have been achieved and are in conformance with the approved "+
			"Project Design Document."))

	// ── Signature Block ───────────────────────────────────────────────────────
	pdf.Ln(10)
	drawSectionTitle(pdf, "Authorized Signatures")
	pdf.Ln(4)

	drawKeyValue(pdf, "Lead Verifier", strOrDefault(req.Data, "lead_verifier", "________________"))
	pdf.Ln(2)
	drawKeyValue(pdf, "Technical Reviewer", strOrDefault(req.Data, "technical_reviewer", "________________"))
	pdf.Ln(2)
	drawKeyValue(pdf, "Issue Date", strOrDefault(req.Data, "issue_date", "________________"))

	addWatermark(pdf, req.Watermark)
	return toBytes(pdf)
}

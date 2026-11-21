// Package observability configures distributed tracing for this service
// (issue #695). Before this package existed, the OTel SDK packages were
// listed in go.mod only as transitive (// indirect) dependencies — nothing
// in this module ever imported them directly, so no TracerProvider was ever
// configured and no span was ever created, leaving every trace backend empty
// regardless of what instrumentation got added elsewhere.
package observability

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

// DefaultServiceName is used when OTEL_SERVICE_NAME is unset. Also used by
// main.go as the instrumentation name passed to otelgin.Middleware, and by
// other packages in this module as their tracer name (see
// minting/service.go for the pattern) — one constant instead of the same
// literal string repeated at every call site.
const DefaultServiceName = "project-portal-backend"

// Shutdown flushes any buffered spans and releases exporter resources. It is
// a no-op (never nil) when tracing is disabled, so callers can always defer
// it unconditionally.
type Shutdown func(context.Context) error

// InitFromEnv configures the global OpenTelemetry TracerProvider and
// text-map propagator for this process from the standard OTel environment
// variables (see .env.example for the full list). Call once at startup,
// before the Gin router is constructed, and defer the returned Shutdown.
//
// OTEL_TRACES_EXPORTER selects the exporter:
//   - "stdout" (default): pretty-prints spans to stdout. Safe with no
//     collector running, so it's the default for local development.
//   - "otlp": OTLP/HTTP, configured via the standard OTEL_EXPORTER_OTLP_*
//     env vars that otlptracehttp.New reads itself (OTEL_EXPORTER_OTLP_ENDPOINT,
//     _HEADERS, _INSECURE, _PROTOCOL, ...) — set this in staging/production
//     once a collector endpoint exists.
//   - "none": tracing stays a no-op (the OTel API's default behavior with no
//     provider configured) — for environments that never want the overhead.
//
// A misconfigured exporter (e.g. an unreachable OTLP endpoint) does not fail
// startup: otlptracehttp.New only builds the exporter, it does not connect
// eagerly, so export failures surface later as spans silently dropped (with
// an error logged via the OTel SDK's own global error handler) rather than
// as a boot-time error.
func InitFromEnv(ctx context.Context) (Shutdown, error) {
	noop := Shutdown(func(context.Context) error { return nil })

	exporterKind := strings.ToLower(strings.TrimSpace(getenvDefault("OTEL_TRACES_EXPORTER", "stdout")))
	switch exporterKind {
	case "none", "disabled", "off":
		log.Println("ℹ️  OTEL_TRACES_EXPORTER=none — tracing is disabled")
		return noop, nil
	}

	var exporter sdktrace.SpanExporter
	var err error
	switch exporterKind {
	case "otlp":
		exporter, err = otlptracehttp.New(ctx)
	case "stdout", "console":
		exporter, err = stdouttrace.New(stdouttrace.WithPrettyPrint())
	default:
		return nil, fmt.Errorf(
			"unknown OTEL_TRACES_EXPORTER %q (expected one of: otlp, stdout, none)", exporterKind,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("create otel trace exporter %q: %w", exporterKind, err)
	}

	serviceName := getenvDefault("OTEL_SERVICE_NAME", DefaultServiceName)
	res, err := resource.New(ctx,
		resource.WithAttributes(semconv.ServiceName(serviceName)),
		resource.WithFromEnv(),
	)
	if err != nil {
		return nil, fmt.Errorf("build otel resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	log.Printf("✅ OpenTelemetry tracing initialized (exporter=%s, service=%s)", exporterKind, serviceName)
	return tp.Shutdown, nil
}

func getenvDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

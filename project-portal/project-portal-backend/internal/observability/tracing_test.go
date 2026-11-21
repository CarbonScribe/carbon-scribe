package observability

import (
	"context"
	"testing"
	"time"
)

func TestInitFromEnv_Disabled(t *testing.T) {
	for _, value := range []string{"none", "disabled", "off", "NONE"} {
		t.Run(value, func(t *testing.T) {
			t.Setenv("OTEL_TRACES_EXPORTER", value)

			shutdown, err := InitFromEnv(context.Background())
			if err != nil {
				t.Fatalf("InitFromEnv() error = %v, want nil", err)
			}
			if shutdown == nil {
				t.Fatal("InitFromEnv() returned a nil shutdown func")
			}
			if err := shutdown(context.Background()); err != nil {
				t.Fatalf("no-op shutdown() error = %v, want nil", err)
			}
		})
	}
}

func TestInitFromEnv_Stdout(t *testing.T) {
	t.Setenv("OTEL_TRACES_EXPORTER", "stdout")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	shutdown, err := InitFromEnv(ctx)
	if err != nil {
		t.Fatalf("InitFromEnv() error = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := shutdown(context.Background()); err != nil {
			t.Errorf("shutdown() error = %v, want nil", err)
		}
	})
}

func TestInitFromEnv_OTLP(t *testing.T) {
	// otlptracehttp.New only builds the exporter; it does not connect
	// eagerly, so this must succeed even with no collector reachable at
	// the default endpoint — that's the whole point of using try/export
	// semantics rather than failing startup (#695).
	t.Setenv("OTEL_TRACES_EXPORTER", "otlp")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	shutdown, err := InitFromEnv(ctx)
	if err != nil {
		t.Fatalf("InitFromEnv() error = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := shutdown(context.Background()); err != nil {
			t.Errorf("shutdown() error = %v, want nil", err)
		}
	})
}

func TestInitFromEnv_UnknownExporterIsRejected(t *testing.T) {
	t.Setenv("OTEL_TRACES_EXPORTER", "not-a-real-exporter")

	_, err := InitFromEnv(context.Background())
	if err == nil {
		t.Fatal("InitFromEnv() error = nil, want an error for an unknown exporter kind")
	}
}

func TestInitFromEnv_DefaultsToStdoutExporter(t *testing.T) {
	// OTEL_TRACES_EXPORTER unset should behave the same as "stdout" — the
	// documented local-dev default (#695) — not error and not silently
	// fall back to "none".
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	shutdown, err := InitFromEnv(ctx)
	if err != nil {
		t.Fatalf("InitFromEnv() error = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := shutdown(context.Background()); err != nil {
			t.Errorf("shutdown() error = %v, want nil", err)
		}
	})
}

func TestGetenvDefault(t *testing.T) {
	t.Run("returns the env value when set", func(t *testing.T) {
		t.Setenv("OBSERVABILITY_TEST_KEY", "configured-value")
		if got := getenvDefault("OBSERVABILITY_TEST_KEY", "fallback"); got != "configured-value" {
			t.Errorf("getenvDefault() = %q, want %q", got, "configured-value")
		}
	})

	t.Run("returns the fallback when unset", func(t *testing.T) {
		t.Setenv("OBSERVABILITY_TEST_KEY_UNSET", "")
		if got := getenvDefault("OBSERVABILITY_TEST_KEY_UNSET", "fallback"); got != "fallback" {
			t.Errorf("getenvDefault() = %q, want %q", got, "fallback")
		}
	})
}

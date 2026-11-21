import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmAlertPayload } from "./project-portal.client.js";

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      create: () => ({ get: getMock, post: postMock }),
    },
  };
});

const { projectPortalClient, classifyConfirmAlertError } =
  await import("./project-portal.client.js");
const { env } = await import("../config/env.js");
const { logger } = await import("../shared/logging/logger.js");
const {
  mockMethodologiesResponseBody,
  mockMethodologies,
  mockConfirmAlertPayload,
  mockConfirmAlertResponseBody,
  mockConfirmAlertResponse,
} = await import("./project-portal.client.fixtures.js");

function axiosError({
  status,
  hasResponse = true,
}: {
  status?: number;
  hasResponse?: boolean;
}) {
  const err = new Error("request failed") as Error & {
    isAxiosError: boolean;
    response?: { status: number };
  };
  err.isAxiosError = true;
  if (hasResponse) {
    err.response = { status: status ?? 500 };
  }
  return err;
}

describe("projectPortalClient.getMethodologies", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("returns the validated, typed methodology list", async () => {
    getMock.mockResolvedValue({ data: mockMethodologiesResponseBody });

    const result = await projectPortalClient.getMethodologies();

    expect(result).toEqual(mockMethodologies);
    expect(getMock).toHaveBeenCalledWith("/methodologies");
  });

  it("throws on a malformed response instead of passing it through", async () => {
    getMock.mockResolvedValue({
      data: { methodologies: [{ id: "agroforestry" }] },
    });

    await expect(projectPortalClient.getMethodologies()).rejects.toThrow();
  });

  it("does not retry a 4xx response", async () => {
    getMock.mockRejectedValue(axiosError({ status: 404 }));

    await expect(projectPortalClient.getMethodologies()).rejects.toThrow();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and succeeds", async () => {
    getMock
      .mockRejectedValueOnce(axiosError({ status: 503 }))
      .mockResolvedValueOnce({ data: mockMethodologiesResponseBody });

    const result = await projectPortalClient.getMethodologies();

    expect(result).toEqual(mockMethodologies);
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error with no response and eventually gives up", async () => {
    getMock.mockRejectedValue(axiosError({ hasResponse: false }));

    await expect(projectPortalClient.getMethodologies()).rejects.toThrow();
    // Initial attempt + MAX_RETRIES retries.
    expect(getMock).toHaveBeenCalledTimes(3);
  });

  it("returns fixture data directly without HTTP calls when mock mode is enabled", async () => {
    env.mockProjectPortal = true;
    try {
      const result = await projectPortalClient.getMethodologies();
      expect(result).toEqual(mockMethodologies);
      expect(getMock).not.toHaveBeenCalled();
    } finally {
      env.mockProjectPortal = false;
    }
  });

  describe("request/response logging (#707)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logs a request-start and a request-complete line, with method/path/status/duration — never the body", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      getMock.mockResolvedValue({
        status: 200,
        data: mockMethodologiesResponseBody,
      });

      await projectPortalClient.getMethodologies();

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "getMethodologies",
          method: "GET",
          path: "/methodologies",
          event: "request_start",
        }),
        expect.any(String),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "getMethodologies",
          event: "request_complete",
          outcome: "success",
          status: 200,
          attempts: 1,
          retried: false,
          durationMs: expect.any(Number),
        }),
        expect.any(String),
      );
      for (const call of infoSpy.mock.calls) {
        expect(JSON.stringify(call[0])).not.toContain("agroforestry");
      }
    });

    it("correlates log lines with the calling agent's requestId when supplied", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      getMock.mockResolvedValue({
        status: 200,
        data: mockMethodologiesResponseBody,
      });

      await projectPortalClient.getMethodologies({
        requestId: "req-correlate-methodologies-1",
      });

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "req-correlate-methodologies-1" }),
        expect.any(String),
      );
    });

    it("does not include a requestId field when the caller doesn't supply one", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      getMock.mockResolvedValue({
        status: 200,
        data: mockMethodologiesResponseBody,
      });

      await projectPortalClient.getMethodologies();

      const startCall = infoSpy.mock.calls.find(
        (call) => (call[0] as { event?: string }).event === "request_start",
      );
      expect(
        (startCall?.[0] as { requestId?: string }).requestId,
      ).toBeUndefined();
    });

    it("logs a distinct, attempt-numbered line for a retry, distinguishing it from a first-try success", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const infoSpy = vi.spyOn(logger, "info");
      getMock
        .mockRejectedValueOnce(axiosError({ status: 503 }))
        .mockResolvedValueOnce({
          status: 200,
          data: mockMethodologiesResponseBody,
        });

      await projectPortalClient.getMethodologies();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "getMethodologies",
          event: "retry",
          attempt: 1,
          maxRetries: 2,
          error: expect.any(String),
        }),
        expect.any(String),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "request_complete",
          outcome: "success",
          attempts: 2,
          retried: true,
        }),
        expect.any(String),
      );
    });

    it("logs a request-failed line with the error and no retry line for a non-retryable 4xx", async () => {
      const errorSpy = vi.spyOn(logger, "error");
      const warnSpy = vi.spyOn(logger, "warn");
      getMock.mockRejectedValue(axiosError({ status: 404 }));

      await expect(projectPortalClient.getMethodologies()).rejects.toThrow();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "getMethodologies",
          event: "request_complete",
          outcome: "error",
          status: 404,
        }),
        expect.any(String),
      );
    });

    it("logs the response status and a top-level-keys shape summary on a schema-validation failure", async () => {
      const errorSpy = vi.spyOn(logger, "error");
      getMock.mockResolvedValue({
        status: 200,
        data: { methodologies: [{ id: "agroforestry" }] },
      });

      await expect(projectPortalClient.getMethodologies()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "getMethodologies",
          event: "schema_validation_failed",
          status: 200,
          responseShape: {
            type: "object",
            keys: ["methodologies"],
          },
        }),
        expect.any(String),
      );
    });
  });
});

describe("projectPortalClient.confirmAlert", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("posts the confirmed alert to the notifications pipeline and returns the validated notification", async () => {
    postMock.mockResolvedValue({ data: mockConfirmAlertResponseBody });

    const result = await projectPortalClient.confirmAlert(
      "proj-fixture-1",
      mockConfirmAlertPayload,
    );

    expect(result).toEqual(mockConfirmAlertResponse);
    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body, config] = postMock.mock.calls[0]!;
    expect(path).toBe("/internal/notifications/confirmed-alerts");
    expect(body).toEqual({
      project_id: "proj-fixture-1",
      category: "monitoring.alert",
      subject: "Confirmed alert for project proj-fixture-1",
      content:
        "NDVI drop corroborated by IoT sensor readings and no weather anomaly.",
      channels: ["IN_APP"],
      metadata: mockConfirmAlertPayload.metadata,
    });
    // The idempotency key travels as a header, not in the body.
    expect(config).toEqual({
      headers: { "Idempotency-Key": "req-fixture-1" },
    });
    expect(body).not.toHaveProperty("idempotencyKey");
  });

  it("omits the Idempotency-Key header when no key is supplied", async () => {
    postMock.mockResolvedValue({ data: mockConfirmAlertResponseBody });
    const payloadWithoutKey: ConfirmAlertPayload = {
      ...mockConfirmAlertPayload,
      idempotencyKey: undefined,
    };

    await projectPortalClient.confirmAlert("proj-fixture-1", payloadWithoutKey);

    const [, body, config] = postMock.mock.calls[0]!;
    expect(config).toBeUndefined();
    expect(body).not.toHaveProperty("idempotencyKey");
  });

  it("surfaces an upstream error instead of swallowing it, without retrying a 4xx", async () => {
    postMock.mockRejectedValue(axiosError({ status: 422 }));

    await expect(
      projectPortalClient.confirmAlert(
        "proj-fixture-1",
        mockConfirmAlertPayload,
      ),
    ).rejects.toThrow("request failed");
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient downstream failure and succeeds", async () => {
    postMock
      .mockRejectedValueOnce(axiosError({ status: 503 }))
      .mockResolvedValueOnce({ data: mockConfirmAlertResponseBody });

    const result = await projectPortalClient.confirmAlert(
      "proj-fixture-1",
      mockConfirmAlertPayload,
    );

    expect(result).toEqual(mockConfirmAlertResponse);
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it("throws on a malformed success response instead of passing it through", async () => {
    postMock.mockResolvedValue({ data: { id: 5 } });

    await expect(
      projectPortalClient.confirmAlert(
        "proj-fixture-1",
        mockConfirmAlertPayload,
      ),
    ).rejects.toThrow();
  });

  it("returns fixture data directly without HTTP calls when mock mode is enabled", async () => {
    env.mockProjectPortal = true;
    try {
      const result = await projectPortalClient.confirmAlert(
        "proj-custom-99",
        mockConfirmAlertPayload,
      );
      expect(result).toEqual({
        ...mockConfirmAlertResponse,
        project_id: "proj-custom-99",
        category: mockConfirmAlertPayload.category,
        subject: mockConfirmAlertPayload.subject,
      });
      expect(postMock).not.toHaveBeenCalled();
    } finally {
      env.mockProjectPortal = false;
    }
  });

  describe("request/response logging (#707)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logs a request-start and a request-complete line, with method/path/status/duration — never the body", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      postMock.mockResolvedValue({
        status: 200,
        data: mockConfirmAlertResponseBody,
      });

      await projectPortalClient.confirmAlert(
        "proj-fixture-1",
        mockConfirmAlertPayload,
      );

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "confirmAlert",
          method: "POST",
          path: "/internal/notifications/confirmed-alerts",
          event: "request_start",
        }),
        expect.any(String),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "confirmAlert",
          event: "request_complete",
          outcome: "success",
          status: 200,
          attempts: 1,
          retried: false,
          durationMs: expect.any(Number),
        }),
        expect.any(String),
      );
      for (const call of infoSpy.mock.calls) {
        expect(JSON.stringify(call[0])).not.toContain(
          mockConfirmAlertPayload.content,
        );
      }
    });

    it("correlates log lines with options.requestId when supplied", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      postMock.mockResolvedValue({
        status: 200,
        data: mockConfirmAlertResponseBody,
      });

      await projectPortalClient.confirmAlert(
        "proj-fixture-1",
        mockConfirmAlertPayload,
        { requestId: "req-override-confirm-alert" },
      );

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "req-override-confirm-alert" }),
        expect.any(String),
      );
    });

    it("falls back to alertPayload.idempotencyKey as requestId when options.requestId is omitted", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      postMock.mockResolvedValue({
        status: 200,
        data: mockConfirmAlertResponseBody,
      });

      await projectPortalClient.confirmAlert(
        "proj-fixture-1",
        mockConfirmAlertPayload,
      );

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: mockConfirmAlertPayload.idempotencyKey,
        }),
        expect.any(String),
      );
    });

    it("does not include a requestId field when neither options nor alertPayload provide one", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      postMock.mockResolvedValue({
        status: 200,
        data: mockConfirmAlertResponseBody,
      });
      const payloadWithoutKey: ConfirmAlertPayload = {
        ...mockConfirmAlertPayload,
        idempotencyKey: undefined,
      };

      await projectPortalClient.confirmAlert(
        "proj-fixture-1",
        payloadWithoutKey,
      );

      const startCall = infoSpy.mock.calls.find(
        (call) => (call[0] as { event?: string }).event === "request_start",
      );
      expect(
        (startCall?.[0] as { requestId?: string }).requestId,
      ).toBeUndefined();
    });

    it("logs a distinct retry warning line on transient downstream failure", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const infoSpy = vi.spyOn(logger, "info");
      postMock
        .mockRejectedValueOnce(axiosError({ status: 503 }))
        .mockResolvedValueOnce({
          status: 200,
          data: mockConfirmAlertResponseBody,
        });

      await projectPortalClient.confirmAlert(
        "proj-fixture-1",
        mockConfirmAlertPayload,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "confirmAlert",
          event: "retry",
          attempt: 1,
          maxRetries: 2,
          error: expect.any(String),
        }),
        expect.any(String),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "request_complete",
          outcome: "success",
          attempts: 2,
          retried: true,
        }),
        expect.any(String),
      );
    });

    it("logs a request-failed line with the error and no retry line for a non-retryable 4xx", async () => {
      const errorSpy = vi.spyOn(logger, "error");
      const warnSpy = vi.spyOn(logger, "warn");
      postMock.mockRejectedValue(axiosError({ status: 422 }));

      await expect(
        projectPortalClient.confirmAlert(
          "proj-fixture-1",
          mockConfirmAlertPayload,
        ),
      ).rejects.toThrow();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "confirmAlert",
          event: "request_complete",
          outcome: "error",
          status: 422,
        }),
        expect.any(String),
      );
    });

    it("logs the response status and a top-level-keys shape summary on a schema-validation failure", async () => {
      const errorSpy = vi.spyOn(logger, "error");
      postMock.mockResolvedValue({
        status: 200,
        data: { missingStatus: true },
      });

      await expect(
        projectPortalClient.confirmAlert(
          "proj-fixture-1",
          mockConfirmAlertPayload,
        ),
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "project-portal",
          operation: "confirmAlert",
          event: "schema_validation_failed",
          status: 200,
          responseShape: {
            type: "object",
            keys: ["missingStatus"],
          },
        }),
        expect.any(String),
      );
    });
  });
});

describe("classifyConfirmAlertError", () => {
  it("classifies a 4xx as a non-retryable invalid request", () => {
    expect(classifyConfirmAlertError(axiosError({ status: 422 }))).toEqual({
      category: "invalid_request",
      retryable: false,
    });
  });

  it("classifies a 5xx and a no-response network error as retryable", () => {
    expect(classifyConfirmAlertError(axiosError({ status: 503 }))).toEqual({
      category: "connection_error",
      retryable: true,
    });
    expect(
      classifyConfirmAlertError(axiosError({ hasResponse: false })),
    ).toEqual({ category: "connection_error", retryable: true });
  });

  it("classifies a non-axios failure (e.g. a response-schema parse error) as unknown and not retryable", () => {
    expect(classifyConfirmAlertError(new Error("unusable body"))).toEqual({
      category: "unknown",
      retryable: false,
    });
  });
});

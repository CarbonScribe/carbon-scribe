import { describe, expect, it } from "vitest";
import {
  ALERT_TRIAGE_ACTION_TYPES,
  checkApproval,
  COMPLIANCE_REPORT_ACTION_TYPES,
  DISCOVERY_ACTION_TYPES,
  PDD_DRAFT_ACTION_TYPES,
} from "./approval-gate.js";

describe("checkApproval", () => {
  it.each([
    ["discovery.recommend-credits", DISCOVERY_ACTION_TYPES.RECOMMEND_CREDITS],
    ["pdd-draft.draft-sections", PDD_DRAFT_ACTION_TYPES.DRAFT_SECTIONS],
    ["alert-triage.suppress", ALERT_TRIAGE_ACTION_TYPES.SUPPRESS],
    ["alert-triage.needs-more-data", ALERT_TRIAGE_ACTION_TYPES.NEEDS_MORE_DATA],
  ])("auto-approves the read-only action type %s", (_label, actionType) => {
    expect(checkApproval({ actionType, payload: {} })).toBe("auto-approved");
  });

  it.each([
    [
      "compliance-report.draft-report",
      COMPLIANCE_REPORT_ACTION_TYPES.DRAFT_REPORT,
    ],
    ["alert-triage.escalate", ALERT_TRIAGE_ACTION_TYPES.ESCALATE],
  ])(
    "requires approval for the consequential action type %s",
    (_label, actionType) => {
      expect(checkApproval({ actionType, payload: {} })).toBe("needs-approval");
    },
  );

  it("defaults an unrecognized action type to needs-approval rather than throwing or auto-approving", () => {
    expect(() =>
      checkApproval({
        actionType: "some-future-agent.mint-and-submit",
        payload: {},
      }),
    ).not.toThrow();
    expect(
      checkApproval({
        actionType: "some-future-agent.mint-and-submit",
        payload: {},
      }),
    ).toBe("needs-approval");
    expect(checkApproval({ actionType: "", payload: null })).toBe(
      "needs-approval",
    );
  });

  it("ignores payload contents — the decision is keyed on actionType alone", () => {
    const actionType = DISCOVERY_ACTION_TYPES.RECOMMEND_CREDITS;
    expect(checkApproval({ actionType, payload: { anything: "at all" } })).toBe(
      "auto-approved",
    );
    expect(checkApproval({ actionType, payload: null })).toBe("auto-approved");
  });

  // Acceptance criterion: compliance-report action types are provably
  // unable to resolve to "auto-approved". Exercised against every entry in
  // COMPLIANCE_REPORT_ACTION_TYPES (not just the one known today) and
  // against several different payload shapes, so this keeps holding even
  // if a payload-based auto-approval path were ever added elsewhere.
  it("never auto-approves any compliance-report action type, for any payload", () => {
    const payloads: unknown[] = [
      {},
      null,
      { framework: "csrd", sections: [], gaps: [] },
      { framework: "cbam", sections: [{ name: "x", content: "y" }], gaps: [] },
    ];

    for (const actionType of Object.values(COMPLIANCE_REPORT_ACTION_TYPES)) {
      for (const payload of payloads) {
        expect(checkApproval({ actionType, payload })).toBe("needs-approval");
      }
    }
  });
});

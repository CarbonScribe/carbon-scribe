import type { ApprovedActionHandler } from "./outbox.types.js";

export class ActionHandlerRegistry {
  private readonly handlers = new Map<string, ApprovedActionHandler>();

  register(actionType: string, handler: ApprovedActionHandler): void {
    if (this.handlers.has(actionType)) {
      throw new Error(
        `handler already registered for action type: ${actionType}`,
      );
    }
    this.handlers.set(actionType, handler);
  }

  get(actionType: string): ApprovedActionHandler | undefined {
    return this.handlers.get(actionType);
  }
}

import { RequestContext } from '../context/request-context';

export interface WorkflowStep {
  stage: string;
  step: number;
  name: string;
  description?: string;
}

/**
 * Decorator for marking a method as a workflow step.
 * Automatically enriches logs with workflow stage and step information.
 */
export function LogWorkflow(step: WorkflowStep): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      // Set workflow context
      RequestContext.setWorkflowStage(step.stage, step.step);

      // Log workflow step start
      const logger = (this as any).logger;
      if (logger) {
        logger.debug(`Workflow step: ${step.name}`, {
          workflowStage: step.stage,
          step: step.step,
          metadata: {
            stepName: step.name,
            stepDescription: step.description,
            target: target.constructor.name,
            method: propertyKey.toString(),
          },
        });
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

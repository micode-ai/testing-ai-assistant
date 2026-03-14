import 'reflect-metadata';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const SPAN_ATTRIBUTE_METADATA_KEY = Symbol('span_attribute_params');

interface SpanAttributeParam {
  index: number;
  key: string;
}

/**
 * Method decorator that wraps the decorated method in an OpenTelemetry span.
 *
 * @param spanName - Optional custom span name. Defaults to `ClassName.methodName`.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class UserService {
 *   @Traced()
 *   async findById(id: string) { ... }
 *
 *   @Traced('user.create')
 *   async createUser(dto: CreateUserDto) { ... }
 * }
 * ```
 */
export function Traced(spanName?: string) {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<unknown>,
  ): TypedPropertyDescriptor<unknown> => {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const name = spanName || `${className}.${methodName}`;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      const tracer = trace.getTracer('@testing-ai/tracing');
      return tracer.startActiveSpan(name, (span) => {
        try {
          // Apply @SpanAttribute parameter metadata
          const attributeParams: SpanAttributeParam[] | undefined =
            Reflect.getMetadata(
              SPAN_ATTRIBUTE_METADATA_KEY,
              target,
              propertyKey,
            );
          if (attributeParams) {
            for (const param of attributeParams) {
              const value = args[param.index];
              if (value !== undefined && value !== null) {
                span.setAttribute(
                  param.key,
                  typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value),
                );
              }
            }
          }

          const result = originalMethod.apply(this, args);

          // Handle promises
          if (result instanceof Promise) {
            return result
              .then((resolved: unknown) => {
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                return resolved;
              })
              .catch((error: Error) => {
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: error.message,
                });
                span.recordException(error);
                span.end();
                throw error;
              });
          }

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return result;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message,
          });
          span.recordException(err);
          span.end();
          throw error;
        }
      });
    } as unknown;

    return descriptor;
  };
}

/**
 * Parameter decorator that adds the parameter value as a span attribute
 * when used with @Traced().
 *
 * @param key - The attribute key name in the span.
 *
 * @example
 * ```ts
 * @Traced()
 * async findById(@SpanAttribute('user.id') id: string) { ... }
 * ```
 */
export function SpanAttribute(key: string): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) => {
    if (propertyKey === undefined) return;

    const existingParams: SpanAttributeParam[] =
      Reflect.getMetadata(SPAN_ATTRIBUTE_METADATA_KEY, target, propertyKey) ||
      [];
    existingParams.push({ index: parameterIndex, key });
    Reflect.defineMetadata(
      SPAN_ATTRIBUTE_METADATA_KEY,
      existingParams,
      target,
      propertyKey,
    );
  };
}

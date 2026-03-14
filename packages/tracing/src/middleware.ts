import { Request, Response, NextFunction } from 'express';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';

const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Express middleware that ensures every request has a correlation ID.
 *
 * - Reads `x-correlation-id` from the incoming request headers.
 * - If missing, generates a new UUID v4.
 * - Sets the correlation ID as an attribute on the active span.
 * - Attaches the correlation ID to the response headers for downstream propagation.
 * - Makes `req.correlationId` available for application code.
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const correlationId =
    (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();

  // Attach to request for application-level access
  (req as Request & { correlationId: string }).correlationId = correlationId;

  // Set on response header so clients can correlate
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  // Add as attribute to the current active span (if any)
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setAttribute('correlation.id', correlationId);
  }

  next();
}

/**
 * Express middleware that creates a root span for each incoming request
 * with standard HTTP attributes. Use this only if the auto-instrumentation
 * does not already cover your framework.
 */
export function requestTracingMiddleware(serviceName: string) {
  const tracer = trace.getTracer(serviceName);

  return (req: Request, res: Response, next: NextFunction): void => {
    const span = tracer.startSpan(`${req.method} ${req.path}`, {
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.target': req.path,
        'http.user_agent': req.get('user-agent') || '',
      },
    });

    // Run the rest of the middleware chain within the span context
    context.with(trace.setSpan(context.active(), span), () => {
      res.on('finish', () => {
        span.setAttribute('http.status_code', res.statusCode);
        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        span.end();
      });

      next();
    });
  };
}

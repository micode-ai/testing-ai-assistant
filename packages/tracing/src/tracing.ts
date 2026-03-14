import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

export interface TracingOptions {
  /** Service version (default: '0.0.1') */
  version?: string;
  /** Deployment environment (default: process.env.NODE_ENV || 'development') */
  environment?: string;
  /** OTLP endpoint (default: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318') */
  endpoint?: string;
  /** Enable debug logging for OpenTelemetry (default: false) */
  debug?: boolean;
}

let sdk: NodeSDK | undefined;

/**
 * Initialize OpenTelemetry tracing and metrics.
 * Must be called BEFORE NestJS bootstrap (i.e., before any imports that
 * create HTTP servers or database connections).
 */
export function initTracing(serviceName: string, options?: TracingOptions): void {
  const endpoint =
    options?.endpoint ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://localhost:4318';

  const version = options?.version || '0.0.1';
  const environment =
    options?.environment || process.env.NODE_ENV || 'development';

  if (options?.debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: version,
    'deployment.environment.name': environment,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15000,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metricReader: metricReader as any,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown
  const shutdown = async () => {
    if (sdk) {
      await sdk.shutdown();
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

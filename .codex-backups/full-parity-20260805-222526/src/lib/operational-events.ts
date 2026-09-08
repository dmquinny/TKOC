import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export type OperationalSeverity = 'info' | 'warning' | 'error';

type EventInput = {
  kind: string;
  severity: OperationalSeverity;
  summary: string;
  detail?: string;
  requestId?: string;
  route?: string;
  userId?: number;
  pID?: number;
};

function clean(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined;
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit) || undefined;
}

export function requestIdFor(request: Request): string {
  return clean(request.headers.get('x-request-id') ?? undefined, 64) ?? randomUUID();
}

export async function recordOperationalEvent(input: EventInput): Promise<void> {
  const event = {
    kind: clean(input.kind, 32) ?? 'application',
    severity: input.severity,
    summary: clean(input.summary, 255) ?? 'Operational event',
    detail: clean(input.detail, 8_000),
    requestId: clean(input.requestId, 64),
    route: clean(input.route, 120),
    userId: input.userId,
    pID: input.pID,
  };
  const write = prisma.operationalEvent.create({ data: event }).catch(loggingError => {
    console.error('Failed to persist operational event:', loggingError, event);
  });
  // Error reporting must never make an already-failing request wait for the
  // database connection timeout. The write may still complete in the background.
  await Promise.race([
    write,
    new Promise<void>(resolve => setTimeout(resolve, 750)),
  ]);
}

export async function internalErrorResponse(
  request: Request,
  route: string,
  error: unknown,
): Promise<NextResponse> {
  const requestId = requestIdFor(request);
  const detail = error instanceof Error
    ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
    : String(error);
  console.error(`[${requestId}] ${route}:`, error);
  await recordOperationalEvent({
    kind: 'application-error',
    severity: 'error',
    summary: `Unhandled error in ${route}`,
    detail,
    requestId,
    route,
  });
  return NextResponse.json(
    { error: `Something went wrong. Please try again. Reference: ${requestId}`, requestId },
    { status: 500, headers: { 'X-Request-ID': requestId, 'Cache-Control': 'no-store' } },
  );
}

export async function recordSuspiciousAction(
  request: Request,
  route: string,
  summary: string,
  context: { userId?: number; pID?: number; detail?: string } = {},
): Promise<string> {
  const requestId = requestIdFor(request);
  await recordOperationalEvent({
    kind: 'suspicious-action',
    severity: 'warning',
    summary,
    detail: context.detail,
    requestId,
    route,
    userId: context.userId,
    pID: context.pID,
  });
  return requestId;
}

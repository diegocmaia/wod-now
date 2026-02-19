import {
  applyRateLimitHeaders,
  enforcePublicApiProtections,
  toTimeoutErrorResponse,
  withApiTimeout
} from '../../../lib/api-abuse-protection.js';
import { db } from '../../../lib/db.js';

type WorkoutsScaffoldResponse = {
  count: number;
};

export async function GET(request: Request): Promise<Response> {
  const protection = enforcePublicApiProtections(request);
  if ('response' in protection) {
    return protection.response;
  }

  let count: number;
  try {
    count = await withApiTimeout(db.workout.count({}), 'public');
  } catch {
    return toTimeoutErrorResponse();
  }

  const body: WorkoutsScaffoldResponse = { count };
  const response = Response.json(body, { status: 200 });
  return applyRateLimitHeaders(response, protection.rateLimitHeaders);
}

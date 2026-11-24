import { ApiError } from '@/server/entity-api';
import { errorResponse } from '@/server/http';
import { enforceRateLimit } from '@/server/rate-limit';
import { decodeTicketShortCode } from '@/server/short-links';
import { loadTicketBundle, ticketImageResponse } from '@/server/ticket-download';

export const dynamic = 'force-dynamic';

// The signed short code is the capability: no session is needed. Image
// generation is still CPU work, so throttle it per client.
const DOWNLOAD_LIMIT = 30;
const DOWNLOAD_WINDOW_SECONDS = 10 * 60;

export async function GET(request, context) {
  try {
    await enforceRateLimit(request, {
      name: 'ticket-email-download',
      limit: DOWNLOAD_LIMIT,
      windowSeconds: DOWNLOAD_WINDOW_SECONDS,
    });

    const { code } = await context.params;
    const registrationId = decodeTicketShortCode(code);
    if (!registrationId) {
      throw new ApiError(400, 'This ticket download link is invalid or has expired.');
    }

    const bundle = await loadTicketBundle(registrationId);
    const url = new URL(request.url);
    const format = url.searchParams.get('format') === 'jpeg' ? 'jpeg' : 'webp';
    return await ticketImageResponse({ ...bundle, format });
  } catch (error) {
    return errorResponse(error);
  }
}

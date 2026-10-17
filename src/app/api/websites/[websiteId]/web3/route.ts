import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { filterParams, withDateRange } from '@/lib/schema';
import { canViewWebsiteSection } from '@/permissions';
import { getWeb3Metrics, Web3UnsupportedError } from '@/queries/sql/web3/getWeb3Metrics';

/* Gully Analytics: Web3 dashboard metrics for a website. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = withDateRange({
    ...filterParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { websiteId } = await params;

  if (!(await canViewWebsiteSection(auth, websiteId, 'events'))) {
    return unauthorized();
  }

  const filters = await getQueryFilters(query, websiteId);

  try {
    const data = await getWeb3Metrics(websiteId, filters);

    return json({ data });
  } catch (e) {
    if (e instanceof Web3UnsupportedError) {
      return Response.json(
        { error: { message: e.message, code: 'not-implemented', status: 501 } },
        { status: 501 },
      );
    }
    throw e;
  }
}

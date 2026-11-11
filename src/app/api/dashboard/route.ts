import { z } from 'zod';
import {
  dashboardEntityIds,
  defaultDashboardParameters,
  hasDashboardComponents,
  repairDashboardParameters,
} from '@/lib/gully-dashboard';
import prisma from '@/lib/prisma';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import type { Auth, BoardParameters } from '@/lib/types';
import { canViewLink, canViewPixel, canViewWebsite, hasValidBoardReports } from '@/permissions';
import { createBoard, getBoard, updateBoard } from '@/queries/prisma';

/**
 * The website to bind widgets to: of the user's own websites (else those of the user's teams), the
 * one with the latest event in the last 7 days, else the oldest one.
 */
async function firstWebsiteId(userId: string): Promise<string | null> {
  const select = { id: true } as const;
  const orderBy = { createdAt: 'asc' } as const;
  let sites = await prisma.client.website.findMany({
    where: { userId, deletedAt: null },
    orderBy,
    select,
    take: 200,
  });
  if (!sites.length) {
    sites = await prisma.client.website.findMany({
      where: { deletedAt: null, team: { deletedAt: null, members: { some: { userId } } } },
      orderBy,
      select,
      take: 200,
    });
  }
  if (!sites.length) return null;
  if (sites.length === 1) return sites[0].id;
  try {
    const recent = await prisma.client.websiteEvent.findFirst({
      where: {
        websiteId: { in: sites.map(s => s.id) },
        createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
      },
      orderBy: { createdAt: 'desc' },
      select: { websiteId: true },
    });
    if (recent) return recent.websiteId;
  } catch {
    /* events unreadable (e.g. ClickHouse mode): keep the oldest website */
  }
  return sites[0].id;
}

/**
 * Gully Analytics: widgets bind to websites the user can read. A widget whose item was deleted or
 * moved away is bound to the user's first website (or cleared), and an empty dashboard gets the
 * starter layout for that website. Nothing is written here: the user's next save keeps it.
 */
async function emptySafeParameters(auth: Auth, parameters: BoardParameters | undefined) {
  const userAuth: Auth = { user: auth.user };
  const ids = dashboardEntityIds(parameters);
  const allowed = new Set<string>();
  const check = async (type: string, id: string, fn: Promise<boolean>) => {
    try {
      if (await fn) allowed.add(`${type}:${id}`);
    } catch {
      /* unreadable counts as gone */
    }
  };
  await Promise.all([
    ...[...ids.website].map(id => check('website', id, canViewWebsite(userAuth, id))),
    ...[...ids.pixel].map(id => check('pixel', id, canViewPixel(userAuth, id))),
    ...[...ids.link].map(id => check('link', id, canViewLink(userAuth, id))),
  ]);
  const needsFallback = allowed.size < ids.website.size + ids.pixel.size + ids.link.size;
  const empty = !hasDashboardComponents(parameters);
  const fallback = needsFallback || empty ? await firstWebsiteId(auth.user.id) : null;
  const { parameters: repaired } = repairDashboardParameters(
    parameters,
    (type, id) => allowed.has(`${type}:${id}`),
    fallback,
  );
  if (!hasDashboardComponents(repaired) && fallback) {
    return { ...repaired, ...defaultDashboardParameters(fallback) };
  }
  return repaired;
}

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const board = await getBoard(auth.user.id);

  if (board && board.userId !== auth.user.id) {
    return unauthorized();
  }

  const parameters = await emptySafeParameters(
    auth,
    (board?.parameters ?? undefined) as BoardParameters | undefined,
  );

  if (!board) {
    return json(
      hasDashboardComponents(parameters)
        ? { type: 'dashboard', name: '', description: '', parameters }
        : null,
    );
  }

  return json({ ...board, parameters });
}

export async function POST(request: Request) {
  const schema = z.object({
    name: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    parameters: z.object({}).passthrough().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const userId = auth.user.id;
  const existing = await getBoard(userId);

  if (existing && existing.userId !== userId) {
    return unauthorized();
  }

  const data = {
    name: body.name,
    description: body.description,
    parameters: body.parameters ?? {},
  };

  if (!(await hasValidBoardReports(existing?.type ?? 'dashboard', data.parameters))) {
    return badRequest({ message: 'Board contains invalid saved reports.' });
  }

  if (existing) {
    const result = await updateBoard(userId, data);

    return json(result);
  }

  const result = await createBoard({
    id: userId,
    type: 'dashboard',
    userId,
    ...data,
  });

  return json(result);
}

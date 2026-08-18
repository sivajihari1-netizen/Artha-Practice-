import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Client } from "@prisma/client";
import { getPortalSession } from "@/lib/clientPortalAuth";

/** All active Client records this email is a contact for, deduped, across whichever firm(s) they belong to. */
export async function getAccessibleClients(email: string): Promise<(Client & { firmName: string })[]> {
  const contacts = await prisma.contactPerson.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { client: { include: { firm: { select: { name: true } } } } },
  });
  const map = new Map<string, Client & { firmName: string }>();
  for (const c of contacts) {
    if (c.client?.active) {
      const { firm, ...client } = c.client;
      map.set(client.id, { ...client, firmName: firm.name });
    }
  }
  return [...map.values()];
}

export function resolveActiveClient<T extends { id: string }>(clients: T[], preferredId: string | undefined | null): T | null {
  if (clients.length === 0) return null;
  if (preferredId) {
    const found = clients.find((c) => c.id === preferredId);
    if (found) return found;
  }
  return clients[0];
}

export const PORTAL_ACTIVE_CLIENT_COOKIE = "artha_portal_client";

/** For pages within the (authenticated) portal group — resolves the session's active client, or null if unauthenticated/no access. Re-derives from the DB every call, never trusts the cookie blindly. */
export async function getActivePortalClient(): Promise<(Client & { firmName: string }) | null> {
  const session = getPortalSession();
  if (!session) return null;
  const accessible = await getAccessibleClients(session.email);
  if (accessible.length === 0) return null;
  const preferredId = cookies().get(PORTAL_ACTIVE_CLIENT_COOKIE)?.value;
  return resolveActiveClient(accessible, preferredId);
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ACTOR_COOKIE, actorIndex, getActor, listActors } from "@/lib/auth/actor";
import { loadPacket } from "@/lib/packet/load";

export async function GET() {
  const packet = loadPacket();
  return NextResponse.json({
    current: await getActor(packet),
    actors: listActors(packet),
  });
}

/** Switch role. Everything that follows is decided server-side from this cookie. */
export async function POST(request: Request) {
  const { actorId } = (await request.json()) as { actorId?: string };
  const packet = loadPacket();
  const actor = actorId ? actorIndex(packet).get(actorId) : undefined;

  if (!actor) {
    return NextResponse.json({ error: `No such person: ${actorId}` }, { status: 400 });
  }

  const store = await cookies();
  store.set(ACTOR_COOKIE, actor.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return NextResponse.json({ current: actor });
}

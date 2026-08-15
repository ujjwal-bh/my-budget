import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ id: string }> };

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const client = getSupabaseUserClient(token);
  const { data } = await client.auth.getUser();
  return data.user ? { user: data.user, client } : null;
}

export async function PUT(request: NextRequest, context: Context) {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { id } = await context.params;
  if (!body.merchant || !body.category || !Number.isFinite(body.amount) || !["expense", "income"].includes(body.type)) return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  const { data, error } = await authenticated.client.from("transactions").update({ merchant: body.merchant, category: body.category, amount: body.amount, type: body.type }).eq("id", id).eq("user_id", authenticated.user.id).select("id, merchant, category, date, amount, type").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, context: Context) {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { error } = await authenticated.client.from("transactions").delete().eq("id", id).eq("user_id", authenticated.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}

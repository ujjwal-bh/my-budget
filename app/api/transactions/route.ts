import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserClient } from "@/lib/supabase-server";

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const client = getSupabaseUserClient(token);
  const { data } = await client.auth.getUser();
  return data.user ? { user: data.user, client } : null;
}

export async function GET(request: NextRequest) {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await authenticated.client.from("transactions").select("id, merchant, category, date, amount, type").eq("user_id", authenticated.user.id).order("date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.merchant || !body.category || !Number.isFinite(body.amount) || !["expense", "income"].includes(body.type)) return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  const { data, error } = await authenticated.client.from("transactions").insert({ user_id: authenticated.user.id, merchant: body.merchant, category: body.category, amount: body.amount, type: body.type, date: new Date().toISOString() }).select("id, merchant, category, date, amount, type").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

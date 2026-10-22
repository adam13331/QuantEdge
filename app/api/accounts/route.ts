import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/db";

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(accounts);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const account = await prisma.account.create({
      data: {
        id: body.id,
        name: body.name,
        platform: body.platform || "MetaTrader",
        initialBalance: body.initialBalance,
        currency: body.currency || "USD",
      },
    });
    return NextResponse.json(account);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    // The Portfolio balance is the sum of the trading accounts. Writing it here
    // would produce a value the client immediately recomputes, so reject it
    // rather than letting the stored row drift out of sync.
    if (id === "portfolio" && "initialBalance" in data) {
      return NextResponse.json(
        { error: "Portfolio balance is derived from the other accounts" },
        { status: 400 }
      );
    }
    const account = await prisma.account.update({
      where: { id },
      data,
    });
    return NextResponse.json(account);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
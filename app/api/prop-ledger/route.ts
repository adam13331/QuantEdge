import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/db";

// The payout ledger has no JSON-in-TEXT columns, so there is deliberately no
// stringify/parse pair here: rows go to the client exactly as Prisma returns
// them. `amount` is signed — fees negative, payouts positive — and the sign is
// written here rather than accepted from the form, so a client can always ask
// the trader for a positive number without risking a fee that reads as income.
const KINDS = ["fee", "payout"] as const;
type Kind = (typeof KINDS)[number];

const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }
    const entries = await prisma.propLedgerEntry.findMany({
      where: { accountId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch ledger entries" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = body.kind as Kind;
    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: "kind must be fee or payout" }, { status: 400 });
    }
    if (!body.accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }
    if (!isDate(body.date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be greater than zero" }, { status: 400 });
    }

    const entry = await prisma.propLedgerEntry.create({
      data: {
        id: typeof body.id === "string" && body.id ? body.id : crypto.randomUUID(),
        accountId: body.accountId,
        kind,
        date: body.date,
        amount: kind === "fee" ? -Math.abs(amount) : Math.abs(amount),
        // The firm is captured here rather than looked up from the account:
        // the preset is editable, and an old fee must keep naming the firm it
        // was paid to.
        firm: typeof body.firm === "string" && body.firm.trim() ? body.firm.trim().slice(0, 80) : null,
        label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : null,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      },
    });
    return NextResponse.json(entry);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create ledger entry" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await prisma.propLedgerEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete ledger entry" }, { status: 500 });
  }
}

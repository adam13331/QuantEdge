import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/db";

// An experiment is a written hypothesis plus the window that makes it
// testable. The performance is never stored here — it is computed from the
// trades inside and outside the window, so the claim cannot drift from the data.

export async function GET() {
  try {
    const experiments = await prisma.experiment.findMany({ orderBy: { startDate: "desc" } });
    return NextResponse.json(experiments);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || !body.startDate) {
      return NextResponse.json({ error: "name and startDate are required" }, { status: 400 });
    }
    const experiment = await prisma.experiment.create({
      data: {
        id: body.id || `exp-${Date.now()}`,
        name: body.name,
        hypothesis: body.hypothesis ?? "",
        change: body.change ?? "",
        expectedEffect: body.expectedEffect || null,
        startDate: body.startDate,
        endDate: body.endDate || null,
        playbookId: body.playbookId || null,
        status: body.status || "running",
        conclusion: body.conclusion || null,
      },
    });
    return NextResponse.json(experiment);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create experiment" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    const experiment = await prisma.experiment.update({ where: { id }, data: rest });
    return NextResponse.json(experiment);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update experiment" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await prisma.experiment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete experiment" }, { status: 500 });
  }
}

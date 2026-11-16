import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "../../lib/db";
import {
  backupPath, createBackup, discardWalFiles, findDatabasePath,
  isSqliteFile, listBackups,
} from "../../lib/backup";

// Reading and replacing the live file cannot be cached or statically rendered.
export const dynamic = "force-dynamic";

const stamp = () => new Date().toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;

  // The list exists so the automatic pre-update backups are reachable from the
  // UI; without it they are files the user can never retrieve.
  if (params.get("list") === "1") {
    return NextResponse.json({ backups: listBackups() }, { headers: { "Cache-Control": "no-store" } });
  }

  const requested = params.get("file");
  const file = requested ? backupPath(requested) : findDatabasePath();
  if (!file) {
    return NextResponse.json({ error: "No database found" }, { status: 404 });
  }

  const bytes = fs.readFileSync(file);
  const name = requested ?? `quantedge-backup-${stamp()}.db`;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const upload = form.get("file");
    if (!upload || typeof upload === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = Buffer.from(await upload.arrayBuffer());
    if (!isSqliteFile(bytes)) {
      return NextResponse.json({ error: "That file is not a SQLite database" }, { status: 400 });
    }

    const dbPath = findDatabasePath();
    if (!dbPath) {
      return NextResponse.json({ error: "No database found" }, { status: 404 });
    }

    // Protect the current file before touching it: a bad upload, a full disk or
    // a crash mid-copy all leave a restorable copy behind.
    const safety = createBackup("pre-restore");

    await prisma.$disconnect();

    const tmp = `${dbPath}.restore-tmp`;
    fs.writeFileSync(tmp, bytes);
    if (fs.statSync(tmp).size !== bytes.length) {
      fs.unlinkSync(tmp);
      return NextResponse.json({ error: "Write was incomplete" }, { status: 500 });
    }
    fs.renameSync(tmp, dbPath);
    discardWalFiles(dbPath);

    return NextResponse.json({
      ok: true,
      restoredBytes: bytes.length,
      safetyBackup: safety?.name ?? null,
      path: path.basename(dbPath),
    });
  } catch (error) {
    console.error("Restore failed:", error);
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }
}

import { readFile } from "fs/promises";
import path from "path";

// The exporter lives in scripts/, which is not web-served. Reading it here
// keeps one copy of the script instead of duplicating it into public/ where it
// would drift from the CSV contract.
export async function GET() {
  try {
    const file = path.join(process.cwd(), "scripts", "QuantEdgeExport.mq5");
    const body = await readFile(file, "utf8");
    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="QuantEdgeExport.mq5"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Exporter not found.", { status: 404 });
  }
}

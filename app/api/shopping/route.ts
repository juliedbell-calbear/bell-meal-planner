import { NextResponse } from "next/server";
import { getList, saveList, addItems } from "@/lib/shopping";
import { dbOk } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const list = await getList();
  return NextResponse.json(
    { items: list.items, weekKey: list.weekKey, dbOk: dbOk() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Action-based updates (instead of clobbering the whole list) so two phones
// editing at once don't wipe each other's changes.
export async function POST(request: Request) {
  const body = await request.json();
  const list = await getList();

  switch (body.action) {
    case "add": {
      const names: string[] = Array.isArray(body.names) ? body.names : [body.name];
      addItems(list, names.filter(Boolean), "manual", { addedBy: body.addedBy });
      break;
    }
    case "toggle": {
      const item = list.items.find((i) => i.id === body.id);
      if (item) item.checked = !item.checked;
      break;
    }
    case "remove": {
      const item = list.items.find((i) => i.id === body.id);
      if (item) {
        list.items = list.items.filter((i) => i.id !== body.id);
        if (item.source === "meal") {
          // remember the deletion so the meal-plan sync doesn't re-add it
          const norm = item.name.trim().toLowerCase();
          if (!list.removedNames.includes(norm)) list.removedNames.push(norm);
        }
      }
      break;
    }
    case "uncheckAll": {
      list.items.forEach((i) => (i.checked = false));
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  }

  await saveList(list);
  return NextResponse.json({ ok: true, items: list.items, dbOk: dbOk() });
}

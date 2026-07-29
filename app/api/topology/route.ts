import { NextResponse } from "next/server";
import {
  createCustomer,
  createTopology,
  deleteCustomer,
  deleteTopology,
  duplicateCustomer,
  duplicateTopology,
  readTopologyDataset,
  renameCustomer,
  renameTopology,
  saveTopologyProject,
} from "@/db/topology-postgres";
import type { Project } from "@/app/lib/topology-types";

type TopologyAction =
  | { action: "createCustomer"; name: string; siteId?: string }
  | { action: "createTopology"; customerId: string; name: string; project: Project; siteId?: string }
  | { action: "saveProject"; topologyId: string; project: Project }
  | { action: "renameCustomer"; customerId: string; name: string }
  | { action: "renameTopology"; topologyId: string; name: string }
  | { action: "duplicateCustomer"; customerId: string }
  | { action: "duplicateTopology"; topologyId: string }
  | { action: "deleteCustomer"; customerId: string }
  | { action: "deleteTopology"; topologyId: string };

export async function GET(request: Request) {
  try {
    return NextResponse.json(await readTopologyDataset(currentUserEmail(request)));
  } catch (error) {
    return topologyError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<TopologyAction>;
    const email = currentUserEmail(request);
    switch (body.action) {
      case "createCustomer":
        return NextResponse.json(await createCustomer(email, requiredText(body.name, "name"), optionalText(body.siteId)));
      case "createTopology":
        return NextResponse.json(await createTopology(
          email,
          requiredText(body.customerId, "customerId"),
          requiredText(body.name, "name"),
          requiredProject(body.project),
          optionalText(body.siteId),
        ));
      case "saveProject":
        return NextResponse.json(await saveTopologyProject(
          email,
          requiredText(body.topologyId, "topologyId"),
          requiredProject(body.project),
        ));
      case "renameCustomer":
        return NextResponse.json(await renameCustomer(
          email,
          requiredText(body.customerId, "customerId"),
          requiredText(body.name, "name"),
        ));
      case "renameTopology":
        return NextResponse.json(await renameTopology(
          email,
          requiredText(body.topologyId, "topologyId"),
          requiredText(body.name, "name"),
        ));
      case "duplicateCustomer":
        return NextResponse.json(await duplicateCustomer(email, requiredText(body.customerId, "customerId")));
      case "duplicateTopology":
        return NextResponse.json(await duplicateTopology(email, requiredText(body.topologyId, "topologyId")));
      case "deleteCustomer":
        return NextResponse.json(await deleteCustomer(email, requiredText(body.customerId, "customerId")));
      case "deleteTopology":
        return NextResponse.json(await deleteTopology(email, requiredText(body.topologyId, "topologyId")));
      default:
        return NextResponse.json({ error: "Unsupported topology action." }, { status: 400 });
    }
  } catch (error) {
    return topologyError(error);
  }
}

function currentUserEmail(request: Request) {
  return request.headers.get("x-nettopo-user-email") ||
    process.env.NETTOPO_DEV_USER_EMAIL ||
    "manner@company.local";
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function requiredProject(value: unknown): Project {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as Project).devices) ||
    !Array.isArray((value as Project).links) ||
    !Array.isArray((value as Project).groups)
  ) {
    throw new Error("project is required.");
  }
  return value as Project;
}

function topologyError(error: unknown) {
  const message = error instanceof Error ? error.message : "Topology API error.";
  const status = message.includes("DATABASE_URL") ? 503 : message.includes("Permission denied") ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

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
import { requirePilotBoundRequestIdentity } from "@/app/lib/server/pilot-request";
import { assertPilotMutationRequest, noStoreHeaders } from "@/app/lib/server/http-security";
import { validateProject } from "@/app/lib/topology-validation";
import { PostgresSchemaNotReadyError, safePostgresSchemaError } from "@/db/postgres-schema-check";

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
    const identity = await requirePilotBoundRequestIdentity(request);
    return NextResponse.json(await readTopologyDataset(identity.email, {
      identitySource: identity.source,
      pilotPrincipal: identity.pilot,
    }), { headers: noStoreHeaders() });
  } catch (error) {
    return topologyError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requirePilotBoundRequestIdentity(request);
    assertPilotMutationRequest(request);
    const body = await request.json() as Partial<TopologyAction>;
    const email = identity.email;
    const context = { identitySource: identity.source, pilotPrincipal: identity.pilot };
    switch (body.action) {
      case "createCustomer":
        return NextResponse.json(await createCustomer(email, requiredText(body.name, "name"), optionalText(body.siteId), {
          ...context,
          synthetic: identity.source === "pilot-session",
        }), { headers: noStoreHeaders() });
      case "createTopology":
        return NextResponse.json(await createTopology(
          email,
          requiredText(body.customerId, "customerId"),
          requiredText(body.name, "name"),
          requiredProject(body.project),
          optionalText(body.siteId),
          context,
        ), { headers: noStoreHeaders() });
      case "saveProject":
        return NextResponse.json(await saveTopologyProject(
          email,
          requiredText(body.topologyId, "topologyId"),
          requiredProject(body.project),
          context,
        ), { headers: noStoreHeaders() });
      case "renameCustomer":
        return NextResponse.json(await renameCustomer(
          email,
          requiredText(body.customerId, "customerId"),
          requiredText(body.name, "name"),
          context,
        ), { headers: noStoreHeaders() });
      case "renameTopology":
        return NextResponse.json(await renameTopology(
          email,
          requiredText(body.topologyId, "topologyId"),
          requiredText(body.name, "name"),
          context,
        ), { headers: noStoreHeaders() });
      case "duplicateCustomer":
        return NextResponse.json(await duplicateCustomer(email, requiredText(body.customerId, "customerId"), context), { headers: noStoreHeaders() });
      case "duplicateTopology":
        return NextResponse.json(await duplicateTopology(email, requiredText(body.topologyId, "topologyId"), context), { headers: noStoreHeaders() });
      case "deleteCustomer":
        return NextResponse.json(await deleteCustomer(email, requiredText(body.customerId, "customerId"), context), { headers: noStoreHeaders() });
      case "deleteTopology":
        return NextResponse.json(await deleteTopology(email, requiredText(body.topologyId, "topologyId"), context), { headers: noStoreHeaders() });
      default:
        return NextResponse.json({ error: "UNSUPPORTED_TOPOLOGY_ACTION", message: "Unsupported topology action." }, { status: 400, headers: noStoreHeaders() });
    }
  } catch (error) {
    return topologyError(error);
  }
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
  return validateProject(value);
}

function topologyError(error: unknown) {
  if (error instanceof PostgresSchemaNotReadyError) {
    return NextResponse.json(safePostgresSchemaError(error.status), { status: 503, headers: noStoreHeaders() });
  }
  const message = error instanceof Error ? error.message : "Topology API error.";
  const status = message.includes("Authentication") || message.includes("Dev identity") || message.includes("forbidden")
    ? 401
    : message.includes("DATABASE_URL")
      ? 503
      : message.includes("Resource not found") || message.includes("not found")
        ? 404
        : message.includes("Permission denied")
          ? 403
          : 400;
  return NextResponse.json({ error: status === 401 ? "AUTHENTICATION_REQUIRED" : "TOPOLOGY_API_ERROR", message: safeTopologyMessage(status) }, { status, headers: noStoreHeaders() });
}

function safeTopologyMessage(status: number) {
  if (status === 401) return "Authentication required.";
  if (status === 403) return "Permission denied.";
  if (status === 404) return "Resource not found.";
  if (status === 503) return "Database unavailable.";
  return "Topology API error.";
}

"use client";

import { create } from "zustand";
import { topologyDb } from "./topology-db";
import {
  cloneProject,
  EMPTY_PROJECT,
  type CustomerRecord,
  type Project,
  type SiteRecord,
  type TopologyRecord,
  type UserRecord,
} from "./topology-types";
import { containsProjectCredentials, sanitizeProject, stripProjectCredentials } from "./topology-validation";

const LEGACY_STORAGE_KEY = "nettopo-studio-v1";
const ACTIVE_CUSTOMER_KEY = "nettopo-active-customer-id";
const ACTIVE_TOPOLOGY_KEY = "nettopo-active-topology-id";
const DEV_USER_EMAIL_KEY = "nettopo-dev-user-email";
const USE_SERVER_STORAGE = process.env.NEXT_PUBLIC_TOPOLOGY_STORAGE === "server";

type ProjectUpdater = Project | ((current: Project) => Project);

type TopologyStore = {
  customers: CustomerRecord[];
  topologies: TopologyRecord[];
  sites: SiteRecord[];
  currentUser?: UserRecord;
  permissions: {
    canCreate: boolean;
    canWriteAll: boolean;
    canReadAll: boolean;
  };
  activeCustomerId?: string;
  activeTopologyId?: string;
  project: Project;
  ready: boolean;
  saving: boolean;
  devUserEmail: string;
  initialize: () => Promise<void>;
  setDevUserEmail: (email: string) => Promise<void>;
  setProject: (updater: ProjectUpdater) => void;
  saveDeviceCredential: (projectDeviceId: string, username?: string, secret?: string) => Promise<void>;
  selectCustomer: (customerId: string) => Promise<void>;
  selectTopology: (topologyId: string) => Promise<void>;
  createCustomer: (name: string, siteId?: string) => Promise<void>;
  createTopology: (name: string, copyCurrent?: boolean, siteId?: string) => Promise<void>;
  importProject: (project: Project, strategy: "new" | "merge" | "replace", name?: string, siteId?: string) => Promise<void>;
  renameCustomer: (customerId: string, name: string) => Promise<void>;
  renameTopology: (topologyId: string, name: string) => Promise<void>;
  duplicateCustomer: (customerId: string) => Promise<void>;
  duplicateTopology: (topologyId: string) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  deleteTopology: (topologyId: string) => Promise<void>;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function safeLegacyProject(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Project;
    if (Array.isArray(parsed.devices) && Array.isArray(parsed.links) && Array.isArray(parsed.groups)) return sanitizeProject(parsed);
  } catch {
    return undefined;
  }
  return undefined;
}

function sortByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

type RepositoryDataset = {
  customers: CustomerRecord[];
  topologies: TopologyRecord[];
  sites?: SiteRecord[];
  currentUser?: UserRecord;
  permissions?: {
    canCreate: boolean;
    canWriteAll: boolean;
    canReadAll: boolean;
  };
};

function safeProject(project: Project) {
  return sanitizeProject(project);
}

function safeTopology(topology: TopologyRecord): TopologyRecord {
  return { ...topology, project: safeProject(topology.project) };
}

function safeTopologies(topologies: TopologyRecord[]) {
  return topologies.map(safeTopology);
}

const LOCAL_ADMIN_USER: UserRecord = {
  id: "user-sean-sie",
  email: "sean.sie@dus.local",
  name: "謝慶宣",
  role: "engineer",
  siteIds: [],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const DEFAULT_DEV_USER_EMAIL = "";
type RuntimeCapabilities = {
  capabilities?: {
    demoSeed?: boolean;
  };
};

function readDevUserEmail() {
  if (typeof window === "undefined") return DEFAULT_DEV_USER_EMAIL;
  return localStorage.getItem(DEV_USER_EMAIL_KEY) || DEFAULT_DEV_USER_EMAIL;
}

function topologyHeaders(): Record<string, string> {
  const email = readDevUserEmail();
  return email ? { "x-nettopo-dev-user-email": email } : {};
}

async function readRuntimeCapabilities() {
  try {
    const response = await fetch("/api/runtime-capabilities", { cache: "no-store" });
    if (!response.ok) return { demoSeed: false };
    const payload = await response.json() as RuntimeCapabilities;
    return { demoSeed: Boolean(payload.capabilities?.demoSeed) };
  } catch {
    return { demoSeed: false };
  }
}

async function fetchServerDataset() {
  const response = await fetch("/api/topology", { cache: "no-store", headers: topologyHeaders() });
  if (!response.ok) throw new Error(await topologyResponseMessage(response));
  return await response.json() as RepositoryDataset;
}

async function serverAction(body: Record<string, unknown>) {
  const response = await fetch("/api/topology", {
    method: "POST",
    headers: { "content-type": "application/json", ...topologyHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await topologyResponseMessage(response));
  return await response.json() as RepositoryDataset;
}

let serverWriteQueue: Promise<unknown> = Promise.resolve();

function queueServerWrite<T>(write: () => Promise<T>) {
  const pending = serverWriteQueue.then(write, write);
  serverWriteQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

async function serverCredentialAction(body: Record<string, unknown>) {
  const response = await fetch("/api/credentials", {
    method: "POST",
    headers: { "content-type": "application/json", ...topologyHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await topologyResponseMessage(response));
}

async function topologyResponseMessage(response: Response) {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || `Topology API failed with HTTP ${response.status}.`;
  } catch {
    return `Topology API failed with HTTP ${response.status}.`;
  }
}

function saveActiveSelection(customerId?: string, topologyId?: string) {
  if (!customerId || !topologyId) return;
  localStorage.setItem(ACTIVE_CUSTOMER_KEY, customerId);
  localStorage.setItem(ACTIVE_TOPOLOGY_KEY, topologyId);
}

function buildActiveState(dataset: RepositoryDataset, preferredTopologyId?: string, preferredCustomerId?: string) {
  const customers = sortByUpdatedAt(dataset.customers);
  const topologies = sortByUpdatedAt(safeTopologies(dataset.topologies));
  const preferredTopology = topologies.find((topology) => topology.id === preferredTopologyId);
  const customerTopology = preferredCustomerId
    ? sortByUpdatedAt(topologies.filter((topology) => topology.customerId === preferredCustomerId))[0]
    : undefined;
  const activeTopology = preferredTopology ?? customerTopology ?? topologies[0];
  const activeCustomerId = activeTopology?.customerId ?? customers[0]?.id;
  const activeTopologyId = activeTopology?.id;
  saveActiveSelection(activeCustomerId, activeTopologyId);

  return {
    customers,
    topologies,
    sites: dataset.sites ?? [],
    currentUser: dataset.currentUser ?? LOCAL_ADMIN_USER,
    permissions: dataset.permissions ?? { canCreate: true, canWriteAll: true, canReadAll: true },
    activeCustomerId,
    activeTopologyId,
    project: safeProject(activeTopology?.project ?? EMPTY_PROJECT),
  };
}

function readStoredActiveState(dataset: RepositoryDataset) {
  return buildActiveState(
    dataset,
    localStorage.getItem(ACTIVE_TOPOLOGY_KEY) ?? undefined,
    localStorage.getItem(ACTIVE_CUSTOMER_KEY) ?? undefined,
  );
}

async function seedInitialData(demoSeed: boolean) {
  const timestamp = nowIso();
  const customer: CustomerRecord = {
    id: uid("customer"),
    name: "示範客戶",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const topology: TopologyRecord = {
    id: uid("topology"),
    customerId: customer.id,
    ownerUserId: LOCAL_ADMIN_USER.id,
    createdByUserId: LOCAL_ADMIN_USER.id,
    updatedByUserId: LOCAL_ADMIN_USER.id,
    name: "我的網路架構",
    versionLabel: "v1",
    project: safeProject(safeLegacyProject(localStorage.getItem(LEGACY_STORAGE_KEY)) ?? (demoSeed ? (await import("./topology-types")).SAMPLE_PROJECT : EMPTY_PROJECT)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await topologyDb.transaction("rw", topologyDb.customers, topologyDb.topologies, topologyDb.meta, async () => {
    await topologyDb.customers.add(customer);
    await topologyDb.topologies.add(topology);
    await topologyDb.meta.bulkPut([
      { key: "activeCustomerId", value: customer.id },
      { key: "activeTopologyId", value: topology.id },
    ]);
  });

  return { customer, topology };
}

async function ensureSeanSpineLeafDemo(customerId: string, demoSeed: boolean) {
  if (!demoSeed) return;
  const {
    SEAN_SPINE_LEAF_PROJECT,
    SEAN_SPINE_LEAF_TOPOLOGY_ID,
    SEAN_SPINE_LEAF_TOPOLOGY_NAME,
  } = await import("./demo-topologies");
  if (await topologyDb.topologies.get(SEAN_SPINE_LEAF_TOPOLOGY_ID)) return;
  const timestamp = nowIso();
  await topologyDb.topologies.add({
    id: SEAN_SPINE_LEAF_TOPOLOGY_ID,
    customerId,
    ownerUserId: LOCAL_ADMIN_USER.id,
    createdByUserId: LOCAL_ADMIN_USER.id,
    updatedByUserId: LOCAL_ADMIN_USER.id,
    name: SEAN_SPINE_LEAF_TOPOLOGY_NAME,
    versionLabel: "v1",
    project: safeProject(SEAN_SPINE_LEAF_PROJECT),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function makeEmptyCustomer(name = "示範客戶") {
  const timestamp = nowIso();
  const customer: CustomerRecord = {
    id: uid("customer"),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const topology: TopologyRecord = {
    id: uid("topology"),
    customerId: customer.id,
    name: "現況拓樸",
    versionLabel: "v1",
    project: safeProject(EMPTY_PROJECT),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { customer, topology };
}

async function readActiveData() {
  const runtime = await readRuntimeCapabilities();
  let customers = await topologyDb.customers.toArray();
  let topologies = await topologyDb.topologies.toArray();
  let activeCustomerId = (await topologyDb.meta.get("activeCustomerId"))?.value;
  let activeTopologyId = (await topologyDb.meta.get("activeTopologyId"))?.value;

  if (customers.length === 0 || topologies.length === 0) {
    const seeded = await seedInitialData(runtime.demoSeed);
    customers = [seeded.customer];
    topologies = [seeded.topology];
    activeCustomerId = seeded.customer.id;
    activeTopologyId = seeded.topology.id;
  }

  await ensureSeanSpineLeafDemo(activeCustomerId ?? customers[0].id, runtime.demoSeed);
  topologies = await topologyDb.topologies.toArray();

  const sanitizedTopologies = safeTopologies(topologies);
  const updates = sanitizedTopologies.filter((topology, index) =>
    containsProjectCredentials(topologies[index]?.project) ||
    JSON.stringify(topology.project) !== JSON.stringify(topologies[index]?.project),
  );
  if (updates.length > 0) {
    await topologyDb.transaction("rw", topologyDb.topologies, async () => {
      for (const topology of updates) {
        await topologyDb.topologies.update(topology.id, { project: cloneProject(topology.project) });
      }
    });
  }
  topologies = sanitizedTopologies;

  let activeTopology = topologies.find((topology) => topology.id === activeTopologyId);
  if (!activeTopology) activeTopology = sortByUpdatedAt(topologies)[0];
  activeTopologyId = activeTopology.id;
  activeCustomerId = activeTopology.customerId;

  await topologyDb.meta.bulkPut([
    { key: "activeCustomerId", value: activeCustomerId },
    { key: "activeTopologyId", value: activeTopologyId },
  ]);

  return {
    customers: sortByUpdatedAt(customers),
    topologies: sortByUpdatedAt(topologies),
    sites: [],
    currentUser: LOCAL_ADMIN_USER,
    permissions: { canCreate: true, canWriteAll: true, canReadAll: true },
    activeCustomerId,
    activeTopologyId,
    project: safeProject(activeTopology.project),
  };
}

export const useTopologyStore = create<TopologyStore>((set, get) => ({
  customers: [],
  topologies: [],
  sites: [],
  currentUser: LOCAL_ADMIN_USER,
  permissions: { canCreate: true, canWriteAll: true, canReadAll: true },
  project: EMPTY_PROJECT,
  ready: false,
  saving: false,
  devUserEmail: DEFAULT_DEV_USER_EMAIL,

  initialize: async () => {
    if (typeof window === "undefined") return;
    const devUserEmail = readDevUserEmail();
    if (USE_SERVER_STORAGE) {
      const dataset = await fetchServerDataset();
      set({ ...readStoredActiveState(dataset), devUserEmail, ready: true });
      return;
    }
    const data = await readActiveData();
    set({ ...data, devUserEmail, ready: true });
  },

  setDevUserEmail: async (email) => {
    const nextEmail = email.trim() || DEFAULT_DEV_USER_EMAIL;
    localStorage.setItem(DEV_USER_EMAIL_KEY, nextEmail);
    if (USE_SERVER_STORAGE) {
      set({ ready: false, devUserEmail: nextEmail });
      const dataset = await fetchServerDataset();
      set({ ...readStoredActiveState(dataset), devUserEmail: nextEmail, ready: true });
      return;
    }
    set({ devUserEmail: nextEmail });
  },

  setProject: (updater) => {
    const current = get();
    const nextProject = typeof updater === "function" ? updater(current.project) : updater;
    const persistedProject = safeProject(stripProjectCredentials(nextProject));
    const activeTopologyId = current.activeTopologyId;
    const timestamp = nowIso();
    const nextTopologies = current.topologies.map((topology) =>
      topology.id === activeTopologyId
        ? { ...topology, project: cloneProject(persistedProject), updatedAt: timestamp }
        : topology,
    );

    set({ project: cloneProject(persistedProject), topologies: sortByUpdatedAt(nextTopologies), saving: true });
    if (!activeTopologyId) return;
    if (USE_SERVER_STORAGE) {
      void queueServerWrite(() => serverAction({
        action: "saveProject",
        topologyId: activeTopologyId,
        project: cloneProject(persistedProject),
      }))
        .then((dataset) => set((state) => ({ ...readStoredActiveState(dataset), project: state.project })))
        .finally(() => set({ saving: false }));
      return;
    }

    void topologyDb.topologies.update(activeTopologyId, { project: cloneProject(persistedProject), updatedAt: timestamp })
      .finally(() => set({ saving: false }));
  },

  saveDeviceCredential: async (projectDeviceId, username, secret) => {
    if (!USE_SERVER_STORAGE) {
      if (username || secret) {
        throw new Error("本機模式尚未提供安全的帳密保存；帳密不會寫入 Project、IndexedDB 或匯出檔。請切換 PostgreSQL server mode 後再儲存設備帳密。");
      }
      return;
    }
    if (!secret) return;
    const topologyId = get().activeTopologyId;
    if (!topologyId) throw new Error("No active topology is available for this credential.");
    await queueServerWrite(() => serverCredentialAction({
      action: "upsert",
      topologyId,
      projectDeviceId,
      kind: "device_admin",
      username: username?.trim() || undefined,
      secret,
    }));
  },

  selectCustomer: async (customerId) => {
    const customerTopologies = sortByUpdatedAt(get().topologies.filter((topology) => topology.customerId === customerId));
    const nextTopology = customerTopologies[0];
    if (!nextTopology) return;

    if (USE_SERVER_STORAGE) {
      saveActiveSelection(customerId, nextTopology.id);
      set({
        activeCustomerId: customerId,
        activeTopologyId: nextTopology.id,
        project: cloneProject(nextTopology.project),
      });
      return;
    }

    await topologyDb.meta.bulkPut([
      { key: "activeCustomerId", value: customerId },
      { key: "activeTopologyId", value: nextTopology.id },
    ]);
    set({
      activeCustomerId: customerId,
      activeTopologyId: nextTopology.id,
      project: cloneProject(nextTopology.project),
    });
  },

  selectTopology: async (topologyId) => {
    const nextTopology = get().topologies.find((topology) => topology.id === topologyId);
    if (!nextTopology) return;

    if (USE_SERVER_STORAGE) {
      saveActiveSelection(nextTopology.customerId, topologyId);
      set({
        activeCustomerId: nextTopology.customerId,
        activeTopologyId: topologyId,
        project: cloneProject(nextTopology.project),
      });
      return;
    }

    await topologyDb.meta.bulkPut([
      { key: "activeCustomerId", value: nextTopology.customerId },
      { key: "activeTopologyId", value: nextTopology.id },
    ]);
    set({
      activeCustomerId: nextTopology.customerId,
      activeTopologyId: topologyId,
      project: cloneProject(nextTopology.project),
    });
  },

  createCustomer: async (name, siteId) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (USE_SERVER_STORAGE) {
      const dataset = await serverAction({ action: "createCustomer", name: trimmed, siteId });
      const newestCustomer = sortByUpdatedAt(dataset.customers)[0];
      set(buildActiveState(dataset, undefined, newestCustomer?.id));
      return;
    }
    const timestamp = nowIso();
    const customer: CustomerRecord = {
      id: uid("customer"),
      name: trimmed,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const topology: TopologyRecord = {
      id: uid("topology"),
      customerId: customer.id,
      siteId: siteId || undefined,
      name: "現況拓樸",
      versionLabel: "v1",
      project: cloneProject(EMPTY_PROJECT),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await topologyDb.transaction("rw", topologyDb.customers, topologyDb.topologies, topologyDb.meta, async () => {
      await topologyDb.customers.add(customer);
      await topologyDb.topologies.add(topology);
      await topologyDb.meta.bulkPut([
        { key: "activeCustomerId", value: customer.id },
        { key: "activeTopologyId", value: topology.id },
      ]);
    });

    set((state) => ({
      customers: sortByUpdatedAt([customer, ...state.customers]),
      topologies: sortByUpdatedAt([topology, ...state.topologies]),
      activeCustomerId: customer.id,
      activeTopologyId: topology.id,
      project: cloneProject(topology.project),
    }));
  },

  createTopology: async (name, copyCurrent = true, siteId) => {
    const current = get();
    if (!current.activeCustomerId) return;
    if (USE_SERVER_STORAGE) {
      const dataset = await serverAction({
        action: "createTopology",
        customerId: current.activeCustomerId,
        name: name.trim() || "新拓樸",
        project: safeProject(copyCurrent ? current.project : EMPTY_PROJECT),
        siteId,
      });
      const newestTopology = sortByUpdatedAt(dataset.topologies.filter((topology) => topology.customerId === current.activeCustomerId))[0];
      set(buildActiveState(dataset, newestTopology?.id, current.activeCustomerId));
      return;
    }
    const timestamp = nowIso();
    const siblingCount = current.topologies.filter((topology) => topology.customerId === current.activeCustomerId).length;
    const topology: TopologyRecord = {
      id: uid("topology"),
      customerId: current.activeCustomerId,
      siteId: siteId || undefined,
      ownerUserId: current.currentUser?.id,
      createdByUserId: current.currentUser?.id,
      updatedByUserId: current.currentUser?.id,
      name: name.trim() || `拓樸 ${siblingCount + 1}`,
      versionLabel: `v${siblingCount + 1}`,
      project: safeProject(copyCurrent ? current.project : EMPTY_PROJECT),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await topologyDb.transaction("rw", topologyDb.topologies, topologyDb.meta, async () => {
      await topologyDb.topologies.add(topology);
      await topologyDb.meta.bulkPut([
        { key: "activeCustomerId", value: topology.customerId },
        { key: "activeTopologyId", value: topology.id },
      ]);
    });

    set((state) => ({
      topologies: sortByUpdatedAt([topology, ...state.topologies]),
      activeTopologyId: topology.id,
      project: cloneProject(topology.project),
    }));
  },

  importProject: async (project, strategy, name, siteId) => {
    const current = get();
    const importedProject = safeProject(project);
    if (!current.activeCustomerId) throw new Error("匯入前必須先選擇客戶。");

    if (strategy === "new") {
      const topologyName = name?.trim() || `匯入拓樸 ${current.topologies.length + 1}`;
      if (USE_SERVER_STORAGE) {
        const dataset = await serverAction({
          action: "createTopology",
          customerId: current.activeCustomerId,
          name: topologyName,
          project: safeProject(importedProject),
          siteId,
        });
        const newestTopology = sortByUpdatedAt(
          dataset.topologies.filter((topology) => topology.customerId === current.activeCustomerId),
        )[0];
        set(buildActiveState(dataset, newestTopology?.id, current.activeCustomerId));
        return;
      }

      const timestamp = nowIso();
      const siblingCount = current.topologies.filter((topology) => topology.customerId === current.activeCustomerId).length;
      const topology: TopologyRecord = {
        id: uid("topology"),
        customerId: current.activeCustomerId,
        ownerUserId: current.currentUser?.id,
        createdByUserId: current.currentUser?.id,
        updatedByUserId: current.currentUser?.id,
        name: topologyName,
        versionLabel: `v${siblingCount + 1}`,
        project: safeProject(importedProject),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await topologyDb.transaction("rw", topologyDb.topologies, topologyDb.meta, async () => {
        await topologyDb.topologies.add(topology);
        await topologyDb.meta.bulkPut([
          { key: "activeCustomerId", value: topology.customerId },
          { key: "activeTopologyId", value: topology.id },
        ]);
      });
      set((state) => ({
        topologies: sortByUpdatedAt([topology, ...state.topologies]),
        activeTopologyId: topology.id,
        project: cloneProject(topology.project),
      }));
      return;
    }

    if (!current.activeTopologyId) throw new Error("沒有可更新的目前拓樸。");
    set({ saving: true });
    try {
      if (USE_SERVER_STORAGE) {
        const dataset = await serverAction({
          action: "saveProject",
          topologyId: current.activeTopologyId,
          project: safeProject(importedProject),
        });
        set(buildActiveState(dataset, current.activeTopologyId, current.activeCustomerId));
        return;
      }

      const timestamp = nowIso();
      await topologyDb.topologies.update(current.activeTopologyId, {
        project: safeProject(importedProject),
        updatedAt: timestamp,
      });
      set((state) => ({
        project: safeProject(importedProject),
        topologies: sortByUpdatedAt(state.topologies.map((topology) =>
          topology.id === current.activeTopologyId
            ? { ...topology, project: cloneProject(importedProject), updatedAt: timestamp }
            : topology,
        )),
      }));
    } finally {
      set({ saving: false });
    }
  },

  renameCustomer: async (customerId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (USE_SERVER_STORAGE) {
      const dataset = await serverAction({ action: "renameCustomer", customerId, name: trimmed });
      set(readStoredActiveState(dataset));
      return;
    }
    const timestamp = nowIso();
    await topologyDb.customers.update(customerId, { name: trimmed, updatedAt: timestamp });
    set((state) => ({
      customers: sortByUpdatedAt(state.customers.map((customer) =>
        customer.id === customerId ? { ...customer, name: trimmed, updatedAt: timestamp } : customer,
      )),
    }));
  },

  renameTopology: async (topologyId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (USE_SERVER_STORAGE) {
      const dataset = await serverAction({ action: "renameTopology", topologyId, name: trimmed });
      set(readStoredActiveState(dataset));
      return;
    }
    const timestamp = nowIso();
    await topologyDb.topologies.update(topologyId, { name: trimmed, updatedAt: timestamp });
    set((state) => ({
      topologies: sortByUpdatedAt(state.topologies.map((topology) =>
        topology.id === topologyId ? { ...topology, name: trimmed, updatedAt: timestamp } : topology,
      )),
    }));
  },

  duplicateCustomer: async (customerId) => {
    const current = get();
    const sourceCustomer = current.customers.find((customer) => customer.id === customerId);
    if (!sourceCustomer) return;
    if (USE_SERVER_STORAGE) {
      const dataset = await serverAction({ action: "duplicateCustomer", customerId });
      const newestCustomer = sortByUpdatedAt(dataset.customers)[0];
      set(buildActiveState(dataset, undefined, newestCustomer?.id));
      return;
    }
    const timestamp = nowIso();
    const customer: CustomerRecord = {
      ...sourceCustomer,
      id: uid("customer"),
      name: `${sourceCustomer.name} 複本`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const sourceTopologies = current.topologies.filter((topology) => topology.customerId === customerId);
    const topologies = (sourceTopologies.length > 0 ? sourceTopologies : [makeEmptyCustomer().topology]).map((topology, index): TopologyRecord => ({
      ...topology,
      id: uid("topology"),
      customerId: customer.id,
      name: topology.name,
      versionLabel: topology.versionLabel || `v${index + 1}`,
      project: safeProject(topology.project),
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    const activeTopology = topologies[0];

    await topologyDb.transaction("rw", topologyDb.customers, topologyDb.topologies, topologyDb.meta, async () => {
      await topologyDb.customers.add(customer);
      await topologyDb.topologies.bulkAdd(topologies);
      await topologyDb.meta.bulkPut([
        { key: "activeCustomerId", value: customer.id },
        { key: "activeTopologyId", value: activeTopology.id },
      ]);
    });

    set((state) => ({
      customers: sortByUpdatedAt([customer, ...state.customers]),
      topologies: sortByUpdatedAt([...topologies, ...state.topologies]),
      activeCustomerId: customer.id,
      activeTopologyId: activeTopology.id,
      project: safeProject(activeTopology.project),
    }));
  },

  duplicateTopology: async (topologyId) => {
    const current = get();
    const source = current.topologies.find((topology) => topology.id === topologyId);
    if (!source) return;
    if (USE_SERVER_STORAGE) {
      const dataset = await serverAction({ action: "duplicateTopology", topologyId });
      const newestTopology = sortByUpdatedAt(dataset.topologies.filter((topology) => topology.customerId === source.customerId))[0];
      set(buildActiveState(dataset, newestTopology?.id, source.customerId));
      return;
    }
    const timestamp = nowIso();
    const siblingCount = current.topologies.filter((topology) => topology.customerId === source.customerId).length;
    const topology: TopologyRecord = {
      ...source,
      id: uid("topology"),
      name: `${source.name} 複本`,
      versionLabel: `v${siblingCount + 1}`,
      project: safeProject(source.project),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await topologyDb.transaction("rw", topologyDb.topologies, topologyDb.meta, async () => {
      await topologyDb.topologies.add(topology);
      await topologyDb.meta.bulkPut([
        { key: "activeCustomerId", value: topology.customerId },
        { key: "activeTopologyId", value: topology.id },
      ]);
    });

    set((state) => ({
      topologies: sortByUpdatedAt([topology, ...state.topologies]),
      activeCustomerId: topology.customerId,
      activeTopologyId: topology.id,
      project: cloneProject(topology.project),
    }));
  },

  deleteCustomer: async (customerId) => {
    const current = get();
    if (USE_SERVER_STORAGE) {
      const dataset = await serverAction({ action: "deleteCustomer", customerId });
      set(buildActiveState(dataset));
      return;
    }
    const deletingActive = current.activeCustomerId === customerId;
    let customers = current.customers.filter((customer) => customer.id !== customerId);
    let topologies = current.topologies.filter((topology) => topology.customerId !== customerId);
    let activeCustomerId = current.activeCustomerId;
    let activeTopologyId = current.activeTopologyId;
    let activeProject = current.project;
    let fallback: ReturnType<typeof makeEmptyCustomer> | undefined;

    if (customers.length === 0 || topologies.length === 0) {
      fallback = makeEmptyCustomer();
      customers = [fallback.customer];
      topologies = [fallback.topology];
      activeCustomerId = fallback.customer.id;
      activeTopologyId = fallback.topology.id;
      activeProject = safeProject(fallback.topology.project);
    } else if (deletingActive) {
      const nextTopology = sortByUpdatedAt(topologies)[0];
      activeCustomerId = nextTopology.customerId;
      activeTopologyId = nextTopology.id;
      activeProject = safeProject(nextTopology.project);
    }

    await topologyDb.transaction("rw", topologyDb.customers, topologyDb.topologies, topologyDb.meta, async () => {
      await topologyDb.customers.delete(customerId);
      await topologyDb.topologies.where("customerId").equals(customerId).delete();
      if (fallback) {
        await topologyDb.customers.add(fallback.customer);
        await topologyDb.topologies.add(fallback.topology);
      }
      await topologyDb.meta.bulkPut([
        { key: "activeCustomerId", value: activeCustomerId ?? "" },
        { key: "activeTopologyId", value: activeTopologyId ?? "" },
      ]);
    });

    set({
      customers: sortByUpdatedAt(customers),
      topologies: sortByUpdatedAt(topologies),
      activeCustomerId,
      activeTopologyId,
      project: activeProject,
    });
  },

  deleteTopology: async (topologyId) => {
    const current = get();
    const deleting = current.topologies.find((topology) => topology.id === topologyId);
    if (!deleting) return;
    if (USE_SERVER_STORAGE) {
      const dataset = await serverAction({ action: "deleteTopology", topologyId });
      set(buildActiveState(dataset, undefined, deleting.customerId));
      return;
    }
    let topologies = current.topologies.filter((topology) => topology.id !== topologyId);
    const customers = current.customers;
    let activeCustomerId = current.activeCustomerId;
    let activeTopologyId = current.activeTopologyId;
    let activeProject = current.project;
    let replacement: TopologyRecord | undefined;

    const remainingForCustomer = topologies.filter((topology) => topology.customerId === deleting.customerId);
    if (remainingForCustomer.length === 0) {
      const timestamp = nowIso();
      replacement = {
        id: uid("topology"),
        customerId: deleting.customerId,
        name: "現況拓樸",
        versionLabel: "v1",
        project: safeProject(EMPTY_PROJECT),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      topologies = [replacement, ...topologies];
    }

    if (current.activeTopologyId === topologyId) {
      const nextTopology = sortByUpdatedAt(topologies.filter((topology) => topology.customerId === deleting.customerId))[0] ?? sortByUpdatedAt(topologies)[0];
      activeCustomerId = nextTopology.customerId;
      activeTopologyId = nextTopology.id;
      activeProject = safeProject(nextTopology.project);
    }

    await topologyDb.transaction("rw", topologyDb.topologies, topologyDb.meta, async () => {
      await topologyDb.topologies.delete(topologyId);
      if (replacement) await topologyDb.topologies.add(replacement);
      await topologyDb.meta.bulkPut([
        { key: "activeCustomerId", value: activeCustomerId ?? "" },
        { key: "activeTopologyId", value: activeTopologyId ?? "" },
      ]);
    });

    set({
      customers: sortByUpdatedAt(customers),
      topologies: sortByUpdatedAt(topologies),
      activeCustomerId,
      activeTopologyId,
      project: activeProject,
    });
  },
}));

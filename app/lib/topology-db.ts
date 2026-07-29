"use client";

import Dexie, { type EntityTable } from "dexie";
import type { CustomerRecord, TopologyRecord } from "./topology-types";

export type MetaRecord = {
  key: "activeCustomerId" | "activeTopologyId";
  value: string;
};

export class NetTopoDatabase extends Dexie {
  customers!: EntityTable<CustomerRecord, "id">;
  topologies!: EntityTable<TopologyRecord, "id">;
  meta!: EntityTable<MetaRecord, "key">;

  constructor() {
    super("nettopo-studio-db");
    this.version(1).stores({
      customers: "id, name, updatedAt",
      topologies: "id, customerId, name, updatedAt",
      meta: "key",
    });
  }
}

export const topologyDb = new NetTopoDatabase();

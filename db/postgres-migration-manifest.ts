import formalTopologySchema from "./migrations/0001_formal_topology_schema.sql?raw";
import dictionaryConstraints from "./migrations/0002_dictionary_constraints.sql?raw";
import projectDeviceCredentials from "./migrations/0003_project_device_credentials.sql?raw";
import topologyQuantityAndCollapse from "./migrations/0004_topology_quantity_and_collapse.sql?raw";
import { definePostgresMigrations } from "./postgres-migrations.js";

export const postgresMigrations = definePostgresMigrations({
  "0001_formal_topology_schema.sql": formalTopologySchema,
  "0002_dictionary_constraints.sql": dictionaryConstraints,
  "0003_project_device_credentials.sql": projectDeviceCredentials,
  "0004_topology_quantity_and_collapse.sql": topologyQuantityAndCollapse,
});

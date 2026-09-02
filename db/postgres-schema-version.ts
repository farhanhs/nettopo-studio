export type PostgresMigrationExpectation = {
  version: string;
  name: string;
  filename: string;
  checksum: string;
};

export const requiredPostgresSchemaVersion = "0004";

export const expectedPostgresMigrations: PostgresMigrationExpectation[] = [
  {
    "version": "0001",
    "name": "formal_topology_schema",
    "filename": "0001_formal_topology_schema.sql",
    "checksum": "09621c8ab45f7320a5ea48d8830dde12d5e046c9a03b2cf3772813e8e977e615"
  },
  {
    "version": "0002",
    "name": "dictionary_constraints",
    "filename": "0002_dictionary_constraints.sql",
    "checksum": "183da6c133d15d38098acb81d1fb8357f33832b3c858001a68a8367990c595b4"
  },
  {
    "version": "0003",
    "name": "project_device_credentials",
    "filename": "0003_project_device_credentials.sql",
    "checksum": "7c55e8f4e393fcae02251159108bca1ac9265e90ece38756204afa87c90c3cd6"
  },
  {
    "version": "0004",
    "name": "topology_quantity_and_collapse",
    "filename": "0004_topology_quantity_and_collapse.sql",
    "checksum": "5c1bbafce4bdfa76182b9005aa96de1e30d78a8273a694f547ba1572cd3741d4"
  }
];

export type PostgresMigrationExpectation = {
  version: string;
  name: string;
  filename: string;
  checksum: string;
  compatibleChecksums?: Array<{
    checksum: string;
    reason: "legacy_raw_crlf";
  }>;
};

export const requiredPostgresSchemaVersion = "0004";

export const expectedPostgresMigrations: PostgresMigrationExpectation[] = [
  {
    "version": "0001",
    "name": "formal_topology_schema",
    "filename": "0001_formal_topology_schema.sql",
    "checksum": "09621c8ab45f7320a5ea48d8830dde12d5e046c9a03b2cf3772813e8e977e615",
    "compatibleChecksums": [
      {
        "checksum": "6bc0195c84be1413d69aa6f048d9fd548236c521d1472c6f9d80fab03df34256",
        "reason": "legacy_raw_crlf"
      }
    ]
  },
  {
    "version": "0002",
    "name": "dictionary_constraints",
    "filename": "0002_dictionary_constraints.sql",
    "checksum": "183da6c133d15d38098acb81d1fb8357f33832b3c858001a68a8367990c595b4",
    "compatibleChecksums": [
      {
        "checksum": "a48749253d7cba4dcce4397592ec1ee6945543b82d96d3ffe1747f1369a55742",
        "reason": "legacy_raw_crlf"
      }
    ]
  },
  {
    "version": "0003",
    "name": "project_device_credentials",
    "filename": "0003_project_device_credentials.sql",
    "checksum": "7c55e8f4e393fcae02251159108bca1ac9265e90ece38756204afa87c90c3cd6",
    "compatibleChecksums": [
      {
        "checksum": "ba95378fb6855b8da02614106dae7440c3a00cd0a62e7b9c5e98bfa80b4edefd",
        "reason": "legacy_raw_crlf"
      }
    ]
  },
  {
    "version": "0004",
    "name": "topology_quantity_and_collapse",
    "filename": "0004_topology_quantity_and_collapse.sql",
    "checksum": "5c1bbafce4bdfa76182b9005aa96de1e30d78a8273a694f547ba1572cd3741d4",
    "compatibleChecksums": [
      {
        "checksum": "4f2d818af4753841526616bf4f311376c9a5b57dd8f81acc9abe4f5c02204083",
        "reason": "legacy_raw_crlf"
      }
    ]
  }
];

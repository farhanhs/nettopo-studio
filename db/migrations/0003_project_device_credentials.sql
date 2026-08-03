alter table device_credentials
  add column if not exists project_device_id varchar(128);

create index if not exists device_credentials_project_device_id_idx
  on device_credentials(topology_id, project_device_id);

create unique index if not exists device_credentials_project_device_kind_idx
  on device_credentials(topology_id, project_device_id, kind)
  where project_device_id is not null;

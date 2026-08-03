-- Quantity nodes, collapsible groups, and extended device dictionaries.
alter table topology_devices
  add column if not exists quantity integer not null default 1;

alter table topology_devices
  add constraint topology_devices_quantity_check
  check (quantity between 1 and 10000);

alter table topology_groups
  add column if not exists collapsed boolean not null default false;

insert into device_types (code, name)
values
  ('ssid', 'SSID'),
  ('mesh-node', 'Mesh node'),
  ('printer', 'Printer'),
  ('camera', 'Camera'),
  ('pos', 'POS'),
  ('iot', 'IoT')
on conflict (code) do update set name = excluded.name, updated_at = now();

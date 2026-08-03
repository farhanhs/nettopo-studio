create table if not exists roles (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists permissions (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_code text not null references roles(code) on delete cascade,
  permission_code text not null references permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

create table if not exists sites (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null references roles(code),
  password_hash text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists password_hash text;
alter table users add column if not exists disabled_at timestamptz;
create index if not exists users_role_idx on users(role);
create index if not exists users_disabled_at_idx on users(disabled_at);

create table if not exists user_sites (
  user_id text not null references users(id) on delete cascade,
  site_id text not null references sites(id) on delete cascade,
  primary key (user_id, site_id)
);

create table if not exists customers (
  id text primary key,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists config_kinds (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_profiles (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  kind text not null references config_kinds(code),
  profile_key text not null,
  profile_value jsonb not null,
  updated_by_user_id text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, kind, profile_key)
);
create index if not exists customer_profiles_customer_id_idx on customer_profiles(customer_id);

create table if not exists topologies (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  site_id text references sites(id),
  owner_user_id text references users(id),
  created_by_user_id text references users(id),
  updated_by_user_id text references users(id),
  name text not null,
  version_label text not null,
  project jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table topologies add column if not exists site_id text references sites(id);
alter table topologies add column if not exists owner_user_id text references users(id);
alter table topologies add column if not exists created_by_user_id text references users(id);
alter table topologies add column if not exists updated_by_user_id text references users(id);
create index if not exists topologies_customer_id_idx on topologies(customer_id);
create index if not exists topologies_site_id_idx on topologies(site_id);
create index if not exists topologies_owner_user_id_idx on topologies(owner_user_id);
create index if not exists topologies_updated_at_idx on topologies(updated_at desc);

create table if not exists topology_profiles (
  id text primary key,
  topology_id text not null references topologies(id) on delete cascade,
  kind text not null references config_kinds(code),
  profile_key text not null,
  profile_value jsonb not null,
  updated_by_user_id text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topology_id, kind, profile_key)
);
create index if not exists topology_profiles_topology_id_idx on topology_profiles(topology_id);

create table if not exists topology_versions (
  id text primary key,
  topology_id text not null references topologies(id) on delete cascade,
  version_label text not null,
  project_snapshot jsonb not null,
  change_note text,
  created_by_user_id text references users(id),
  created_at timestamptz not null default now(),
  unique (topology_id, version_label)
);
create index if not exists topology_versions_topology_id_idx on topology_versions(topology_id);

create table if not exists device_types (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists group_kinds (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists link_kinds (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists topology_groups (
  id text primary key,
  topology_id text not null references topologies(id) on delete cascade,
  name text not null,
  kind text not null references group_kinds(code),
  color text not null,
  raw_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists topology_groups_topology_id_idx on topology_groups(topology_id);

create table if not exists topology_devices (
  id text primary key,
  topology_id text not null references topologies(id) on delete cascade,
  device_type text not null references device_types(code),
  group_id text references topology_groups(id) on delete set null,
  name text not null,
  ip text,
  mac text,
  model text,
  location text,
  management_url text,
  position_x integer not null,
  position_y integer not null,
  raw_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists topology_devices_topology_id_idx on topology_devices(topology_id);
create index if not exists topology_devices_group_id_idx on topology_devices(group_id);
create index if not exists topology_devices_type_idx on topology_devices(device_type);

create table if not exists topology_links (
  id text primary key,
  topology_id text not null references topologies(id) on delete cascade,
  from_device_id text not null references topology_devices(id) on delete cascade,
  to_device_id text not null references topology_devices(id) on delete cascade,
  kind text not null references link_kinds(code),
  from_port text,
  to_port text,
  vlan text,
  speed text,
  raw_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists topology_links_topology_id_idx on topology_links(topology_id);
create index if not exists topology_links_from_device_id_idx on topology_links(from_device_id);
create index if not exists topology_links_to_device_id_idx on topology_links(to_device_id);

create table if not exists credential_kinds (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists device_credentials (
  id text primary key,
  topology_id text not null references topologies(id) on delete cascade,
  device_id text references topology_devices(id) on delete set null,
  kind text not null references credential_kinds(code),
  username_masked text,
  username_ciphertext text,
  secret_masked text not null,
  secret_ciphertext text,
  secret_nonce text,
  key_version text,
  created_by_user_id text references users(id),
  updated_by_user_id text references users(id),
  last_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_credentials_topology_id_idx on device_credentials(topology_id);
create index if not exists device_credentials_device_id_idx on device_credentials(device_id);
create index if not exists device_credentials_kind_idx on device_credentials(kind);

create table if not exists audit_logs (
  id text primary key,
  actor_user_id text references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  site_id text references sites(id) on delete set null,
  customer_id text references customers(id) on delete set null,
  topology_id text references topologies(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_actor_user_id_idx on audit_logs(actor_user_id);
create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

create table if not exists api_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  scopes jsonb not null,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists api_tokens_user_id_idx on api_tokens(user_id);

insert into roles (code, name, description)
values
  ('boss', 'Boss', 'Read and edit every customer and topology.'),
  ('site_manager', 'Site manager', 'Read and edit data for assigned sites.'),
  ('engineer', 'Engineer', 'Create and edit owned topology files.'),
  ('sales_procurement', 'Sales and procurement', 'Read all files without write access.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into permissions (code, name, description)
values
  ('customer.read.all', 'Read all customers', 'Can read all customer records.'),
  ('customer.write.all', 'Write all customers', 'Can edit all customer records.'),
  ('topology.read.all', 'Read all topologies', 'Can read all topology records.'),
  ('topology.write.all', 'Write all topologies', 'Can edit all topology records.'),
  ('topology.read.site', 'Read site topologies', 'Can read topology records in assigned sites.'),
  ('topology.write.site', 'Write site topologies', 'Can edit topology records in assigned sites.'),
  ('topology.write.owned', 'Write owned topologies', 'Can edit topology records created or owned by the user.'),
  ('credential.read.masked', 'Read masked credentials', 'Can read masked credential fields.'),
  ('credential.write', 'Write credentials', 'Can create or rotate encrypted credential records.'),
  ('audit.read', 'Read audit logs', 'Can review audit log records.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into role_permissions (role_code, permission_code)
values
  ('boss', 'customer.read.all'),
  ('boss', 'customer.write.all'),
  ('boss', 'topology.read.all'),
  ('boss', 'topology.write.all'),
  ('boss', 'credential.read.masked'),
  ('boss', 'credential.write'),
  ('boss', 'audit.read'),
  ('site_manager', 'topology.read.site'),
  ('site_manager', 'topology.write.site'),
  ('site_manager', 'credential.read.masked'),
  ('engineer', 'topology.write.owned'),
  ('engineer', 'credential.read.masked'),
  ('sales_procurement', 'customer.read.all'),
  ('sales_procurement', 'topology.read.all'),
  ('sales_procurement', 'credential.read.masked')
on conflict do nothing;

insert into config_kinds (code, name, description)
values
  ('customer_profile', 'Customer profile', 'Structured customer settings and metadata.'),
  ('topology_profile', 'Topology profile', 'Structured topology settings and metadata.'),
  ('import_mapping', 'Import mapping', 'CSV or document import mapping settings.'),
  ('export_template', 'Export template', 'Export and report template settings.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into device_types (code, name)
values
  ('router', 'Router'),
  ('modem', 'Modem'),
  ('firewall', 'Firewall'),
  ('switch', 'Switch'),
  ('server', 'Server'),
  ('nas', 'NAS'),
  ('erp', 'ERP'),
  ('access-point', 'Access point'),
  ('client', 'Client')
on conflict (code) do update set name = excluded.name, updated_at = now();

insert into group_kinds (code, name)
values
  ('site', 'Site'),
  ('domain', 'Domain'),
  ('vlan', 'VLAN')
on conflict (code) do update set name = excluded.name, updated_at = now();

insert into link_kinds (code, name)
values
  ('wired', 'Wired'),
  ('wireless', 'Wireless')
on conflict (code) do update set name = excluded.name, updated_at = now();

insert into credential_kinds (code, name, description)
values
  ('device_admin', 'Device admin', 'Administrative credential for a network device.'),
  ('device_readonly', 'Device read only', 'Read-only credential for a network device.'),
  ('wifi', 'Wi-Fi', 'Wireless network credential.'),
  ('vpn', 'VPN', 'VPN credential.'),
  ('external_service', 'External service', 'Credential for an external service.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

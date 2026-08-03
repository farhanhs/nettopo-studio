-- Formal data-dictionary constraints. Migration 0001 remains immutable after release.
-- Length checks work for both existing text columns and future varchar columns without
-- dropping foreign keys during an in-place upgrade.
alter table roles add constraint roles_code_length_check check (char_length(code) between 1 and 64);
alter table roles add constraint roles_name_length_check check (char_length(name) between 1 and 120);
alter table roles add constraint roles_description_length_check check (description is null or char_length(description) <= 1000);
alter table permissions add constraint permissions_code_length_check check (char_length(code) between 1 and 64);
alter table permissions add constraint permissions_name_length_check check (char_length(name) between 1 and 120);
alter table permissions add constraint permissions_description_length_check check (description is null or char_length(description) <= 1000);
alter table sites add constraint sites_id_length_check check (char_length(id) between 1 and 128);
alter table sites add constraint sites_name_length_check check (char_length(name) between 1 and 120);
alter table users add constraint users_id_length_check check (char_length(id) between 1 and 128);
alter table users add constraint users_email_length_check check (char_length(email) between 1 and 254);
alter table users add constraint users_name_length_check check (char_length(name) between 1 and 120);
alter table users add constraint users_password_hash_length_check check (password_hash is null or char_length(password_hash) <= 255);
alter table customers add constraint customers_id_length_check check (char_length(id) between 1 and 128);
alter table customers add constraint customers_name_length_check check (char_length(name) between 1 and 160);
alter table customers add constraint customers_notes_length_check check (notes is null or char_length(notes) <= 4000);
alter table topologies add constraint topologies_id_length_check check (char_length(id) between 1 and 128);
alter table topologies add constraint topologies_name_length_check check (char_length(name) between 1 and 160);
alter table topologies add constraint topologies_version_label_length_check check (char_length(version_label) between 1 and 64);
alter table topology_groups add constraint topology_groups_name_length_check check (char_length(name) between 1 and 160);
alter table topology_devices add constraint topology_devices_name_length_check check (char_length(name) between 1 and 160);
alter table topology_devices add constraint topology_devices_ip_length_check check (ip is null or char_length(ip) <= 45);
alter table topology_devices add constraint topology_devices_mac_length_check check (mac is null or char_length(mac) <= 17);
alter table topology_devices add constraint topology_devices_model_length_check check (model is null or char_length(model) <= 160);
alter table topology_devices add constraint topology_devices_location_length_check check (location is null or char_length(location) <= 240);
alter table topology_devices add constraint topology_devices_management_url_length_check check (management_url is null or char_length(management_url) <= 2048);
alter table topology_links add constraint topology_links_from_port_length_check check (from_port is null or char_length(from_port) <= 64);
alter table topology_links add constraint topology_links_to_port_length_check check (to_port is null or char_length(to_port) <= 64);
alter table topology_links add constraint topology_links_vlan_length_check check (vlan is null or char_length(vlan) <= 64);
alter table topology_links add constraint topology_links_speed_length_check check (speed is null or char_length(speed) <= 64);

alter table roles add constraint roles_code_format_check check (code ~ '^[a-z][a-z0-9._-]*$');
alter table permissions add constraint permissions_code_format_check check (code ~ '^[a-z][a-z0-9._-]*$');
alter table config_kinds add constraint config_kinds_code_format_check check (code ~ '^[a-z][a-z0-9._-]*$');
alter table users add constraint users_id_format_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$');
alter table users add constraint users_email_half_width_check check (email !~ '[^ -~]');
alter table sites add constraint sites_id_format_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$');
alter table customers add constraint customers_id_format_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$');
alter table topologies add constraint topologies_id_format_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$');
alter table topologies add constraint topologies_project_object_check check (jsonb_typeof(project) = 'object');
alter table topology_groups add constraint topology_groups_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');
alter table topology_devices add constraint topology_devices_ip_half_width_check check (ip is null or ip !~ '[^ -~]');
alter table topology_devices add constraint topology_devices_mac_check check (mac is null or mac ~ '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$');
alter table topology_devices add constraint topology_devices_position_x_check check (position_x between -1000000 and 1000000);
alter table topology_devices add constraint topology_devices_position_y_check check (position_y between -1000000 and 1000000);
alter table topology_links add constraint topology_links_distinct_devices_check check (from_device_id <> to_device_id);

-- Trouble pictures are removed through the Storage API.
-- Supabase rejects DELETE on storage.objects (protect_delete, error 42501).
-- trouble_delete_art ran that delete, so removing a trouble rolled back.
-- Deleting a table rolled back too: trouble rows go with the table, and the
-- same trigger fired for each one.
--
-- The app lists {table_id}/{trouble_id}/{revision}.jpg while the row exists,
-- deletes the row, then calls storage.remove. This file drops the trigger.
-- A table removed in the SQL editor does not run the app, so that table's
-- folder stays in the trouble-art bucket until you remove it in Storage.
--
-- Read, insert, and update stay on can_see_trouble_art / can_write_trouble_art:
-- a living trouble, and only the current GM. Players never see the library.
-- Delete uses can_delete_trouble_art so that same GM can remove a leftover
-- file once the row is gone. A past GM cannot.

drop trigger if exists trouble_delete_art on public.trouble;
drop function if exists public.delete_trouble_art();

create or replace function public.can_delete_trouble_art(object_name text)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  parts text[];
  tid uuid;
begin
  if object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{1,16}\.jpg$' then
    return false;
  end if;
  parts := string_to_array(object_name, '/');
  tid := parts[1]::uuid;
  return public.is_current_gm(tid);
end;
$$;

revoke all on function public.can_delete_trouble_art(text) from public, anon, authenticated;
grant execute on function public.can_delete_trouble_art(text) to authenticated;

drop policy if exists trouble_art_delete on storage.objects;
create policy trouble_art_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trouble-art'
    and public.can_delete_trouble_art(name)
  );

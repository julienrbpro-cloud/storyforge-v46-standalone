import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL("../supabase/migrations/20261008033507_storyforge_cloud_schema_v1.sql", import.meta.url),
  "utf8",
);
const OWNER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const PROJECT = "20000000-0000-4000-8000-000000000001";
const OTHER_PROJECT = "20000000-0000-4000-8000-000000000002";

test("cloud schema works without automatic Data API grants", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  // Model only the managed Supabase SQL interfaces used by the migration.
  // Policies and permissions run in Postgres, not in a JavaScript mock.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt()->>'sub')::uuid
    $$;
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
    $$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated;
    alter default privileges in schema public
      revoke all on tables from public, anon, authenticated, service_role;
    create table public.unexposed_probe (id uuid primary key);
  `);
  assert.equal(
    (
      await db.query(
        "select has_table_privilege('authenticated', 'public.unexposed_probe', 'SELECT') as allowed",
      )
    ).rows[0].allowed,
    false,
  );
  await db.exec(migration);
  await db.query("insert into auth.users (id) values ($1), ($2)", [OWNER, OTHER]);

  async function signedIn(id, anonymous = false) {
    await db.exec("reset role; set role authenticated;");
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: id, is_anonymous: anonymous }),
    ]);
  }

  await t.test("replay restores explicit CRUD grants and RLS", async () => {
    const { rows } = await db.query(`
      select r.role_name, p.privilege,
        has_table_privilege(r.role_name, 'public.storyforge_projects', p.privilege) as allowed
      from (values ('anon'), ('authenticated'), ('service_role')) r(role_name)
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(privilege)
    `);
    for (const row of rows) assert.equal(row.allowed, row.role_name === "authenticated");
    const state = (
      await db.query(`
      select relrowsecurity as rls,
        (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'storyforge_projects') as project_policies,
        (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects') as image_policies
      from pg_class where oid = 'public.storyforge_projects'::regclass
    `)
    ).rows[0];
    assert.deepEqual(state, { rls: true, project_policies: 4, image_policies: 4 });
  });

  await t.test("signed-in users can create, read and update their own projects", async () => {
    await signedIn(OWNER);
    const { rows } = await db.query(
      "insert into public.storyforge_projects (id, title) values ($1, 'Owner project') returning owner_id, revision",
      [PROJECT],
    );
    assert.equal(rows[0].owner_id, OWNER);
    assert.equal(Number(rows[0].revision), 1);
    await signedIn(OTHER);
    await db.query(
      "insert into public.storyforge_projects (id, title) values ($1, 'Other project')",
      [OTHER_PROJECT],
    );
    await signedIn(OWNER);
    assert.deepEqual((await db.query("select id from public.storyforge_projects")).rows, [
      { id: PROJECT },
    ]);
    assert.deepEqual(
      (
        await db.query(
          "update public.storyforge_projects set title = 'Updated', revision = revision + 1 where id = $1 returning title",
          [PROJECT],
        )
      ).rows,
      [{ title: "Updated" }],
    );
  });

  await t.test(
    "owners cannot read, change, delete or take ownership of another user's rows",
    async () => {
      assert.deepEqual(
        (await db.query("select id from public.storyforge_projects where id = $1", [OTHER_PROJECT]))
          .rows,
        [],
      );
      assert.deepEqual(
        (
          await db.query(
            "update public.storyforge_projects set title = 'Forbidden' where id = $1 returning id",
            [OTHER_PROJECT],
          )
        ).rows,
        [],
      );
      assert.deepEqual(
        (
          await db.query("delete from public.storyforge_projects where id = $1 returning id", [
            OTHER_PROJECT,
          ])
        ).rows,
        [],
      );
      await assert.rejects(
        db.query("update public.storyforge_projects set owner_id = $1 where id = $2", [
          OTHER,
          PROJECT,
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        db.query("insert into public.storyforge_projects (owner_id) values ($1)", [OTHER]),
        { code: "42501" },
      );
    },
  );

  await t.test("image policies restrict access to the owner's folder", async () => {
    await db.query(
      "insert into storage.objects (bucket_id, name) values ('StoryForge-Image', $1)",
      [OWNER + "/project/image.png"],
    );
    await assert.rejects(
      db.query("insert into storage.objects (bucket_id, name) values ('StoryForge-Image', $1)", [
        OTHER + "/project/image.png",
      ]),
      { code: "42501" },
    );
    await signedIn(OTHER);
    assert.deepEqual((await db.query("select name from storage.objects")).rows, []);
  });

  await t.test("anonymous sign-ins cannot access projects or images", async () => {
    await signedIn(OWNER, true);
    assert.deepEqual((await db.query("select id from public.storyforge_projects")).rows, []);
    assert.deepEqual((await db.query("select name from storage.objects")).rows, []);
    await assert.rejects(
      db.query("insert into public.storyforge_projects (title) values ('Forbidden')"),
      { code: "42501" },
    );
    await assert.rejects(
      db.query("insert into storage.objects (bucket_id, name) values ('StoryForge-Image', $1)", [
        OWNER + "/project/anonymous.png",
      ]),
      { code: "42501" },
    );
    assert.deepEqual(
      (
        await db.query(
          "update public.storyforge_projects set title = 'Forbidden' where id = $1 returning id",
          [PROJECT],
        )
      ).rows,
      [],
    );
    assert.deepEqual(
      (
        await db.query("delete from public.storyforge_projects where id = $1 returning id", [
          PROJECT,
        ])
      ).rows,
      [],
    );
  });

  await t.test("unauthenticated requests have no table privileges", async () => {
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select id from public.storyforge_projects"), { code: "42501" });
    await assert.rejects(
      db.query("insert into public.storyforge_projects (title) values ('Forbidden')"),
      { code: "42501" },
    );
    await assert.rejects(db.query("update public.storyforge_projects set title = 'Forbidden'"), {
      code: "42501",
    });
    await assert.rejects(db.query("delete from public.storyforge_projects"), { code: "42501" });
  });

  await t.test(
    "an owner can delete their project without deleting another user's project",
    async () => {
      await signedIn(OWNER);
      assert.deepEqual(
        (
          await db.query("delete from public.storyforge_projects where id = $1 returning id", [
            PROJECT,
          ])
        ).rows,
        [{ id: PROJECT }],
      );
      await signedIn(OTHER);
      assert.deepEqual((await db.query("select id from public.storyforge_projects")).rows, [
        { id: OTHER_PROJECT },
      ]);
    },
  );
});

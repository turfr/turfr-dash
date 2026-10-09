# ADR-001: Supabase Client Access Requires Explicit RLS Policies

**Status:** Accepted  
**Date:** 2026-10-08

## Context

The existing `matches`, `participation`, and `players` tables were in the exposed
`public` schema with Row Level Security (RLS) disabled and full privileges granted
to the unauthenticated `anon` role. The tables include personal and payment-related
fields. The Turfr dashboard in this repository reads from a published Google Sheet
and does not access these Supabase tables directly. The 3Kend backend uses
server-side API routes and separate tables.

Modules may have different needs: some data may be public to read, while writes
should be limited to specific actors and rows. A single broad policy cannot safely
represent every module's access rules.

## Decision

- Enable RLS on every table in an API-exposed schema.
- Deny direct client access by default. Do not grant `anon` or `authenticated`
  privileges unless a module has an explicit access requirement.
- For each required client operation, grant only that operation and add an RLS
  policy that defines which rows that actor may access or change.
- Keep Supabase secret/service-role keys on the server. Server routes using these
  keys must perform their own authentication and authorization checks.
- Public reads must be explicitly designed and granted. They may use a narrowly
  scoped RLS read policy or a server API route.
- Realtime publication is separate from authorization. Adding a table to Realtime
  does not grant clients permission to read its rows.

## Consequences

- Direct browser access to `matches`, `participation`, and `players` is denied
  until module-specific grants and policies are added.
- Modules that relied on unrestricted Supabase client access must be updated to
  follow this model; their direct queries may fail until then.
- New tables and future access paths must include grants and RLS policies in the
  same reviewed migration.
- Database access changes should include checks for allowed and denied operations
  under the `anon` and `authenticated` roles.
- Server-side privileged access remains possible and must stay behind validated
  server routes; the service-role key must never be exposed to browser code.

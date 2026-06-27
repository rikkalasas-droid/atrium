# Atrium — SharePoint Migration Mapper ported to .NET (2026-06-27)

Branch: `feat/migration-mapper`. Ports the proven Python assessment engine
(`atrium-migration-assessment`) into the .NET backend so the migration plan +
fidelity report are produced by the app itself — the roadmap's "next" step now
that BYO storage is live to receive bytes.

## What landed
- **`backend/Atrium.Api/Migration/`** (namespace `Atrium.Api.MigrationEngine`):
  - `Fidelity.cs` — `Severity` (OK/INFO/LOSSY/BLOCKED), `Finding`, `FidelityReport`.
  - `CanonicalModel.cs` — the reader contract input shape (site, principals,
    libraries → columns + documents → versions, roleAssignments, fields).
  - `PlanModel.cs` — Atrium-shaped output (PlannedItem/Version/StoredFile/Grant/
    Principal, ByteCopyJob, MigrationPlan).
  - `MigrationMapper.cs` — the rules, a faithful port of `mapping.py`/`migrator.py`:
    site→Space, libraries collapse (`_library`), folders→`_path`, files→Document
    Items + StoredFile pointer, versions→sequential ItemVersions (labels kept),
    managed-metadata→Label|TermGuid (LOSSY), lookups→id+text (LOSSY), person→by
    identity (INFO), calculated→snapshot (INFO), content-type→flattened (LOSSY),
    permissions only on broken inheritance with role mapping + Limited-Access
    ignored, principal-mapping manifest, redirect map, and a byte-copy manifest
    (current + historical versions) all marked BLOCKED until execution copies bytes.
- **`POST /api/migration/assess`** (`Endpoints/MigrationEndpoints.cs`) — accepts a
  canonical dump, returns `space`, `summary`, `fidelity{counts,worst,findings}`,
  `items`, `grants`, `byteCopyJobs`, `principals`, `redirects`. `?preserveVersionBytes=false`
  drops historical-version byte jobs. Pure, no DB.
- **`samples/migration/contoso-hr.json`** — the HR fixture, committed as the
  reference input / test target.

## Naming gotcha
The folder is `Migration/` but the namespace is **`Atrium.Api.MigrationEngine`** —
a singular `Atrium.Api.Migration` namespace shadows EF Core's `Migration` base
type used by the generated classes in `Atrium.Api.Migrations` (build error
CS0118). Renamed to avoid the clash.

## Verified (matches the Python reference exactly)
`POST /api/migration/assess` with the HR fixture returns:
```
documents 5 · versionSnapshots 17 · uniquePermItems 2 · grants 3 · principals 4
byteCopyJobs 17 (current 2 MB | incl. history 11 MB) · redirects 5
FIDELITY  OK:4 INFO:7 LOSSY:5 BLOCKED:5   worst BLOCKED
```
The 5 LOSSY findings are the expected ones: 2 managed-metadata (Region), 2
lookups (RelatedPolicy), 1 custom permission level (HR Approver).

## Not yet built (next)
- **Execution** — `POST /api/migration/execute`: write the plan into the DB
  (Space/Items/ItemVersions/ResourceGrants + Pending StoredFile rows) and run the
  byte-copy manifest through `IStorageProvider` once a reader supplies bytes.
- **Readers** — Graph (SP Online) and CSOM/REST (on-prem) that emit canonical
  JSON; these run against a real tenant with the customer's own credentials.
- **Lists (P3)** needs the Atrium list/table decision; **Pages (P2)** mapper is
  designed but not built.

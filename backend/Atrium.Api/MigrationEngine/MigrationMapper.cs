using System.Text.Json;
using System.Text.RegularExpressions;

namespace Atrium.Api.MigrationEngine;

/// <summary>
/// The mapping brain: a canonical SharePoint source -> an Atrium MigrationPlan +
/// fidelity report. Pure rules, no I/O — a faithful C# port of the proven Python
/// assessment engine. Run without copying bytes, it is a pre-flight assessment.
/// </summary>
public static class MigrationMapper
{
    // Atrium roles (ascending): Viewer < Contributor < Editor < Manager < Owner
    private static readonly Dictionary<string, int> RoleRank = new()
    {
        ["Viewer"] = 1, ["Contributor"] = 2, ["Editor"] = 3, ["Manager"] = 4, ["Owner"] = 5,
    };
    private static readonly Dictionary<string, string> SpRoleMap = new()
    {
        ["Read"] = "Viewer", ["View Only"] = "Viewer", ["Restricted Read"] = "Viewer",
        ["Contribute"] = "Contributor", ["Edit"] = "Editor", ["Design"] = "Editor",
        ["Full Control"] = "Owner",
        // "Limited Access" handled specially (ignored — it's SP plumbing)
    };

    public static string Slugify(string? s)
    {
        var outp = Regex.Replace((s ?? "").ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrEmpty(outp) ? "site" : outp;
    }

    public static MigrationPlan MigrateSite(SourceDump dump, bool preserveVersionBytes = true)
    {
        var site = dump.Site;
        var plan = new MigrationPlan { SpaceName = site.Title, SpaceSlug = Slugify(site.Title) };
        var report = plan.Report;

        report.Add(Severity.OK, "site", site.Url, $"Site '{site.Title}' -> Atrium Space '{plan.SpaceSlug}'.");

        // ---- principals directory (identity mapping manifest) ----
        foreach (var p in dump.Principals)
        {
            var status = p.Type == "User" && !string.IsNullOrWhiteSpace(p.Email) ? "resolve-by-email"
                : p.Type == "SharePointGroup" ? "create-atrium-group"
                : "needs-directory(Keycloak)";
            plan.Principals.Add(new PlannedPrincipal
            {
                Login = p.Login, DisplayName = p.DisplayName ?? p.Login,
                Email = p.Email, Type = p.Type, MappingStatus = status,
            });
        }

        // ---- libraries ----
        if (dump.Libraries.Count > 1)
            report.Add(Severity.INFO, "library", site.Url,
                $"{dump.Libraries.Count} document libraries collapse into one Space; library identity " +
                "preserved per-document as '_library'. Atrium has no library-container entity yet (flat Spaces).");

        foreach (var lib in dump.Libraries)
        {
            var columns = lib.Columns.ToDictionary(c => c.InternalName, c => c);
            if (lib.RootHasUniquePermissions)
                report.Add(Severity.INFO, "permissions", lib.ServerRelativeUrl,
                    $"Library '{lib.Title}' root has unique permissions; mapped at library scope.");
            foreach (var doc in lib.Documents)
                MapDocument(doc, columns, lib.Title, plan.SpaceSlug, plan, preserveVersionBytes);
        }

        return plan;
    }

    // ---- field (metadata column) mapping ----
    private static Dictionary<string, object?> MapFields(SourceDocument doc, Dictionary<string, Column> columns,
        FidelityReport report, string srcRef, string libraryTitle)
    {
        var outp = new Dictionary<string, object?>();
        if (!string.IsNullOrWhiteSpace(doc.FolderPath)) outp["_path"] = doc.FolderPath;
        outp["_library"] = libraryTitle;

        foreach (var (name, value) in doc.Fields)
        {
            columns.TryGetValue(name, out var col);
            var ctype = col?.Type ?? "Text";

            if ((col?.ReadOnly ?? false) || ctype == "Calculated")
            {
                outp[name] = new Dictionary<string, object?> { ["value"] = value, ["_note"] = "calculated/read-only at source; stored as snapshot" };
                report.Add(Severity.INFO, "calculated-column", srcRef,
                    $"Column '{name}' is calculated/read-only; migrated as a static snapshot value.");
                continue;
            }

            if (ctype == "TaxonomyFieldType")
            {
                var label = JsonStr(value, "label");
                outp[name] = new Dictionary<string, object?>
                {
                    ["label"] = label, ["termGuid"] = JsonStr(value, "termGuid"),
                    ["termSetId"] = JsonStr(value, "termSetId"), ["_lossy"] = "term store not migrated",
                };
                report.Add(Severity.LOSSY, "managed-metadata", srcRef,
                    $"Managed-metadata column '{name}' preserved as Label|TermGuid ('{label}'); the term store/" +
                    "taxonomy itself is not migrated (Atrium has no term store) — term-driven navigation & validation are lost.");
                continue;
            }

            if (ctype is "User" or "MultiUser")
            {
                outp[name] = value;   // {login, displayName, email}
                report.Add(Severity.INFO, "person-column", srcRef,
                    $"Person column '{name}' kept by identity; resolves once the user exists in Atrium.");
                continue;
            }

            if (ctype == "Lookup")
            {
                outp[name] = new Dictionary<string, object?> { ["lookupId"] = JsonRaw(value, "lookupId"), ["value"] = JsonStr(value, "value") };
                report.Add(Severity.LOSSY, "lookup-column", srcRef,
                    $"Lookup column '{name}' stored as id+text; the referential link is not reconstructed " +
                    "unless the target list is also migrated.");
                continue;
            }

            // Text / Note / Number / Bool / DateTime / Choice / URL -> direct
            outp[name] = value;
        }

        return outp;
    }

    // ---- permission mapping (only for items with broken inheritance) ----
    private static List<PlannedGrant> MapPermissions(string itemId, List<RoleAssignment> roleAssignments,
        FidelityReport report, string srcRef)
    {
        var grants = new List<PlannedGrant>();
        foreach (var ra in roleAssignments)
        {
            var principal = ra.Principal;
            var plogin = string.IsNullOrEmpty(principal.Login) ? "?" : principal.Login;
            var ptype = principal.Type;
            var pdisplay = principal.DisplayName ?? plogin;

            var effective = ra.Roles.Where(r => r != "Limited Access").ToList();
            if (effective.Count == 0)
            {
                report.Add(Severity.INFO, "permissions", srcRef,
                    $"'{pdisplay}' had only 'Limited Access' (SharePoint plumbing, not a real grant) — ignored.");
                continue;
            }

            string? bestRole = null; var bestRank = -1; var lossyLevels = new List<string>();
            foreach (var r in effective)
            {
                if (!SpRoleMap.TryGetValue(r, out var mapped)) { lossyLevels.Add(r); mapped = "Editor"; }
                var rank = RoleRank[mapped];
                if (rank > bestRank) { bestRank = rank; bestRole = mapped; }
            }

            foreach (var lvl in lossyLevels)
                report.Add(Severity.LOSSY, "permissions", srcRef,
                    $"Custom permission level '{lvl}' has no Atrium equivalent; mapped to nearest role '{bestRole}' — exact rights may differ.");

            if (ptype == "SecurityGroup")
                report.Add(Severity.INFO, "principal", srcRef,
                    $"AD security group '{pdisplay}' referenced; requires directory integration (Keycloak) to resolve members.");
            else if (ptype == "SharePointGroup")
                report.Add(Severity.INFO, "principal", srcRef,
                    $"SharePoint group '{pdisplay}' becomes an Atrium group/membership during execution.");

            grants.Add(new PlannedGrant
            {
                ItemSourceId = itemId, PrincipalLogin = plogin, PrincipalType = ptype,
                AtriumRole = bestRole!, SourceRoles = effective,
            });
        }
        return grants;
    }

    // ---- document mapping ----
    private static void MapDocument(SourceDocument doc, Dictionary<string, Column> columns, string libraryTitle,
        string spaceSlug, MigrationPlan plan, bool preserveVersionBytes)
    {
        var report = plan.Report;
        var srcRef = doc.ServerRelativeUrl;
        var itemId = doc.Id;

        var fields = MapFields(doc, columns, report, srcRef, libraryTitle);

        if (!string.IsNullOrWhiteSpace(doc.ContentType))
        {
            fields["_contentType"] = doc.ContentType;
            report.Add(Severity.LOSSY, "content-type", srcRef,
                $"Content type '{doc.ContentType}' flattened to columns + a name tag; content-type behaviors/templates not migrated.");
        }

        var title = FieldString(fields, "Title") ?? doc.Name;

        // versions -> sequential ItemVersions, original label preserved
        var versions = doc.Versions.OrderBy(v => v.Modified ?? "", StringComparer.Ordinal).ToList();
        var plannedVersions = new List<PlannedVersion>();
        for (var i = 0; i < versions.Count; i++)
        {
            var v = versions[i];
            plannedVersions.Add(new PlannedVersion
            {
                VersionNumber = i + 1, SourceLabel = v.Label ?? (i + 1).ToString(),
                Modified = v.Modified ?? "", AuthorLogin = v.ModifiedBy,
                SnapshotJson = JsonSerializer.Serialize(new { title, label = v.Label, modified = v.Modified }),
            });
        }
        var currentVersion = plannedVersions.Count == 0 ? 1 : plannedVersions.Count;
        if (plannedVersions.Count > 1)
            report.Add(Severity.OK, "versions", srcRef,
                $"{plannedVersions.Count} versions mapped to ItemVersion history " +
                $"(labels {versions[0].Label}..{versions[^1].Label}) — preserved.");

        // stored file (current bytes) + byte-copy manifest
        var destKey = $"{spaceSlug}/{itemId}/{doc.Name}";
        var stored = new PlannedStoredFile
        {
            SourceUrl = srcRef, FileName = doc.Name, Size = doc.Size,
            ContentHash = doc.ContentHash, DestinationKey = destKey,
        };
        plan.ByteCopyJobs.Add(new ByteCopyJob { SourceUrl = srcRef, Size = doc.Size, ContentHash = doc.ContentHash, DestinationKey = destKey, VersionLabel = null });
        if (preserveVersionBytes && versions.Count > 1)
            foreach (var v in versions.Take(versions.Count - 1))
                plan.ByteCopyJobs.Add(new ByteCopyJob
                {
                    SourceUrl = srcRef, Size = v.Size, ContentHash = null,
                    DestinationKey = $"{spaceSlug}/{itemId}/_versions/{v.Label}/{doc.Name}", VersionLabel = v.Label,
                });

        report.Add(Severity.BLOCKED, "file-bytes", srcRef,
            "File content copy is planned (manifest job) but BLOCKED until the BYO storage service receives bytes; " +
            "metadata/versions/permissions map now.");

        if (!string.IsNullOrWhiteSpace(doc.CheckedOutBy))
            report.Add(Severity.INFO, "check-out", srcRef,
                "File is checked out at source; migrated as latest available version (check-out state not preserved).");

        if (srcRef.Length > 200)
            report.Add(Severity.INFO, "url-length", srcRef,
                $"Source path is {srcRef.Length} chars — long URLs risk SharePoint's 400-char ceiling and break on copy; verify destination key length.");

        plan.Redirects.Add(new Dictionary<string, string> { ["from"] = srcRef, ["to"] = $"/s/{spaceSlug}/{itemId}" });

        if (doc.HasUniquePermissions)
            plan.Grants.AddRange(MapPermissions(itemId, doc.RoleAssignments, report, srcRef));
        // inherited items intentionally emit NO grant — inheritance-by-default in Atrium.

        plan.Items.Add(new PlannedItem
        {
            SourceId = itemId, Kind = "Document", Title = title,
            FieldsJson = JsonSerializer.Serialize(fields),
            CurrentVersion = currentVersion, Versions = plannedVersions,
            StoredFile = stored, HasUniquePermissions = doc.HasUniquePermissions,
        });
    }

    // ---- JsonElement helpers ----
    private static string? JsonStr(JsonElement el, string prop)
        => el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() : null;

    private static object? JsonRaw(JsonElement el, string prop)
        => el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v)
            ? (v.ValueKind == JsonValueKind.Number ? v.GetRawText() : v.ToString()) : null;

    private static string? FieldString(Dictionary<string, object?> fields, string key)
    {
        if (!fields.TryGetValue(key, out var v) || v is null) return null;
        if (v is JsonElement el) return el.ValueKind == JsonValueKind.String ? el.GetString() : el.ToString();
        return v.ToString();
    }
}

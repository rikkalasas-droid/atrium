using Atrium.Api.MigrationEngine;

namespace Atrium.Api.Endpoints;

/// <summary>
/// SharePoint migration: the pre-flight ASSESSMENT as an API. POST a canonical
/// source dump (what a Graph/CSOM reader produces) and get back the full Atrium
/// migration plan + an honest fidelity report — exactly what survives, what is
/// lossy, what is blocked — before any bytes move. Execution (writing the plan +
/// copying bytes via IStorageProvider) is a separate, later endpoint.
/// </summary>
public static class MigrationEndpoints
{
    public static void MapMigrationEndpoints(this WebApplication app)
    {
        app.MapPost("/api/migration/assess", (SourceDump dump, bool? preserveVersionBytes) =>
        {
            if (dump is null || string.IsNullOrWhiteSpace(dump.Site.Title))
                return Results.BadRequest(new { error = "Provide a canonical source dump with a site.title." });

            var plan = MigrationMapper.MigrateSite(dump, preserveVersionBytes ?? true);
            var r = plan.Report;
            var counts = r.Counts();

            var currentBytes = plan.ByteCopyJobs.Where(j => j.VersionLabel is null).Sum(j => j.Size);
            var allBytes = plan.ByteCopyJobs.Sum(j => j.Size);

            return Results.Ok(new
            {
                space = new { name = plan.SpaceName, slug = plan.SpaceSlug },
                summary = new
                {
                    documents = plan.Items.Count(i => i.Kind == "Document"),
                    versionSnapshots = plan.Items.Sum(i => i.Versions.Count),
                    uniquePermissionItems = plan.Items.Count(i => i.HasUniquePermissions),
                    grants = plan.Grants.Count,
                    principals = plan.Principals.Count,
                    byteCopyJobs = plan.ByteCopyJobs.Count,
                    currentBytes,
                    bytesWithHistory = allBytes,
                    redirects = plan.Redirects.Count,
                },
                fidelity = new
                {
                    // Dictionary keys keep their exact casing (Web JSON only camelCases property names)
                    counts = new Dictionary<string, int>
                    {
                        ["OK"] = counts[Severity.OK], ["INFO"] = counts[Severity.INFO],
                        ["LOSSY"] = counts[Severity.LOSSY], ["BLOCKED"] = counts[Severity.BLOCKED],
                    },
                    worst = r.Worst().ToString(),
                    findings = r.Findings.Select(f => new
                    {
                        severity = f.Severity.ToString(), category = f.Category,
                        source = f.SourceRef, message = f.Message,
                    }),
                },
                items = plan.Items,
                grants = plan.Grants,
                byteCopyJobs = plan.ByteCopyJobs,
                principals = plan.Principals,
                redirects = plan.Redirects,
            });
        }).DisableAntiforgery();
    }
}

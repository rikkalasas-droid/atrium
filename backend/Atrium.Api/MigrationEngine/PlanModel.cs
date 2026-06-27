namespace Atrium.Api.MigrationEngine;

// Atrium-shaped output DTOs — dependency-free mirrors of the EF entities. The
// execution phase turns these into real Item/ItemVersion/StoredFile/ResourceGrant
// rows; keeping them plain makes the mapping pure and testable.

public sealed class PlannedVersion
{
    public int VersionNumber { get; set; }
    public string SourceLabel { get; set; } = "";
    public string Modified { get; set; } = "";
    public string? AuthorLogin { get; set; }
    public string SnapshotJson { get; set; } = "{}";
}

public sealed class PlannedStoredFile
{
    public string SourceUrl { get; set; } = "";
    public string FileName { get; set; } = "";
    public long Size { get; set; }
    public string? ContentHash { get; set; }
    public string DestinationKey { get; set; } = "";
    public string Status { get; set; } = "Pending";   // bytes not copied until storage executes the manifest
}

public sealed class PlannedGrant
{
    public string ItemSourceId { get; set; } = "";
    public string PrincipalLogin { get; set; } = "";
    public string PrincipalType { get; set; } = "";
    public string AtriumRole { get; set; } = "";
    public List<string> SourceRoles { get; set; } = new();
}

public sealed class PlannedItem
{
    public string SourceId { get; set; } = "";
    public string Kind { get; set; } = "Document";   // Document | Page | List ...
    public string Title { get; set; } = "";
    public string FieldsJson { get; set; } = "{}";
    public int CurrentVersion { get; set; }
    public List<PlannedVersion> Versions { get; set; } = new();
    public PlannedStoredFile? StoredFile { get; set; }
    public bool HasUniquePermissions { get; set; }
}

public sealed class ByteCopyJob
{
    public string SourceUrl { get; set; } = "";
    public long Size { get; set; }
    public string? ContentHash { get; set; }
    public string DestinationKey { get; set; } = "";
    public string? VersionLabel { get; set; }   // null = current; else a historical version
}

public sealed class PlannedPrincipal
{
    public string Login { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Email { get; set; }
    public string Type { get; set; } = "User";
    public string MappingStatus { get; set; } = "";
}

public sealed class MigrationPlan
{
    public string SpaceName { get; set; } = "";
    public string SpaceSlug { get; set; } = "";
    public List<PlannedItem> Items { get; set; } = new();
    public List<PlannedGrant> Grants { get; set; } = new();
    public List<ByteCopyJob> ByteCopyJobs { get; set; } = new();
    public List<PlannedPrincipal> Principals { get; set; } = new();
    public List<Dictionary<string, string>> Redirects { get; set; } = new();
    public FidelityReport Report { get; set; } = new();
}

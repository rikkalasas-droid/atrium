using System.Text.Json;
using Atrium.Api.Data;
using Atrium.Api.Domain;

namespace Atrium.Api.Services;

/// <summary>
/// Captures a point-in-time snapshot of an Item (title + fields + ordered blocks)
/// into ItemVersion. Callers set item.CurrentVersion to the desired number first,
/// ensure item.Blocks reflects the final state, then call WriteVersion.
/// </summary>
public static class Versioning
{
    public static void WriteVersion(AtriumDbContext db, Item item, Guid? authorId)
    {
        var snapshot = new
        {
            title = item.Title,
            fields = item.FieldsJson,
            blocks = item.Blocks
                .OrderBy(b => b.Position)
                .Select(b => new
                {
                    type = b.Type.ToString(),
                    b.Position,
                    b.ParentBlockId,
                    content = b.ContentJson
                })
        };

        db.ItemVersions.Add(new ItemVersion
        {
            TenantId = item.TenantId,
            ItemId = item.Id,
            VersionNumber = item.CurrentVersion,
            Title = item.Title,
            SnapshotJson = JsonSerializer.Serialize(snapshot),
            AuthorId = authorId
        });
    }
}

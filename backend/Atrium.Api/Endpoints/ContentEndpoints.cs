using System.Text.Json;
using System.Text.RegularExpressions;
using Atrium.Api.Contracts;
using Atrium.Api.Data;
using Atrium.Api.Domain;
using Atrium.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Atrium.Api.Endpoints;

public static class ContentEndpoints
{
    public static RouteGroupBuilder MapContentEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api");

        // ---------------- Spaces ----------------
        g.MapGet("/spaces", async (AtriumDbContext db) =>
            await db.Spaces.OrderBy(s => s.Name)
                .Select(s => new { s.Id, s.Name, s.Slug, s.Icon, s.Description })
                .ToListAsync());

        g.MapPost("/spaces", async (CreateSpaceRequest req, HttpContext ctx, AtriumDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.BadRequest(new { error = "name is required" });

            var tenant = await ResolveTenantAsync(ctx, db);
            var slug = Slugify(string.IsNullOrWhiteSpace(req.Slug) ? req.Name : req.Slug!);

            if (await db.Spaces.AnyAsync(s => s.TenantId == tenant.Id && s.Slug == slug))
                return Results.Conflict(new { error = $"a space with slug '{slug}' already exists" });

            var space = new Space
            {
                TenantId = tenant.Id, Name = req.Name, Slug = slug,
                Description = req.Description, Icon = req.Icon
            };
            db.Spaces.Add(space);
            await db.SaveChangesAsync();
            return Results.Created($"/api/spaces/{space.Id}",
                new { space.Id, space.Name, space.Slug, space.Icon, space.Description });
        });

        g.MapPatch("/spaces/{spaceId:guid}", async (Guid spaceId, UpdateSpaceRequest req, AtriumDbContext db) =>
        {
            var space = await db.Spaces.FirstOrDefaultAsync(s => s.Id == spaceId);
            if (space is null) return Results.NotFound();
            if (req.Name is not null) space.Name = req.Name;
            if (req.Description is not null) space.Description = req.Description;
            if (req.Icon is not null) space.Icon = req.Icon;
            await db.SaveChangesAsync();
            return Results.Ok(new { space.Id, space.Name, space.Slug, space.Icon, space.Description });
        });

        // ---------------- Items ----------------
        g.MapGet("/spaces/{spaceId:guid}/items", async (Guid spaceId, AtriumDbContext db) =>
            await db.Items.Where(i => i.SpaceId == spaceId)
                .OrderByDescending(i => i.UpdatedAt)
                .Select(i => new { i.Id, type = i.Type.ToString(), i.Title, i.CurrentVersion, i.UpdatedAt })
                .ToListAsync());

        g.MapGet("/items/{itemId:guid}", async (Guid itemId, AtriumDbContext db) =>
        {
            var item = await db.Items
                .Include(i => i.Blocks.OrderBy(b => b.Position))
                .FirstOrDefaultAsync(i => i.Id == itemId);

            return item is null
                ? Results.NotFound()
                : Results.Ok(new
                {
                    item.Id, type = item.Type.ToString(), item.Title,
                    item.CurrentVersion, item.FieldsJson,
                    blocks = item.Blocks.OrderBy(b => b.Position)
                        .Select(b => new { b.Id, type = b.Type.ToString(), b.Position, b.ParentBlockId, b.ContentJson })
                });
        });

        g.MapPost("/spaces/{spaceId:guid}/items", async (Guid spaceId, CreateItemRequest req, AtriumDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Title))
                return Results.BadRequest(new { error = "title is required" });

            var space = await db.Spaces.FirstOrDefaultAsync(s => s.Id == spaceId);
            if (space is null) return Results.NotFound(new { error = "space not found" });

            if (!TryParseItemType(req.Type, out var type))
                return Results.BadRequest(new { error = $"invalid item type '{req.Type}'" });
            if (!ValidJsonOrNull(req.FieldsJson, out var ferr))
                return Results.BadRequest(new { error = ferr });

            var item = new Item
            {
                TenantId = space.TenantId, SpaceId = space.Id,
                Type = type, Title = req.Title, FieldsJson = req.FieldsJson
            };

            if (req.Blocks is not null)
            {
                foreach (var bi in req.Blocks)
                {
                    if (!TryParseBlockType(bi.Type, out var bt))
                        return Results.BadRequest(new { error = $"invalid block type '{bi.Type}'" });
                    if (!ValidJsonOrNull(bi.ContentJson, out var berr))
                        return Results.BadRequest(new { error = berr });
                    item.Blocks.Add(new Block
                    {
                        TenantId = space.TenantId, Type = bt, Position = bi.Position,
                        ContentJson = bi.ContentJson, ParentBlockId = bi.ParentBlockId
                    });
                }
            }

            item.CurrentVersion = 1;
            db.Items.Add(item);
            Versioning.WriteVersion(db, item, authorId: null);   // version #1
            await db.SaveChangesAsync();
            return Results.Created($"/api/items/{item.Id}",
                new { item.Id, type = item.Type.ToString(), item.Title, item.CurrentVersion });
        });

        g.MapPatch("/items/{itemId:guid}", async (Guid itemId, UpdateItemRequest req, AtriumDbContext db) =>
        {
            var item = await db.Items.Include(i => i.Blocks).FirstOrDefaultAsync(i => i.Id == itemId);
            if (item is null) return Results.NotFound();
            if (!ValidJsonOrNull(req.FieldsJson, out var ferr))
                return Results.BadRequest(new { error = ferr });

            if (req.Title is not null) item.Title = req.Title;
            if (req.FieldsJson is not null) item.FieldsJson = req.FieldsJson;

            item.CurrentVersion += 1;
            item.UpdatedAt = DateTime.UtcNow;
            Versioning.WriteVersion(db, item, null);
            await db.SaveChangesAsync();
            return Results.Ok(new { item.Id, item.Title, item.CurrentVersion, item.UpdatedAt });
        });

        g.MapDelete("/items/{itemId:guid}", async (Guid itemId, AtriumDbContext db) =>
        {
            var item = await db.Items.FirstOrDefaultAsync(i => i.Id == itemId);
            if (item is null) return Results.NotFound();
            item.DeletedAt = DateTime.UtcNow;     // soft delete (hidden by the query filter)
            item.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---------------- Blocks ----------------
        // Replace the whole block tree — the page-editor "save".
        g.MapPut("/items/{itemId:guid}/blocks", async (Guid itemId, ReplaceBlocksRequest req, AtriumDbContext db) =>
        {
            var item = await db.Items.Include(i => i.Blocks).FirstOrDefaultAsync(i => i.Id == itemId);
            if (item is null) return Results.NotFound();

            foreach (var bi in req.Blocks)
            {
                if (!TryParseBlockType(bi.Type, out _))
                    return Results.BadRequest(new { error = $"invalid block type '{bi.Type}'" });
                if (!ValidJsonOrNull(bi.ContentJson, out var berr))
                    return Results.BadRequest(new { error = berr });
            }

            db.Blocks.RemoveRange(item.Blocks);
            item.Blocks.Clear();
            foreach (var bi in req.Blocks)
            {
                TryParseBlockType(bi.Type, out var bt);
                item.Blocks.Add(new Block
                {
                    TenantId = item.TenantId, Type = bt, Position = bi.Position,
                    ContentJson = bi.ContentJson, ParentBlockId = bi.ParentBlockId
                });
            }

            item.CurrentVersion += 1;
            item.UpdatedAt = DateTime.UtcNow;
            Versioning.WriteVersion(db, item, null);
            await db.SaveChangesAsync();
            return Results.Ok(new { item.Id, item.CurrentVersion, blockCount = item.Blocks.Count });
        });

        // Append a single block.
        g.MapPost("/items/{itemId:guid}/blocks", async (Guid itemId, CreateBlockRequest req, AtriumDbContext db) =>
        {
            var item = await db.Items.Include(i => i.Blocks).FirstOrDefaultAsync(i => i.Id == itemId);
            if (item is null) return Results.NotFound();
            if (!TryParseBlockType(req.Type, out var bt))
                return Results.BadRequest(new { error = $"invalid block type '{req.Type}'" });
            if (!ValidJsonOrNull(req.ContentJson, out var berr))
                return Results.BadRequest(new { error = berr });

            var pos = req.Position ?? (item.Blocks.Count == 0 ? 0 : item.Blocks.Max(b => b.Position) + 1);
            var block = new Block
            {
                TenantId = item.TenantId, ItemId = item.Id, Type = bt,
                Position = pos, ContentJson = req.ContentJson, ParentBlockId = req.ParentBlockId
            };
            item.Blocks.Add(block);

            item.CurrentVersion += 1;
            item.UpdatedAt = DateTime.UtcNow;
            Versioning.WriteVersion(db, item, null);
            await db.SaveChangesAsync();
            return Results.Created($"/api/items/{item.Id}",
                new { block.Id, type = block.Type.ToString(), block.Position });
        });

        g.MapPatch("/blocks/{blockId:guid}", async (Guid blockId, UpdateBlockRequest req, AtriumDbContext db) =>
        {
            var item = await db.Items.Include(i => i.Blocks)
                .FirstOrDefaultAsync(i => i.Blocks.Any(b => b.Id == blockId));
            if (item is null) return Results.NotFound();
            var block = item.Blocks.First(b => b.Id == blockId);

            if (!ValidJsonOrNull(req.ContentJson, out var berr))
                return Results.BadRequest(new { error = berr });
            if (req.Type is not null)
            {
                if (!TryParseBlockType(req.Type, out var bt))
                    return Results.BadRequest(new { error = $"invalid block type '{req.Type}'" });
                block.Type = bt;
            }
            if (req.Position.HasValue) block.Position = req.Position.Value;
            if (req.ContentJson is not null) block.ContentJson = req.ContentJson;
            block.UpdatedAt = DateTime.UtcNow;

            item.CurrentVersion += 1;
            item.UpdatedAt = DateTime.UtcNow;
            Versioning.WriteVersion(db, item, null);
            await db.SaveChangesAsync();
            return Results.Ok(new { block.Id, type = block.Type.ToString(), block.Position });
        });

        g.MapDelete("/blocks/{blockId:guid}", async (Guid blockId, AtriumDbContext db) =>
        {
            var item = await db.Items.Include(i => i.Blocks)
                .FirstOrDefaultAsync(i => i.Blocks.Any(b => b.Id == blockId));
            if (item is null) return Results.NotFound();
            var block = item.Blocks.First(b => b.Id == blockId);

            item.Blocks.Remove(block);
            db.Blocks.Remove(block);

            item.CurrentVersion += 1;
            item.UpdatedAt = DateTime.UtcNow;
            Versioning.WriteVersion(db, item, null);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---------------- Version history ----------------
        g.MapGet("/items/{itemId:guid}/versions", async (Guid itemId, AtriumDbContext db) =>
            await db.ItemVersions.Where(v => v.ItemId == itemId)
                .OrderByDescending(v => v.VersionNumber)
                .Select(v => new { v.VersionNumber, v.Title, v.AuthorId, v.CreatedAt })
                .ToListAsync());

        g.MapGet("/items/{itemId:guid}/versions/{n:int}", async (Guid itemId, int n, AtriumDbContext db) =>
        {
            var v = await db.ItemVersions.FirstOrDefaultAsync(x => x.ItemId == itemId && x.VersionNumber == n);
            return v is null
                ? Results.NotFound()
                : Results.Ok(new { v.VersionNumber, v.Title, v.CreatedAt, snapshot = v.SnapshotJson });
        });

        return g;
    }

    // ---------------- helpers ----------------
    private static async Task<Tenant> ResolveTenantAsync(HttpContext ctx, AtriumDbContext db)
    {
        // Pre-auth shim: tenant comes from a header (default "demo"). Replaced by
        // the authenticated token + tenant middleware once Keycloak lands.
        var slug = ctx.Request.Headers["X-Tenant-Slug"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(slug)) slug = "demo";

        var t = await db.Tenants.FirstOrDefaultAsync(x => x.Slug == slug);
        if (t is null)
        {
            t = new Tenant { Name = slug, Slug = slug };
            db.Tenants.Add(t);
            await db.SaveChangesAsync();
        }
        return t;
    }

    private static string Slugify(string s)
    {
        var cleaned = Regex.Replace(s.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrEmpty(cleaned) ? "untitled" : cleaned;
    }

    private static bool TryParseItemType(string? s, out ItemType t)
    {
        if (string.IsNullOrWhiteSpace(s)) { t = ItemType.Page; return true; }
        return Enum.TryParse(s, ignoreCase: true, out t);
    }

    private static bool TryParseBlockType(string? s, out BlockType t)
    {
        t = default;
        return !string.IsNullOrWhiteSpace(s) && Enum.TryParse(s, ignoreCase: true, out t);
    }

    private static bool ValidJsonOrNull(string? json, out string error)
    {
        error = "";
        if (string.IsNullOrWhiteSpace(json)) return true;
        try { using var _ = JsonDocument.Parse(json); return true; }
        catch (JsonException ex) { error = $"invalid JSON: {ex.Message}"; return false; }
    }
}

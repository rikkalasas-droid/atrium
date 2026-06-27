using System.Text;
using Atrium.Api.Data;
using Atrium.Api.Domain;
using Atrium.Api.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Atrium.Api.Endpoints;

// =====================================================================================
//  STORAGE / FILE ENDPOINTS  (signed-URL upload + download, admin status + self-test)
//
//  WIRING NOTE — this file creates/reads `StoredFile` rows and assumes this shape from
//  your data layer. Align the property names with your actual StoredFile entity:
//      Guid Id, Guid TenantId, Guid? ItemId, Guid? BlockId,
//      string FileName, string ContentType, long Size, string StorageKey,
//      string? ContentHash, string Status ("Pending"|"Available"),
//      DateTime CreatedAt, DateTime UpdatedAt, DateTime? DeletedAt
//  The storage PROVIDER layer (Storage/*) has no such dependency and is final as-is.
// =====================================================================================
public static class FileEndpoints
{
    public static RouteGroupBuilder MapStorageEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api");

        // 1) Ask for a direct-to-cloud upload URL. The browser then PUTs bytes straight
        //    to the customer's storage — they never touch the Atrium server.
        g.MapPost("/files/upload-url", async (
            UploadUrlRequest req, HttpContext ctx, AtriumDbContext db,
            IStorageProvider storage, IOptions<StorageOptions> opt) =>
        {
            if (string.IsNullOrWhiteSpace(req.FileName))
                return Results.BadRequest(new { error = "fileName is required" });

            var tenant = await ResolveTenantAsync(ctx, db);
            var safeName = SanitizeFileName(req.FileName);
            var key = $"files/{tenant.Id}/{Guid.NewGuid()}/{safeName}";
            var contentType = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType;

            var signed = await storage.CreateUploadUrlAsync(key, contentType, opt.Value.SignedUrlTtl);
            return Results.Ok(new
            {
                key,
                uploadUrl = signed.Url,
                method = signed.Method,
                headers = signed.Headers,
                expiresAt = signed.ExpiresAt,
            });
        });

        // 2) Confirm the upload landed → record a StoredFile (verified to exist in the bucket).
        g.MapPost("/files", async (
            ConfirmUploadRequest req, HttpContext ctx, AtriumDbContext db, IStorageProvider storage) =>
        {
            if (string.IsNullOrWhiteSpace(req.Key) || string.IsNullOrWhiteSpace(req.FileName))
                return Results.BadRequest(new { error = "key and fileName are required" });

            if (!await storage.ExistsAsync(req.Key))
                return Results.BadRequest(new { error = "no object found at key — was the upload completed?" });

            var tenant = await ResolveTenantAsync(ctx, db);
            var file = new StoredFile
            {
                TenantId = tenant.Id,
                ItemId = req.ItemId,
                BlockId = req.BlockId,
                FileName = req.FileName,
                StorageProvider = storage.Name,
                ContentType = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType,
                SizeBytes = req.Size,
                StorageKey = req.Key,
                Checksum = req.ContentHash,
                Status = "Available",
            };
            db.StoredFiles.Add(file);
            await db.SaveChangesAsync();
            return Results.Created($"/api/files/{file.Id}",
                new { file.Id, file.FileName, Size = file.SizeBytes, file.ContentType });
        });

        // 3) Get a short-lived download URL (direct from cloud, with a friendly filename).
        g.MapGet("/files/{fileId:guid}/download-url", async (
            Guid fileId, AtriumDbContext db, IStorageProvider storage, IOptions<StorageOptions> opt) =>
        {
            var file = await db.StoredFiles.FirstOrDefaultAsync(f => f.Id == fileId);
            if (file is null) return Results.NotFound();

            var signed = await storage.CreateDownloadUrlAsync(file.StorageKey, opt.Value.SignedUrlTtl, file.FileName);
            return Results.Ok(new { downloadUrl = signed.Url, expiresAt = signed.ExpiresAt, file.FileName });
        });

        // 4) Delete: remove from the bucket, then drop the row.
        g.MapDelete("/files/{fileId:guid}", async (
            Guid fileId, AtriumDbContext db, IStorageProvider storage) =>
        {
            var file = await db.StoredFiles.FirstOrDefaultAsync(f => f.Id == fileId);
            if (file is null) return Results.NotFound();

            await storage.DeleteAsync(file.StorageKey);
            db.StoredFiles.Remove(file);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // 5) Server-mediated UPLOAD (multipart). The signed-URL path (1+2) is the
        //    production "bytes bypass the server" route; this is the path the UI uses
        //    so uploads work even when the cloud endpoint isn't browser-reachable
        //    (e.g. in-stack MinIO on dev). Bytes stream API -> storage.
        g.MapPost("/files/direct", async (HttpRequest request, HttpContext ctx, AtriumDbContext db, IStorageProvider storage) =>
        {
            if (!request.HasFormContentType) return Results.BadRequest(new { error = "expected multipart/form-data" });
            var form = await request.ReadFormAsync();
            var f = form.Files["file"];
            if (f is null || f.Length == 0) return Results.BadRequest(new { error = "no file part named 'file'" });

            var tenant = await ResolveTenantAsync(ctx, db);
            var safe = SanitizeFileName(f.FileName);
            var key = $"files/{tenant.Id}/{Guid.NewGuid()}/{safe}";
            var contentType = string.IsNullOrWhiteSpace(f.ContentType) ? "application/octet-stream" : f.ContentType;
            await using (var s = f.OpenReadStream())
                await storage.PutAsync(key, s, contentType);

            Guid? itemId = Guid.TryParse(form["itemId"], out var iid) ? iid : null;
            Guid? blockId = Guid.TryParse(form["blockId"], out var bid) ? bid : null;
            var file = new StoredFile
            {
                TenantId = tenant.Id, ItemId = itemId, BlockId = blockId,
                FileName = safe, StorageProvider = storage.Name, ContentType = contentType,
                SizeBytes = f.Length, StorageKey = key, Status = "Available",
            };
            db.StoredFiles.Add(file);
            await db.SaveChangesAsync();
            return Results.Ok(new { file.Id, file.FileName, Size = file.SizeBytes, file.ContentType });
        }).DisableAntiforgery();

        // 6) Server-mediated DOWNLOAD — streams bytes through the API with a friendly
        //    filename. Pairs with /files/direct for environments where presigned cloud
        //    URLs aren't browser-reachable. (download-url remains the direct-cloud route.)
        g.MapGet("/files/{fileId:guid}/raw", async (Guid fileId, AtriumDbContext db, IStorageProvider storage) =>
        {
            var file = await db.StoredFiles.FirstOrDefaultAsync(f => f.Id == fileId);
            if (file is null) return Results.NotFound();
            var stream = await storage.GetAsync(file.StorageKey);
            return Results.File(stream, file.ContentType, file.FileName);
        });

        // --- admin: which backend is configured (no secrets) ---
        g.MapGet("/admin/storage", (IStorageProvider storage, IOptions<StorageOptions> opt) =>
            Results.Ok(new
            {
                provider = storage.Name,
                configuredProvider = opt.Value.Provider,
                bucket = opt.Value.Bucket,
                signedUrlTtlSeconds = opt.Value.SignedUrlTtlSeconds,
                configured = !string.IsNullOrWhiteSpace(opt.Value.Bucket),
            }));

        // --- admin: live connection self-test (put → exists → get → delete) ---
        //     Run this against the MinIO already in your stack to prove the whole path.
        g.MapPost("/admin/storage/test", async (IStorageProvider storage) =>
        {
            var key = $"_atrium-selftest/{Guid.NewGuid():N}.txt";
            var payload = "atrium storage self-test";
            var steps = new List<object>();
            try
            {
                using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(payload)))
                    await storage.PutAsync(key, ms, "text/plain");
                steps.Add(new { step = "put", ok = true });

                var exists = await storage.ExistsAsync(key);
                steps.Add(new { step = "exists", ok = exists });

                string readBack;
                await using (var s = await storage.GetAsync(key))
                using (var r = new StreamReader(s))
                    readBack = await r.ReadToEndAsync();
                steps.Add(new { step = "get", ok = readBack == payload });

                await storage.DeleteAsync(key);
                steps.Add(new { step = "delete", ok = true });

                var gone = !await storage.ExistsAsync(key);
                steps.Add(new { step = "verify-deleted", ok = gone });

                var ok = readBack == payload && exists && gone;
                return Results.Ok(new { ok, provider = storage.Name, steps });
            }
            catch (Exception ex)
            {
                return Results.Json(new { ok = false, provider = storage.Name, steps, error = ex.Message }, statusCode: 500);
            }
        });

        return g;
    }

    private static async Task<Tenant> ResolveTenantAsync(HttpContext ctx, AtriumDbContext db)
    {
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

    private static string SanitizeFileName(string name)
    {
        var trimmed = name.Replace("\\", "/");
        trimmed = trimmed[(trimmed.LastIndexOf('/') + 1)..];           // drop any path
        foreach (var c in Path.GetInvalidFileNameChars())
            trimmed = trimmed.Replace(c, '_');
        return string.IsNullOrWhiteSpace(trimmed) ? "file" : trimmed;
    }
}

public record UploadUrlRequest(string FileName, string? ContentType, long Size, Guid? ItemId, Guid? BlockId);
public record ConfirmUploadRequest(string Key, string FileName, string? ContentType, long Size, string? ContentHash, Guid? ItemId, Guid? BlockId);

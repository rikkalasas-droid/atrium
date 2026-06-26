using Microsoft.Extensions.Options;

namespace Atrium.Api.Storage;

/// <summary>
/// Wires storage into DI. The provider is chosen ONCE from config; the rest of
/// the app only ever sees IStorageProvider. Adding a backend means adding one
/// case here and a new adapter class — the switch is the entire integration point.
/// </summary>
public static class StorageRegistration
{
    public static IServiceCollection AddAtriumStorage(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<StorageOptions>(config.GetSection(StorageOptions.SectionName));

        services.AddSingleton<IStorageProvider>(sp =>
        {
            var o = sp.GetRequiredService<IOptions<StorageOptions>>().Value;
            return o.Provider.Trim().ToLowerInvariant() switch
            {
                "s3" or "minio" => new S3StorageProvider(o),   // MinIO = S3 with Endpoint+ForcePathStyle
                "azure"         => new AzureBlobStorageProvider(o),
                "gcs"           => new GcsStorageProvider(o),
                _ => throw new InvalidOperationException(
                    $"Unknown storage provider '{o.Provider}'. Use s3 | minio | azure | gcs.")
            };
        });

        return services;
    }
}

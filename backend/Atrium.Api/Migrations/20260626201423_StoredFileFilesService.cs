using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atrium.Api.Migrations
{
    /// <inheritdoc />
    public partial class StoredFileFilesService : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "ItemId",
                table: "StoredFiles",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "BlockId",
                table: "StoredFiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FileName",
                table: "StoredFiles",
                type: "character varying(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "StoredFiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_StoredFiles_BlockId",
                table: "StoredFiles",
                column: "BlockId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StoredFiles_BlockId",
                table: "StoredFiles");

            migrationBuilder.DropColumn(
                name: "BlockId",
                table: "StoredFiles");

            migrationBuilder.DropColumn(
                name: "FileName",
                table: "StoredFiles");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "StoredFiles");

            migrationBuilder.AlterColumn<Guid>(
                name: "ItemId",
                table: "StoredFiles",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}

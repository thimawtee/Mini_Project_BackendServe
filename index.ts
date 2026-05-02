import { db } from "./db";
import fs from "fs";

// =============================================
// HELPER: Render halaman dengan layout utama
// =============================================
function render(
  content: string,
  activePage: string,
  pageTitle: string,
): string {
  let layout = fs.readFileSync("./views/layout/main.html", "utf8");

  // Tandai menu aktif di sidebar
  layout = layout.replace(
    "{{active_dashboard}}",
    activePage === "dashboard" ? "bg-gray-700" : "",
  );
  layout = layout.replace(
    "{{active_mahasiswa}}",
    activePage === "mahasiswa" ? "bg-gray-700" : "",
  );
  layout = layout.replace(
    "{{active_jurusan}}",
    activePage === "jurusan" ? "bg-gray-700" : "",
  );
  layout = layout.replace("{{page_title}}", pageTitle);
  layout = layout.replace("{{content}}", content);

  return layout;
}

// =============================================
// HELPER: Buat dropdown options jurusan
// =============================================
async function getJurusanOptions(selectedId?: string): Promise<string> {
  const [rows]: any = await db.query(
    "SELECT * FROM jurusan ORDER BY nama_jurusan",
  );

  let options = "";
  rows.forEach((j: any) => {
    const selected = String(j.id) === String(selectedId) ? "selected" : "";
    options += `<option value="${j.id}" ${selected}>${j.nama_jurusan}</option>`;
  });

  return options;
}

// =============================================
// SERVER BUN.JS
// =============================================
Bun.serve({
  port: 3000,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // ==========================================
    // DASHBOARD
    // ==========================================
    if (method === "GET" && path === "/") {
      // Ambil statistik
      const [totalMhs]: any = await db.query(
        "SELECT COUNT(*) as total FROM mahasiswa",
      );
      const [totalJrs]: any = await db.query(
        "SELECT COUNT(*) as total FROM jurusan",
      );

      // Ambil 5 data mahasiswa terbaru untuk preview
      const [recentRows]: any = await db.query(`
        SELECT mahasiswa.nama, jurusan.nama_jurusan, mahasiswa.angkatan
        FROM mahasiswa
        LEFT JOIN jurusan ON mahasiswa.jurusan_id = jurusan.id
        ORDER BY mahasiswa.id DESC
        LIMIT 5
      `);

      // Buat baris tabel preview
      let previewRows = "";
      if (recentRows.length === 0) {
        previewRows = `<tr><td colspan="3" class="p-4 text-center text-gray-400">Belum ada data</td></tr>`;
      } else {
        recentRows.forEach((m: any) => {
          previewRows += `
            <tr class="border-t hover:bg-gray-50">
              <td class="p-3">${m.nama}</td>
              <td class="p-3">${m.nama_jurusan || "-"}</td>
              <td class="p-3">${m.angkatan}</td>
            </tr>
          `;
        });
      }

      let view = fs.readFileSync("./views/dashboard/index.html", "utf8");
      view = view.replace("{{total_mahasiswa}}", totalMhs[0].total);
      view = view.replace("{{total_jurusan}}", totalJrs[0].total);
      view = view.replace("{{preview_rows}}", previewRows);

      return new Response(render(view, "dashboard", "Dashboard"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // ==========================================
    // MAHASISWA - LIST
    // ==========================================
    if (method === "GET" && path === "/mahasiswa") {
      // Query JOIN untuk tampilkan nama jurusan
      const [rows]: any = await db.query(`
        SELECT mahasiswa.id, mahasiswa.nama, jurusan.nama_jurusan, mahasiswa.angkatan
        FROM mahasiswa
        LEFT JOIN jurusan ON mahasiswa.jurusan_id = jurusan.id
        ORDER BY mahasiswa.id DESC
      `);

      let table = "";
      if (rows.length === 0) {
        table = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Belum ada data mahasiswa</td></tr>`;
      } else {
        rows.forEach((m: any) => {
          table += `
            <tr class="border-t hover:bg-gray-50 transition-colors">
              <td class="p-4 text-gray-500">${m.id}</td>
              <td class="p-4 font-medium">${m.nama}</td>
              <td class="p-4">${m.nama_jurusan || "-"}</td>
              <td class="p-4">${m.angkatan}</td>
              <td class="p-4">
                <a href="/mahasiswa/edit/${m.id}"
                   class="inline-block bg-yellow-400 hover:bg-yellow-500 text-white text-xs px-3 py-1 rounded mr-1 transition-colors">
                  Edit
                </a>
                <a href="/mahasiswa/delete/${m.id}"
                   class="inline-block bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded transition-colors"
                   onclick="return confirm('Yakin hapus data ini?')">
                  Hapus
                </a>
              </td>
            </tr>
          `;
        });
      }

      let view = fs.readFileSync("./views/mahasiswa/index.html", "utf8");
      view = view.replace("{{rows}}", table);

      return new Response(render(view, "mahasiswa", "Data Mahasiswa"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // ==========================================
    // MAHASISWA - FORM TAMBAH
    // ==========================================
    if (method === "GET" && path === "/mahasiswa/create") {
      const jurusanOptions = await getJurusanOptions();
      let view = fs.readFileSync("./views/mahasiswa/create.html", "utf8");
      view = view.replace("{{jurusan_options}}", jurusanOptions);

      return new Response(render(view, "mahasiswa", "Tambah Mahasiswa"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // ==========================================
    // MAHASISWA - SIMPAN DATA (POST)
    // ==========================================
    if (method === "POST" && path === "/mahasiswa/store") {
      const body = await req.formData();
      const nama = body.get("nama");
      const jurusan_id = body.get("jurusan_id");
      const angkatan = body.get("angkatan");

      if (!nama || !jurusan_id || !angkatan) {
        return new Response(
          render(
            `<div class="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
          Semua field wajib diisi!
          <br><a href="/mahasiswa/create" class="underline mt-2 inline-block">← Kembali</a>
        </div>`,
            "mahasiswa",
            "Error",
          ),
          { headers: { "Content-Type": "text/html" } },
        );
      }
      await db.query(
        "INSERT INTO mahasiswa (nama, jurusan_id, angkatan) VALUES (?, ?, ?)",
        [nama, jurusan_id, angkatan],
      );

      return Response.redirect("/mahasiswa", 302);
    }

    // ==========================================
    // MAHASISWA - FORM EDIT
    // ==========================================
    if (method === "GET" && path.startsWith("/mahasiswa/edit/")) {
      const id = path.split("/")[3];
      const [rows]: any = await db.query(
        "SELECT * FROM mahasiswa WHERE id = ?",
        [id],
      );

      if (rows.length === 0) {
        return new Response("Data tidak ditemukan", { status: 404 });
      }

      const mhs = rows[0];
      const jurusanOptions = await getJurusanOptions(String(mhs.jurusan_id));

      let view = fs.readFileSync("./views/mahasiswa/edit.html", "utf8");
      view = view.replace("{{id}}", mhs.id);
      view = view.replace("{{nama}}", mhs.nama);
      view = view.replace("{{angkatan}}", mhs.angkatan);
      view = view.replace("{{jurusan_options}}", jurusanOptions);

      return new Response(render(view, "mahasiswa", "Edit Mahasiswa"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // ==========================================
    // MAHASISWA - UPDATE DATA (POST)
    // ==========================================
    if (method === "POST" && path.startsWith("/mahasiswa/update/")) {
      const id = path.split("/")[3];
      const body = await req.formData();
      const nama = body.get("nama");
      const jurusan_id = body.get("jurusan_id");
      const angkatan = body.get("angkatan");

      await db.query(
        "UPDATE mahasiswa SET nama = ?, jurusan_id = ?, angkatan = ? WHERE id = ?",
        [nama, jurusan_id, angkatan, id],
      );

      return Response.redirect("/mahasiswa", 302);
    }

    // ==========================================
    // MAHASISWA - HAPUS DATA
    // ==========================================
    if (method === "GET" && path.startsWith("/mahasiswa/delete/")) {
      const id = path.split("/")[3];
      await db.query("DELETE FROM mahasiswa WHERE id = ?", [id]);
      return Response.redirect("/mahasiswa", 302);
    }

    // ==========================================
    // JURUSAN - LIST
    // ==========================================
    if (method === "GET" && path === "/jurusan") {
      const [rows]: any = await db.query(
        "SELECT * FROM jurusan ORDER BY id DESC",
      );

      let table = "";
      if (rows.length === 0) {
        table = `<tr><td colspan="3" class="p-6 text-center text-gray-400">Belum ada data jurusan</td></tr>`;
      } else {
        rows.forEach((j: any) => {
          table += `
            <tr class="border-t hover:bg-gray-50 transition-colors">
              <td class="p-4 text-gray-500">${j.id}</td>
              <td class="p-4 font-medium">${j.nama_jurusan}</td>
              <td class="p-4">
                <a href="/jurusan/edit/${j.id}"
                   class="inline-block bg-yellow-400 hover:bg-yellow-500 text-white text-xs px-3 py-1 rounded mr-1 transition-colors">
                  Edit
                </a>
                <a href="/jurusan/delete/${j.id}"
                   class="inline-block bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded transition-colors"
                   onclick="return confirm('Yakin hapus jurusan ini?')">
                  Hapus
                </a>
              </td>
            </tr>
          `;
        });
      }

      let view = fs.readFileSync("./views/jurusan/index.html", "utf8");
      view = view.replace("{{rows}}", table);

      return new Response(render(view, "jurusan", "Data Jurusan"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // ==========================================
    // JURUSAN - FORM TAMBAH
    // ==========================================
    if (method === "GET" && path === "/jurusan/create") {
      const view = fs.readFileSync("./views/jurusan/create.html", "utf8");
      return new Response(render(view, "jurusan", "Tambah Jurusan"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // ==========================================
    // JURUSAN - SIMPAN DATA (POST)
    // ==========================================
    if (method === "POST" && path === "/jurusan/store") {
      const body = await req.formData();
      const nama_jurusan = body.get("nama_jurusan");

      await db.query("INSERT INTO jurusan (nama_jurusan) VALUES (?)", [
        nama_jurusan,
      ]);

      return Response.redirect("/jurusan", 302);
    }

    // ==========================================
    // JURUSAN - FORM EDIT
    // ==========================================
    if (method === "GET" && path.startsWith("/jurusan/edit/")) {
      const id = path.split("/")[3];
      const [rows]: any = await db.query("SELECT * FROM jurusan WHERE id = ?", [
        id,
      ]);

      if (rows.length === 0) {
        return new Response("Data tidak ditemukan", { status: 404 });
      }

      const jrs = rows[0];
      let view = fs.readFileSync("./views/jurusan/edit.html", "utf8");
      view = view.replace("{{id}}", jrs.id);
      view = view.replace("{{nama_jurusan}}", jrs.nama_jurusan);

      return new Response(render(view, "jurusan", "Edit Jurusan"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // ==========================================
    // JURUSAN - UPDATE DATA (POST)
    // ==========================================
    if (method === "POST" && path.startsWith("/jurusan/update/")) {
      const id = path.split("/")[3];
      const body = await req.formData();
      const nama_jurusan = body.get("nama_jurusan");

      await db.query("UPDATE jurusan SET nama_jurusan = ? WHERE id = ?", [
        nama_jurusan,
        id,
      ]);

      return Response.redirect("/jurusan", 302);
    }

    // ==========================================
    // JURUSAN - HAPUS DATA
    // ==========================================
    if (method === "GET" && path.startsWith("/jurusan/delete/")) {
      const id = path.split("/")[3];
      // Cek apakah jurusan masih dipakai mahasiswa
      const [check]: any = await db.query(
        "SELECT COUNT(*) as total FROM mahasiswa WHERE jurusan_id = ?",
        [id],
      );
      if (check[0].total > 0) {
        return new Response(
          render(
            `<div class="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
              <strong>Tidak bisa dihapus!</strong> Jurusan ini masih digunakan oleh ${check[0].total} mahasiswa.
              <br><a href="/jurusan" class="underline mt-2 inline-block">← Kembali</a>
            </div>`,
            "jurusan",
            "Error",
          ),
          { headers: { "Content-Type": "text/html" } },
        );
      }

      await db.query("DELETE FROM jurusan WHERE id = ?", [id]);
      return Response.redirect("/jurusan", 302);
    }

    // 404 - Halaman tidak ditemukan
    return new Response(
      render(
        `<div class="text-center py-20">
          <p class="text-6xl mb-4">🔍</p>
          <h2 class="text-2xl font-bold text-gray-700">Halaman tidak ditemukan</h2>
          <a href="/" class="text-blue-500 hover:underline mt-4 inline-block">← Kembali ke Dashboard</a>
        </div>`,
        "",
        "404 Not Found",
      ),
      { status: 404, headers: { "Content-Type": "text/html" } },
    );
  },
});

console.log("✅ Server Bun.js berjalan di http://localhost:3000");

# WhatsApp hasil Shield melalui Fonnte

Hanya satu pesan untuk setiap pesanan: setelah pembayaran terverifikasi dan admin
selesai mengunggah/mengonfirmasi laporan PDF. Pembayaran saja, pesanan baru,
top-up, pembelian paket, serta laporan lama tidak mengirim pesan.

## Konfigurasi

1. Sambungkan nomor WhatsApp di menu Device Fonnte. Simpan **device token** sebagai
   `FONNTE_TOKEN` pada server lokal dan environment Production Vercel. Jangan
   gunakan account token, variabel `NEXT_PUBLIC_*`, atau menaruh token di Git.
2. Terapkan migrasi `20261124014337_shield-whatsapp-notifications.sql` setelah
   diuji pada backend branch. Tabel dan RPC hanya dapat diakses server admin.
3. Atur `WHATSAPP_PUBLIC_URL=https://www.gleans.my.id` (atau gunakan
   `DUITKU_PUBLIC_URL` yang sudah ada) dan `CRON_SECRET` acak minimal 32 karakter.
4. Deploy kode. Setelah konfirmasi laporan, server langsung mencoba mengirim pesan
   setelah respons berhasil dikembalikan ke admin. Untuk pemulihan kegagalan,
   jadwalkan GET `/api/cron/whatsapp` setiap menit dengan header
   `Authorization: Bearer <CRON_SECRET>`. Pada InsForge, simpan secret lalu gunakan
   referensi `${{secrets.CRON_SECRET}}` pada header jadwal. Jadwal tidak otomatis
   dibuat oleh kode ini. Jangan arahkan jadwal produksi ke localhost.
5. Verifikasi satu pesanan uji yang dibayar lalu diselesaikan. Periksa Fonnte
   Message History dan tabel `shield_whatsapp_notifications`.

Pesan menggunakan template admin dengan nama pelanggan/file, skor AI yang diisi
admin saat mengunggah laporan, tautan halaman detail pesanan, dan promo cek ulang.
`{link_hasil}` berisi tautan unduh bertanda tangan yang dapat dibuka dari WhatsApp
di perangkat lain. URL dibuat saat pengiriman, hanya untuk file laporan tersebut,
dan kedaluwarsa paling lambat pada batas unduh laporan (maksimal 24 jam). Tautan
ini memberikan akses bagi pemegang tautan, jadi tidak dicatat pada log endpoint.
Alias lama `{tautan_hasil}` tetap menuju halaman detail pesanan yang memerlukan
browser pemesan, akun pemilik, atau kode akses pesanan.

## Mengedit template di admin

Halaman utama menampilkan **Riwayat template** dengan nama, cuplikan pesan, status
aktif, serta ikon pensil untuk **Edit**, tangan untuk **Gunakan**, dan tempat sampah
untuk **Hapus**. Hapus meminta konfirmasi; template aktif harus diganti sebelum
dapat dihapus. Pesan semula tersimpan sebagai
**Template 1 — Hasil & Promo**; tersedia pula **Template 2 — Hasil Tanpa Promo** dan
template lengkap yang ditambahkan admin. Tombol **Gunakan** menetapkan template
untuk pengiriman berikutnya tanpa mengirim pesan uji.

**Edit** membuka popup nama, isi pesan, promo, dan pratinjau. **Template baru**
membuka popup yang sama untuk membuat template bernama, maksimal 20 template.
Nama harus unik. **Simpan perubahan** / **Simpan template** menyimpan lalu menutup
popup. **Batal** atau menutup popup membuang perubahan yang belum disimpan.
Menyimpan perubahan pada template aktif langsung memperbarui pesan aktif.
Variabel pesan tetap satu baris yang bisa digeser horizontal di dalam popup.

Migrasi `20261124023319_whatsapp-template-library.sql` menambahkan pustaka template
server-only. Penyimpanan dan pemilihan aktif dilakukan dalam satu transaksi dengan
revisi global. Pembacaan pustaka memakai satu snapshot agar pilihan aktif, isi, dan
revisi konsisten. Isi pesan lama serta promo terpilih dipertahankan selama migrasi.

Buka **Pengaturan → Notifikasi**. Editor menyediakan variabel `{nama}`, `{nama_file}`,
`{skor_ai}`, `{link_hasil}`, `{diskon}`, `{kode_promo}`, `{masa_berlaku}`, `{invoice}`,
dan `{batas_unduh}` dengan pratinjau langsung. Alias lama `{dokumen}` dan
`{tautan_hasil}` tetap didukung. Salah satu `{link_hasil}`/`{tautan_hasil}` wajib ada. Simpan template untuk
memakainya pada pengiriman berikutnya; pratinjau serta penyimpanan tidak mengirim
pesan uji. Menyimpan template tidak mengubah pilihan aktif kecuali template tersebut sedang dipakai.

Terapkan juga migrasi `20261124020811_whatsapp-message-template.sql`. Template
disimpan server-side, tidak di localStorage atau di dashboard Fonnte. Pembaruan
memeriksa revisi untuk mencegah penyunting lain tertimpa dan dicatat pada aktivitas
admin. Jika template gagal dimuat, worker menunda pengiriman tanpa mengklaim antrean.

Migrasi `20261124022011_whatsapp-score-promo.sql` menyimpan skor AI 0–100 (maksimal
dua desimal) pada pesanan dan pilihan promo pada pengaturan. Skor wajib diisi saat
admin mengonfirmasi laporan baru, dan tidak dapat diubah setelah laporan terbit.
Tidak ada skor rekaan untuk laporan lama yang belum memiliki skor.

Promo awal yang dipilih pengguna: HEMAT5RIBU. Persentase, kode, dan tanggal akhir
diambil dari promo aktif, bukan angka tetap dalam pesan. Editor hanya menawarkan
promo persentase aktif. Jika template memuat variabel promo tetapi promo terpilih
dinonaktifkan/kedaluwarsa, pengiriman ditunda sampai admin memilih promo valid;
operator dapat menghapus paragraf promo dari template jika tidak ingin menawarkan
promo lagi. Tidak ada kode atau potongan harga baru yang dibuat oleh integrasi ini.

## Pengiriman dan pemulihan

Laporan dan entri antrean dibuat dalam transaksi database yang sama. Worker
mengambil maksimal lima pesan dengan lock dan token klaim untuk mencegah dua
worker mengirim entri yang sama. Tidak ada panggilan Fonnte di transaksi pembayaran.

Penolakan yang pasti dari Fonnte dicoba ulang dengan jeda bertambah, maksimal
lima percobaan. Nomor tidak valid langsung `failed`, hasil kedaluwarsa `skipped`.
`accepted` berarti Fonnte menerima permintaan, bukan bukti pesan sudah dibaca
atau terkirim ke WhatsApp. Respons timeout/tidak dapat dipastikan dan worker
terputus menjadi `uncertain`; tidak dikirim ulang otomatis untuk menghindari
pesan ganda. Operator harus memeriksa Message History sebelum mencoba kembali.

Untuk melihat jumlah status tanpa data pelanggan:

```sql
SELECT state,count(*) FROM public.shield_whatsapp_notifications GROUP BY state;
```

Endpoint hanya mengembalikan jumlah dan status umum, tanpa token, nomor tujuan,
nama dokumen, isi pesan, atau respons mentah Fonnte. Konfigurasi token, migrasi,
deployment, serta jadwal harus diverifikasi sebelum menyatakan integrasi aktif.

Referensi: [Send API](https://docs.fonnte.com/api-send-message/),
[Device Profile](https://docs.fonnte.com/api-device-profile/).

## Sakelar notifikasi

Kartu **Hubungkan Fonnte** memiliki sakelar **Aktif/Nonaktif** yang disimpan di
server. Migrasi `20261124074337_whatsapp-notification-controls.sql` mempertahankan
pengiriman aktif secara default. Saat dimatikan, laporan baru tidak masuk antrean,
antrean pending ditandai skipped, dan worker tidak mengambil pesan. Worker juga
memeriksa kembali sakelar sebelum mengirim setiap pesan yang sudah diklaim.
Pesan yang sudah diserahkan ke Fonnte tidak dapat ditarik kembali. Mengaktifkan
kembali tidak mengirim tumpukan pesan lama; hanya laporan berikutnya yang dikirim.
Penggantian sakelar dan penghapusan template memerlukan admin, origin yang sama,
serta revisi terkini, dan tercatat pada aktivitas admin.

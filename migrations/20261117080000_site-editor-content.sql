CREATE TABLE public.site_articles (
  id text PRIMARY KEY,
  record jsonb NOT NULL,
  slug text GENERATED ALWAYS AS (record->>'slug') STORED UNIQUE NOT NULL,
  status text GENERATED ALWAYS AS (record->>'status') STORED NOT NULL CHECK (status IN ('Draft', 'Terbit', 'Terjadwal', 'Arsip')),
  publish_at timestamptz,
  edited_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_articles_publication ON public.site_articles (publish_at DESC) WHERE status IN ('Terbit', 'Terjadwal');

CREATE TABLE public.site_promotions (
  id text PRIMARY KEY,
  record jsonb NOT NULL,
  kind text GENERATED ALWAYS AS (record->>'type') STORED NOT NULL CHECK (kind IN ('Banner', 'Popup', 'Kode promo')),
  code text GENERATED ALWAYS AS (NULLIF(record->>'code', '')) STORED UNIQUE,
  active boolean GENERATED ALWAYS AS ((record->>'active')::boolean) STORED NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  edited_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_promotions_active_period ON public.site_promotions (kind, starts_on, ends_on) WHERE active;

CREATE TABLE public.site_media (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  url text NOT NULL,
  bytes integer NOT NULL CHECK (bytes > 0),
  edited_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_editor_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  object text NOT NULL
);

ALTER TABLE public.site_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_editor_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_articles, public.site_promotions, public.site_media, public.site_editor_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.site_articles, public.site_promotions TO project_admin;
GRANT SELECT, INSERT ON public.site_media, public.site_editor_activity TO project_admin;

INSERT INTO public.site_articles (id, record, publish_at, edited_by) VALUES ('article-cara-menulis-sitasi-apa-7', '{"id":"article-cara-menulis-sitasi-apa-7","slug":"cara-menulis-sitasi-apa-7","title":"Cara Menulis Sitasi APA 7 untuk Jurnal, Buku, dan Website","summary":"Panduan singkat format APA edisi ketujuh lengkap dengan contoh, plus cara membuatnya otomatis dari DOI.","content":"APA 7 adalah gaya sitasi yang paling banyak dipakai di bidang sosial, psikologi, pendidikan, dan kesehatan. Berikut format dasarnya.\n\n## Artikel jurnal\n\nFormat: Penulis, A. A., & Penulis, B. B. (Tahun). Judul artikel. *Nama Jurnal*, *volume*(nomor), halaman. https://doi.org/xxxx\n\nHal yang sering terlewat:\n\n1. Judul artikel hanya huruf kapital di awal kalimat dan nama diri.\n2. Nama jurnal dan nomor volume ditulis miring.\n3. DOI ditulis sebagai tautan lengkap, tanpa kata \"doi:\".\n\n## Buku\n\nFormat: Penulis, A. A. (Tahun). *Judul buku* (edisi). Penerbit.\n\nDi APA 7, lokasi penerbit **tidak perlu** ditulis lagi.\n\n## Website\n\nFormat: Penulis atau Organisasi. (Tahun, Tanggal Bulan). *Judul halaman*. Nama Situs. URL\n\n## Buat otomatis\n\nDaripada mengetik manual, masukkan DOI atau judul artikel di [Gleans Cite](/sitasi). Hasilnya langsung dalam format APA 7 atau IEEE dan bisa disalin ke daftar pustaka.","author":"Tim Gleans","category":"Tutorial","coverId":"","coverAlt":"","featured":false,"status":"Terbit","publishAt":"2026-09-18T00:00:00.000Z"}', '2026-09-18T00:00:00.000Z', 'Tim Gleans');
INSERT INTO public.site_articles (id, record, publish_at, edited_by) VALUES ('article-memahami-hasil-deteksi-ai', '{"id":"article-memahami-hasil-deteksi-ai","slug":"memahami-hasil-deteksi-ai","title":"Memahami Hasil Deteksi AI dari GPTZero","summary":"Apa arti skor AI, campuran, dan manusia? Pelajari cara membaca laporan deteksi AI dan apa yang perlu dilakukan setelahnya.","content":"Banyak kampus mulai memeriksa apakah tugas mahasiswa ditulis dengan bantuan AI. Gleans Shield memakai GPTZero untuk membantumu mengecek dokumen sebelum dikumpulkan.\n\n## Tiga kategori utama\n\n- **Manusia**: pola tulisan cenderung bervariasi dan tidak mudah ditebak.\n- **Campuran**: sebagian kalimat terdeteksi mirip tulisan AI.\n- **AI**: sebagian besar teks memiliki pola khas model bahasa.\n\n## Kalimat yang disorot\n\nLaporan Gleans menandai kalimat yang paling berpengaruh terhadap skor. Fokuskan revisi pada kalimat tersebut: tambahkan contoh spesifik, data, atau sudut pandangmu sendiri.\n\n## Skor bukan vonis\n\nDetektor AI bekerja berdasarkan probabilitas, jadi hasilnya bisa keliru, terutama untuk teks pendek atau bahasa selain Inggris. Gunakan hasilnya sebagai bahan refleksi, bukan satu-satunya penentu.\n\n## Privasi dokumen\n\nTeks dokumen diekstrak di browsermu dan laporan dihapus otomatis setelah 24 jam. Unduh laporanmu lewat halaman [Cek Pesanan](/cek-pesanan) sebelum masa berlakunya habis.","author":"Tim Gleans","category":"Edukasi","coverId":"","coverAlt":"","featured":false,"status":"Terbit","publishAt":"2026-09-15T00:00:00.000Z"}', '2026-09-15T00:00:00.000Z', 'Tim Gleans');
INSERT INTO public.site_articles (id, record, publish_at, edited_by) VALUES ('article-parafrase-yang-etis', '{"id":"article-parafrase-yang-etis","slug":"parafrase-yang-etis","title":"Parafrase yang Etis, Bukan Sekadar Ganti Kata","summary":"Parafrase yang baik memahami ide sumber lalu menuliskannya ulang dengan gaya sendiri. Ini langkah-langkahnya.","content":"Parafrase adalah menuliskan kembali gagasan orang lain dengan kata-katamu sendiri, **tetap disertai sitasi**. Mengganti beberapa kata dengan sinonim saja belum cukup.\n\n## Langkah parafrase\n\n1. Baca sumber sampai benar-benar paham maksudnya.\n2. Tutup sumbernya, lalu tulis ulang ide tersebut dari ingatan.\n3. Bandingkan dengan sumber asli: pastikan maknanya sama, tapi struktur kalimatnya berbeda.\n4. Cantumkan sitasi.\n\n## Peran alat bantu\n\n[Gleans Writer](/parafrase) membantu memberi variasi kata dan struktur kalimat. Anggap hasilnya sebagai draf awal, lalu sesuaikan agar sesuai dengan gaya tulisan dan konteks penelitianmu.","author":"Tim Gleans","category":"Tips & Trik","coverId":"","coverAlt":"","featured":false,"status":"Terbit","publishAt":"2026-09-10T00:00:00.000Z"}', '2026-09-10T00:00:00.000Z', 'Tim Gleans');
INSERT INTO public.site_articles (id, record, publish_at, edited_by) VALUES ('article-perbedaan-apa-dan-ieee', '{"id":"article-perbedaan-apa-dan-ieee","slug":"perbedaan-apa-dan-ieee","title":"Perbedaan Gaya Sitasi APA dan IEEE","summary":"Kapan memakai APA dan kapan memakai IEEE? Kenali perbedaan cara mengutip di dalam teks dan menyusun daftar pustaka.","content":"APA dan IEEE sama-sama gaya sitasi populer, tetapi dipakai di bidang yang berbeda.\n\n## APA (American Psychological Association)\n\n- Umum di ilmu sosial, pendidikan, psikologi, dan kesehatan.\n- Kutipan dalam teks memakai nama dan tahun, misalnya (Santoso, 2024).\n- Daftar pustaka diurutkan berdasarkan abjad nama penulis.\n\n## IEEE (Institute of Electrical and Electronics Engineers)\n\n- Umum di teknik, ilmu komputer, dan teknologi informasi.\n- Kutipan dalam teks memakai nomor dalam kurung siku, misalnya [1].\n- Daftar pustaka diurutkan sesuai urutan kemunculan di teks.\n\n## Mana yang harus dipakai?\n\nIkuti pedoman penulisan dari kampus atau jurnal tujuanmu. Di [Gleans Cite](/sitasi), kamu bisa berpindah antara APA dan IEEE dengan satu klik.","author":"Tim Gleans","category":"Edukasi","coverId":"","coverAlt":"","featured":false,"status":"Terbit","publishAt":"2026-09-05T00:00:00.000Z"}', '2026-09-05T00:00:00.000Z', 'Tim Gleans');
INSERT INTO public.site_articles (id, record, publish_at, edited_by) VALUES ('article-persiapan-sidang-skripsi', '{"id":"article-persiapan-sidang-skripsi","slug":"persiapan-sidang-skripsi","title":"Checklist Persiapan Sidang Skripsi","summary":"Dari merapikan daftar pustaka sampai latihan presentasi, ini daftar hal yang perlu kamu siapkan menjelang sidang.","content":"Sidang skripsi adalah garis finis yang menegangkan. Persiapan yang rapi akan membuatmu jauh lebih tenang.\n\n## Dokumen\n\n- Naskah final sudah disetujui pembimbing.\n- Daftar pustaka konsisten dalam satu gaya sitasi.\n- Dokumen sudah dicek dengan [Gleans Shield](/deteksi-ai) sebelum dikumpulkan.\n\n## Presentasi\n\n- Slide maksimal 15 halaman, fokus pada latar belakang, metode, hasil, dan kesimpulan.\n- Latihan dengan waktu, idealnya 10 sampai 15 menit.\n- Siapkan jawaban untuk pertanyaan tentang keterbatasan penelitian.\n\n## Hari H\n\nDatang lebih awal, bawa salinan naskah, dan tarik napas. Kamu yang paling paham penelitianmu sendiri.","author":"Tim Gleans","category":"Kampus","coverId":"","coverAlt":"","featured":false,"status":"Terbit","publishAt":"2026-08-28T00:00:00.000Z"}', '2026-08-28T00:00:00.000Z', 'Tim Gleans');
INSERT INTO public.site_articles (id, record, publish_at, edited_by) VALUES ('article-tips-menyusun-latar-belakang-masalah', '{"id":"article-tips-menyusun-latar-belakang-masalah","slug":"tips-menyusun-latar-belakang-masalah","title":"Tips Menyusun Latar Belakang Masalah yang Kuat","summary":"Latar belakang adalah pintu masuk penelitianmu. Begini cara menyusunnya supaya runtut, meyakinkan, dan langsung ke inti masalah.","content":"Latar belakang masalah sering jadi bagian yang paling lama dikerjakan. Padahal, kalau strukturnya jelas, bagian ini justru bisa ditulis paling cepat.\n\n## Mulai dari gambaran umum\n\nBuka dengan konteks yang luas tapi relevan. Misalnya, kalau penelitianmu tentang literasi digital mahasiswa, mulai dari data penetrasi internet di Indonesia, lalu persempit ke lingkungan kampus.\n\n## Tunjukkan kesenjangan (gap)\n\nInti latar belakang adalah **kesenjangan antara kondisi ideal dan kondisi nyata**. Sebutkan apa yang seharusnya terjadi menurut teori atau regulasi, lalu tunjukkan data yang memperlihatkan kenyataannya berbeda.\n\n- Gunakan data terbaru, idealnya lima tahun terakhir.\n- Kutip penelitian terdahulu untuk memperlihatkan bahwa masalah ini nyata.\n- Jelaskan apa yang belum diteliti oleh penelitian sebelumnya.\n\n## Tutup dengan alasan penelitian\n\nParagraf terakhir menjawab pertanyaan \"kenapa penelitian ini penting dilakukan sekarang?\". Dari sini, rumusan masalah akan mengalir dengan alami.\n\n## Jangan lupa sitasi\n\nSetiap data dan klaim perlu sumber. Gunakan [Gleans Cite](/sitasi) untuk membuat sitasi APA 7 atau IEEE langsung dari DOI, supaya daftar pustakamu rapi sejak awal.","author":"Tim Gleans","category":"Tips & Trik","coverId":"","coverAlt":"","featured":false,"status":"Terbit","publishAt":"2026-09-20T00:00:00.000Z"}', '2026-09-20T00:00:00.000Z', 'Tim Gleans');
INSERT INTO public.site_promotions (id, record, starts_on, ends_on, edited_by) VALUES ('promo-GLEANS10', '{"id":"promo-GLEANS10","name":"GLEANS10","title":"Diskon 10%","type":"Kode promo","code":"GLEANS10","discount":10,"discountType":"percentage","start":"2020-01-01","end":"9999-12-31","active":true}', '2020-01-01', '9999-12-31', 'Tim Gleans');
INSERT INTO public.site_promotions (id, record, starts_on, ends_on, edited_by) VALUES ('promo-MAHASISWA', '{"id":"promo-MAHASISWA","name":"MAHASISWA","title":"Potongan Rp 2.000","type":"Kode promo","code":"MAHASISWA","discount":2000,"discountType":"fixed","start":"2020-01-01","end":"9999-12-31","active":true}', '2020-01-01', '9999-12-31', 'Tim Gleans');
INSERT INTO public.site_promotions (id, record, starts_on, ends_on, edited_by) VALUES ('promo-SKRIPSIAMAN', '{"id":"promo-SKRIPSIAMAN","name":"SKRIPSIAMAN","title":"Diskon 25%","type":"Kode promo","code":"SKRIPSIAMAN","discount":25,"discountType":"percentage","start":"2020-01-01","end":"9999-12-31","active":true}', '2020-01-01', '9999-12-31', 'Tim Gleans');

CREATE FUNCTION public.record_site_editor_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'site_media' THEN
    INSERT INTO public.site_editor_activity (actor, action, object) VALUES (NEW.edited_by, 'Mengunggah media', NEW.name);
  ELSE
    INSERT INTO public.site_editor_activity (actor, action, object)
    VALUES (
      NEW.edited_by,
      CASE WHEN TG_TABLE_NAME = 'site_articles' THEN 'Menyimpan artikel' ELSE 'Menyimpan promosi' END,
      COALESCE(NEW.record->>'name', NEW.record->>'title')
    );
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.record_site_editor_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_site_editor_activity() TO project_admin;
CREATE TRIGGER site_articles_activity AFTER INSERT OR UPDATE ON public.site_articles
FOR EACH ROW EXECUTE FUNCTION public.record_site_editor_activity();
CREATE TRIGGER site_promotions_activity AFTER INSERT OR UPDATE ON public.site_promotions
FOR EACH ROW EXECUTE FUNCTION public.record_site_editor_activity();
CREATE TRIGGER site_media_activity AFTER INSERT ON public.site_media
FOR EACH ROW EXECUTE FUNCTION public.record_site_editor_activity();

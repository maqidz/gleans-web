import type { Metadata } from "next";
import Link from "next/link";
import { BlogCard, PostByline } from "@/features/blog/components/blog-card";
import { BlogCover } from "@/features/blog/components/blog-cover";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CtaBanner } from "@/components/layout/cta-banner";
import { PageIntro } from "@/components/layout/section-heading";
import { BLOG_CATEGORIES, categorySlug } from "@/features/blog/lib/content";
import { listPublishedArticles } from "@/features/admin/lib/site-editor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog & Berita",
  description: "Tips menulis akademik, panduan sitasi, dan kabar seputar dunia kampus dari Tim Gleans.",
};

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ kategori?: string }> }) {
  const { kategori } = await searchParams;
  const posts = await listPublishedArticles();
  const active = BLOG_CATEGORIES.find((c) => categorySlug(c) === kategori);
  const featured = posts.find(post => post.featured);
  const list = active ? posts.filter((p) => p.category === active) : posts;

  return (
    <>
      <Breadcrumb items={[{ label: "Blog & Berita" }]} />
      <section className="container-page flex flex-col gap-10 pt-10 pb-16 md:pt-14 lg:gap-12 lg:pt-[60px] lg:pb-24">
        <PageIntro
          title="Blog & Berita"
          description="Tips menulis, panduan sitasi, dan kabar seputar dunia kampus dalam satu tempat."
        />

        {featured && (
          <Link href={`/blog/${featured.slug}`} className="group grid items-center gap-6 md:grid-cols-2 lg:gap-10">
            <BlogCover
              post={featured}
              size="hero"
              className="aspect-video"
            />
            <div className="flex flex-col gap-3">
              <span className="w-fit rounded-full border border-primary px-3 py-1 text-xs font-medium tracking-wide text-primary">UNGGULAN</span>
              <h2 className="group-hover:text-primary text-2xl leading-snug font-medium lg:text-[32px]">
                {featured.title}
              </h2>
              {featured.excerpt && <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground md:text-base">{featured.excerpt}</p>}
              <PostByline post={featured} />
            </div>
          </Link>
        )}

        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <CategoryPill href="/blog" label="Semua" active={!active} />
          {BLOG_CATEGORIES.map((category) => (
            <CategoryPill
              key={category}
              href={`/blog?kategori=${categorySlug(category)}`}
              label={category}
              active={active === category}
            />
          ))}
        </div>

        {list.length > 0 ? (
          <div className="grid gap-10 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {list.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Belum ada artikel di kategori ini.</p>
        )}
      </section>
      <CtaBanner />
    </>
  );
}

function CategoryPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "flex h-10 shrink-0 items-center rounded-full border px-5 text-sm font-medium tracking-wide uppercase transition-colors",
        active ? "border-primary bg-primary text-white" : "hover:border-primary hover:text-primary bg-white",
      )}
    >
      {label}
    </Link>
  );
}

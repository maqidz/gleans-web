import { notFound, redirect } from "next/navigation";
import { AdminBlogEditor } from "@/features/admin/components/blog-editor";
import { AdminEditorialList } from "@/features/admin/components/editorial-list";
import { AdminPromotionEditor } from "@/features/admin/components/promotion-editor";
import { currentAdmin } from "@/features/auth/session";
import { jakartaDate, listEditorRecords, type BlogEntry, type Promotion } from "@/features/admin/lib/site-editor";

export default async function Page({ params }: { params: Promise<{ module: string; id: string }> }) {
  const { module, id } = await params;
  if (module !== "blog" && module !== "promosi") notFound();
  if (!await currentAdmin()) redirect("/masuk");
  if (module === "promosi") {
    const existing = id === "baru" ? undefined : (await listEditorRecords("promo", id))[0] as Promotion | undefined;
    if (id !== "baru" && !existing) notFound();
    return <>
      <AdminEditorialList module="promosi" />
      <AdminPromotionEditor key={id} existing={existing} today={jakartaDate()} />
    </>;
  }
  const existing = id === "baru" ? undefined : (await listEditorRecords("blog", id))[0] as BlogEntry | undefined;
  return <AdminBlogEditor id={id} key={id} existing={existing} />;
}

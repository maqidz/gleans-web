import { activeSitePromotions } from "@/features/admin/lib/site-editor";
import { PromotionPopup } from "./promotion-popup";

export async function HomePromotions() {
  const promotions = await activeSitePromotions().catch(() => []);
  if (!promotions.length) return null;

  const banners = promotions.map(({ id, revision, title, description, href, imageUrl, buttonLabel }) => (
    { id: `${id}:${revision}`, title, description, href, imageUrl, buttonLabel }
  ));
  return <PromotionPopup key={banners.map(banner => banner.id).join(",")} banners={banners} />;
}

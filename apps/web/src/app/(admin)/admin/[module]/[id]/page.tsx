import { notFound } from "next/navigation";
import { AdminUnavailable } from "@/features/admin/components/unavailable";
export default async function Page({params}:{params:Promise<{module:string;id:string}>}) {const {module}=await params;if(module!=="blog")notFound();return <AdminUnavailable title="Blog"/>;}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { initializeProductMasterFoundation } from "@/features/product-master/foundation";
import { prisma } from "@/lib/prisma";

export async function initializeProductMasterFoundationAction() {
  const result = await initializeProductMasterFoundation({ prisma });

  revalidatePath("/product-master");
  revalidatePath("/executive");
  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath("/revenue");
  revalidatePath("/today");

  redirect(
    `/product-master?initialized=1&products=${result.createdProducts}&articles=${result.createdArticles}&records=${result.updatedCanonicalRecords}`,
  );
}

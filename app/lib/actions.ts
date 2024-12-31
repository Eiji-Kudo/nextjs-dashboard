"use server";

export async function createInvoice(formData: FormData) {
  const rawFormData = Object.fromEntries(formData.entries());
  // Test it out:
  console.log(rawFormData);
}

"use server";

import { db } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer."
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status."
  }),
  date: z.string()
});

const client = await db.connect();

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = CreateInvoice.safeParse({
      customerId: rawFormData.customerId,
      amount: rawFormData.amount,
      status: rawFormData.status
    });

    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: "Missing Fields. Failed to Create Invoice."
      };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split("T")[0];

    // Insert data into the database
    try {
      await client.sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    } catch (error) {
      // If a database error occurs, return a more specific error.
      return {
        message: "Database Error: Failed to Create Invoice."
      };
    }

    // Revalidate the cache for the invoices page and redirect the user.
    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
}

export async function updateInvoice(
  prevState: State,
  id: string,
  formData: FormData
) {
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = UpdateInvoice.safeParse({
      customerId: rawFormData.customerId,
      amount: rawFormData.amount,
      status: rawFormData.status
    });

    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: "Missing Fields. Failed to Create Invoice."
      };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;

    await client.sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;

    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
  } catch (error) {
    console.error(`Error updating invoice with ID ${id}:`, error);
    throw error;
  }
}

export async function deleteInvoice(id: string) {
  try {
    await client.sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath("/dashboard/invoices");
  } catch (error) {
    console.error(`Error deleting invoice with ID ${id}:`, error);
    throw error;
  } finally {
    redirect("/dashboard/invoices");
  }
}

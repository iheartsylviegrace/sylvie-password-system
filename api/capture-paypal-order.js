import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { getCurrentPassword } from "../passwords.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function getPayPalAccessToken() {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    "https://api-m.paypal.com/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  if (!response.ok) {
    throw new Error("Could not authenticate with PayPal.");
  }

  const data = await response.json();
  return data.access_token;
}

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "https://sylviegrace.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const { orderId, customerEmail } = req.body ?? {};

  if (!orderId || !customerEmail) {
    return res.status(400).json({
      error: "Order ID and customer email are required."
    });
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const captureResponse = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const capture = await captureResponse.json();

    if (!captureResponse.ok) {
      console.error(capture);

      return res.status(captureResponse.status).json({
        error: "The PayPal payment could not be captured."
      });
    }

    if (capture.status !== "COMPLETED") {
      return res.status(400).json({
        error: "The payment was not completed."
      });
    }

    const transactionId =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    if (!transactionId) {
      return res.status(500).json({
        error: "PayPal did not return a transaction ID."
      });
    }

    const { data: existingTransaction, error: lookupError } =
      await supabase
        .from("paypal_transactions")
        .select("transaction_id")
        .eq("transaction_id", transactionId)
        .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (existingTransaction) {
      return res.status(200).json({
        success: true,
        alreadySent: true
      });
    }

    const password = getCurrentPassword();

    const { error: emailError } = await resend.emails.send({
      from: "Sylvie Grace <password@sylviegrace.com>",
      to: customerEmail,
      subject: "Your Sylvie Grace access password",
      html: `
        <h2>Thank you for your purchase.</h2>

        <p>Your current access password is:</p>

        <p style="font-size:32px;font-weight:bold;letter-spacing:2px;">
          ${password}
        </p>

        <p>
          This password provides access for the current weekly period.
          A new $5 purchase is required after the password changes.
        </p>
      `
    });

    if (emailError) {
      throw emailError;
    }

    const { error: insertError } = await supabase
      .from("paypal_transactions")
      .insert({
        transaction_id: transactionId,
        customer_email: customerEmail,
        password_sent: true
      });

    if (insertError) {
      throw insertError;
    }

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "The payment was captured, but the password email could not be completed."
    });
  }
}

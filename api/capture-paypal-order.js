import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { getCurrentPassword } from "../passwords.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function setCorsHeaders(res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://sylviegrace.com"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
}

function isValidEmail(value) {
  return (
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

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

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error("PayPal authentication error:", data);
    throw new Error("Could not authenticate with PayPal.");
  }

  return data.access_token;
}

async function getPayPalOrder(orderId, accessToken) {
  const response = await fetch(
    `https://api-m.paypal.com/v2/checkout/orders/${orderId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  const order = await response.json();

  if (!response.ok) {
    console.error("PayPal order lookup error:", order);
    throw new Error("Could not retrieve the PayPal order.");
  }

  return order;
}

function getCompletedCapture(order) {
  const captures =
    order?.purchase_units?.[0]?.payments?.captures ?? [];

  return captures.find(
    (capture) => capture.status === "COMPLETED"
  );
}

async function capturePayPalOrder(orderId, accessToken) {
  const response = await fetch(
    `https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",

        // Reusing this same value makes a retry of this order capture
        // idempotent instead of creating a second capture attempt.
        "PayPal-Request-Id": `capture-${orderId}`
      }
    }
  );

  const captureResult = await response.json();

  if (response.ok) {
    return captureResult;
  }

  /*
    A previous request may have captured the order successfully even if
    the browser did not receive the response. Retrieve the order before
    treating the request as a failure.
  */
  const existingOrder = await getPayPalOrder(
    orderId,
    accessToken
  );

  const existingCapture = getCompletedCapture(existingOrder);

  if (existingCapture) {
    return existingOrder;
  }

  console.error("PayPal capture error:", captureResult);

  const issue =
    captureResult?.details?.[0]?.issue ||
    captureResult?.name ||
    "UNKNOWN_PAYPAL_ERROR";

  throw new Error(`PayPal capture failed: ${issue}`);
}

async function getStoredTransaction(transactionId) {
  const { data, error } = await supabase
    .from("paypal_transactions")
    .select(
      "transaction_id, customer_email, password_sent"
    )
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (error) {
    console.error("Supabase lookup error:", error);
    throw new Error(
      "Could not check whether this transaction was already processed."
    );
  }

  return data;
}

async function reserveTransaction(
  transactionId,
  customerEmail
) {
  const { error } = await supabase
    .from("paypal_transactions")
    .insert({
      transaction_id: transactionId,
      customer_email: customerEmail,
      password_sent: false
    });

  if (!error) {
    return;
  }

  /*
    PostgreSQL code 23505 means a unique value already exists.
    Once transaction_id is marked UNIQUE in Supabase, simultaneous
    requests cannot create duplicate transaction rows.
  */
  if (error.code === "23505") {
    return;
  }

  console.error("Supabase reservation error:", error);

  throw new Error(
    "The payment was completed, but the transaction could not be recorded."
  );
}

async function markPasswordSent(transactionId) {
  const { error } = await supabase
    .from("paypal_transactions")
    .update({
      password_sent: true
    })
    .eq("transaction_id", transactionId);

  if (error) {
    console.error(
      "Supabase password status update error:",
      error
    );

    throw new Error(
      "The password email was sent, but its delivery status could not be recorded."
    );
  }
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const { orderId, customerEmail } = req.body ?? {};
  const normalizedEmail =
    typeof customerEmail === "string"
      ? customerEmail.trim().toLowerCase()
      : "";

  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({
      error: "A valid PayPal order ID is required."
    });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({
      error: "A valid customer email is required."
    });
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const captureResult = await capturePayPalOrder(
      orderId,
      accessToken
    );

    const completedCapture =
      getCompletedCapture(captureResult);

    if (!completedCapture?.id) {
      return res.status(400).json({
        error:
          "PayPal did not return a completed payment capture."
      });
    }

    const captureAmount = completedCapture.amount;

    if (
      captureAmount?.currency_code !== "USD" ||
      captureAmount?.value !== "5.00"
    ) {
      console.error(
        "Unexpected PayPal capture amount:",
        captureAmount
      );

      return res.status(400).json({
        error:
          "The completed payment amount did not match the $5 checkout."
      });
    }

    const transactionId = completedCapture.id;

    let storedTransaction =
      await getStoredTransaction(transactionId);

    if (storedTransaction?.password_sent === true) {
      return res.status(200).json({
        success: true,
        alreadySent: true
      });
    }

    if (!storedTransaction) {
      await reserveTransaction(
        transactionId,
        normalizedEmail
      );

      storedTransaction =
        await getStoredTransaction(transactionId);
    }

    if (storedTransaction?.password_sent === true) {
      return res.status(200).json({
        success: true,
        alreadySent: true
      });
    }

    const password = getCurrentPassword();

    const { data: emailData, error: emailError } =
      await resend.emails.send(
        {
          from:
            "Sylvie Grace <password@sylviegrace.com>",
          to: normalizedEmail,
          subject:
            "Your Sylvie Grace access password",
        html: `
  <div style="font-family:Arial,sans-serif;line-height:1.5;">
    <p>Thank you for your purchase.</p>

    <p>Your current access password is:</p>

    <p
      style="
        font-size:32px;
        font-weight:bold;
        letter-spacing:2px;
        margin:24px 0;
      "
    >
      ${password}
    </p>

    <p>
      This password provides access for the current
      weekly period.
    </p>

    <p>
      A new $5 purchase is required after the password
      changes.
    </p>

    <div style="margin-top:40px;text-align:center;">
      <a
        href="https://sylviegrace.com/thelookingglass"
        style="
          color:#c62828;
          text-decoration:none;
          font-size:16px;
          font-family:Arial,sans-serif;
        "
      >
        🐇 go through the looking glass
      </a>
    </div>
  </div>
`
          `
        },
        {
          /*
            Resend will not send this same transaction email twice
            during its idempotency window.
          */
          idempotencyKey:
            `weekly-password/${transactionId}`
        }
      );

    if (emailError) {
      console.error("Resend email error:", emailError);

      throw new Error(
        "The payment was completed, but the password email could not be sent."
      );
    }

    if (!emailData?.id) {
      throw new Error(
        "Resend did not confirm that the email was accepted."
      );
    }

    await markPasswordSent(transactionId);

    return res.status(200).json({
      success: true,
      alreadySent: false
    });
  } catch (error) {
    console.error(
      "Capture and fulfillment error:",
      error
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "The payment was completed, but the password email could not be completed."
    });
  }
}

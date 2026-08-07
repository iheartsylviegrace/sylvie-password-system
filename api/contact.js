import { Resend } from "resend";

const resend =
  new Resend(process.env.RESEND_API_KEY);

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
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value.trim()
    )
  );
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

  const {
    name,
    email,
    message
  } = req.body ?? {};

  const cleanName =
    typeof name === "string"
      ? name.trim()
      : "";

  const cleanEmail =
    typeof email === "string"
      ? email.trim().toLowerCase()
      : "";

  const cleanMessage =
    typeof message === "string"
      ? message.trim()
      : "";

  if (
    !cleanName ||
    !isValidEmail(cleanEmail) ||
    !cleanMessage
  ) {
    return res.status(400).json({
      error:
        "Name, valid email, and message are required."
    });
  }

  try {
    const {
      data,
      error
    } = await resend.emails.send({
      from:
        "Sylvie Grace Website <password@sylviegrace.com>",

      to:
        "info@sylviegrace.com",

      replyTo:
        cleanEmail,

      subject:
        `website message from ${cleanName}`,

      html: `
        <div
          style="
            font-family:Arial,sans-serif;
            line-height:1.5;
          "
        >
          <p>
            <strong>name:</strong>
            ${cleanName}
          </p>

          <p>
            <strong>email:</strong>
            ${cleanEmail}
          </p>

          <p>
            <strong>message:</strong>
          </p>

          <p>
            ${cleanMessage
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\n/g, "<br>")}
          </p>
        </div>
      `
    });

    if (error) {
      console.error(
        "Resend contact error:",
        error
      );

      return res.status(500).json({
        error:
          "The message could not be sent."
      });
    }

    if (!data?.id) {
      return res.status(500).json({
        error:
          "Resend did not confirm delivery."
      });
    }

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error(
      "Contact form error:",
      error
    );

    return res.status(500).json({
      error:
        "The message could not be sent."
    });
  }
}

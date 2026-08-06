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
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      "https://api-m.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              description: "Sylvie Grace weekly access",
              amount: {
                currency_code: "USD",
                value: "5.00"
              }
            }
          ],
          application_context: {
            brand_name: "Sylvie Grace",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING"
          }
        })
      }
    );

    const order = await response.json();

    if (!response.ok) {
      console.error(order);

      return res.status(response.status).json({
        error: "PayPal could not create the order"
      });
    }

    return res.status(200).json({
      id: order.id
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Could not create the PayPal order"
    });
  }
}

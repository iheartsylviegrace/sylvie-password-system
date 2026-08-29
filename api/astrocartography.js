export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  try {
    const {
      day,
      month,
      year,
      hour,
      minute,
      latitude,
      longitude,
      timezone
    } = req.body ?? {};

    const response = await fetch(
      "https://json.astrologyapi.com/v1/acg/travel",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-astrologyapi-key":
            process.env.ASTROLOGY_API_KEY
        },

        body: JSON.stringify({
          day: Number(day),
          month: Number(month),
          year: Number(year),
          hour: Number(hour),
          min: Number(minute),
          second: 0,
          tzone: Number(timezone),
          lat: Number(latitude),
          lon: Number(longitude),
          include_parans: false
        })
      }
    );

    const data = await response.json();

    return res
      .status(response.status)
      .json(data);

  } catch (error) {
    console.error(
      "Astrocartography API error:",
      error
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Astrocartography request failed."
    });
  }
}

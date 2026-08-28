export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
      name,
      day,
      month,
      year,
      hour,
      minute,
      latitude,
      longitude,
      timezone
    } = req.body;

    const response = await fetch(
      "https://json.astrologyapi.com/v1/astro_details",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.ASTROLOGY_API_USER +
                ":" +
                process.env.ASTROLOGY_API_KEY
            ).toString("base64"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          day: Number(day),
          month: Number(month),
          year: Number(year),
          hour: Number(hour),
          min: Number(minute),
          lat: Number(latitude),
          lon: Number(longitude),
          tzone: Number(timezone)
        })
      }
    );

    const data = await response.json();

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}

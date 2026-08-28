export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  try {
    const response = await fetch(
      "https://json.astrologyapi.com/v1/acg/travel",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
        },
        body: JSON.stringify(req.body)
      }
    );

    const data = await response.json();

    return res.status(response.status).json(data);

  } catch (error) {

    return res.status(500).json({
      error: error.message
    });

  }
}
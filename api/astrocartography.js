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
      longitude
    } = req.body ?? {};

    /*
     * STEP 1:
     * Find the historical timezone offset
     * for the birthplace and birth date.
     */

    const birthDate =
      String(month).padStart(2, "0") +
      "-" +
      String(day).padStart(2, "0") +
      "-" +
      String(year);

    const timezoneResponse = await fetch(
      "https://json.astrologyapi.com/v1/timezone_with_dst",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-astrologyapi-key":
            process.env.ASTROLOGY_API_KEY
        },

        body: JSON.stringify({
          latitude: Number(latitude),
          longitude: Number(longitude),
          date: birthDate
        })
      }
    );

    const timezoneData =
      await timezoneResponse.json();

    if (!timezoneResponse.ok) {
      console.error(
        "Timezone API error:",
        timezoneData
      );

      return res
        .status(timezoneResponse.status)
        .json({
          error:
            "Could not determine historical timezone.",
          details: timezoneData
        });
    }

    const historicalTimezone =
      Number(timezoneData.timezone);

    if (!Number.isFinite(historicalTimezone)) {
      console.error(
        "Invalid timezone response:",
        timezoneData
      );

      return res.status(500).json({
        error:
          "AstrologyAPI returned an invalid timezone."
      });
    }

    console.log(
      "Historical timezone:",
      historicalTimezone,
      "Birth date:",
      birthDate,
      "Coordinates:",
      latitude,
      longitude
    );

    /*
     * STEP 2:
     * Generate astrocartography using
     * the correct historical timezone.
     */

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

          tzone: historicalTimezone,

          lat: Number(latitude),
          lon: Number(longitude),

          include_parans: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Astrocartography API error:",
        data
      );

      return res
        .status(response.status)
        .json(data);
    }

    /*
     * Return chart normally.
     * Also include the timezone temporarily
     * so we can verify our fix while testing.
     */

    return res.status(200).json({
      ...data,

      _debug: {
        historicalTimezone,
        birthDate
      }
    });

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

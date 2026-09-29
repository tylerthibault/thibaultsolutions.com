INSERT INTO "ugc_brand_leads" (
  "brand", "category", "signal", "source", "source_url", "compensation",
  "creator_fit", "status", "research_notes"
)
SELECT seed.*
FROM (
  VALUES
    (
      'SmashIt Honey',
      'Wellness / DTC',
      'Actively seeking UGC creators for TikTok, Reels, and Meta ads',
      'Upwork creator brief',
      'https://www.upwork.com/jobs/~022104871534896384007',
      '$20 listed',
      'Direct-response product demo / testimonial',
      'RESEARCH',
      'Open creator brief found Sept. 29, 2026. Review product, claims, deliverables, and usage-right terms before pitching.'
    ),
    (
      'Summers Ahead',
      'Financial services',
      'Seeking natural-looking creators ages 28–55 for Facebook and Instagram ads',
      'Upwork creator brief',
      'https://www.upwork.com/jobs/~022104698582123426682',
      'Not listed',
      'Talking-head testimonial / problem-solution',
      'RESEARCH',
      'Age range fits. Financial-services claims require extra care; verify brief language, substantiation, and required disclosures.'
    )
) AS seed(
  "brand", "category", "signal", "source", "source_url", "compensation",
  "creator_fit", "status", "research_notes"
)
WHERE NOT EXISTS (SELECT 1 FROM "ugc_brand_leads");

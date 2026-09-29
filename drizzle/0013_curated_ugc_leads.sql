INSERT INTO "ugc_brand_leads" (
  "brand", "category", "signal", "source", "source_url", "contact_url",
  "compensation", "creator_fit", "status", "research_notes"
)
SELECT
  'Countrywide Properties',
  'Real estate / lifestyle',
  'Current U.S. UGC casting call seeking natural on-camera creators with a portfolio or sample videos.',
  'LinkedIn Jobs',
  'https://www.linkedin.com/jobs/view/ugc-creator-at-countrywide-properties-4463517587',
  'https://www.linkedin.com/jobs/view/ugc-creator-at-countrywide-properties-4463517587',
  '$1,300 listed paid opportunity',
  'Natural talking-head, testimonial, problem-solution, lifestyle',
  'PITCH',
  'Verified Sept. 29, 2026. U.S.-based, 18+, strong natural speaking ability; UGC/TikTok/Reels experience preferred.'
WHERE NOT EXISTS (SELECT 1 FROM "ugc_brand_leads" WHERE lower("brand") = lower('Countrywide Properties'));
--> statement-breakpoint

INSERT INTO "ugc_brand_leads" (
  "brand", "category", "signal", "source", "source_url", "contact_url",
  "compensation", "creator_fit", "status", "research_notes"
)
SELECT
  'Surround Sound',
  'Agency roster / beauty & wellness',
  'Building a recurring roster of paid UGC creators for short-form paid social across consumer brands.',
  'LinkedIn Jobs',
  'https://www.linkedin.com/jobs/view/freelance-ugc-creator-beauty-wellness-at-surround-sound-4464105179',
  'https://www.linkedin.com/jobs/view/freelance-ugc-creator-beauty-wellness-at-surround-sound-4464105179',
  '$150–$300 typical assignments',
  'Scripted-but-natural delivery, product/routine B-roll, raw footage',
  'PITCH',
  'Verified Sept. 29, 2026. Remote UGC roster; no large following required. Beauty, skincare, wellness, nutrition, fitness, and consumer-brand work.'
WHERE NOT EXISTS (SELECT 1 FROM "ugc_brand_leads" WHERE lower("brand") = lower('Surround Sound'));
--> statement-breakpoint

INSERT INTO "ugc_brand_leads" (
  "brand", "category", "signal", "source", "source_url", "contact_url",
  "compensation", "creator_fit", "status", "research_notes"
)
SELECT
  'Mindshare Tech Product Campaign',
  'Tech / lifestyle',
  'Open creator campaign for a tech product across Instagram and YouTube Shorts.',
  'AveoReach',
  'https://aveoreach.com/campaign/hiring-ugc-creators-for-a-tech-product',
  'https://aveoreach.com/campaign/hiring-ugc-creators-for-a-tech-product',
  '$150–$300 per video listed',
  'Tech demo, lifestyle use case, tutorial, talking-head',
  'RESEARCH',
  'Verified Sept. 29, 2026. U.S. campaign; listed follower range is 1K–50K. AveoReach verification is required before applying.'
WHERE NOT EXISTS (SELECT 1 FROM "ugc_brand_leads" WHERE lower("brand") = lower('Mindshare Tech Product Campaign'));
--> statement-breakpoint

INSERT INTO "ugc_brand_leads" (
  "brand", "category", "signal", "source", "source_url", "contact_url",
  "compensation", "creator_fit", "status", "research_notes"
)
SELECT
  'NoGood Flex Creator Network',
  'Agency roster / multi-brand',
  'Current freelance creator network recruiting UGC talent for client projects.',
  'DailyRemote / NoGood',
  'https://dailyremote.com/remote-job/flex-creator-no-good-freelance-ugc-creator-network-5659175',
  'https://dailyremote.com/remote-job/flex-creator-no-good-freelance-ugc-creator-network-5659175',
  'Not listed',
  'Multi-brand UGC, scripting, content creation, performance creative',
  'RESEARCH',
  'Verified Sept. 29, 2026. NoGood describes a client roster that includes major consumer and tech brands; treat this as a recurring pipeline source rather than one brand deal.'
WHERE NOT EXISTS (SELECT 1 FROM "ugc_brand_leads" WHERE lower("brand") = lower('NoGood Flex Creator Network'));
--> statement-breakpoint

INSERT INTO "ugc_brand_leads" (
  "brand", "category", "signal", "source", "source_url", "contact_url",
  "compensation", "creator_fit", "status", "research_notes"
)
SELECT
  'PixelPig',
  'AI / SaaS',
  'Recent tech-UGC recruiting post for AI-model content tied to Claude MCP and PixelPig.',
  'Reddit / UGCForTech',
  'https://www.reddit.com/r/UGCForTech/comments/1w4r2ar/hiring_ugc_creators_for_tech_saas_base_pay/',
  'https://www.reddit.com/r/UGCForTech/comments/1w4r2ar/hiring_ugc_creators_for_tech_saas_base_pay/',
  'Base per video + view bonuses',
  'AI tool demo, screen-led tutorial, talking-head tech explainer',
  'RESEARCH',
  'Verified Sept. 29, 2026 from a recent creator-community post. All experience levels mentioned. Verify company identity, contract, usage rights, and payment terms before sharing sensitive information.'
WHERE NOT EXISTS (SELECT 1 FROM "ugc_brand_leads" WHERE lower("brand") = lower('PixelPig'));
--> statement-breakpoint

INSERT INTO "ugc_brand_leads" (
  "brand", "category", "signal", "source", "source_url", "contact_url",
  "compensation", "creator_fit", "status", "research_notes"
)
SELECT
  'NALTOVI',
  'Health & wellness',
  'Recent U.S.-only UGC brief for short brand-intro and collagen-creamer videos.',
  'Upwork',
  'https://www.upwork.com/freelance-jobs/apply/Two-UGC-Video-Creators-Needed-for-Health-and-Wellness-Brand_~022097657344992725405/',
  'https://www.upwork.com/freelance-jobs/apply/Two-UGC-Video-Creators-Needed-for-Health-and-Wellness-Brand_~022097657344992725405/',
  'About $75 per completed video',
  'Health/wellness product intro, scripted talking-head, clean vertical demo',
  'RESEARCH',
  'Verified Sept. 29, 2026. Broad reuse includes website, social, and paid ads. Listed rate is low for those usage rights, so review or negotiate terms before accepting.'
WHERE NOT EXISTS (SELECT 1 FROM "ugc_brand_leads" WHERE lower("brand") = lower('NALTOVI'));

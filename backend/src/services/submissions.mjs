export async function insertPendingSubmission(pool, payload) {
  const result = await pool.query(
    `
      insert into submissions (
        contributor_name,
        contributor_email,
        story_text,
        raw_location_text,
        privacy_mode,
        display_lat,
        display_lng,
        status
      ) values ($1, $2, $3, $4, $5, $6, $7, 'pending_review')
      returning id, status, created_at
    `,
    [
      payload.contributorName ?? null,
      payload.contributorEmail ?? null,
      payload.storyText ?? null,
      payload.rawLocationText,
      payload.privacyMode ?? 'city',
      payload.displayLat,
      payload.displayLng
    ]
  );

  return result.rows[0];
}

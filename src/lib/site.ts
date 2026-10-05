// Facts about the site that more than one page states.

// Shown as visible text wherever it appears, not just a mailto href: Spotify
// for Artists reviewers need to SEE the address next to the artist to verify
// a request.
export const CONTACT_EMAIL = 'chrisgwim@chrisgwim.com';

// The sibling brand, linked from every page. No UTM parameters.
export const LUNTHRA_URL = 'https://lunthra.com';

// SoundCloud Artist Pro referral, offered on the home page only.
export const REFERRAL_URL = 'https://invite.soundcloud.com/magnusnova!8bf953f927!a';

/**
 * JSON for an inline <script> data block. A "</script>" inside a title or a
 * description would otherwise end the block early, and both come from
 * SoundCloud on a timer with nobody reviewing them.
 */
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

# Suggestions

Serve the public site and API on the same HTTPS origin. Submissions are private. The public list reads only the edited question and Daniel’s reply once he checks the approval box. No mail is sent and the form asks for no contact details.

## Review and reply

In the Cloudflare dashboard, open **Storage & databases**, **D1 SQL database**, then **future-mississauga-suggestions**. In the Data tab, open the `suggestions` table. The **original** column is private. Enter the edited question in **public_question** and your answer in **response**. Set **reviewed_at** to the review timestamp, then set **approved** to `1`. Change it back to `0` to withdraw an entry. The public API only returns the edited wording and your reply.

## Website moderator inbox

Open `/suggestions.html#moderate`. To get the moderator key, sign in to Cloudflare, open the dedicated D1 database in Studio and select the only row in the private `suggestion_moderator` table. Paste its `access_key` into the website’s review form. Save a draft, approve an edited question with your reply, or withdraw it from the same screen. The key stays in page memory until you leave or sign out. The public site never returns this key or an unedited submission.

As an alternative, an operator can set `SUGGESTIONS_ADMIN_TOKEN` as a Worker secret. When configured, that secret takes precedence over the database key. The authenticated Cloudflare dashboard also supports direct review as described above.

## Database setup

The release binds the dedicated `future-mississauga-suggestions` D1 database as `SUGGESTIONS_DB`. Apply `cloudflare/suggestions.sql` to a new database before using it. To test against a separate database, set `FM_SUGGESTIONS_DATABASE_ID` before building. The production domain and its active Worker share the same queue.

The Worker admits at most 250 submissions per UTC day across all visitors. This limits database growth, not all request charges. Keep the project’s existing account budget alert and plan limits. Offline HTML does not submit messages. Opening the online edition is a separate, explicit action.

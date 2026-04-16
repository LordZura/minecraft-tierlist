Finished Website Requirements

The project is only considered complete when all of the following are implemented and working:

1. Authentication and accounts
- Players can register and log in with a Minecraft username-based account.
- Launcher-based users are supported without requiring Mojang/Microsoft authentication.
- Sessions persist correctly.
- Logout works.
- Password handling is secure.
- Admin login exists and is protected.

2. Supabase integration
- Supabase is used as the backend database.
- All data is stored in Supabase Postgres.
- Row-level security is enabled and configured correctly.
- Admin-only actions are protected.
- Client and server access to Supabase are cleanly separated.

3. Player profiles
- Every registered player has a public profile page.
- Profiles show:
  - total wins
  - total losses
  - total score
  - ranking position
  - PvP-type stats
  - challenge record
  - match history
  - opponents beaten in challenges
- Profiles load correctly and update after new results.

4. Match logging
- Players can log fights against registered players only.
- Fight logs include:
  - opponent
  - PvP type
  - winner
  - score/result
  - timestamp
- Logged fights are pending until the opponent approves them.
- Rejected logs are not counted.
- Admin can approve, reject, edit, or bypass logs.

5. Challenge system
- Players can challenge other registered players.
- Challenges run as 10-match sets.
- Challenge results are recorded per match and as a final outcome.
- Challenge winner is determined by majority wins.
- Challenge results affect rankings.
- A player who loses a challenge cannot challenge the same opponent again for 3 days.
- Challenge requests can be accepted or rejected.
- Admin can override challenge handling.

6. Notifications
- Players have a notifications page.
- Notifications show pending fight logs and challenge requests.
- Players can review, accept, or reject items.
- Notification status updates correctly after action.

7. Ranking system
- A ranking page lists all players.
- Rankings update automatically from verified results.
- Ranking view includes:
  - position
  - total wins
  - PvP-type wins
  - total points
  - challenge record
- Rankings are sortable and filterable.
- Player profile links work from the ranking page.

8. PvP types
- The site supports all required PvP categories:
  - crystal
  - sword
  - axe
  - UHC
  - manhunt
  - mace
  - SMP
  - cart
  - bow
- Each type is tracked separately in stats and history.

9. Admin panel
- Admin panel exists and works.
- Admin can:
  - approve or reject entries
  - edit player stats
  - fix incorrect results
  - bypass verification
  - manage rankings
  - manage users and records
- Admin actions are logged.

10. Data integrity
- Duplicate submissions are prevented.
- Invalid opponents cannot be submitted.
- Self-challenges and self-match logs are blocked.
- Unverified results do not count.
- All edits preserve audit history where possible.
- Full history is retained.

11. UI and usability
- The site has a clean, modern, organized layout.
- It works well on desktop and mobile.
- Navigation is clear.
- Key pages are easy to find.
- Tables, cards, badges, and filters are used well.
- The app feels polished and easy to use.

12. Required pages
- Home / landing page
- Register / login page
- Ranking page
- Player profile page
- Add fight log page
- Challenge page
- Notifications page
- Admin panel
- Match history or detail pages where useful

13. Security
- Sensitive actions are protected.
- Users can only edit their own content unless admin.
- Server-side checks verify permissions.
- Input validation exists for all forms.
- Database rules block unauthorized access.

14. Final product quality
- The app is stable.
- Errors are handled gracefully.
- Loading states are present.
- Empty states are present.
- The codebase is modular and maintainable.
- The project can be deployed and used as a real MVP.

15. Completion rule
- The project is not finished unless the full flow works:
  register → log in → add match/challenge → approve → ranking updates → profile updates → admin can manage everything.



  -----------------------------------------------------------------------------------------------------------


  original prompt:

  Build a clean, organized, and fully functional Minecraft PvP tier list web app using Supabase for the backend, database, and authentication/storage where appropriate.

Goal
Create a personal ranking website where players can register using their Minecraft username only. Do not require Microsoft/Mojang authentication for accounts. Username-based registration should be enough, so even launcher-based users can join.

Use Supabase servers for:
- database
- authentication
- row-level security
- server-side data handling
- notifications/data storage as needed

Main idea
The site tracks PvP results between registered players and uses those results to build a ranking system. It should feel modern, easy to use, and simple to update after matches.

Main features

1) Player registration and profiles
- Players can register with:
  - Minecraft username
  - password
  - optional avatar/profile info
- Each player gets a personal profile page.
- Profile page should show:
  - total wins
  - total losses
  - score/ranking points
  - wins and losses by PvP type
  - match history
  - challenge history
  - players they are “better than” based on challenge results

2) PvP match logging
- Players can log fights only against registered players.
- When logging a fight, they select:
  - opponent
  - PvP type
  - winner
  - score/result
- PvP types:
  - crystal
  - sword
  - axe
  - UHC
  - manhunt
  - mace
  - SMP
  - cart
  - bow
- Logged fights should not become public or counted until the opponent confirms them.
- Opponent must be able to accept or reject the fight log.
- Admin can bypass this verification.

3) Challenge system
- Players can challenge another registered player.
- If the challenge is accepted, the two players play a set of 10 matches.
- This is meant to determine who is better overall.
- The player who wins the majority of the 10 matches is considered the winner of the challenge.
- Winning 6 or more out of 10 should count as a challenge win, but all match results should still be stored.
- Challenge results should affect ranking, but not as heavily as the main fight log.
- A player who loses a challenge can only challenge that same opponent again after 3 days.

4) Notifications / approvals
- Create a notifications page.
- Players should see pending fight logs and pending challenge requests.
- They can accept or reject entries.
- Admin can approve, edit, or bypass everything.

5) Ranking page
- Create a main ranking page that lists all registered players.
- Show for each player:
  - rank position
  - total wins
  - wins by PvP type
  - total score
  - challenge record
- Ranking should be sortable/filterable.
- Clicking a player should open their profile and show:
  - stats
  - history
  - opponents they defeated in challenges
  - people they are ranked above

6) Admin panel
- Admin login should be simple for now.
- Use password: password
- Admin can:
  - edit player stats
  - approve/reject logs and challenges
  - modify rankings
  - remove or correct bad data
  - bypass opponent approval
  - manage almost everything in the app

Ranking logic
- Fight logs should give decent ranking points.
- Challenge wins should give some ranking points, but less than regular logged fights.
- A challenge win should have more meaning than a single fight log.
- Store all results per PvP type.
- Keep the ranking system easy to adjust later.

Pages to build
- Home / landing page
- Register / login page
- Ranking page
- Player profile page
- Add fight log page
- Challenge page
- Notifications page
- Admin panel
- Optional: match history / leaderboard detail pages

UI / design requirements
- Clean, modern, organized layout
- Responsive design for desktop and mobile
- Clear navigation
- Use cards, tables, badges, and filters where useful
- Make the app easy to scan and easy to use

Data model requirements
Create models for:
- users / players
- fight logs
- challenges
- challenge matches
- notifications
- ranking points
- admin actions

Supabase implementation requirements
- Use Supabase as the primary backend.
- Design the schema for Supabase Postgres.
- Use the built-in username/password API routes and local session storage.
- Use row-level security policies correctly.
- Keep server actions secure.
- Store uploaded assets in Supabase Storage if needed.
- Structure the app so the frontend reads and writes to Supabase cleanly.
- Make sure admin-only actions are protected properly.

Important behavior
- Nothing should count until verified, unless admin overrides it.
- Keep a full history of all results.
- Prevent duplicate or invalid challenge submissions.
- Enforce the 3-day cooldown after losing a challenge to the same opponent.
- Make the code modular and easy to expand later.

Implementation notes
- Build this as a complete working app, not just UI.
- Include backend logic, database structure, and frontend pages.
- Keep the code clean, maintainable, and well organized.
- Use sensible defaults and placeholder styling if needed.
- Add comments only where necessary.
- Prefer simple, practical solutions over overengineering.

Deliverable
Generate the project structure, main pages, Supabase schema, RLS policies, and core logic for the app so it can be used as a functional MVP.
## Troubleshooting: `ERR_NAME_NOT_RESOLVED` for Supabase

If browser logs show requests like `https://<project-ref>.supabase.co/... net::ERR_NAME_NOT_RESOLVED`, the app cannot resolve your Supabase host DNS.

Common causes:
- `NEXT_PUBLIC_SUPABASE_URL` points to the wrong project ref.
- The referenced Supabase project was deleted or never existed.
- Local/network DNS issues.

Quick checks:
1. Confirm `NEXT_PUBLIC_SUPABASE_URL` exactly matches your project URL from Supabase dashboard (`https://<project-ref>.supabase.co`).
2. Confirm the project is active in Supabase.
3. Redeploy/restart app after updating env vars.

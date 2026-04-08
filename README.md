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
- Supabase is used as the backend for database, auth, and storage where needed.
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
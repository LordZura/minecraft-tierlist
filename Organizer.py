from pathlib import Path

PROJECT_ROOT = Path("minecraft-pvp-tierlist")

FILES = {
    "app/layout.tsx": """// Global layout
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
""",
    "app/page.tsx": """// Home / Landing Page
export default function HomePage() {
  return <main>Home Page</main>;
}
""",
    "app/register/page.tsx": """// Register Page
export default function RegisterPage() {
  return <main>Register</main>;
}
""",
    "app/login/page.tsx": """// Login Page
export default function LoginPage() {
  return <main>Login</main>;
}
""",
    "app/rankings/page.tsx": """// Rankings Page
export default function RankingsPage() {
  return <main>Rankings</main>;
}
""",
    "app/profile/[username]/page.tsx": """// Profile Page
export default function ProfilePage() {
  return <main>Profile</main>;
}
""",
    "app/fight-log/page.tsx": """// Fight Log Page
export default function FightLogPage() {
  return <main>Fight Log</main>;
}
""",
    "app/challenge/page.tsx": """// Challenge Page
export default function ChallengePage() {
  return <main>Challenge</main>;
}
""",
    "app/notifications/page.tsx": """// Notifications Page
export default function NotificationsPage() {
  return <main>Notifications</main>;
}
""",
    "app/admin/page.tsx": """// Admin Page
export default function AdminPage() {
  return <main>Admin</main>;
}
""",
    "app/api/.gitkeep": "",
    "components/NavBar.tsx": """export function NavBar() {
  return <nav>NavBar</nav>;
}
""",
    "components/PlayerCard.tsx": """export function PlayerCard() {
  return <div>PlayerCard</div>;
}
""",
    "components/FightLogForm.tsx": """export function FightLogForm() {
  return <form>FightLogForm</form>;
}
""",
    "components/ChallengeForm.tsx": """export function ChallengeForm() {
  return <form>ChallengeForm</form>;
}
""",
    "components/NotificationList.tsx": """export function NotificationList() {
  return <div>NotificationList</div>;
}
""",
    "components/RankingTable.tsx": """export function RankingTable() {
  return <table><tbody /></table>;
}
""",
    "components/ProfileStats.tsx": """export function ProfileStats() {
  return <div>ProfileStats</div>;
}
""",
    "components/AdminPanel.tsx": """export function AdminPanel() {
  return <section>AdminPanel</section>;
}
""",
    "lib/supabaseClient.ts": """import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
""",
    "supabase/schema.sql": "-- Supabase schema goes here\n",
    "supabase/rls.sql": "-- Row-level security policies go here\n",
    "utils/ranking.ts": """export function calculatePoints() {
  return 0;
}
""",
    ".gitignore": """node_modules
.next
dist
build
.env
.env.local
""",
    "README.md": "# minecraft-pvp-tierlist\n",
}

DIRECTORIES = [
    "app/register",
    "app/login",
    "app/rankings",
    "app/profile/[username]",
    "app/fight-log",
    "app/challenge",
    "app/notifications",
    "app/admin",
    "app/api",
    "components",
    "lib",
    "supabase",
    "utils",
]

def create_project():
    PROJECT_ROOT.mkdir(parents=True, exist_ok=True)

    for directory in DIRECTORIES:
        (PROJECT_ROOT / directory).mkdir(parents=True, exist_ok=True)

    for relative_path, content in FILES.items():
        file_path = PROJECT_ROOT / relative_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        if not file_path.exists():
            file_path.write_text(content, encoding="utf-8")

    print(f"Project created at: {PROJECT_ROOT.resolve()}")

if __name__ == "__main__":
    create_project()
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, ensureAdmin, ensureSuperAdmin } from '@/lib/routeAuth';

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      is_admin: ensureAdmin(user),
      is_super_admin: ensureSuperAdmin(user),
    },
  });
}

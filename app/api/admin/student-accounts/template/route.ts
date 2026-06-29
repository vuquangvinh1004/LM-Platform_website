import { NextResponse } from "next/server";

import { requireRole } from "@/lib/services/auth-service";

export async function GET() {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return NextResponse.json({ message: profileResult.error.message }, { status: 403 });
  }

  const csvContent = "\uFEFFMã sinh viên,Họ và tên,Mật khẩu khởi tạo\r\n";

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"student-accounts-template.csv\"",
    },
  });
}

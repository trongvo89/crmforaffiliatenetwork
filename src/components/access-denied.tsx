import Link from "next/link";
import { ShieldOff } from "lucide-react";

export function AccessDenied({ label }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <ShieldOff className="h-8 w-8 text-red-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Không có quyền truy cập</h2>
        <p className="mt-1 text-sm text-gray-500">
          {label
            ? `Bạn chưa được cấp quyền xem "${label}".`
            : "Bạn chưa được cấp quyền xem trang này."}
        </p>
        <p className="mt-0.5 text-sm text-gray-400">
          Liên hệ Super Admin để được cấp quyền.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Về Dashboard
      </Link>
    </div>
  );
}

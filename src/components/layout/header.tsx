"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell } from "lucide-react";

interface HeaderProps {
  title: string;
  user?: { email?: string } | null;
}

export function Header({ title, user }: HeaderProps) {
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="relative rounded-full p-2 hover:bg-gray-100">
          <Bell className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-600 text-white text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-gray-700">{user?.email}</span>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Lỗi", description: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "staff" } },
    });
    if (error) {
      toast({ title: "Đăng ký thất bại", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Đăng ký thành công",
        description: "Vui lòng kiểm tra email để xác nhận tài khoản.",
      });
      router.push("/login");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="email@cityads.vn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          placeholder="Tối thiểu 8 ký tự"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Xác nhận mật khẩu</Label>
        <Input
          id="confirm"
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Đang đăng ký..." : "Đăng ký"}
      </Button>
      <p className="text-center text-sm text-gray-600">
        Đã có tài khoản?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
